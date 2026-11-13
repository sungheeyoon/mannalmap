import { RELATIONS, RELATION_LABEL, RELATION_NONE_LABEL, type Relation } from '@people';
import type { ReadingCredits } from '@reading/credits';
import { READING_NOUN } from '@reading/notes';
import {
  COMPAT_ASK_CONFIRM,
  PARTNER_SELF_LABEL,
  PARTNER_TYPED_LABEL,
  READING_ASK_CONFIRM,
  askSheetShape,
  partnerAskTitle,
  readingAskTitle,
  relationAskTitle,
  type AskSheetShape,
} from '@reading/person-screen';
import type { Element, Stem } from '@saju';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useClient } from '@/auth/connected';
import { readPicker, openPair, readPairRelation, type Choosable } from '@/compat/data';
import { askOnFirstReading } from '@/push/device';
import { newRequestKey, startReading, type ReadingTarget } from '@/reading/api';
import { storeAvailable } from '@/credits/store';
import { useBuyCredits } from '@/reading/dialogs';
import { followRefusal } from '@/reading/panel';
import { Button } from '@/ui/buttons';
import { ElementSymbol } from '@/ui/element-symbol';
import { FailureLine } from '@/ui/failure-line';
import { Icon } from '@/ui/icons';
import { DetailSheet } from '@/ui/sheet';
import { StemSymbol } from '@/ui/stem-symbol';
import { settled } from '@/ui/settled';
import { WordText } from '@/ui/word-text';
import { COLOR, CONTROL, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { UNREACHABLE } from '@/auth/signup';

import { go } from './parts';

/*
  **저장한 사람 화면의 누름 둘 — 그 자리의 시트에서 끝난다**(운영자 승인 2026-11-13, ADR 0249 · 웹 `app/me/people/[personId]/person-sheets.tsx`).
  만들기는 같은 문(`startReading`), 두 사람 열기도 같은 문(`openPair`). **풀이권이 0장이면 시트가 곧 구매 입구다**(운영자 승인 2026-11-13, ADR 0251 —
  꼴은 `askSheetShape`): [풀이권 구매]는 다시 열 물음(`?ask=…`)을 싣고 풀이권 화면으로 가고, 결제 완료 창이 돌려보내면 사람 화면이 같은 시트를
  다시 연다(`resume`). 받기를 저절로 시작하지는 않는다.
*/

type Started = { kind: 'opened' } | { kind: 'out-of-credits' } | { kind: 'failed'; message: string };

/** 시도를 연다 — 풀이 화면의 누름(`use-reading-panel.ts`)과 같은 갈래로 답을 가른다. 열었으면 다 되면 알려 줄지 처음 묻는다(ADR 0236) */
async function start(client: ReturnType<typeof useClient>, target: ReadingTarget): Promise<Started> {
  const answer = await settled(startReading(client, target, newRequestKey()), 'startReading', () => ({ ok: false, refused: { refused: 'unavailable', message: UNREACHABLE } }) as const);
  if (!answer.ok) {
    if (answer.refused.refused === 'unavailable') return { kind: 'failed', message: answer.refused.message };
    followRefusal(answer.refused);
    return { kind: 'failed', message: UNREACHABLE };
  }
  const result = answer.value;
  if (result.ok) {
    void askOnFirstReading(client);
    return { kind: 'opened' };
  }
  return result.outOfCredits ? { kind: 'out-of-credits' } : { kind: 'failed', message: result.message };
}

/**
 * 확인 시트의 몸 — 풀이권 줄 · 실패 한 줄 · 단추(웹의 `AskBody`). 예약 줄 · 돌려준다는 줄은 두지 않는다(운영자 2026-11-13). 줄과 단추는
 * `askSheetShape` 의 꼴이다 — 쓰는 꼴은 [받기] · [궁합 보기] / [취소], 0장은 [풀이권 구매] / [취소], 살 수 없으면 [확인] 하나
 */
function AskBody({
  shape,
  failure,
  busy,
  confirmLabel,
  onConfirm,
  onBuy,
  onCancel,
  children,
}: {
  shape: AskSheetShape;
  failure: string | null;
  busy: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onBuy: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={styles.body}>
      {children}
      <View style={styles.costLines}>
        {shape.lines.map((line, nth) => (
          <WordText key={line} style={nth === 0 ? styles.cost : styles.costNote}>
            {line}
          </WordText>
        ))}
      </View>
      {failure !== null && <FailureLine>{failure}</FailureLine>}
      <View style={styles.lines}>
        {shape.kind === 'use' ? (
          <Button label={confirmLabel} onPress={onConfirm} busy={busy} />
        ) : (
          <Button label={shape.confirmLabel} onPress={shape.kind === 'buy' ? onBuy : onCancel} accessibilityRole={shape.kind === 'buy' ? 'link' : 'button'} />
        )}
        {shape.cancelLabel !== null && <Button label={shape.cancelLabel} variant="secondary" onPress={onCancel} />}
      </View>
    </View>
  );
}

/**
 * 「사주풀이 받기」의 확인 시트 — 여는 것은 진한 카드의 단추(`open`)와, 사고 돌아온 사람 화면(`open` 을 다시 부른다). [받기]는 곧장 기다리는
 * 화면(그 사람의 풀이 화면)으로
 */
export function useReadingAsk({ name, target, readingHref, credits }: { name: string; target: ReadingTarget; readingHref: string; credits: ReadingCredits | null }) {
  const client = useClient();
  const goBuy = useBuyCredits();
  const [asking, setAsking] = useState(false);
  /** 눌렀는데 문이 「풀이권이 없다」고 답했다 — 시트가 구매 꼴로 바뀐다 */
  const [spent, setSpent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shape = askSheetShape(credits, { spent, canBuy: storeAvailable });

  const open = () => {
    setSpent(false);
    setFailure(null);
    setAsking(true);
  };
  const buy = () => {
    setAsking(false);
    goBuy(READING_NOUN.person, { kind: 'reading' });
  };

  const confirm = async () => {
    setBusy(true);
    const started = await start(client, target);
    setBusy(false);
    if (started.kind === 'opened') {
      setAsking(false);
      go(readingHref);
    } else if (started.kind === 'out-of-credits') setSpent(true);
    else setFailure(started.message);
  };

  const sheets = (
    <DetailSheet wrapTitle open={asking} title={readingAskTitle(name)} onClose={() => setAsking(false)}>
      <AskBody
        shape={shape}
        failure={failure}
        busy={busy}
        confirmLabel={READING_ASK_CONFIRM}
        onConfirm={() => void confirm()}
        onBuy={buy}
        onCancel={() => setAsking(false)}
      />
    </DetailSheet>
  );
  return { open, sheets };
}

/** 고를 수 있는 상대 — 궁합 탭의 고르는 칸과 같은 사람들, 이 사람만 빠진다. 이미 본 궁합이 있으면 그 궁합으로 간다 */
type Partner = Choosable & { readonly seenHref: string | null };

function Face({ stem, element }: { stem: Stem | null; element: Element | null }) {
  return (
    <View style={[styles.face, { backgroundColor: element === null ? COLOR.noneSoft : ELEMENT_TONE[element].soft }]}>
      {stem !== null ? <StemSymbol stem={stem} size={24} /> : <ElementSymbol element={element} size={24} />}
    </View>
  );
}

/**
 * **「+ 다른 사람과 궁합 보기」의 시트 둘** — 「누구를 볼까요?」(나 · 저장한 사람 · 직접 입력) → 「어떤 사이예요?」 → [궁합 보기] → 기다림 →
 * 궁합 결과. 결과는 이 화면 위에 쌓이고(`/me/readings/compat`) 뒤로 가면 이 사람 화면이다. 직접 입력은 궁합 탭의 적는 칸으로 간다 — 이 사람이 첫 칸에 앉은 채.
 */
export function useCompatAdd({
  person,
  seen,
  credits,
}: {
  person: { personId: string; name: string };
  /** 이 사람과 이미 본 궁합 — 상대 id → 그 궁합의 주소 */
  seen: ReadonlyMap<string, string>;
  credits: ReadingCredits | null;
}) {
  const client = useClient();
  const goBuy = useBuyCredits();
  /** 시트 하나가 두 걸음을 든다 — 「누구를」 다음 「어떤 사이」. 뜨는 판을 바꿔 띄우면 iOS 가 뒤의 것을 못 띄운다 */
  const [step, setStep] = useState<'pick' | 'ask' | null>(null);
  const [partners, setPartners] = useState<readonly Partner[] | null>(null);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [relation, setRelation] = useState<Relation | null>(null);
  /** 사이를 건드렸나 — 안 건드린 「선택 안 함」을 답으로 보내면 적어 둔 답이 지워진다(`openPair`) */
  const touched = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 눌렀는데 문이 「풀이권이 없다」고 답했다 — 시트가 구매 꼴로 바뀐다 */
  const [spent, setSpent] = useState(false);
  const shape = askSheetShape(credits, { spent, canBuy: storeAvailable });

  /** 고를 사람을 읽는다 — 다시 열 때(`resume`)는 그 목록에서 상대를 찾는다. 못 읽었으면 `null` */
  const load = async (): Promise<readonly Partner[] | null> => {
    setLoadFailure(null);
    const read = await settled(readPicker(client), 'readPicker', () => ({ kind: 'failed', message: UNREACHABLE }) as const);
    if (read.kind === 'ok') {
      const next = read.value.people.filter((one) => one.personId !== person.personId).map((one) => ({ ...one, seenHref: seen.get(one.personId) ?? null }));
      setPartners(next);
      return next;
    }
    if (read.kind === 'failed') setLoadFailure(read.message);
    return null;
  };

  const open = () => {
    setPartner(null);
    setStep('pick');
    void load();
  };
  const close = () => setStep(null);

  const choose = (next: Partner) => {
    if (next.seenHref !== null) {
      close();
      go(next.seenHref);
      return;
    }
    setPartner(next);
    setRelation(null);
    touched.current = false;
    setFailure(null);
    setSpent(false);
    setStep('ask');
    /* 적어 둔 사이를 칸에 세운다 — 못 읽었으면 칸을 안 건드린다 */
    void settled(readPairRelation(client, person.personId, next.personId), 'pair_relation_of', () => ({ ok: false }) as const).then((stored) => {
      if (stored.ok && !touched.current) setRelation(stored.relation);
    });
  };

  /**
   * 사고 돌아왔다 — 같은 상대 · 사이를 고른 채 「어떤 사이예요?」를 다시 연다. 사이를 건드렸으면 그 답이 선다(`picked`), 아니면 적어 둔 사이를 읽는다.
   * 상대가 목록에 없으면(그새 지웠다) 「누구를 볼까요?」부터다
   */
  const resume = async (partnerId: string, picked: Relation | null | undefined) => {
    const list = await load();
    const found = list?.find((one) => one.personId === partnerId) ?? null;
    if (found === null) {
      open();
      return;
    }
    choose(found);
    if (picked !== undefined) {
      touched.current = true;
      setRelation(picked);
    }
  };

  const buy = () => {
    if (partner === null) return;
    close();
    goBuy(READING_NOUN.private, { kind: 'compat', partnerId: partner.personId, relation: touched.current ? relation : undefined });
  };

  const confirm = async () => {
    if (partner === null) return;
    setBusy(true);
    const opened = await settled(
      openPair(client, { from: 'saved', personId: person.personId }, { from: 'saved', personId: partner.personId }, touched.current ? relation : undefined),
      'openPair',
      () => ({ ok: false, kind: 'failed', message: UNREACHABLE }) as const,
    );
    if (!opened.ok) {
      setBusy(false);
      setFailure(opened.kind === 'failed' ? opened.message : UNREACHABLE);
      return;
    }
    const started = await start(client, { kind: 'private', personA: opened.personA, personB: opened.personB });
    setBusy(false);
    if (started.kind === 'opened') {
      close();
      go(`/me/readings/compat?a=${opened.personA}&b=${opened.personB}`);
    } else if (started.kind === 'out-of-credits') setSpent(true);
    else setFailure(started.message);
  };

  const partnerName = partner === null ? '' : partner.isSelfPerson ? PARTNER_SELF_LABEL : partner.label;

  const sheets = (
    <>
      <DetailSheet wrapTitle open={step !== null} title={step === 'ask' ? relationAskTitle(person.name, partnerName) : partnerAskTitle(person.name)} onClose={close}>
        {step === 'ask' ? (
          <AskBody shape={shape} failure={failure} busy={busy} confirmLabel={COMPAT_ASK_CONFIRM} onConfirm={() => void confirm()} onBuy={buy} onCancel={close}>
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {[...RELATIONS, null].map((choice) => {
                const picked = relation === choice;
                return (
                  <Pressable
                    key={choice ?? 'none'}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: picked }}
                    onPress={() => {
                      touched.current = true;
                      setRelation(choice);
                    }}
                    style={[styles.chip, picked && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, picked && styles.chipTextOn]}>{choice === null ? RELATION_NONE_LABEL : RELATION_LABEL[choice]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </AskBody>
        ) : (
          <View>
            {loadFailure !== null && <FailureLine onRetry={() => void load()}>{loadFailure}</FailureLine>}
            {(partners ?? []).map((one) => (
              <Pressable key={one.personId} accessibilityRole="button" onPress={() => choose(one)} style={styles.row}>
                <Face stem={one.stem} element={one.element} />
                <Text style={styles.rowText} numberOfLines={1}>{one.isSelfPerson ? PARTNER_SELF_LABEL : one.label}</Text>
                <Icon name="chevron" size={16} color={COLOR.muted} />
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                close();
                go(`/me/compat?pickA=${person.personId}&typeB=1`);
              }}
              style={styles.row}
            >
              <View style={[styles.face, { backgroundColor: COLOR.surfaceSunken }]}>
                <Icon name="plus" size={16} color={COLOR.secondary} />
              </View>
              <Text style={styles.rowText} numberOfLines={1}>{PARTNER_TYPED_LABEL}</Text>
              <Icon name="chevron" size={16} color={COLOR.muted} />
            </Pressable>
          </View>
        )}
      </DetailSheet>
    </>
  );
  return { open, resume: (partnerId: string, picked: Relation | null | undefined) => void resume(partnerId, picked), sheets };
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  lines: { gap: 8 },
  costLines: { gap: 2 },
  cost: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 22, color: COLOR.foreground },
  costNote: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 22, color: COLOR.secondary },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  face: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  /* 같은 너비의 2열 — 궁합 탭의 사이 칸과 같다(`compat/picker.tsx`) */
  chip: { flexBasis: '40%', flexGrow: 1, minHeight: CONTROL, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  chipOn: { borderColor: COLOR.borderStrong, backgroundColor: COLOR.accentWash },
  chipText: { textAlign: 'center', fontSize: TYPE.note, fontFamily: FONT.medium, color: COLOR.secondary },
  chipTextOn: { fontFamily: FONT.bold, color: COLOR.foreground },
});
