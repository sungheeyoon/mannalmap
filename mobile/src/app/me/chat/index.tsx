import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CHAT_TAB_LABEL, messageTimeLabel, partnerNameOf, roomNoticeOf } from '@chat';
import { ROOM_NO_MESSAGES_YET, TALK_UNANSWERED_LABEL } from '@chat/copy';
import { foldUnanswered } from '@chat/room/talk';
import type { Element } from '@saju';

import { Avatar } from '@/chat/avatar';
import { EmptyChat } from '@/chat/empty';
import { listenLive } from '@/chat/live';
import { UNREACHABLE } from '@/auth/signup';
import { AccountNotice, FailureLine } from '@/chat/notices';
import { settled } from '@/ui/settled';
import { noteActivity, readRoomListScreen, type ChatRoom, type RoomListScreen } from '@/chat/reads';
import { ReportDialog, type ReportableMessage } from '@/chat/dialogs';
import { readEndedTalkMessages, type EndedTalk } from '@/matching/talk-doors';
import { Icon } from '@/ui/icons';
import { LoadingMark } from '@/ui/loading';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

/** 한 물결의 변경을 묶어 다시 읽는 간격 — 웹의 `REDRAW_AFTER_MS` 와 같다 */
const REREAD_AFTER_MS = 400;

/** 대화방 목록 — 누가 어느 방을 보는가는 읽는 문이 정한다(ADR 0091). 접속 상태는 여기 안 선다(ADR 0092) */
export default function ChatRoomsScreen() {
  const [screen, setScreen] = useState<RoomListScreen | null>(null);
  const live = useRef(true);

  const load = useCallback(async () => {
    const next = await settled(readRoomListScreen(), 'readRoomListScreen', () => ({ kind: 'failed', message: UNREACHABLE }) as const);
    if (!live.current) return;
    if (next.kind === 'signed-out') router.replace('/');
    /* 선 화면을 다시 읽다 실패하면 가진 것을 그대로 둔다 — 다음 다시 대조가 메운다 */
    else setScreen((now) => (now?.kind === 'ready' && next.kind === 'failed' ? now : next));
  }, []);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  /* 사람이 이 화면을 연 것은 활동이다 — 돌아올 때마다 다시 읽는다(방에서 읽은 수 · 마지막 말) */
  useFocusEffect(
    useCallback(() => {
      noteActivity();
      void load();
    }, [load]),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listenLive((signal) => {
      if (signal.kind === 'change' && signal.change.area !== 'chat' && signal.change.area !== 'requests') return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => void load(), REREAD_AFTER_MS);
    });
    return () => {
      unlisten();
      if (timer !== null) clearTimeout(timer);
    };
  }, [load]);

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        {CHAT_TAB_LABEL}
      </Text>
      {screen === null && <LoadingMark />}
      {screen !== null && screen.kind === 'failed' && (
        <View style={styles.pad}>
          <FailureLine onRetry={load}>{screen.message}</FailureLine>
        </View>
      )}
      {screen !== null && screen.kind === 'blocked' && (
        <View style={styles.pad}>
          <AccountNotice state={screen.state} onRetry={load} />
        </View>
      )}
      {screen !== null && screen.kind === 'ready' && screen.rooms.length === 0 && (
        <View style={styles.pad}>
          <EmptyChat hasSelf={screen.hasSelf} />
        </View>
      )}
      {screen !== null && screen.kind === 'ready' && screen.rooms.length > 0 && (
        <RoomList screen={screen} />
      )}
    </View>
  );
}

/** 받은 사람이 그냥 둔 대화는 아래에 접힌다 — 재촉하지 않고 지우지도 않는다. 없으면 접이칸도 없다 */
function RoomList({ screen }: { screen: Extract<RoomListScreen, { kind: 'ready' }> }) {
  const [open, setOpen] = useState(false);
  const { rooms, unanswered } = useMemo(() => foldUnanswered(screen.rooms, screen.requests), [screen.rooms, screen.requests]);
  const row = (room: ChatRoom) => <RoomRow key={room.matchId} room={room} tone={screen.tones.get(room.matchId)?.theirs.element ?? null} />;
  return (
    <FlatList
      data={rooms}
      keyExtractor={(room) => room.matchId}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => row(item)}
      ListFooterComponent={
        unanswered.length === 0 && screen.ended.length === 0 ? undefined : (
          <View>
            {unanswered.length > 0 && (
              <>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.fold}>
              <Text style={styles.foldText}>
                {TALK_UNANSWERED_LABEL} {unanswered.length}
              </Text>
              <View style={open && styles.turned}>
                <Icon name="chevron" color={COLOR.secondary} size={16} />
              </View>
            </Pressable>
            {open && unanswered.map(row)}
              </>
            )}
            <EndedTalks talks={screen.ended} />
          </View>
        )
      }
    />
  );
}

