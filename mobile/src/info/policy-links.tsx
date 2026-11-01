import { router } from 'expo-router';
import { View } from 'react-native';

import { TextButton } from '@/ui/parts';

import { POLICY_TITLE } from './copy';

/**
 * 약관 전문 끝의 길 — 설정에 못 들어가는 사람(로그인 전 · 가입 중)도 처리방침 한 장에서 나머지 약관 · 사업자 정보 · 연락처에 닿는다.
 * 가입 화면과 첫 화면이 처리방침으로 잇는다. 스택에 이미 있으면 거기까지 돌아가 겹쳐 쌓이지 않는다.
 */
export function PoliciesLink() {
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <TextButton label={POLICY_TITLE} onPress={() => router.dismissTo('/policies' as never)} />
    </View>
  );
}
