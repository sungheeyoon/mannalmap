import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';

import { safeReturnPath } from '@consent/return-path';
import { DEFAULT_QUERY, missingAnswer } from '@input/query';
import { ELEMENTS } from '@saju';

import { useClient } from '@/auth/connected';
import { signOut } from '@/auth/sign-in';
import { listenLive } from '@/chat/live';
import { OtherSaju, ReceivedReadings, RunningReadings, SavedPeople } from '@/home/lists';
import { homeUnreachable, readHome, readRunning, type Home } from '@/home/read';
import { MatchOpenAlert } from '@/home/match-open-alert';
import { SelfCard } from '@/home/self-card';
import { BirthFields, useBirthForm } from '@/people/birth-fields';
import { openParticipation, saveFailureOf, saveSelfPerson } from '@/reading/chart-writes';
import { followRefusal } from '@/reading/panel';
import { ElementSymbol } from '@/ui/element-symbol';
import { LoadingDots } from '@/ui/loading';
import { PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { CardFrame, Paper } from '@/ui/surfaces';
import { useLatestReads } from '@/ui/latest-reads';
import { settled } from '@/ui/settled';
import { WordText } from '@/ui/word-text';

/** 홈 — 차례는 웹의 `app/me/(home)/page.tsx` 와 같다. 다른 화면에서 돌아올 때마다 다시 읽는다 */
export default function HomeScreen() {
  const client = useClient();
  const [home, setHome] = useState<Home | null>(null);
  /* 복귀 · 실시간 신호 · 5초 확인이 겹쳐 부른다 — 늦게 온 옛 응답은 버린다 */
  const reads = useLatestReads();

  const load = useCallback(() => {
    const asked = reads.ask();
    void settled(readHome(client), 'readHome', homeUnreachable).then((next) => {
      if (!reads.fresh(asked)) return;
      /* 선 화면을 다시 읽다 못 읽으면 가진 것을 그대로 둔다 — 다음에 돌아올 때 메운다(채팅 목록과 같다). 둔 응답은 그렸다고 적지 않는다 */
      if (next.kind === 'failed') {
        setHome((now) => (now?.kind === 'home' || now?.kind === 'no-self' ? now : next));
        return;
      }
      reads.shown(asked);
      setHome(next);
      /* 참여를 여는 문은 아무것도 안 그린다 — 끈 사람은 안 열리고, 못 열어도 홈은 선다(웹의 `openDiscoveryParticipation`) */
      if (next.kind === 'home') void openParticipation(client);
    });
  }, [client, reads]);
  useFocusEffect(load);

  /* 다 된 풀이는 소식으로 온다(ADR 0155) — 계정 채널이 들으면 홈을 다시 읽는다. 다른 탭에 있어도 돌아오면 어차피 다시 읽는다 */
  useEffect(() => listenLive((signal) => {
    if (signal.kind === 'resync' || signal.change.area === 'notifications') load();
  }), [load]);

  /* 만드는 동안은 5초마다 줄만 다시 묻는다(웹의 `RUNNING_ASK_EVERY_MS`). 줄이 사라지면 홈을 다시 읽어 결과가 선다 */
  const watching = home?.kind === 'home' && home.running.length > 0;
  useFocusEffect(useCallback(() => {
    if (!watching) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      /* 같은 번호를 받되 그렸다고 적지 않는다 — 줄만 덮는 답이 그 앞에 보낸 홈 전체 읽기를 버리지 않게 */
      const asked = reads.ask();
      void settled(readRunning(client), 'readRunning', () => null).then((lines) => {
        if (lines === null || !reads.fresh(asked)) return;
        if (lines.length === 0) load();
        else setHome((now) => (now?.kind === 'home' ? { ...now, running: lines } : now));
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [client, watching, load, reads]));

  if (home === null) return <LoadingDots />;
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Body home={home} retry={load} />
    </ScrollView>
  );
}

function Body({ home, retry }: { home: Home; retry: () => void }) {
  const client = useClient();
  const { next } = useLocalSearchParams<{ next?: string }>();
  switch (home.kind) {
    case 'failed':
      return (
        <View style={styles.failure}>
          <WordText style={styles.failureText}>{home.message}</WordText>
          <SecondaryButton label="다시 시도하기" onPress={retry} />
        </View>
      );
    case 'sign-in':
      return (
        <View style={styles.failure}>
          <WordText style={styles.failureText}>{home.message}</WordText>
          <SecondaryButton label="다시 로그인" onPress={() => void signOut(client)} />
        </View>
      );
    case 'notice':
      return (
        <CardFrame style={styles.notice}>
          <WordText style={styles.noticeTitle}>{home.title}</WordText>
          <WordText style={styles.noticeDetail}>{home.detail}</WordText>
        </CardFrame>
      );
    case 'no-self':
      /* 인연 탭의 안내에서 왔으면 저장한 뒤 그 인연 탭으로 돌아간다 — 스택에 있는 그 화면이라 겹치지 않고, 돌아가며 덱을 다시 읽는다 */
      return <NoSelf nickname={home.nickname} onSaved={next !== undefined && safeReturnPath(next) === '/me/matching' ? () => router.dismissTo('/me/matching' as never) : retry} />;
    case 'home':
      break;
  }

  const self =
    home.self.kind === 'ok' ? (
      <SelfCard card={home.self} />
    ) : home.self.kind === 'unreadable' ? (
      <CardFrame style={styles.unreadable}>
        <WordText style={styles.noticeDetail}>{home.self.message}</WordText>
        <WordText style={styles.meta}>{home.self.note}</WordText>
      </CardFrame>
    ) : (
      <View style={styles.failure}>
        <WordText style={styles.failureText}>{home.self.message}</WordText>
        <SecondaryButton label="다시 시도하기" onPress={retry} />
      </View>
    );

  if (home.firstVisit) {
    return (
      <>
        {self}
        <SavedPeople people={home.people} slots={home.slots} />
        <OtherSaju />
        <MatchOpenAlert />
      </>
    );
  }
  return (
    <>
      <RunningReadings running={home.running} />
      <View style={styles.stack}>
        {self}
        <OtherSaju />
        <MatchOpenAlert />
      </View>
      <ReceivedReadings readings={home.received} />
      <SavedPeople people={home.people} slots={home.slots} />
    </>
  );
}

/** 내 사주가 없을 때 — 웹의 등록 폼 그대로다(`app/me/onboarding.tsx`). 저장은 앱의 문을 지나고 여덟 글자는 서버가 센다(ADR 0211). 저장하면 홈을 다시 읽어 내 사주 카드가 선다 */
function NoSelf({ nickname, onSaved }: { nickname: string; onSaved: () => void }) {
  const client = useClient();
  const form = useBirthForm({ ...DEFAULT_QUERY, name: nickname });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const missing = missingAnswer(form.query);

  const save = async () => {
    setSaving(true);
    setFailure(null);
    const answer = await saveSelfPerson(client, form.query);
    setSaving(false);
    if (answer.ok && answer.value.ok) {
      onSaved();
      return;
    }
    setFailure(saveFailureOf(answer));
    if (!answer.ok) followRefusal(answer.refused);
  };

  return (
    <Paper style={styles.paper}>
      <View style={styles.symbols}>
        {ELEMENTS.map((element) => (
          <ElementSymbol key={element} element={element} size={40} />
        ))}
      </View>
      <View style={styles.paperHead}>
        <WordText accessibilityRole="header" style={styles.paperTitle}>내 사주 등록</WordText>
        <WordText style={styles.paperDetail}>
          <WordText style={styles.strong}>{nickname}</WordText> 님의 출생 정보를 입력해 주세요.
        </WordText>
      </View>
      <BirthFields form={form} showName={false} />
      <PrimaryButton label={saving ? '저장하는 중…' : '내 사주로 저장'} onPress={() => void save()} disabled={missing !== null || saving} />
      {missing !== null && <WordText style={styles.meta}>{missing}</WordText>}
      {failure !== null && <WordText accessibilityRole="alert" style={styles.failureText}>저장하지 못했어요. {failure}</WordText>}
    </Paper>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24 },
  stack: { gap: 12 },
  failure: { gap: 8, alignItems: 'flex-start' },
  failureText: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger },
  noticeTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  noticeDetail: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 20, color: COLOR.secondary },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  paper: { gap: 24 },
  symbols: { flexDirection: 'row', gap: 8 },
  paperHead: { gap: 8 },
  strong: { fontFamily: FONT.bold, color: COLOR.foreground },
  paperTitle: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 35, color: COLOR.foreground },
  notice: { gap: 4, paddingHorizontal: 20, paddingVertical: 16 },
  unreadable: { gap: 8, padding: 20 },
  paperDetail: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
});
