import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SIGN_OUT_PENDING } from '@account/copy';
import { mayRequestDeletion } from '@account/index';
import { safeReturnPath } from '@consent/return-path';
import { NOTICE_ACK_LABEL, NOTICE_ACK_NOTE, OPTIONAL_CONSENTS, OPTIONAL_CONSENT_NOTE } from '@consent/notice';
import {
  SIGNUP_AGE_LABEL,
  SIGNUP_HEAD,
  SIGNUP_LABEL,
  SIGNUP_NOTICE_DISCOVERY,
  SIGNUP_NOTICE_KEEP,
  SIGNUP_NOTICE_USE,
  signupGap,
  type SignupField,
} from '@consent/signup';
import { NICKNAME_AVAILABLE_NOTE, NICKNAME_MAX, NICKNAME_MIN, NICKNAME_TAKEN_NOTE, missingNickname, nicknameKey } from '@profile';

import { ConnectedClient, useClient } from '@/auth/connected';
import { supabase } from '@/auth/client';
import { arriveAt } from '@/auth/arrive';
import { MatchingSteps } from '@/auth/matching-steps';
import { signOut } from '@/auth/sign-in';
import { checkNickname, completeSignup, NOT_READY, readSignup, UNREACHABLE, type SignupState } from '@/auth/signup';
import { RequestDeletion } from '@/settings/leaving';
import { legalPagesOpen, openLegalPage } from '@/info/legal-web';
import { AccountNotice } from '@/settings/parts';
import { LoadingDots } from '@/ui/loading';
import { Logo } from '@/ui/logo';
import { FailureLine } from '@/ui/failure-line';
import { CheckRow, Field, FieldLabel, PrimaryButton, SecondaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { goBack } from '@/ui/top-bar';
import { Card, CardFrame, Paper, Tile } from '@/ui/surfaces';

const SIGN_OUT_FAILED = '로그아웃하지 못했어요. 다시 시도해 주세요.';

/**
 * 가입 — 웹의 `/signup` 과 같은 한 폼이다(ADR 0042). 마치면 이 자리를 들고 온 목적지 `next` 로 갈아 끼운다(ADR 0128 · 0213).
 */
export default function SignupScreen() {
  /* 가입은 `/me` 밖이라 이 화면이 껍데기다 — 주소 · 공개 키가 없는 빌드는 그 까닭만 말하고, 아래는 연결된 클라이언트만 본다(ADR 0243) */
  if (supabase === null) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Text style={styles.line}>{NOT_READY}</Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <ConnectedClient client={supabase}>
      <Signup />
    </ConnectedClient>
  );
}

