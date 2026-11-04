import { MATCHING_INTRO_TITLE } from '@brand/guide';
import type { Query } from '@input/query';
import type { SameChart } from '@input/same-chart';
import { noRoomToSave, type PersonSlots } from '@people';
import { withReturnPath } from '@consent/return-path';
import { matchEntriesStand } from '@matching/opening';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { chartPath, type ChartWant } from '@consent/app-destination';
import { supabase } from '@/auth/client';
import { readGate } from '@/home/gate';
import { useMatchOpen } from '@/matching/opening';
import { goHome } from '@/info/go-home';
import { addPerson, readSlots } from '@/people/data';
import { SameChartAsk, type SameChartQuestion } from '@/people/same-chart-ask';
import { settled } from '@/ui/settled';
import { Icon } from '@/ui/icons';
import { Card } from '@/ui/surfaces';
import { PrimaryButton, SecondaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { saveSelfPerson } from './chart-writes';

const reading = '사주풀이';
const saveWhat = '출생 정보';

/**
 * `out` 은 아직 저장할 수 없는 사람(로그인 전 · 가입 전)이다 — 세션이 없으면 서버를 안 부른다(ADR 0213). 가입 전인 사람에게 내 사주를 묻지 않는다.
 * `self` 는 내 사주를 등록했는가와 등록하면 설 이름 — 못 읽었으면 `null` 이고 그때는 묻지 않는다(`app/self-person-state.ts`).
 * `slots` 가 `null` 이면 못 읽은 것이고 막지 않는다.
 */
type SaveContext = { state: 'out' } | { state: 'in'; self: { saved: boolean; nickname: string | null } | null; slots: PersonSlots | null };

function useSaveContext(): SaveContext | null {
  const [context, setContext] = useState<SaveContext | null>(null);

  /* 돌아올 때마다 다시 본다 — 가입을 마치고 돌아온 사람, 저장한 사람을 비우고 온 사람의 답이 바뀐다 */
  useFocusEffect(
    useCallback(() => {
      let live = true;
      /* 세션을 못 읽었으면 묻지 않고 막지 않는다 — 저장 카드가 서고 저장이 제 실패 줄을 말한다 */
      void settled(
        (async (): Promise<SaveContext> => {
          const gate = await readGate();
          /* 관문은 세션이 없으면 서버를 안 부른다 — 정책이 빈 답을 내 「내 사주가 없다」로 읽히지 않게 여기서 갈린다 */
          if (gate.kind === 'out' || gate.kind === 'signup' || supabase === null) return { state: 'out' };
          const [account, slots] = await Promise.all([supabase.from('app_user').select('self_person_id, nickname').maybeSingle(), readSlots()]);
          const self = account.error !== null ? null : { saved: account.data !== null && account.data.self_person_id !== null, nickname: account.data?.nickname ?? null };
          return { state: 'in', self, slots };
        })(),
        'useSaveContext',
        (): SaveContext => ({ state: 'in', self: null, slots: null }),
      ).then((next) => {
        if (live) setContext(next);
      });
      return () => {
        live = false;
      };
    }, []),
  );

  return context;
}

/**
 * **결과 화면의 다음 행동** — 갈래와 글자는 웹의 `app/save-for-reading.tsx` 다. 로그인 전이면 풀이와 저장 두 단추가 서고(ADR 0213 추기), 내 사주가
 * 없으면 내 사주인지 먼저 묻고(ADR 0128), 아니면 「저장한 사람」으로 저장한다. 웹이 함께 잇는 로그인 전 맛보기는 앱에 없어 그 갈래도 없다.
 * `want` 는 로그인 전에 누른 일이다 — 저장을 누르고 온 사람은 내 사주를 저장한 뒤 결과에 남고, 나머지는 풀이 칸으로 간다.
 */
export function SavePersonForReading({ query, want }: { query: Query; want: ChartWant | null }) {
  const context = useSaveContext();
  /** 「다른 사람의 사주예요」를 눌렀다 — 이 화면에서는 다시 묻지 않는다 */
  const [someoneElse, setSomeoneElse] = useState(false);
  const [savedHere, setSavedHere] = useState(false);
  const matchOpen = useMatchOpen();

  if (savedHere) return <SavedCard />;
  if (context === null) return null;
  if (context.state === 'out') {
    return (
      <>
        <SignInCard query={query} />
        {/* 로그인한 사람에게는 인연 탭이 있어 안 선다. 인연이 닫힌 동안은 소개도 안 선다(ADR 0222) */}
        {matchEntriesStand(matchOpen) && (
          <Pressable accessibilityRole="link" onPress={() => router.push('/matching-intro')} style={styles.intro}>
            <Text style={styles.introText}>{MATCHING_INTRO_TITLE}</Text>
            <Icon name="arrow" size={16} color={COLOR.secondary} />
          </Pressable>
        )}
      </>
    );
  }
  if (context.self !== null && !context.self.saved && !someoneElse) {
    return <SelfConfirm query={query} want={want} name={context.self.nickname ?? query.name.trim()} onSomeoneElse={() => setSomeoneElse(true)} onSavedHere={() => setSavedHere(true)} />;
  }
  return <SaveCard query={query} slots={context.slots} />;
}

/**
 * 로그인 전의 다음 행동 — 누른 일이 주소에 실려 로그인 화면이 그 까닭을 말한다. 다녀오면 이 결과로 돌아오고, 저장도 풀이도 대신 누르지 않는다(ADR 0213 · 0028).
 * 풀이권을 쓰는 확인은 풀이 칸에서 요청 직전에 묻는다.
 */
function SignInCard({ query }: { query: Query }) {
  const signInFor = (want: ChartWant) => router.push(withReturnPath('/auth', chartPath(query, want)) as never);
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>이 사주가 내 삶에서는 어떤 뜻일까요?</Text>
        <Text style={styles.line}>성향부터 일과 연애, 운의 흐름까지 글로 풀어드려요.</Text>
      </View>
      <View style={styles.answers}>
        <PrimaryButton label="사주풀이 받기" onPress={() => signInFor('reading')} />
        <SecondaryButton label="저장하기" onPress={() => signInFor('save')} />
      </View>
    </Card>
  );
}

