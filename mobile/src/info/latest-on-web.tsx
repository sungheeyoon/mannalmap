import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';

import type { POLICY_LINKS } from '@brand/links';

import { SITE_URL } from '@/site';
import { TextButton } from '@/ui/parts';

import { BUNDLED_TEXT_NOTE, LATEST_ON_WEB_LABEL } from './copy';
import { FinePrint } from './frame';

/**
 * **약관 셋의 최신 판은 웹에 있다** — 앱은 OTA 가 없어 약관 · 환불정책 · 처리방침 글이 빌드에 박힌다. 웹이 개정되면 설치된 앱은
 * 옛 글을 계속 보이므로, 머리 아래에 그 사실과 웹의 같은 화면을 여는 단추를 둔다. 여는 법은 채팅의 바깥 링크와 같은 앱 안 브라우저다.
 * 웹 주소가 없는 빌드(`SITE_URL` 이 `null`)에는 서지 않는다.
 */
export function LatestOnWeb({ path }: { path: (typeof POLICY_LINKS)[number]['href'] }) {
  if (!SITE_URL) return null;
  const url = new URL(path, SITE_URL).toString();
  return (
    <View style={styles.box}>
      <FinePrint>{BUNDLED_TEXT_NOTE}</FinePrint>
      <View style={styles.link}>
        <TextButton label={LATEST_ON_WEB_LABEL} onPress={() => void WebBrowser.openBrowserAsync(url)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4 },
  link: { alignSelf: 'flex-start' },
});
