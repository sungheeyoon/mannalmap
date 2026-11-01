import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { SERVICE_NAME } from '@brand';
import { REFUND_TERMS_POINTER, refundPolicyFor } from '@brand/refund';

import { appBusinessInfo } from '@/info/business';
import { FinePrint, InfoScreen, LegalHead } from '@/info/frame';
import { LegalBody } from '@/info/legal-body';
import { PoliciesLink } from '@/info/policy-links';
import { COLOR, FONT } from '@/ui/tokens';

/** 환불정책 — 웹의 `/refund` 와 같은 `refundPolicyFor` 다. 풀이권 구매에서 왔으면(`?from=credits`) 주소로 바로 열렸을 때의 뒤로가 그 화면이다 */
export default function RefundScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const policy = refundPolicyFor(appBusinessInfo());
  return (
    <InfoScreen title="환불정책" fallback={from === 'credits' ? '/me/credits' : '/'}>
      <LegalHead title={`${SERVICE_NAME} 환불정책`} note={policy.effectiveDate ? '시행일 ' + policy.effectiveDate : null} />
      <LegalBody document={policy} />
      <FinePrint>
        {REFUND_TERMS_POINTER.before}
        <Text accessibilityRole="link" style={styles.link} onPress={() => router.push('/terms')}>
          {REFUND_TERMS_POINTER.link}
        </Text>
        {REFUND_TERMS_POINTER.after}
      </FinePrint>
      <PoliciesLink />
    </InfoScreen>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: FONT.bold, color: COLOR.foreground, textDecorationLine: 'underline' },
});
