import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { SUPPORT_EMAIL } from '@brand';

import { SecondaryButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';

import { COPY_EMAIL_DONE, COPY_EMAIL_FAILED, COPY_EMAIL_LABEL, MAIL_FAILED, SEND_MAIL_LABEL } from './copy';

/**
 * 문의는 메일 한 길이다(약관 제29조의 연락처) — 앱 안 문의 창은 없다. 메일 앱이 없는 기기를 위해 주소는 화면의 줄에 고를 수 있게 선다.
 * 메일 앱을 못 열었을 때만 주소 복사 단추가 선다 — 평소 화면의 단추는 하나다. 복사한 뒤의 말은 공유 링크 단추와 같은 방식(단추 글자가 잠깐 바뀐다)이다.
 */
export function SendMail() {
  const [failed, setFailed] = useState(false);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (copy !== 'copied') return;
    const timer = setTimeout(() => setCopy('idle'), 4000);
    return () => clearTimeout(timer);
  }, [copy]);

  const open = () => {
    setFailed(false);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => setFailed(true));
  };
  const copyAddress = async () => {
    try {
      await Clipboard.setStringAsync(SUPPORT_EMAIL);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  return (
    <View style={styles.box}>
      <SecondaryButton label={SEND_MAIL_LABEL} onPress={open} />
      {failed && (
        <>
          <Text accessibilityRole="alert" style={styles.failure}>
            {copy === 'failed' ? COPY_EMAIL_FAILED : MAIL_FAILED}
          </Text>
          <SecondaryButton label={copy === 'copied' ? COPY_EMAIL_DONE : COPY_EMAIL_LABEL} onPress={() => void copyAddress()} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 22, color: COLOR.danger },
});
