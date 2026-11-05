import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SERVICE_NAME } from '@brand';
import { SERVICE_FEATURES } from '@brand/features';
import { ABOUT_LEAD, COMPAT_ENTRY, MATCHING_INTRO_TITLE, MEMBER_SIGN_IN_ASK, RESULT_EXAMPLE_STAMP, TRIAL_START } from '@brand/guide';
import { READING_EXAMPLE } from '@reading/preview';

import { withReturnPath } from '@consent/return-path';
import { matchEntriesStand } from '@matching/opening';
import { useMatchOpen } from '@/matching/opening';
import { POLICY_TITLE, SUPPORT_TITLE } from '@/info/copy';
import { Markdown } from '@/reading/markdown';
import { Mark } from '@/share/marks';
import { Logo } from '@/ui/logo';
import { PrimaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Card, Paper } from '@/ui/surfaces';

/** 로그인 전의 아래 길 — 웹 바닥글을 옮기지 않는다. 자주 묻는 질문 · 문의는 고객센터 안, 약관 셋과 사업자 정보는 약관 및 정책 안이다 */
const ENTRY_LINKS = [
  { label: '서비스 소개', open: () => router.push('/about') },
  { label: SUPPORT_TITLE, open: () => router.push('/support') },
  { label: POLICY_TITLE, open: () => router.push('/policies') },
];

/** 생년월일시로 무엇을 보나 — 서비스 소개의 「사주」 줄 그대로다 */
const CHART_LINE = SERVICE_FEATURES.find((feature) => feature.title === '사주')?.body ?? '';
/** 사주풀이 줄 — 서비스 소개의 이름 · 조건 그대로다 */
const READING_FEATURE = SERVICE_FEATURES.find((feature) => feature.icon === 'reading');

/**
 * **로그인 전 첫 화면 — 소개**(ADR 0226). 웹 `/` 의 소개(`app/first-intro.tsx`)와 같은 차례 · 같은 글자다 — 제목 → 한 줄 → **사주풀이 예시**
 * (풀이 화면의 표지 비유 · 절 제목 · 첫 문단 꼴, 「예시」라고 적힌다 — 글은 `src/lib/reading/preview.ts` 한 벌) → 볼 수 있는 것과 사주풀이의 조건 → 두 입구.
 * 슬라이드도 저절로 넘어가는 소개도 없다.
 *
 * 「로그인 없이 사주 보기」는 입력 화면을 스택에 올린다(`/?start=1`) — 뒤로 가면 소개다. 「로그인」은 홈으로 간다(목적지 기본값).
 * 앱에는 로그인 전 궁합 결과가 없어 궁합은 로그인을 지난다(ADR 0213 의 11) — 웹의 「궁합 첫 신호는 로그인 없이」 줄을 세우지 않는다.
 */
export function FirstIntro() {
  const matchOpen = useMatchOpen();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <Logo size={32} />
          <Text style={styles.brand}>{SERVICE_NAME}</Text>
        </View>
        <Paper style={styles.paper}>
          <View style={styles.head}>
            <Text accessibilityRole="header" style={styles.title}>나는 어떤 사람일까?</Text>
            <Text style={styles.lead}>{ABOUT_LEAD[0]}</Text>
          </View>

          {/* 풀이 화면의 표지(“ · 비유)와 본문(절 제목 · 문단)을 같은 부품으로 줄여 세운다 — 누를 자리가 없다 */}
          <Card accessibilityLabel={`${READING_FEATURE?.title ?? ''} ${RESULT_EXAMPLE_STAMP}`} style={styles.example}>
            <View style={styles.exampleHead}>
              <View style={styles.stamp}>
                <Text style={styles.stampText}>{RESULT_EXAMPLE_STAMP}</Text>
              </View>
              <Text style={styles.exampleKind}>{READING_FEATURE?.title}</Text>
            </View>
            <Text aria-hidden style={styles.quote}>“</Text>
            <Text style={styles.metaphor}>{READING_EXAMPLE.metaphor}</Text>
            <View style={styles.excerpt}>
              <Markdown source={READING_EXAMPLE.excerpt} />
            </View>
          </Card>

          <View style={styles.reachLines}>
            <Text style={styles.reach}>{CHART_LINE}</Text>
            {READING_FEATURE !== undefined && (
              <Text style={styles.reach}>
                <Text style={styles.reachName}>{READING_FEATURE.title}</Text> · {READING_FEATURE.note}
              </Text>
            )}
          </View>

          <View style={styles.action}>
            <PrimaryButton label={TRIAL_START} onPress={() => router.push('/?start=1' as never)} />
            <View style={styles.member}>
              <Text style={styles.memberAsk}>{MEMBER_SIGN_IN_ASK}</Text>
              <Pressable accessibilityRole="link" onPress={() => router.push('/auth' as never)} style={styles.signIn}>
                <Text style={styles.signInText}>로그인</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.doors}>
            {/* 인연이 닫힌 동안은 소개도 안 선다(ADR 0222) */}
            {matchEntriesStand(matchOpen) && (
              <Pressable accessibilityRole="link" onPress={() => router.push('/matching-intro')} style={styles.door}>
                <Text style={styles.doorText}>{MATCHING_INTRO_TITLE}</Text>
                <Mark name="arrow" size={16} color={COLOR.secondary} />
              </Pressable>
            )}
            {/* 궁합은 로그인 뒤 궁합 탭이다 — 앱에는 로그인 전 궁합 결과가 없다(ADR 0213 의 11) */}
            <Pressable accessibilityRole="link" onPress={() => router.push(withReturnPath('/auth', '/me/compat') as never)} style={styles.door}>
              <Text style={styles.doorText}>{COMPAT_ENTRY}</Text>
              <Mark name="arrow" size={16} color={COLOR.secondary} />
            </Pressable>
          </View>
        </Paper>

        <View accessibilityLabel="안내" style={styles.links}>
          {ENTRY_LINKS.map((link) => (
            <Pressable key={link.label} accessibilityRole="link" onPress={link.open} style={styles.link}>
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 4, marginBottom: 12, minHeight: 44 },
  brand: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.foreground },
  paper: { paddingHorizontal: 12, paddingTop: 20, paddingBottom: 20, gap: 16 },
  head: { gap: 4, marginHorizontal: 4 },
  title: { fontSize: TYPE.title, lineHeight: 35, fontFamily: FONT.bold, color: COLOR.foreground },
  lead: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.creamInk },
  example: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  exampleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stamp: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken },
  stampText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  exampleKind: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  /* 풀이 화면의 표지(`@/reading/result` 의 quote · metaphor)를 한 단 줄인 꼴 */
  quote: { marginTop: 12, height: 32, fontFamily: FONT.bold, fontSize: 52, lineHeight: 60, color: COLOR.foreground, opacity: 0.6 },
  metaphor: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 29, color: COLOR.foreground },
  excerpt: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  reachLines: { gap: 2, marginHorizontal: 4 },
  reach: { fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  reachName: { fontFamily: FONT.bold, color: COLOR.foreground },
  action: { gap: 4 },
  member: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  memberAsk: { fontSize: TYPE.small, fontFamily: FONT.medium, color: COLOR.secondary },
  signIn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  signInText: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.foreground, textDecorationLine: 'underline' },
  doors: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, marginHorizontal: 4 },
  door: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  doorText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.secondary },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, marginTop: 12, marginHorizontal: 4 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
});
