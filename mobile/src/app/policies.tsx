import { router } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { BUSINESS_DISCLOSURE_LINK, businessInfoLines } from '@brand/business';
import { POLICY_LINKS } from '@brand/links';

import { appBusinessInfo } from '@/info/business';
import { BUSINESS_LABEL, POLICY_TITLE } from '@/info/copy';
import { InfoScreen } from '@/info/frame';
import { LinkRow } from '@/settings/parts';
import { TextButton } from '@/ui/parts';
import { Card, CardFrame } from '@/ui/surfaces';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

/**
 * 약관 및 정책 — 웹 바닥글의 약관 셋과 사업자 정보 줄이 앱에서 서는 한 장이다(같은 `POLICY_LINKS` · `businessInfoLines`, 전자상거래법 제10조 · ADR 0172).
 * 로그인 없이 열린다. 값이 빈 줄은 안 서고, 이메일은 상수라 늘 선다.
 */
export default function PoliciesScreen() {
  const info = appBusinessInfo();
  return (
    <InfoScreen title={POLICY_TITLE} fallback="/">
      <CardFrame>
        {POLICY_LINKS.map((link) => (
          <LinkRow key={link.href} label={link.label} onPress={() => router.push(link.href as never)} />
        ))}
      </CardFrame>
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
