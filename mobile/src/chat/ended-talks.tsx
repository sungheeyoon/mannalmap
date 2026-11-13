import { ENDED_TALK_REPORT, ENDED_TALKS_NOTE, ENDED_TALKS_TITLE } from '@chat/room/detail-copy';
import { when } from '@matching/requests';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useClient } from '@/auth/connected';
import { readEndedTalkMessages, type EndedTalk } from '@/matching/talk-doors';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { ReportDialog, type ReportableMessage } from './dialogs';
import { WordText } from '@/ui/word-text';

/** 끝난 대화의 신고 길(ADR 0215) — 말은 누른 뒤에만 읽고 방은 다시 안 연다. 대화방과 같은 신고 창이고, 이미 끝나 차단으로 넘어가는 길은 없다 */
export function EndedTalks({ talks }: { talks: readonly EndedTalk[] }) {
  const client = useClient();
  const [opened, setOpened] = useState<{ talk: EndedTalk; messages: readonly ReportableMessage[] } | null>(null);
  if (talks.length === 0) return null;
  const open = (talk: EndedTalk) =>
    void readEndedTalkMessages(client, talk.matchId).then(
      (messages) => setOpened({ talk, messages }),
      () => setOpened({ talk, messages: [] }),
    );
  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <WordText style={styles.title}>{ENDED_TALKS_TITLE}</WordText>
        <WordText style={styles.meta}>{ENDED_TALKS_NOTE}</WordText>
      </View>
      {talks.map((talk) => (
        <View key={talk.matchId} style={styles.row}>
          <View style={styles.flex}>
            <WordText numberOfLines={1} style={styles.name}>
              {talk.nickname}
            </WordText>
            <WordText style={styles.meta}>{when(talk.closedAt)}</WordText>
          </View>
          <Pressable accessibilityRole="button" onPress={() => open(talk)} style={styles.report}>
            <WordText style={styles.reportText}>{ENDED_TALK_REPORT}</WordText>
          </Pressable>
        </View>
      ))}
      {opened !== null && <ReportDialog userId={opened.talk.partnerUserId} nickname={opened.talk.nickname} messages={opened.messages} onClose={() => setOpened(null)} onBlock={null} />}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  head: { gap: 4 },
  title: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  flex: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.foreground },
  report: { minHeight: CONTROL, justifyContent: 'center', paddingHorizontal: 16, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong },
  reportText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
});
