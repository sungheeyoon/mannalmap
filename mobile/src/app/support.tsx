import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { GUIDE_LINKS } from '@brand/links';

import { SendMail } from '@/info/contact';
import { CONTACT_LABEL, SUPPORT_MAIL_LINE, SUPPORT_TITLE } from '@/info/copy';
import { InfoScreen } from '@/info/frame';
import { LinkRow } from '@/settings/parts';
import { Card, CardFrame } from '@/ui/surfaces';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

/** 고객센터 — 로그인 없이 열린다. 답 시한을 말하지 않는다: 약속할 기능이 없다 */
export default function SupportScreen() {
  return (
    <InfoScreen title={SUPPORT_TITLE} fallback="/">
      <Card style={styles.card}>
        <WordText accessibilityRole="header" style={styles.head}>
          {CONTACT_LABEL}
        </WordText>
        <WordText selectable style={styles.line}>
          {SUPPORT_MAIL_LINE}
        </WordText>
        <SendMail />
      </Card>
      <CardFrame>
        {GUIDE_LINKS.filter((link) => link.href === '/help').map((link) => (
          <LinkRow key={link.href} label={link.label} onPress={() => router.push(link.href as never)} />
        ))}
      </CardFrame>
    </InfoScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 26, color: COLOR.secondary },
});
