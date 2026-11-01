import { MATCHING_INTRO_AGE, MATCHING_INTRO_EXAMPLE, MATCHING_INTRO_START, MATCHING_INTRO_TITLE } from '@brand/guide';
import { CHAT_USES_NO_CREDIT, MATCH_ACCEPT_HIDDEN, MATCH_ACCEPT_OPENS, RECEIVER_USES_NO_CREDIT } from '@consent/disclosure';
import { withReturnPath } from '@consent/return-path';
import { SIGNUP_NOTICE_DISCOVERY } from '@consent/signup';
import { REQUEST_RESERVES_NOTE } from '@reading/notes';
import { ELEMENT_PICTURE_KO, type Element } from '@saju';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { InfoScreen } from '@/info/frame';
import { ElementSymbol } from '@/ui/element-symbol';
import { PrimaryButton } from '@/ui/parts';
import { CardFrame, Tile } from '@/ui/surfaces';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

const SUPPLIES: readonly Element[] = ['金', '水'];

/** 실제 규칙 그대로다 — 풀이권은 약관 제14조 · `REQUEST_RESERVES_NOTE`, 수락 뒤 열리는 것은 요청 창과 같은 `MATCH_ACCEPT_*` */
const STEPS: readonly { title: string; body: string }[] = [
  { title: '추천 이유', body: `사주로 어울리는 참여자를 소개하고, ${MATCHING_INTRO_EXAMPLE.supply}을 함께 보여 드려요.` },
  { title: '서로 수락', body: `궁합을 요청하면 풀이권 1장이 예약돼요. ${REQUEST_RESERVES_NOTE} ${RECEIVER_USES_NO_CREDIT}` },
  { title: '궁합', body: `수락하면 예약한 풀이권으로 ${MATCH_ACCEPT_OPENS[1]} ${MATCH_ACCEPT_OPENS[0]} ${MATCH_ACCEPT_HIDDEN}` },
  { title: '무료 채팅', body: `수락하면 ${MATCH_ACCEPT_OPENS[2]} ${CHAT_USES_NO_CREDIT}` },
];

/**
 * 인연 소개 — 로그인 없이 열리는 정적 화면이다. 서버를 안 부르고 실제 회원이 안 나온다(ADR 0213 의 10).
 * 예시 카드는 눌리지 않아 아무에게도 가지 않는다. 참여는 인연 탭의 그 길이다 — 로그인 · 가입 화면이 남은 단계를 말한다.
 */
export default function MatchingIntroScreen() {
  return (
    <InfoScreen title={MATCHING_INTRO_TITLE} fallback="/">
      <Tile tone={ELEMENT_TONE[SUPPLIES[0]].soft} style={styles.example} accessibilityLabel={`예시 카드. ${MATCHING_INTRO_EXAMPLE.note}`}>
        <View style={styles.exampleHead}>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>{MATCHING_INTRO_EXAMPLE.stamp}</Text>
          </View>
          <Text style={styles.score}>
            {MATCHING_INTRO_EXAMPLE.score}
            <Text style={styles.scoreOf}> / 100</Text>
          </Text>
        </View>
        <Text style={styles.verdict}>{MATCHING_INTRO_EXAMPLE.verdict}</Text>
        <View style={styles.supply}>
          <View style={styles.dots}>
            {SUPPLIES.map((element, index) => (
              <View key={element} style={[styles.dot, { backgroundColor: ELEMENT_TONE[element].soft, marginLeft: index === 0 ? 0 : -10 }]}>
                <ElementSymbol element={element} size={24} />
              </View>
            ))}
          </View>
          <View style={styles.flex}>
            <Text style={styles.supplyHead}>{MATCHING_INTRO_EXAMPLE.supply}</Text>
            <Text style={styles.supplyNames}>{SUPPLIES.map((element) => ELEMENT_PICTURE_KO[element]).join(' · ')}</Text>
          </View>
        </View>
        <Text style={styles.note}>{MATCHING_INTRO_EXAMPLE.note}</Text>
      </Tile>

      <CardFrame>
        {STEPS.map((step, index) => (
          <View key={step.title} style={[styles.step, index > 0 && styles.stepLine]}>
            <View style={styles.number}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <WordText style={styles.stepBody}>{step.body}</WordText>
            </View>
          </View>
        ))}
      </CardFrame>

      <View style={styles.notes}>
        <WordText style={styles.line}>{SIGNUP_NOTICE_DISCOVERY}</WordText>
        <Text style={styles.line}>{MATCHING_INTRO_AGE}</Text>
      </View>

      <PrimaryButton label={MATCHING_INTRO_START} onPress={() => router.push(withReturnPath('/auth', '/me/matching') as never)} />
    </InfoScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  example: { gap: 12 },
  exampleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stamp: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
  stampText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  score: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  scoreOf: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  verdict: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 26, color: COLOR.foreground },
  supply: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dots: { flexDirection: 'row' },
  dot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 2, borderColor: COLOR.surface },
  supplyHead: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  supplyNames: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  note: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.secondary },
  step: { flexDirection: 'row', gap: 12, padding: 16 },
  stepLine: { borderTopWidth: 1, borderTopColor: COLOR.border },
  number: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken },
  numberText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  stepTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  stepBody: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 22, color: COLOR.secondary },
  notes: { gap: 4, marginHorizontal: 4 },
  line: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.secondary },
});