/** 저장을 누르고 온 사람이 내 사주를 저장한 뒤 — 풀이권을 쓰는 일은 여기서 시작하지 않고 풀이 칸으로 간다 */
function SavedCard() {
  return (
    <Card style={styles.card}>
      <Text accessibilityRole="alert" style={styles.title}>저장했어요</Text>
      <View style={styles.answers}>
        <PrimaryButton label="사주풀이 받기" onPress={() => router.push('/me/readings/self' as never)} />
        <SecondaryButton label="홈으로" onPress={() => void goHome()} />
      </View>
    </Card>
  );
}

/** 저장한 사람으로 저장한다 — 같은 명식이면 먼저 묻고, 자리가 없으면 버튼 자리에 할 일이 선다 */
function SaveCard({ query, slots }: { query: Query; slots: PersonSlots | null }) {
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** 물음이 서 있는 동안 저장 버튼은 자리를 비운다 — 답하지 않고 다시 누르면 같은 물음이 또 온다 */
  const [question, setQuestion] = useState<SameChartQuestion | null>(null);

  const noRoom = noRoomToSave(1, slots);
  const name = query.name.trim();

  /** 「맞다」면 아무것도 저장하지 않고 그 사람에게 간다 — 자리도 안 쓰고 대상도 안 는다 */
  const goTo = (same: SameChart) => {
    setQuestion(null);
    router.push((same.isSelfPerson ? '/me/readings/self' : `/me/readings/${same.personId}`) as never);
  };

  const save = async (evenIfSameChart: boolean) => {
    setSaving(true);
    setFailure(null);
    const saved = await addPerson(query, '', evenIfSameChart);
    setSaving(false);
    if (saved.ok) {
      setQuestion(null);
      router.push(`/me/readings/${saved.personId}` as never);
    } else if (saved.kind === 'failed') {
      setQuestion(null);
      setFailure(saved.message);
    } else {
      const { same } = saved;
      setQuestion({ label: same.label, answer: (sameperson) => (sameperson ? goTo(same) : void save(true)) });
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>
          {reading}로 이어 보기
        </Text>
        <Text style={styles.line}>
          {reading}는 저장한 출생 정보로만 받을 수 있어요.{' '}
          {saveWhat}를 저장하면 {reading}를 받고, 다음에 다시 볼 수도 있어요.
        </Text>
      </View>

      {question !== null ? (
        <SameChartAsk question={question} busy={saving} />
      ) : noRoom !== null ? (
        <View style={styles.noRoom}>
          <Text style={styles.line}>{noRoom}</Text>
          <TextButton label="저장한 사람 관리 →" onPress={() => router.push('/me/people' as never)} />
        </View>
      ) : (
        <>
          <PrimaryButton label={saving ? '저장하는 중…' : '저장하고 계속하기'} onPress={() => void save(false)} disabled={saving} />
          <Text style={styles.fine}>
            {name !== '' ? `저장한 사람 목록에 「${name}」 이름으로 추가돼요.` : '저장한 사람 목록에 이 사람이 추가돼요.'} 저장하면 {reading}를 받는 화면으로 넘어가요.
            {slots !== null && ` 앞으로 ${slots.remaining}명 더 저장할 수 있어요.`} 목록에서 빼려면 ‘저장한 사람’으로 이동해 주세요.
          </Text>
        </>
      )}

      {failure !== null && <Text accessibilityRole="alert" style={styles.failure}>저장하지 못했어요. {failure}</Text>}
    </Card>
  );
}

/**
 * **「이 사주가 내 사주 맞나요?」** — 사주 카드는 이 칸 위에 이미 서 있다. 묻지 않고 저장하면 남의 사주가 내 것이 된다.
 * 풀이를 대신 누르지 않는다 — 풀이권을 쓰는 누름은 도착한 화면에서 사용자가 한다(ADR 0028).
 */
function SelfConfirm({ query, want, name, onSomeoneElse, onSavedHere }: { query: Query; want: ChartWant | null; name: string; onSomeoneElse: () => void; onSavedHere: () => void }) {
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setFailure(null);
    /* 내 사주의 이름은 닉네임이다 — 적은 이름이 비어 있어도 막히지 않게 그 이름으로 보낸다 */
    const answer = await saveSelfPerson({ ...query, name });
    setSaving(false);
    if (answer.ok && answer.value.ok) {
      if (want === 'save') onSavedHere();
      else router.replace('/me/readings/self' as never);
      return;
    }
    setFailure(answer.ok ? (answer.value.ok ? null : answer.value.message) : answer.refused.refused === 'unavailable' ? answer.refused.message : null);
    /* 저장하려다 세션이 끊겼거나 가입이 안 끝났다 — 이 결과를 들고 다시 묻는다 */
    const here = chartPath(query, want ?? undefined);
    if (!answer.ok && answer.refused.refused !== 'unavailable') router.replace((answer.refused.refused === 'sign-in' ? here : withReturnPath('/signup', here)) as never);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>이 사주가 내 사주 맞나요?</Text>
        <Text style={styles.line}>첫 화면에 입력한 정보예요.</Text>
      </View>
      <View style={styles.answers}>
        <PrimaryButton label={saving ? '저장하는 중…' : '내 사주로 저장'} onPress={() => void save()} disabled={saving} />
        <SecondaryButton label="다른 사람의 사주예요" onPress={onSomeoneElse} disabled={saving} />
      </View>
      {failure !== null && <Text accessibilityRole="alert" style={styles.failure}>저장하지 못했어요. {failure}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: 4 },
  introText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.secondary },
  card: { gap: 12 },
  head: { gap: 4 },
  answers: { gap: 8 },
  noRoom: { gap: 4, padding: 12, borderRadius: RADIUS.cell, backgroundColor: COLOR.background },
  title: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 22, color: COLOR.secondary },
  fine: { fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 18, color: COLOR.muted },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.danger },
});
