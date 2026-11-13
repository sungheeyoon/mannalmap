import { BUTTON_OFF_OPACITY } from '@design';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  EMPTY_ANSWERS,
  IMPROVE_LABEL,
  IMPROVE_OPTIONS,
  LIKED_LABEL,
  LIKED_OPTIONS,
  PRICE_FACTORS,
  PRICE_FACTOR_LABEL,
  PRICE_LABEL,
  PRICE_NOTE,
  PRICE_OPTIONS,
  PRICE_STEM,
  PRICE_SUBJECT_LABEL,
  QUESTION,
  SOLE_CHOICES,
  SURVEY_COPY,
  TEXT_LIMIT,
  UNKNOWN_LABEL,
  UNKNOWN_OPTIONS,
  WANT_LABEL,
  WANT_NEW_LABEL,
  WANT_NEW_NOTE,
  WANT_NEW_OPTIONS,
  WANT_OPTIONS,
  afterPicking,
  draftSaver,
  surveyErrors,
  withoutHidden,
  type DraftState,
  type MySurvey,
  type PriceOption,
  type PriceSubject,
  type SurveyAnswers,
  type SurveyContext,
} from '@survey';

import { useClient } from '@/auth/connected';
import { UNREACHABLE } from '@/auth/signup';
import { FailureLine } from '@/ui/failure-line';
import { FieldErrorLine, FieldScrollView, invalidLabel, useFieldErrors } from '@/ui/field-error';
import { useLeaveGuard } from '@/ui/leave-guard';
import { LoadingDots } from '@/ui/loading';
import { CheckRow, PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { TopBar } from '@/ui/top-bar';
import { CardFrame, Paper } from '@/ui/surfaces';

import { AccountNotice, settingsText } from './parts';
import { setOptionalConsent } from './settings';
import { loadSurvey, saveSurvey, type Loaded } from './survey';
import { WordText } from '@/ui/word-text';

/** 서비스 설문 — 웹 `app/me/survey/` 와 같다. 어느 문항이 서는지는 DB 가 답한다(`service_survey_context`) */
export function SurveyScreen() {
  const client = useClient();
  const [data, setData] = useState<Loaded | null>(null);
  const reload = useCallback(async () => setData(await loadSurvey(client)), [client]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 여는 때 읽는다 - setState 는 await 뒤라 렌더와 겹치지 않는다
    void reload();
  }, [reload]);

  if (data === null) {
    return (
      <View style={styles.screen}>
        <TopBar title={SURVEY_COPY.title} fallback="/me/settings" />
        <LoadingDots />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopBar title={SURVEY_COPY.title} fallback="/me/settings" />
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <FieldScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {data.kind === 'blocked' ? (
            <AccountNotice state={data.state} onRetry={() => void reload()} />
          ) : (
            <>
              <Paper style={styles.header}>
                <WordText style={styles.intro}>{SURVEY_COPY.intro}</WordText>
                <WordText style={styles.editable}>{SURVEY_COPY.editable}</WordText>
              </Paper>
              {data.kind === 'failed' ? (
                <CardFrame style={styles.failed}>
                  <FailureLine onRetry={() => void reload()}>설문을 불러오지 못했어요.</FailureLine>
                </CardFrame>
              ) : data.context.consented ? (
                <SurveyForm context={data.context} given={data.given} />
              ) : (
                <CardFrame style={styles.section}>
                  <View style={styles.tight}>
                    <WordText style={settingsText.section}>먼저 동의가 필요합니다</WordText>
                    <WordText style={styles.sm}>{SURVEY_COPY.consentNeeded}</WordText>
                  </View>
                  <ConsentSwitch onDone={() => void reload()} />
                </CardFrame>
              )}
            </>
          )}
        </FieldScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** 여기서 켜는 단추 하나 — 문은 설정과 같다. 끄는 단추는 안 세운다(지움의 경고가 선 설정 화면의 일이다) */
function ConsentSwitch({ onDone }: { onDone: () => void }) {
  const client = useClient();
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const turnOn = async () => {
    setFailure(null);
    setSaving(true);
    const result = await setOptionalConsent(client, true);
    setSaving(false);
    if (result.ok) onDone();
    else setFailure(result.message);
  };
  return (
    <View style={styles.consent}>
      <PrimaryButton label={saving ? '켜는 중…' : '동의하고 설문 열기'} onPress={() => void turnOn()} disabled={saving} />
      <WordText style={styles.small}>설정 화면에서 언제든 다시 끄실 수 있습니다. 끄시면 지금까지 남기신 설문 답도 함께 지웁니다.</WordText>
      {failure !== null && <FailureLine>{failure}</FailureLine>}
    </View>
  );
}

/**
 * 쓰는 동안 저절로 남고, 제출은 손으로 한다. 숨은 문항은 보내기 전에 비운다 — 웹 `form.tsx`. 초안의 차례는 웹과 한 벌(`draftSaver`):
 * 떠나려 하면 안 간 고침을 먼저 넣어 보고 못 넣었을 때만 묻는다. 제출은 초안과 한 줄에 선다. 보내는 동안 칸이 잠긴다(2026-11-09).
 */
function SurveyForm({ context, given }: { context: SurveyContext; given: MySurvey | null }) {
  const client = useClient();
  const [answers, setAnswers] = useState<SurveyAnswers>(given?.answers ?? EMPTY_ANSWERS);
  const [submittedAt, setSubmittedAt] = useState<string | null>(given?.submittedAt ?? null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftState>('idle');
  const [unsaved, setUnsaved] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  /* 단추를 잠그지 않는다 — 아무것도 안 답하고 누르면 첫 문항이 붉고 거기로 데려간다(ADR 0252, 웹과 같다) */
  const checks = useFieldErrors(surveyErrors(answers));
  const [saver] = useState(() =>
    draftSaver<SurveyAnswers>({
      initial: given?.answers ?? EMPTY_ANSWERS,
      save: async (value) => (await settled(saveSurvey(client, value, false), 'survey draft', () => ({ ok: false, message: UNREACHABLE }) as const)).ok,
      onState: (state, left) => {
        setDraft(state);
        setUnsaved(left);
      },
    }),
  );
  const { readSolo, readPair } = context;
  const shown = useMemo(() => ({ readSolo, readPair }), [readSolo, readPair]);
  const open = submittedAt === null || editing;

  useEffect(() => {
    if (open) saver.edit(withoutHidden(answers, shown));
  }, [saver, answers, open, shown]);

  /* 앱이 뒤로 가면 안 간 고침을 곧바로 — 전에는 타이머만 지워 1.2초 안에 떠난 고침이 안 갔다. 닫힐 때도 한 번 더(막기를 지나 사라진 때) */
  useEffect(() => {
    const away = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void saver.flush();
    });
    return () => {
      away.remove();
      void saver.flush();
    };
  }, [saver]);
  /*
    **안 간 고침이 있으면 떠나는 몸짓을 붙들고 먼저 넣어 본다**(`settle`) — 넣으면 묻지 않고 떠나고, 못 넣으면 확인창이 선다. 기다리는 중 ·
    보내는 중 · 제출 중이 모두 「안 간 고침」이다(`saver.unsaved`) — 제출 중에 떠나도 제출이 닿기를 기다린다.
  */
  const { dialog } = useLeaveGuard({ edited: unsaved, saving: false, settle: saver.flush });

  const send = async () => {
    setFailure(null);
    if (!checks.press()) return;
    setSending(true);
    const value = withoutHidden(answers, shown);
    /* 제출도 초안과 같은 줄에 선다 — 떠난 초안이 닿은 뒤에 떠나고, 그 사이 기다리던 초안은 걷힌다 */
    const result = await saver.submit(value, (answers) => settled(saveSurvey(client, answers, true), 'survey submit', () => ({ ok: false, message: UNREACHABLE }) as const));
    setSending(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    setSubmittedAt(result.submittedAt);
    setEditing(false);
  };

  if (!open) {
    return (
      <CardFrame style={styles.section}>
        <View style={styles.tight}>
          <WordText style={settingsText.section}>{SURVEY_COPY.thanks}</WordText>
          <WordText style={styles.sm}>{SURVEY_COPY.editable}</WordText>
        </View>
        <SecondaryButton label="답 고치기" onPress={() => setEditing(true)} />
      </CardFrame>
    );
  }

  const pick = <K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) => setAnswers((now) => ({ ...now, [key]: value }));
  const asked: PriceSubject[] = [...(context.readSolo ? (['solo'] as const) : []), ...(context.readPair ? (['pair'] as const) : [])];
  const total = asked.length > 0 ? 7 : 5;
  const step = (n: number) => `${n}/${total}`;
  const both = `${SURVEY_COPY.multiple} · ${SURVEY_COPY.optional}`;

  return (
    <View style={styles.form}>
      {dialog}
      <WordText style={styles.meta}>{SURVEY_COPY.autosave}</WordText>

      <Picks disabled={sending} step={step(1)} question={QUESTION.liked} hint={SURVEY_COPY.multiple} options={LIKED_OPTIONS} label={LIKED_LABEL} sole={SOLE_CHOICES.liked} picked={answers.liked} onPick={(next) => pick('liked', next)} error={checks.messageOf('liked')} anchor={checks.anchor('liked')} />
      <Picks disabled={sending} step={step(2)} question={QUESTION.unknown} hint={both} options={UNKNOWN_OPTIONS} label={UNKNOWN_LABEL} sole={SOLE_CHOICES.unknown} picked={answers.unknown} onPick={(next) => pick('unknown', next)} />
      <Picks disabled={sending} step={step(3)} question={QUESTION.improve} hint={SURVEY_COPY.multiple} options={IMPROVE_OPTIONS} label={IMPROVE_LABEL} sole={SOLE_CHOICES.improve} picked={answers.improve} onPick={(next) => pick('improve', next)}>
        <Writing disabled={sending} label={QUESTION.improveText} limit={TEXT_LIMIT.improve} value={answers.improveText} onChange={(next) => pick('improveText', next)} ruled />
      </Picks>
      <Picks disabled={sending} step={step(4)} question={QUESTION.wants} hint={SURVEY_COPY.multiple} options={WANT_OPTIONS} label={WANT_LABEL} sole={SOLE_CHOICES.wants} picked={answers.wants} onPick={(next) => pick('wants', next)}>
        <Picks disabled={sending} question={QUESTION.wantsNew} hint={both} note={WANT_NEW_NOTE} options={WANT_NEW_OPTIONS} label={WANT_NEW_LABEL} sole={SOLE_CHOICES.wantsNew} picked={answers.wantsNew} onPick={(next) => pick('wantsNew', next)} nested />
      </Picks>

      {asked.length > 0 && (
        <CardFrame style={styles.panel}>
          <WordText style={styles.step}>{step(5)}</WordText>
          <WordText style={styles.ask}>{PRICE_STEM}</WordText>
          <WordText style={styles.small}>{PRICE_NOTE}</WordText>
          {asked.map((subject) => {
            const key = subject === 'solo' ? 'priceSolo' : 'pricePair';
            return (
              <View key={subject} style={styles.ruled}>
                <WordText style={styles.subject}>{PRICE_SUBJECT_LABEL[subject]}</WordText>
                <View accessibilityRole="radiogroup" style={styles.options}>
                  {PRICE_OPTIONS.map((option) => {
                    const on = answers[key] === option;
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled: sending }}
                        disabled={sending}
                        /* 잘못 고른 값을 지울 길 — 같은 것을 다시 누르면 풀린다 */
                        onPress={() => pick(key, on ? null : (option as PriceOption))}
                        style={[styles.radio, on && styles.radioOn, sending && !on && styles.off]}
                      >
                        <View style={[styles.dot, on && styles.dotOn]}>{on && <View style={styles.dotInner} />}</View>
                        <WordText style={styles.choice}>{PRICE_LABEL[option]}</WordText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </CardFrame>
      )}

      {asked.length > 0 && <Picks disabled={sending} step={step(6)} question={QUESTION.priceFactors} hint={both} options={PRICE_FACTORS} label={PRICE_FACTOR_LABEL} sole={[]} picked={answers.priceFactors} onPick={(next) => pick('priceFactors', next)} />}

      <CardFrame style={styles.panel}>
        <WordText style={styles.step}>{step(total)}</WordText>
        <Writing disabled={sending} label={QUESTION.freeText} limit={TEXT_LIMIT.free} value={answers.freeText} onChange={(next) => pick('freeText', next)} />
      </CardFrame>

      <View style={styles.send}>
        <WordText style={styles.small}>{SURVEY_COPY.drafting}</WordText>
        <PrimaryButton label={submittedAt === null ? SURVEY_COPY.submit : SURVEY_COPY.resubmit} onPress={() => void send()} disabled={sending} />
        <DraftMark state={draft} />
        {failure !== null && <FailureLine>{failure}</FailureLine>}
      </View>
    </View>
  );
}

function DraftMark({ state }: { state: DraftState }) {
  if (state === 'idle') return null;
  if (state === 'failed') return <WordText style={styles.draftFailed}>{`${SURVEY_COPY.draftFailed} 답을 다시 고치면 한 번 더 저장해 볼게요.`}</WordText>;
  return <WordText style={styles.small}>{state === 'saving' ? '임시 저장하는 중…' : SURVEY_COPY.draftSaved}</WordText>;
}

function Picks<T extends string>({
  step,
  question,
  hint,
  note,
  options,
  label,
  sole,
  picked,
  onPick,
  nested = false,
  disabled,
  error = null,
  anchor,
  children,
}: {
  step?: string;
  question: string;
  hint: string;
  note?: string;
  options: readonly T[];
  label: Record<T, string>;
  sole: readonly string[];
  picked: readonly T[];
  onPick: (next: T[]) => void;
  nested?: boolean;
  disabled: boolean;
  /** 누른 뒤 이 문항 아래에 설 붉은 말(ADR 0252) — 고르는 줄의 테가 붉고 읽어 주는 이름에 실린다 */
  error?: string | null;
  /** 누른 뒤 데려갈 자리 — `useFieldErrors` 의 `anchor` */
  anchor?: ReturnType<ReturnType<typeof useFieldErrors>['anchor']>;
  children?: ReactNode;
}) {
  const body = (
    <>
      {step !== undefined && <WordText style={styles.step}>{step}</WordText>}
      <WordText style={nested ? styles.nestedAsk : styles.ask}>{question}</WordText>
      <WordText style={styles.small}>{hint}</WordText>
      {note !== undefined && <WordText style={styles.small}>{note}</WordText>}
      <View style={styles.options}>
        {options.map((option) => (
          <CheckRow key={option} disabled={disabled} refused={error !== null} checked={picked.includes(option)} onToggle={() => onPick(afterPicking(picked, option, sole))}>
            <WordText accessibilityLabel={invalidLabel(label[option], error)} style={styles.choice}>{label[option]}</WordText>
          </CheckRow>
        ))}
      </View>
      <FieldErrorLine message={error} />
      {children}
    </>
  );
  return nested ? <View style={styles.ruled}>{body}</View> : <View ref={anchor}><CardFrame style={styles.panel}>{body}</CardFrame></View>;
}

function Writing({ label, limit, value, onChange, disabled, ruled = false }: { label: string; limit: number; value: string; onChange: (next: string) => void; disabled: boolean; ruled?: boolean }) {
  return (
    <View style={ruled ? styles.ruled : styles.writing}>
      <WordText style={styles.subject}>{label}</WordText>
      <WordText style={styles.small}>{`${SURVEY_COPY.optional} · 최대 ${limit}자`}</WordText>
      <TextInput accessibilityLabel={label} multiline value={value} maxLength={limit} onChangeText={onChange} editable={!disabled} accessibilityState={{ disabled }} style={[styles.area, disabled && styles.off]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 16, padding: 16, paddingBottom: 40 },
  header: { gap: 8 },
  intro: { fontSize: TYPE.body, lineHeight: 26, fontFamily: FONT.medium, color: COLOR.creamInk },
  editable: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.creamInk },
  section: { gap: 16, padding: 20 },
  tight: { gap: 4 },
  sm: { fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.secondary },
  consent: { gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  small: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.muted },
  meta: { paddingHorizontal: 4, fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  form: { gap: 20 },
  panel: { gap: 12, padding: 20 },
  step: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.bold, color: COLOR.muted },
  ask: { fontSize: TYPE.lead, lineHeight: 26, fontFamily: FONT.bold, color: COLOR.foreground },
  nestedAsk: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  subject: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  options: { gap: 8 },
  choice: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.foreground },
  ruled: { gap: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  writing: { gap: 8 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  radioOn: { borderColor: COLOR.foreground, backgroundColor: COLOR.cream },
  dot: { width: 20, height: 20, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  dotOn: { borderColor: COLOR.accent },
  dotInner: { width: 10, height: 10, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  area: { minHeight: 112, paddingHorizontal: 16, paddingVertical: 12, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface, fontFamily: FONT.medium, fontSize: TYPE.field, lineHeight: 24, color: COLOR.foreground, textAlignVertical: 'top' },
  send: { gap: 12, paddingHorizontal: 4 },
  draftFailed: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.bold, color: COLOR.danger },
  failed: { padding: 20 },
  off: { opacity: BUTTON_OFF_OPACITY },
});
