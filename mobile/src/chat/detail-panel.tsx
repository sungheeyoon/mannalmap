import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { detailPanelOf, type MatchDetail } from '@chat/room/detail';
import { DETAIL_CANCEL_NOTE, DETAIL_CANCEL_TITLE, DETAIL_CANCELLED } from '@chat/room/detail-copy';
import { REQUEST_STATUS_TEXT } from '@consent/index';

import { useClient } from '@/auth/connected';
import { cancelRequest, respondToRequest } from '@/matching/doors';
import { ConfirmDialog, DialogText } from '@/ui/confirm-dialog';
import { requestDetail } from '@/matching/talk-doors';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

/**
 * 방 상단의 상세 궁합 칸 — 글자와 누를 일은 공용 `detailPanelOf` 가 정한다(웹과 같다). 받은 사람의 답은 만들기와 그냥 둠뿐이라 거절 단추가 없다.
 * 재전송은 같은 키다: 받았는지 모르는 실패면 키를 들고 있다가 다시 보낸다.
 */
export function DetailPanelView({ detail, matchId, onChanged, onNote }: { detail: MatchDetail; matchId: string; onChanged: () => void; onNote: (note: string) => void }) {
  const client = useClient();
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const panel = detailPanelOf(detail);
  const [asking, setAsking] = useState(false);

  const cancel = async () => {
    if (detail.requestId === null) return;
    setWorking(true);
    setFailure(null);
    const result = await cancelRequest(client, detail.requestId);
    setWorking(false);
    setAsking(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    /* 그 사이 상대가 동의했으면 취소되지 않았다 — 없는 일을 알리지 않는다(대장 01) */
    if (result.status === 'cancelled') onNote(DETAIL_CANCELLED);
    onChanged();
  };

  const ask = async () => {
    /* 앱에는 `crypto` 전역이 없을 수 있어 공용 `newDetailKey` 대신 기기의 난수로 짓는다 — 같은 uuid v4 다 */
    key.current ??= Crypto.randomUUID();
    const result = await requestDetail(client, matchId, key.current);
    if (!result.ok) {
      if (!result.unsure) key.current = null;
      setFailure(result.message);
      return;
    }
    key.current = null;
    onChanged();
  };

  const consent = async () => {
    if (detail.requestId === null) return;
    const result = await respondToRequest(client, detail.requestId);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    if (result.status !== 'accepted') setFailure(REQUEST_STATUS_TEXT[result.status].received);
    onChanged();
  };

  const press = async () => {
    const kind = panel.action?.kind;
    if (kind === 'see') {
      router.push(`/me/match/${matchId}?from=chat` as never);
      return;
    }
    setWorking(true);
    setFailure(null);
    await (kind === 'consent' ? consent() : ask());
    setWorking(false);
  };

  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        {detail.state === 'making' && <ActivityIndicator size="small" color={COLOR.secondary} />}
        <WordText style={styles.title}>{panel.title}</WordText>
      </View>
      {panel.lines.map((line) => (
        <WordText key={line} style={styles.line}>
          {line}
        </WordText>
      ))}
      {failure !== null && (
        <WordText style={styles.failure} accessibilityRole="alert">
          {failure}
        </WordText>
      )}
      {panel.action !== null && (
        <Pressable accessibilityRole="button" disabled={working} onPress={() => void press()} style={[styles.action, working && styles.off]}>
          <WordText style={styles.actionText}>{panel.action.label}</WordText>
        </Pressable>
      )}
      {panel.cancelLabel !== undefined && (
        <>
          <Pressable accessibilityRole="button" disabled={working} onPress={() => setAsking(true)} style={[styles.quiet, working && styles.off]}>
            <WordText style={styles.quietText}>{panel.cancelLabel}</WordText>
          </Pressable>
          <ConfirmDialog open={asking} onClose={() => setAsking(false)} title={DETAIL_CANCEL_TITLE} confirmLabel={panel.cancelLabel} cancelLabel="닫기" onConfirm={() => void cancel()} busy={working}>
            <DialogText>{DETAIL_CANCEL_NOTE}</DialogText>
          </ConfirmDialog>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 6, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLOR.surfaceSoft, borderBottomWidth: 1, borderBottomColor: COLOR.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: FONT.bold, fontSize: TYPE.note, lineHeight: 20, color: COLOR.foreground },
  line: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.secondary },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  action: { minHeight: CONTROL, marginTop: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  actionText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.onAccent },
  off: { opacity: 0.55 },
  quiet: { minHeight: CONTROL, marginTop: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong },
  quietText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.foreground },
});
