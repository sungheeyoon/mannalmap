import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CHAT_TAB_LABEL } from '@chat/index';
import { DETAIL_MAKING, DETAIL_NOT_YET } from '@chat/room/detail-copy';

import { useClient } from '@/auth/connected';
import { readMatchResult, readMyNickname, type MatchOutcome, type Read } from '@/matching/doors';
import { Face, PartnerSheet, ReportBlock } from '@/matching/people';
import type { ReadingTarget } from '@/reading/api';
import { ReadFailure, ReadingPanel, useReadingView } from '@/reading/panel';
import { Icon } from '@/ui/icons';
import { LoadingDots } from '@/ui/loading';
import { PrimaryButton } from '@/ui/parts';
import { TopBar, goBack } from '@/ui/top-bar';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { CardFrame, EmptySlot } from '@/ui/surfaces';

/** 만드는 동안 상태 문을 다시 묻는 간격 — 글이 서면 풀이 칸으로 바뀐다 */
const MAKING_POLL_MS = 5000;

/**
 * 상세 궁합 — 둘이 같이 보는 한 장. 머리 한 줄 · 풀이 본문 차례다. 글이 서기 전에는 풀이 칸을 안 세운다 — 청하기 · 재시도는 방의 일이다.
 * 없는 Match 와 못 보는 Match 는 같은 말로 거절한다(ADR 0007).
 */
export default function MatchScreen() {
  const client = useClient();
  const { matchId, from } = useLocalSearchParams<{ matchId: string; from?: string }>();
  const [outcome, setOutcome] = useState<Read<MatchOutcome> | null>(null);
  const [nickname, setNickname] = useState('');
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    const [next, mine] = await Promise.all([readMatchResult(client, matchId), readMyNickname(client)]);
    setNickname(mine);
    setOutcome(next);
  }, [client, matchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load 는 읽기를 기다린 뒤에만 상태를 고친다. 규칙이 await 를 넘어 보지 못한다
    void load();
  }, [load]);

  const making = outcome?.ok === true && outcome.value.kind === 'ok' && outcome.value.result.detail?.state === 'making';
  useEffect(() => {
    if (!making) return;
    const timer = setInterval(() => void load(), MAKING_POLL_MS);
    return () => clearInterval(timer);
  }, [making, load]);

  const fallback = from === 'history' ? '/me/matching/history' : from === 'shelf' ? '/me/readings' : '/me/matching';
  const back = () => goBack(fallback);

  if (outcome === null) {
    return (
      <View style={styles.screen}>
        <TopBar fallback={fallback} />
        <LoadingDots />
      </View>
    );
  }

  if (!outcome.ok) {
    return (
      <View style={styles.screen}>
        <TopBar title="궁합 결과" fallback={fallback} />
        <View style={styles.content}>
          <Text style={styles.failure} accessibilityRole="alert">
            {outcome.reason}
          </Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.retry}>
            <Text style={styles.retryText}>다시 시도하기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (outcome.value.kind === 'none') {
    return (
      <View style={styles.screen}>
        <TopBar fallback={fallback} />
        <View style={styles.notFound}>
          <Text style={styles.title} accessibilityRole="header">
            찾을 수 없어요
          </Text>
          <View>
            <Text style={styles.line}>주소에 적힌 인연 궁합을 찾지 못했어요.</Text>
            <Text style={styles.line}>인연 탭에서 다시 열어 주세요.</Text>
          </View>
          <PrimaryButton label="인연 탭으로" onPress={() => router.replace('/me/matching')} />
        </View>
      </View>
    );
  }

  const { result } = outcome.value;
  const written = result.detail?.state === 'ready';

  return (
    <View style={styles.screen}>
      <TopBar
        fallback={fallback}
        right={
          <>
            {from !== 'chat' && (
              <Pressable accessibilityRole="link" onPress={() => router.push(`/me/chat/${result.matchId}` as never)} style={styles.chat}>
                <Icon name="chat" size={18} />
                <Text style={styles.chatText}>{CHAT_TAB_LABEL}</Text>
              </Pressable>
            )}
            <ReportBlock userId={result.partnerUserId} nickname={result.partnerNickname} onBlocked={back} />
          </>
        }
      >
        <Pressable accessibilityRole="button" accessibilityLabel={`${result.partnerNickname} 님 자세히`} onPress={() => setSheet(true)}>
          <Face userId={result.partnerUserId} nickname={result.partnerNickname} hasPhoto={result.partnerPhotoCount > 0} focus={result.partnerPhotoFocus[0]} size={40} tone={null} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1} accessibilityRole="header">
            {result.partnerNickname} 님
          </Text>
          <Text style={styles.meta}>궁합 결과</Text>
        </View>
      </TopBar>
      <ScrollView contentContainerStyle={styles.content}>
        <PartnerSheet
          open={sheet}
          onClose={() => setSheet(false)}
          partner={{
            userId: result.partnerUserId,
            nickname: result.partnerNickname,
            intro: result.partnerIntro,
            photoCount: result.partnerPhotoCount,
            photoFocus: result.partnerPhotoFocus,
            tone: null,
          }}
          menu={<ReportBlock userId={result.partnerUserId} nickname={result.partnerNickname} onBlocked={back} />}
        />

        {written ? (
          <MatchReadingPanel matchId={result.matchId} nicknames={{ viewer: nickname, partner: result.partnerNickname }} />
        ) : (
          <EmptySlot>
            <Text style={styles.line}>{result.detail?.state === 'making' ? DETAIL_MAKING : DETAIL_NOT_YET}</Text>
          </EmptySlot>
        )}
      </ScrollView>
    </View>
  );
}

/** 풀이 칸 — 글은 문이 근거 절을 자르고 내준다(ADR 0008 · 0211). 동의가 만드는 글이라 `automatic` 이다(ADR 0038) */
function MatchReadingPanel({ matchId, nicknames }: { matchId: string; nicknames: { viewer: string; partner: string } }) {
  const target = useMemo<ReadingTarget>(() => ({ kind: 'match', matchId }), [matchId]);
  const { answer, reload } = useReadingView(target);

  if (answer === null) return <LoadingDots inline />;
  if ('refused' in answer) return <ReadFailure refused={answer.refused} onRetry={reload} />;
  if (answer.view.view === 'blocked') {
    return (
      <CardFrame style={styles.blocked}>
        <Text style={styles.name}>{answer.view.title}</Text>
        <Text style={styles.line}>{answer.view.detail}</Text>
      </CardFrame>
    );
  }
  if (answer.view.view !== 'reading') return null;
  return <ReadingPanel target={target} view={answer.view} automatic nicknames={nicknames} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 24, padding: 16 },
  flex: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.muted },
  chat: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  chatText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.foreground },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.foreground },
  notFound: { flex: 1, justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 34, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.secondary },
  blocked: { gap: 12, padding: 20 },
});
