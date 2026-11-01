import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
} from '@matching/adult-check';

import { adultCheckProvider, readAdultCheck } from '@/matching/adult-check';
import { PrimaryButton } from '@/ui/parts';
import { CardFrame } from '@/ui/surfaces';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { TopBar } from '@/ui/top-bar';

/**
 * 성인 확인 안내(ADR 0214) — 스위치가 켜졌고 미확인인 사람만 이 자리에 온다. 끝나면 온 주소로 갈아 끼운다.
 * 꺼져 있거나 이미 확인했으면 바로 돌아간다.
 */
export default function AdultCheckScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination = safeReturnPath(next);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void readAdultCheck().then((state) => {
      if (state !== null && !adultCheckNeeded(state)) router.replace(destination as never);
    });
  }, [destination]);

  const start = async () => {
    if (adultCheckProvider === null) return;
    setWorking(true);
    setFailed(false);
    const outcome = await adultCheckProvider.start().catch(() => 'failed' as const);
    const step = adultCheckAfter(outcome, outcome === 'verified' ? await readAdultCheck() : null);
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
          <Text style={styles.title} accessibilityRole="header">
            {ADULT_CHECK_TITLE}
          </Text>
          <Text style={styles.body}>{ADULT_CHECK_LINE}</Text>
          {failed && (
            <Text style={styles.failure} accessibilityRole="alert">
              {ADULT_CHECK_FAILED}
            </Text>
          )}
          {adultCheckProvider === null ? (
            <Text style={styles.body}>{ADULT_CHECK_UNAVAILABLE}</Text>
          ) : (
            <PrimaryButton label={ADULT_CHECK_ACTION} onPress={() => void start()} disabled={working} />
          )}
          <Text style={styles.note}>{MATCHING_START_LEAVE}</Text>
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