/** 끝난 대화의 신고 길(ADR 0215) — 방은 안 열린다. 이름만 서고 누르면 신고 창이다. 없으면 칸도 없다 */
function EndedTalks({ talks }: { talks: readonly EndedTalk[] }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState<{ talk: EndedTalk; messages: readonly ReportableMessage[] } | null>(null);
  if (talks.length === 0) return null;
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.fold}>
        <Text style={styles.foldText}>
          끝난 대화 {talks.length}
        </Text>
        <View style={open && styles.turned}>
          <Icon name="chevron" color={COLOR.secondary} size={16} />
        </View>
      </Pressable>
      {open &&
        talks.map((talk) => (
          <Pressable
            key={talk.matchId}
            accessibilityRole="button"
            onPress={() => void readEndedTalkMessages(talk.matchId).then((messages) => setReporting({ talk, messages }), () => setReporting({ talk, messages: [] }))}
            style={styles.endedRow}
          >
            <Text numberOfLines={1} style={styles.preview}>
              {talk.nickname}
            </Text>
            <Icon name="flag" color={COLOR.secondary} size={16} />
          </Pressable>
        ))}
      {reporting !== null && <ReportDialog userId={reporting.talk.partnerUserId} nickname={reporting.talk.nickname} messages={reporting.messages} onClose={() => setReporting(null)} onBlock={null} />}
    </View>
  );
}

function RoomRow({ room, tone }: { room: ChatRoom; tone: Element | null }) {
  /* 닫힌 방은 마지막 말 대신 닫힌 까닭이 자물쇠와 함께 선다 — 누르기 전에 무엇이 안 되는지 읽힌다 */
  const notice = roomNoticeOf(room);
  const closed = notice !== null;
  const name = partnerNameOf(room);
  const unread = room.unread;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={unread > 0 ? `${name} ${unread}건 안 읽음` : name}
      onPress={() => router.push(`/me/chat/${room.matchId}` as never)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar nickname={name} size={56} tone={tone} dim={closed} userId={room.partnerUserId} hasPhoto={room.partnerHasPhoto} focus={room.partnerPhotoFocus} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={[styles.name, closed && styles.quiet]}>
            {name}
          </Text>
          <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{messageTimeLabel(room.lastMessageAt ?? room.openedAt)}</Text>
        </View>
        <View style={styles.rowBottom}>
          {closed && <Icon name="lock" color={COLOR.secondary} size={14} />}
          <Text numberOfLines={1} style={[styles.preview, unread > 0 && !closed && styles.previewUnread]}>
            {notice ?? room.lastMessageBody ?? ROOM_NO_MESSAGES_YET}
          </Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  title: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, fontSize: TYPE.title, fontFamily: FONT.bold, color: COLOR.foreground },
  pad: { paddingHorizontal: 16 },
  list: { paddingHorizontal: 8, paddingBottom: 16, gap: 2 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 10, borderRadius: RADIUS.card },
  pressed: { backgroundColor: COLOR.surfaceSoft },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, fontSize: TYPE.lead, lineHeight: 24, fontFamily: FONT.bold, color: COLOR.foreground },
  quiet: { color: COLOR.secondary },
  time: { fontSize: TYPE.fine, fontFamily: FONT.medium, color: COLOR.secondary },
  timeUnread: { fontFamily: FONT.bold, color: COLOR.foreground },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { flex: 1, fontSize: TYPE.note, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  previewUnread: { fontFamily: FONT.bold, color: COLOR.foreground },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.danger },
  badgeText: { fontSize: TYPE.fine, fontFamily: FONT.bold, color: COLOR.onAccent },
  fold: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  foldText: { fontSize: TYPE.note, fontFamily: FONT.bold, color: COLOR.secondary },
  turned: { transform: [{ rotate: '90deg' }] },
  endedRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
});
