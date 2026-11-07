import { Linking, StyleSheet, Text, View } from 'react-native';

import { BUSINESS_DISCLOSURE_LINK, BUSINESS_INFO, businessInfoLines } from '@brand/business';
import { POLICY_LINKS } from '@brand/links';

import { BUSINESS_LABEL, POLICY_TITLE } from '@/info/copy';
import { InfoScreen } from '@/info/frame';
import { legalPagesOpen, openLegalPage } from '@/info/legal-web';
import { LinkRow } from '@/settings/parts';
import { TextButton } from '@/ui/parts';
import { Card, CardFrame } from '@/ui/surfaces';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

/**
 * 약관 및 정책 — 웹 바닥글의 약관 셋과 사업자 정보 줄이 앱에서 서는 한 장이다(같은 `POLICY_LINKS` · `businessInfoLines`, 전자상거래법 제10조 · ADR 0172).
 * 로그인 없이 열린다. 값은 웹과 같은 상수 `BUSINESS_INFO`(ADR 0232)이고 빈 줄은 안 선다. 약관 셋은 웹의 현행 판을 앱 안 브라우저로 연다 —
 * 웹 주소가 없는 빌드에는 그 판이 안 선다(ADR 0172 추기 2026-11-07).
 */
export default function PoliciesScreen() {
  const info = BUSINESS_INFO;
  return (
    <InfoScreen title={POLICY_TITLE} fallback="/">
      {legalPagesOpen && (
        <CardFrame>
          {POLICY_LINKS.map((link) => (
            <LinkRow key={link.href} label={link.label} onPress={() => openLegalPage(link.href)} />
          ))}
        </CardFrame>
      )}
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={styles.head}>
          {BUSINESS_LABEL}
        </Text>
        {businessInfoLines(info).map((line) => (
          <View key={line.key}>
            <Text style={styles.label}>{line.label}</Text>
            <Text selectable style={styles.value}>
              {line.value}
            </Text>
          </View>
        ))}
        {info.disclosureUrl !== null && (
          <View style={styles.disclosure}>
            <TextButton label={BUSINESS_DISCLOSURE_LINK} onPress={() => void Linking.openURL(info.disclosureUrl as string)} />
          </View>
        )}
      </Card>
    </InfoScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  label: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  value: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  disclosure: { alignSelf: 'flex-start' },
});
