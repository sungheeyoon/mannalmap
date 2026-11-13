import { CHART_READING_OFFER, MATCHING_INTRO_TITLE, chartReadingOfferTitle } from '@brand/guide';
import type { Query } from '@input/query';
import type { SameChart } from '@input/same-chart';
import { noRoomToSave, type PersonSlots } from '@people';
import { withReturnPath } from '@consent/return-path';
import { matchEntriesStand } from '@matching/opening';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { chartPath, type ChartWant } from '@consent/app-destination';
import { ConnectedClient, useClient } from '@/auth/connected';
import { supabase, type Client } from '@/auth/client';
import { readGate } from '@/home/gate';
import { useMatchOpen } from '@/matching/opening';
import { addPerson, readSlots } from '@/people/data';
import { readSelfPerson } from '@/people/self-person';
import { SameChartAsk, type SameChartQuestion } from '@/people/same-chart-ask';
import { settled } from '@/ui/settled';
import { Button } from '@/ui/buttons';
import { Icon } from '@/ui/icons';
import { Card } from '@/ui/surfaces';
import { PrimaryButton, SecondaryButton, TextButton } from '@/ui/parts';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { saveSelfPerson } from './chart-writes';
import { WordText } from '@/ui/word-text';

/**
 * `out` 은 아직 저장할 수 없는 사람(로그인 전 · 가입 전)이다 — 세션이 없으면 서버를 안 부른다(ADR 0213). 가입 전인 사람에게 내 사주를 묻지 않는다.
 * `self` 는 내 사주를 등록했는가와 등록하면 설 이름 — 못 읽었으면 `null` 이고 그때는 묻지 않는다(`app/self-person-state.ts`).
 * `slots` 가 `null` 이면 못 읽은 것이고 막지 않는다.
 */
type SaveContext = { state: 'out' } | { state: 'in'; client: Client; self: { saved: boolean; nickname: string | null } | null; slots: PersonSlots | null };