function Signup() {
  const client = useClient();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [state, setState] = useState<SignupState | null>(null);
  const finish = () => arriveAt(safeReturnPath(next));

  /* 탈퇴를 신청하면 다시 읽는다 — 폼 대신 탈퇴 대기 안내가 선다 */
  const [reads, setReads] = useState(0);
  useEffect(() => {
    let live = true;
    void settled(readSignup(client), 'readSignup', () => ({ kind: 'failed', message: UNREACHABLE }) as const).then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [client, reads]);

  useEffect(() => {
    if (state?.kind === 'done') finish();
    if (state?.kind === 'closed') router.replace('/closed');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 끝났다는 답에 한 번 간다
  }, [state?.kind]);

  /* 첫 읽기 동안은 판과 오행 다섯 점만 — 안 된다는 말과 폼이 번갈아 비치지 않게. 끝나 떠나는 동안은 판만 */
  if (state === null || state.kind === 'done' || state.kind === 'closed') {
    return <SafeAreaView style={styles.screen}>{state === null && <LoadingDots />}</SafeAreaView>;
  }

  const head = state.kind === 'form' && state.again ? SIGNUP_HEAD.again : SIGNUP_HEAD.first;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Paper style={styles.head}>
            <Logo size={44} />
            <Text style={styles.eyebrow}>{head.eyebrow}</Text>
            <Text style={styles.title}>{head.title}</Text>
            <Text style={styles.headNote}>{head.note}</Text>
          </Paper>

          {/* 다시 동의하는 사람은 가입을 이미 마쳤다 — 첫 가입에만 남은 단계를 말한다 */}
          {state.kind === 'form' && !state.again && safeReturnPath(next).startsWith('/me/matching') && <MatchingSteps done={['sign-in']} />}

          {state.kind === 'form' ? (
            <SignupForm form={state} onDone={finish} />
          ) : state.kind === 'halted' ? (
            <AccountNotice state={state.account} onRetry={() => setReads((n) => n + 1)} />
          ) : state.kind === 'failed' || (state.kind === 'blocked' && state.unread) ? (
            /* 계정 · 일정을 못 읽은 것은 실패 줄이다 — 로그아웃하지 않고 같은 읽기를 다시 한다. 일정이 없는 것(`NOTICE_NOT_READY`)은 다시 읽어도 같아 카드다 */
            <FailureLine onRetry={() => setReads((n) => n + 1)}>{state.message}</FailureLine>
          ) : (
            <Card>
              <Text style={styles.line}>{state.message}</Text>
            </Card>
          )}

          <LeaveLink />
          {/*
            가입을 안 마친 계정도 계정이다 — 앱 스토어의 계정 삭제 요건은 이 계정도 앱 안에서 지울 길을 요구하고, 이 사람에게 설정은
            닫혀 있다. 설정 맨 아래와 같은 말 · 같은 확인 창이다(ADR 0218). 못 읽은 상태에는 세우지 않는다 — 무엇을 지울지 모른다
          */}
          {(state.kind === 'form' || state.kind === 'blocked' || (state.kind === 'halted' && mayRequestDeletion(state.account))) && (
            <RequestDeletion onDone={() => setReads((n) => n + 1)} style={styles.deletion} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignupForm({ form, onDone }: { form: Extract<SignupState, { kind: 'form' }>; onDone: () => void }) {
  const client = useClient();
  const { needsName, again, scheduleId } = form;
  const [nickname, setNickname] = useState('');
  const [fourteen, setFourteen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [chosen, setChosen] = useState<Record<string, boolean>>({ improvement: false });
  const [failure, setFailure] = useState<{ message: string; field: SignupField | null } | null>(null);
  const [working, setWorking] = useState(false);
  const [checked, setChecked] = useState<{ key: string; available: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkTried, setCheckTried] = useState(false);
  const [tried, setTried] = useState(false);
  const nicknameField = useRef<ComponentRef<typeof TextInput>>(null);

  const missing = needsName ? missingNickname(nickname) : null;
  const answer = checked?.key === nicknameKey(nickname) ? checked : null;
  /* 단추를 잠그지 않고, 누르면 처음 걸린 칸 하나를 말한다 — 웹과 같다 */
  const gap = signupGap({ nicknameGap: missing, fourteen, acknowledged });
  const shownGap = tried ? gap : null;
  const refusedHere = (field: SignupField) => failure?.field === field;
  /* 칸은 닉네임 하나다 — 테스트 코드 칸은 걷었다(ADR 0225) */
  const focusName = () => nicknameField.current?.focus();

  const check = async () => {
    if (missing !== null) {
      setCheckTried(true);
      nicknameField.current?.focus();
      return;
    }
    setCheckTried(false);
    setFailure(null);
    setChecking(true);
    const result = await checkNickname(client, nickname);
    setChecking(false);
    if (result.ok) setChecked({ key: nicknameKey(nickname), available: result.available });
    else setFailure({ message: result.message, field: 'nickname' });
  };

  const send = async () => {
    setFailure(null);
    if (gap !== null) {
      setTried(true);
      if (gap.field === 'nickname') focusName();
      return;
    }
    setTried(false);
    setWorking(true);
    const result = await completeSignup(client, {
      nickname,
      scheduleId,
      improvement: chosen.improvement === true,
    });
    setWorking(false);
    if (result.ok) {
      onDone();
      return;
    }
    setFailure({ message: result.message, field: result.field });
    if (result.field !== null) focusName();
  };

  return (
    <CardFrame style={styles.form}>
      {needsName && (
        <View style={styles.group}>
          <FieldLabel>{SIGNUP_LABEL.nickname}</FieldLabel>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Field
                inputRef={nicknameField}
                label={SIGNUP_LABEL.nickname}
                value={nickname}
                maxLength={NICKNAME_MAX}
                autoCapitalize="none"
                placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
                refused={shownGap?.field === 'nickname' || refusedHere('nickname') || (checkTried && missing !== null)}
                onChange={(typed) => {
                  setNickname(typed);
                  if (failure?.field === 'nickname') setFailure(null);
                }}
              />
            </View>
            <SecondaryButton label={checking ? SIGNUP_LABEL.checking : SIGNUP_LABEL.check} onPress={check} disabled={checking} />
          </View>
          {answer !== null && (
            <Text style={answer.available ? styles.note : styles.failure}>
              {answer.available ? NICKNAME_AVAILABLE_NOTE : NICKNAME_TAKEN_NOTE}
            </Text>
          )}
          {checkTried && missing !== null && <Text style={styles.failure}>{missing}</Text>}
          {refusedHere('nickname') && <Text style={styles.failure}>{failure?.message}</Text>}
          <Text style={styles.fine}>{SIGNUP_LABEL.nicknameNote}</Text>
        </View>
      )}

      <Tile tone={COLOR.surfaceSunken} style={styles.notice}>
        <View style={styles.noticeHead}>
          <Text style={styles.noticeTitle}>{SIGNUP_LABEL.noticeHead}</Text>
          {legalPagesOpen && <TextButton label={SIGNUP_LABEL.privacy} onPress={() => openLegalPage('/privacy')} />}
        </View>
        <NoticeLine>{SIGNUP_NOTICE_USE}</NoticeLine>
        <NoticeLine>{SIGNUP_NOTICE_KEEP}</NoticeLine>
        <NoticeLine>{SIGNUP_NOTICE_DISCOVERY}</NoticeLine>
      </Tile>

      {/* 만 14세 이상 — 필수 확인(ADR 0231), 웹과 같은 자리 */}
      <CheckRow checked={fourteen} onToggle={setFourteen} refused={shownGap?.field === 'age'}>
        <Text style={styles.checkLabel}>{SIGNUP_AGE_LABEL}</Text>
      </CheckRow>

      <CheckRow checked={acknowledged} onToggle={setAcknowledged} refused={shownGap?.field === 'ack'}>
        <Text style={styles.checkLabel}>{NOTICE_ACK_LABEL}</Text>
        <Text style={styles.note}>{NOTICE_ACK_NOTE}</Text>
      </CheckRow>

      <View style={styles.group}>
        <FieldLabel>{SIGNUP_LABEL.optional}</FieldLabel>
        <Text style={styles.note}>{OPTIONAL_CONSENT_NOTE}</Text>
      </View>
      {OPTIONAL_CONSENTS.map((one) => (
        <CheckRow
          key={one.key}
          checked={chosen[one.key] === true}
          onToggle={(next) => setChosen((current) => ({ ...current, [one.key]: next }))}
        >
          <Text style={styles.checkLabel}>{one.label}</Text>
          <Text style={styles.note}>{one.detail}</Text>
          <Text style={styles.fine}>{one.erasure}</Text>
        </CheckRow>
      ))}

      <View style={styles.action}>
        {failure !== null && failure.field === null && <Text style={styles.failure}>{failure.message}</Text>}
        {shownGap !== null && <Text style={styles.failure}>{shownGap.message}</Text>}
        <PrimaryButton
          label={working ? SIGNUP_LABEL.signingUp : again ? SIGNUP_LABEL.confirm : SIGNUP_LABEL.signUp}
          onPress={send}
          disabled={working}
        />
      </View>
    </CardFrame>
  );
}

function NoticeLine({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.noticeRow}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

/** 나가는 길 — 다른 계정으로 들어와야 하는 사람, 가입하지 않고 떠나는 사람의 자리. 적어 둔 출생 정보는 앞 화면에 그대로 있다 */
function LeaveLink() {
  const client = useClient();
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const leave = async () => {
    setLeaving(true);
    setFailed(false);
    const left = await signOut(client);
    setLeaving(false);
    if (!left) {
      setFailed(true);
      return;
    }
    goBack('/');
  };
  return (
    <View style={styles.leave}>
      <TextButton label={leaving ? SIGN_OUT_PENDING : SIGNUP_LABEL.otherAccount} onPress={leave} disabled={leaving} />
      {failed && <Text style={styles.failure}>{SIGN_OUT_FAILED}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16, gap: 16 },
  head: { gap: 12 },
  eyebrow: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.creamInk },
  title: { fontSize: TYPE.title, lineHeight: 35, fontFamily: FONT.bold, color: COLOR.foreground },
  headNote: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.creamInk },
  line: { fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.foreground },
  form: { gap: 20, padding: 20 },
  group: { gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameField: { flex: 1 },
  fine: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.muted },
  note: { fontSize: TYPE.note, lineHeight: 21, fontFamily: FONT.medium, color: COLOR.secondary },
  failure: { fontSize: TYPE.small, lineHeight: 19, fontFamily: FONT.medium, color: COLOR.danger },
  notice: { gap: 6 },
  noticeHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12 },
  noticeTitle: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  noticeRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: TYPE.note, lineHeight: 22, color: COLOR.muted },
  noticeText: { flex: 1, fontSize: TYPE.note, lineHeight: 22, fontFamily: FONT.medium, color: COLOR.secondary },
  checkLabel: { fontSize: TYPE.note, lineHeight: 21, fontFamily: FONT.bold, color: COLOR.foreground },
  action: { gap: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border },
  leave: { alignItems: 'center' },
  deletion: { alignSelf: 'center', marginHorizontal: 0 },
});
