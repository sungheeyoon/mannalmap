import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { SUPPORT_EMAIL } from '@brand';

import { SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

import { MAIL_FAILED, SEND_MAIL_LABEL } from './copy';

/** 문의는 메일 한 길이다(약관 제29조의 연락처) — 앱 안 문의 창은 없다. 메일 앱이 없는 기기를 위해 주소는 화면의 줄에 고를 수 있게 선다 */
export function SendMail() {
  const [failed, setFailed] = useState(false);
  const open = () => {
    setFailed(false);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => setFailed(true));
  };
  return (
    <View style={styles.box}>
      <SecondaryButton label={SEND_MAIL_LABEL} onPress={open} />
      {failed && (
        <Text accessibilityRole="alert" style={styles.failure}>
          {MAIL_FAILED}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 22, color: COLOR.danger },
});
