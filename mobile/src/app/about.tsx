import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SERVICE_NAME_TOPIC, SERVICE_TAGLINE } from '@brand';
import { SERVICE_FEATURES, featureText } from '@brand/features';
import { ABOUT_LEAD, ABOUT_LEAD_WHILE_SHUT, ABOUT_STEPS } from '@brand/guide';

import { InfoScreen } from '@/info/frame';
import { useMatchOpen } from '@/matching/opening';
import { goHome } from '@/info/go-home';
import { Icon } from '@/ui/icons';
import { Logo } from '@/ui/logo';
import { PrimaryButton, SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Card, CardFrame, Paper } from '@/ui/surfaces';
import { WordText } from '@/ui/word-text';

/**
 * 서비스 소개 — 웹의 `/about`. 로그인 없이 열리고 세션은 안 읽는다. DB 는 인연의 열림 하나만 묻는다(`useMatchOpen`) —
 * 닫힌 동안 · 모르는 동안은 인연 카드 · 맨 위 둘째 문장 · 「시작하는 차례」 4 가 「준비 중」 쪽 글이다(웹과 같다, 대장 all-10 · all-11)
 */
export default function AboutScreen() {
  const matchOpen = useMatchOpen() === true;
  return (
    <InfoScreen gap={40} title="서비스 소개" fallback="/">
      <Paper style={styles.head}>
        <Logo size={44} />
        <WordText style={styles.meta}>{SERVICE_TAGLINE}</WordText>
        <WordText style={styles.title}>{SERVICE_NAME_TOPIC} 이런 곳이에요</WordText>
        <WordText style={styles.lead}>{`${ABOUT_LEAD[0]} ${matchOpen ? ABOUT_LEAD[1] : ABOUT_LEAD_WHILE_SHUT}`}</WordText>
      </Paper>

      <View style={styles.section}>
        <WordText style={styles.sectionTitle}>할 수 있는 것</WordText>
        {SERVICE_FEATURES.map((feature) => {
          const { body, note } = featureText(feature, matchOpen);
          return (
            <Card key={feature.title} style={styles.feature}>
              <View style={styles.iconBadge}>
                <Icon name={feature.icon} />
              </View>
              <WordText style={styles.name}>{feature.title}</WordText>
              <WordText style={styles.body}>{body}</WordText>
              {/* 궁합의 조건 줄은 첫 신호까지 약속하는데 앱에는 로그인 전 궁합 결과가 없다(ADR 0213) */}
              {feature.title !== '궁합' && note !== null && <WordText style={styles.meta}>{note}</WordText>}
            </Card>
          );
        })}
      </View>

      <View style={styles.section}>
        <WordText style={styles.sectionTitle}>시작하는 차례</WordText>
        <View style={styles.steps}>
          {ABOUT_STEPS.map((step, index) => (
            <CardFrame key={step.title} style={styles.step}>
              <View style={styles.stepNumber}>
                <WordText style={styles.stepNumberText}>{index + 1}</WordText>
              </View>
              <View style={styles.stepBody}>
                <WordText style={styles.stepTitle}>{step.title}</WordText>
                <WordText style={styles.stepText}>{matchOpen || step.whileShut === undefined ? step.body : step.whileShut}</WordText>
              </View>
            </CardFrame>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="무료로 내 사주 보기" onPress={() => void goHome()} />
        <SecondaryButton label="자주 묻는 질문" onPress={() => router.push('/help')} />
      </View>
    </InfoScreen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 12 },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  title: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 34, color: COLOR.foreground },
  lead: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.creamInk },
  section: { gap: 16 },
  sectionTitle: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: COLOR.foreground },
  feature: { gap: 8 },
  iconBadge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSoft },
  name: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 24, color: COLOR.foreground },
  body: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  steps: { gap: 8 },
  step: { flexDirection: 'row', gap: 16, padding: 16 },
  stepNumber: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  stepNumberText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.onAccent },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  stepText: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 24, color: COLOR.secondary },
  actions: { gap: 8 },
});