function useSaveContext(): SaveContext | null {
  const [context, setContext] = useState<SaveContext | null>(null);

  /* 돌아올 때마다 다시 본다 — 가입을 마치고 돌아온 사람, 저장한 사람을 비우고 온 사람의 답이 바뀐다 */
  useFocusEffect(
    useCallback(() => {
      let live = true;
      /* 결과 화면은 `/me` 밖이라 이 자리가 껍데기다 — 주소 · 공개 키가 없는 빌드는 로그인 전과 같다(ADR 0243) */
      const client = supabase;
      if (client === null) {
        setContext({ state: 'out' });
        return;
      }
      /* 세션을 못 읽었으면 묻지 않고 막지 않는다 — 저장 카드가 서고 저장이 제 실패 줄을 말한다 */
      void settled(
        (async (): Promise<SaveContext> => {
          const gate = await readGate();
          /* 관문은 세션이 없으면 서버를 안 부른다 — 정책이 빈 답을 내 「내 사주가 없다」로 읽히지 않게 여기서 갈린다 */
          if (gate.kind === 'out' || gate.kind === 'signup') return { state: 'out' };
          const [self, slots] = await Promise.all([readSelfPerson(client), readSlots(client)]);
          return { state: 'in', client, self, slots };
        })(),
        'useSaveContext',
        (): SaveContext => ({ state: 'in', client, self: null, slots: null }),
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
 * **결과 화면의 다음 행동** — 갈래와 글자는 웹의 `app/save-for-reading.tsx` 다. 로그인 전이면 무료 풀이 단추 하나가 서고(ADR 0213 추기 2026-11-12), 내 사주가
 * 없으면 내 사주인지 먼저 묻고(ADR 0128), 아니면 「저장한 사람」으로 저장한다. 웹이 함께 잇는 로그인 전 맛보기는 앱에 없어 그 갈래도 없다.
 * `want` 는 로그인 전에 누른 일(풀이)이다 — 로그인 화면이 그 까닭을 말하고, 세션이 끊겨 다시 물을 때 주소에 그대로 싣는다. 내 사주를 저장하면 풀이 칸으로 간다.
 */
export function SavePersonForReading({ query, want }: { query: Query; want: ChartWant | null }) {
  const context = useSaveContext();
  /** 「다른 사람의 사주예요」를 눌렀다 — 이 화면에서는 다시 묻지 않는다 */
  const [someoneElse, setSomeoneElse] = useState(false);
  /** 남의 사주를 「저장하기」로 저장했다 — 그 사람의 id. 제자리에 「저장했어요」가 선다 */
  const [savedOther, setSavedOther] = useState<string | null>(null);
  const matchOpen = useMatchOpen();

  if (savedOther !== null) return <SavedOtherCard personId={savedOther} />;
  if (context === null) return null;
  if (context.state === 'out') {
    return (
      <>
        <SignInCard query={query} />
        {/* 로그인한 사람에게는 인연 탭이 있어 안 선다. 인연이 닫힌 동안은 소개도 안 선다(ADR 0222) */}
        {matchEntriesStand(matchOpen) && (
          <Pressable accessibilityRole="link" onPress={() => router.push('/matching-intro')} style={styles.intro}>
            <WordText style={styles.introText}>{MATCHING_INTRO_TITLE}</WordText>
            <Icon name="arrow" size={16} color={COLOR.secondary} />
          </Pressable>
        )}
      </>
    );
  }
  return (
    <ConnectedClient client={context.client}>
      {context.self !== null && !context.self.saved && !someoneElse ? (
        <SelfConfirm query={query} want={want} name={context.self.nickname ?? query.name.trim()} onSomeoneElse={() => setSomeoneElse(true)} />
      ) : (
        <SaveCard query={query} slots={context.slots} onSavedHere={setSavedOther} />
      )}
    </ConnectedClient>
  );
}

/**
 * 로그인 전의 다음 행동 — **무료를 앞에 세운다**(「결과 A안」, 운영자 채택 2026-11-12, 대장 first-07). 딱지 · 제목 · 풀이의 절 셋 · 주 단추 하나 ·
 * 로그인 수단 한 줄이고, 글자는 웹과 한 벌(`CHART_READING_OFFER`)이다. 누른 일이 주소에 실려 로그인 화면이 그 까닭을 말한다. 다녀오면 이 결과로 돌아오고,
 * 저장도 풀이도 대신 누르지 않는다(ADR 0213 · 0028). 풀이권을 쓰는 확인은 풀이 칸에서 요청 직전에 묻는다.
 * 강조는 나무 색이다(운영자 2026-11-12 — 시안의 초록) — 딱지 · 체크 · 주 단추(`primary-wood`, 이 카드만 쓴다).
 * 「저장하기」는 없다(운영자 정정 2026-11-12 — 채택한 시안 그대로). 저장만 하러 로그인을 다녀오는 길(`want=save`)도 함께 걷었다 — 로그인하면 저장 물음이 선다.
 */
function SignInCard({ query }: { query: Query }) {
  const signIn = () => router.push(withReturnPath('/auth', chartPath(query, 'reading')) as never);
  return (
    <Card style={styles.card}>
      <View style={styles.offerHead}>
        <View style={styles.badge}>
          <WordText style={styles.badgeText}>{CHART_READING_OFFER.badge}</WordText>
        </View>
        <WordText accessibilityRole="header" style={styles.title}>{chartReadingOfferTitle(query.hourKnown !== false)}</WordText>
      </View>
      <View style={styles.points}>
        {CHART_READING_OFFER.points.map((point) => (
          <View key={point} style={styles.point}>
            <Icon name="check" size={16} color={OFFER_TONE.ink} />
            <WordText style={styles.line}>{point}</WordText>
          </View>
        ))}
      </View>
      <View style={styles.answers}>
        <Button variant="primary-wood" label={CHART_READING_OFFER.action} onPress={signIn} />
        <WordText style={styles.providers}>{CHART_READING_OFFER.providers}</WordText>
      </View>
    </Card>
  );
}

/** 남의 사주를 「저장하기」로 저장한 뒤 — 내 사주의 「저장했어요」와 같은 꼴. 풀이권을 쓰는 일은 풀이 칸에서 시작한다 */
function SavedOtherCard({ personId }: { personId: string }) {
  return (
    <Card style={styles.card}>
      <WordText accessibilityRole="alert" style={styles.title}>저장했어요</WordText>
      <View style={styles.answers}>
        <PrimaryButton label="사주풀이 받기" onPress={() => router.push(`/me/readings/${personId}` as never)} />
        <SecondaryButton label="저장한 사람 보기" onPress={() => router.push('/me/people' as never)} />
      </View>
    </Card>
  );
}

/** 저장한 사람으로 저장한다 — 같은 명식이면 먼저 묻고, 자리가 없으면 버튼 자리에 할 일이 선다. 「사주풀이 받기」는 저장하고 풀이 칸으로, 「저장하기」는 저장하고 제자리다 */
function SaveCard({ query, slots, onSavedHere }: { query: Query; slots: PersonSlots | null; onSavedHere: (personId: string) => void }) {
  const client = useClient();
  /** 누른 단추 — 그 단추만 「저장하는 중…」을 말하고 둘 다 잠근다 */
  const [pending, setPending] = useState<'reading' | 'stay' | null>(null);
  const saving = pending !== null;
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

  const save = async (evenIfSameChart: boolean, then: 'reading' | 'stay') => {
    setPending(then);
    setFailure(null);
    const saved = await addPerson(client, query, '', evenIfSameChart);
    setPending(null);
    if (saved.ok) {
      setQuestion(null);
      if (then === 'stay') onSavedHere(saved.personId);
      else router.push(`/me/readings/${saved.personId}` as never);
    } else if (saved.kind === 'failed') {
      setQuestion(null);
      setFailure(saved.message);
    } else {
      const { same } = saved;
      setQuestion({ label: same.label, answer: (sameperson) => (sameperson ? goTo(same) : void save(true, then)) });
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <WordText accessibilityRole="header" style={styles.title}>이 사람의 사주는 어떤 뜻일까요?</WordText>
        <WordText style={styles.line}>성향부터 일과 연애, 운의 흐름까지 글로 풀어드려요.</WordText>
      </View>

      {question !== null ? (
        <SameChartAsk question={question} busy={saving} />
      ) : noRoom !== null ? (
        <View style={styles.noRoom}>
          <WordText style={styles.line}>{noRoom}</WordText>
          <TextButton label="저장한 사람 관리 →" onPress={() => router.push('/me/people' as never)} />
        </View>
      ) : (
        <>
          <View style={styles.answers}>
            <PrimaryButton label={pending === 'reading' ? '저장하는 중…' : '사주풀이 받기'} onPress={() => void save(false, 'reading')} disabled={saving} />
            <SecondaryButton label={pending === 'stay' ? '저장하는 중…' : '저장하기'} onPress={() => void save(false, 'stay')} disabled={saving} />
          </View>
          <WordText style={styles.fine}>
            {name !== '' ? `두 단추 모두 저장한 사람 목록에 「${name}」 이름으로 추가돼요.` : '두 단추 모두 저장한 사람 목록에 이 사람이 추가돼요.'}
            {slots !== null && ` 앞으로 ${slots.remaining}명 더 저장할 수 있어요.`} 목록에서 빼려면 ‘저장한 사람’으로 이동해 주세요.
          </WordText>
        </>
      )}

      {failure !== null && <WordText accessibilityRole="alert" style={styles.failure}>저장하지 못했어요. {failure}</WordText>}
    </Card>
  );
}

/**
 * **「이 사주가 내 사주 맞나요?」** — 사주 카드는 이 칸 위에 이미 서 있다. 묻지 않고 저장하면 남의 사주가 내 것이 된다.
 * 풀이를 대신 누르지 않는다 — 풀이권을 쓰는 누름은 도착한 화면에서 사용자가 한다(ADR 0028).
 */
function SelfConfirm({ query, want, name, onSomeoneElse }: { query: Query; want: ChartWant | null; name: string; onSomeoneElse: () => void }) {
  const client = useClient();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setFailure(null);
    /* 내 사주의 이름은 닉네임이다 — 적은 이름이 비어 있어도 막히지 않게 그 이름으로 보낸다 */
    const answer = await saveSelfPerson(client, { ...query, name });
    setSaving(false);
    if (answer.ok && answer.value.ok) {
      router.replace('/me/readings/self' as never);
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
        <WordText accessibilityRole="header" style={styles.title}>이 사주가 내 사주 맞나요?</WordText>
        <WordText style={styles.line}>첫 화면에 입력한 정보예요.</WordText>
      </View>
      <View style={styles.answers}>
        <PrimaryButton label={saving ? '저장하는 중…' : '내 사주로 저장'} onPress={() => void save()} disabled={saving} />
        <SecondaryButton label="다른 사람의 사주예요" onPress={onSomeoneElse} disabled={saving} />
      </View>
      {failure !== null && <WordText accessibilityRole="alert" style={styles.failure}>저장하지 못했어요. {failure}</WordText>}
    </Card>
  );
}

/** 로그인 전 카드의 강조 색 — 나무 오행의 짙은 색 · 연한 색(웹 하단 탭의 켜진 표시 `bg-wood-soft text-wood` 와 같은 값). 이 카드만 쓴다 */
const OFFER_TONE = ELEMENT_TONE['木'];

const styles = StyleSheet.create({
  intro: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: 4 },
  introText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.secondary },
  card: { gap: 12 },
  head: { gap: 4 },
  offerHead: { gap: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: OFFER_TONE.soft },
  badgeText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: OFFER_TONE.ink },
  points: { gap: 2 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  providers: { fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 18, color: COLOR.secondary, textAlign: 'center' },
  answers: { gap: 8 },
  noRoom: { gap: 4, padding: 12, borderRadius: RADIUS.cell, backgroundColor: COLOR.background },
  title: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 22, color: COLOR.secondary },
  fine: { fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 18, color: COLOR.muted },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.danger },
});
