import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MATCHING_START_LEAVE } from '@brand/guide';
import { safeReturnPath } from '@consent/return-path';
import {
  ADULT_CHECK_ACTION,
  ADULT_CHECK_FAILED,
  ADULT_CHECK_LINE,
  ADULT_CHECK_TITLE,
  ADULT_CHECK_UNAVAILABLE,
  adultCheckAfter,
  adultCheckNeeded,
  adultCheckParticipationLine,
} from '@matching/adult-check';

import { useClient } from '@/auth/connected';
import { adultCheckProvider, readAdultCheck, readOptedOut } from '@/matching/adult-check';
import { PrimaryButton } from '@/ui/parts';
import { settled } from '@/ui/settled';
import { CardFrame } from '@/ui/surfaces';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { TopBar } from '@/ui/top-bar';
import { WordText } from '@/ui/word-text';

/**
 * 성인 확인 안내(ADR 0214) — 스위치가 켜졌고 미확인인 사람만 이 자리에 온다. 끝나면 온 주소로 갈아 끼운다.
 * 꺼져 있거나 이미 확인했으면 바로 돌아간다.
 */
export default function AdultCheckScreen() {
  const client = useClient();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination = safeReturnPath(next);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  /** 참여를 껐는가 — 못 읽었거나 아직이면 `null` 이고 참여 줄이 안 선다(웹 안내와 같다) */
  const [optedOut, setOptedOut] = useState<boolean | null>(null);
  const participation = adultCheckParticipationLine(optedOut);

  useEffect(() => {
    void readAdultCheck(client).then((state) => {
      if (state !== null && !adultCheckNeeded(state)) router.replace(destination as never);
    });
  }, [client, destination]);

  useEffect(() => {
    void settled(readOptedOut(client), 'discovery_profile', () => null).then(setOptedOut);
  }, [client]);

  const start = async () => {
    if (adultCheckProvider === null) return;
    setWorking(true);
    setFailed(false);
    const outcome = await adultCheckProvider.start().catch(() => 'failed' as const);
    const step = adultCheckAfter(outcome, outcome === 'verified' ? await readAdultCheck(client) : null);
    setWorking(false);
    if (step === 'go') router.replace(destination as never);
    if (step === 'failed') setFailed(true);
  };

  return (
    <View style={styles.screen}>
      {/* 인연 주소로 돌아가면 다시 여기로 오므로 뒤로 가기는 홈이다 */}
      <TopBar fallback="/me" />
      <ScrollView contentContainerStyle={styles.content}>
        <CardFrame style={styles.card}>
          <WordText style={styles.title} accessibilityRole="header">
            {ADULT_CHECK_TITLE}
          </WordText>
          <WordText style={styles.body}>{ADULT_CHECK_LINE}</WordText>
          {/* 확인이 곧 공개 시점이다 — 참여가 자동으로 켜진다(운영자 결정 2026-11-02, #947). 끈 사람에게는 꺼져 있다는 줄(조율자 2026-11-08) */}
          {participation !== null && <WordText style={styles.body}>{participation}</WordText>}
          {failed && (
            <WordText style={styles.failure} accessibilityRole="alert">
              {ADULT_CHECK_FAILED}
            </WordText>
          )}
          {adultCheckProvider === null ? (
            <WordText style={styles.body}>{ADULT_CHECK_UNAVAILABLE}</WordText>
          ) : (
            <PrimaryButton label={ADULT_CHECK_ACTION} onPress={() => void start()} disabled={working} />
          )}
          <WordText style={styles.note}>{MATCHING_START_LEAVE}</WordText>
        </CardFrame>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16 },
  card: { gap: 12, paddingHorizontal: 20, paddingVertical: 20 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  body: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 20, color: COLOR.secondary },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  note: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 18, color: COLOR.muted },
});
