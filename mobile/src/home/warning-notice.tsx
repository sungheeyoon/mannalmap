import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { WARNING_ACKNOWLEDGE_LABEL, WARNING_NOTICE_TITLE, warningNoticeLines, type WarningNotice as Notice } from '@account/warning';
import { SUPPORT_EMAIL } from '@brand';

import { useClient } from '@/auth/connected';
import { PrimaryButton } from '@/ui/parts';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { CardFrame } from '@/ui/surfaces';

import { acknowledgeWarning, readWarningNotice } from './warning';
import { WordText } from '@/ui/word-text';

/**
 * 경고를 받은 사람에게 서는 안내 — 웹의 `app/me/warning/warning-notice.tsx` 와 같은 문 · 같은 글자다(ADR 0108).
 * 무엇을 내주는가는 문이 정한다. 못 읽었으면 안 그린다 — 부속 정보다. 못 적었으면 안내는 그대로 둔다 — 안 읽은 채 사라지면 「알렸는가」가 거짓이 된다.
 */
export function WarningNotice() {
  const client = useClient();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const read = useCallback(async () => setNotice(await readWarningNotice(client)), [client]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 여는 때 읽는다 - setState 는 await 뒤라 렌더와 겹치지 않는다
    void read();
  }, [read]);

  if (notice === null) return null;

  const acknowledge = async () => {
    setFailure(null);
    setSaving(true);
    const refused = await acknowledgeWarning(client, notice.ref);
    if (refused !== null) setFailure(refused);
    else await read();
    setSaving(false);
  };

  return (
    <View style={styles.wrap}>
      <CardFrame accessibilityLabel={WARNING_NOTICE_TITLE} style={styles.card}>
        <WordText accessibilityRole="header" style={styles.title}>{WARNING_NOTICE_TITLE}</WordText>
        <View style={styles.lines}>
          {warningNoticeLines(notice, SUPPORT_EMAIL).map((line) => (
            <WordText key={line} style={styles.line}>{line}</WordText>
          ))}
        </View>
        <PrimaryButton label={WARNING_ACKNOWLEDGE_LABEL} onPress={() => void acknowledge()} disabled={saving} />
        {failure !== null && <WordText accessibilityRole="alert" style={styles.failure}>{failure}</WordText>}
      </CardFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  card: { gap: 12, padding: 20, borderColor: COLOR.dangerLine, backgroundColor: COLOR.dangerWash },
  title: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.danger },
  lines: { gap: 4 },
  line: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger },
});
