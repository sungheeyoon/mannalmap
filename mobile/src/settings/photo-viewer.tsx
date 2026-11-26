import { Image } from 'expo-image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Modal, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PHOTO_LOAD_FAILED_NOTE } from '@profile';

import { useClient } from '@/auth/connected';
import { ActionSheet, type ActionChoice } from '@/ui/action-sheet';
import { FailureLine } from '@/ui/failure-line';
import { Icon } from '@/ui/icons';
import { LoadingDots } from '@/ui/loading';
import { Card } from '@/ui/surfaces';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';

import { photoSource, type MyPhoto } from './photos';
import { WordText } from '@/ui/word-text';

export const PHOTO_MENU_LABEL = '사진 메뉴';
const SWIPE_PX = 48;

/**
 * 사진 크게 보기 — 웹 `photo-viewer.tsx` 와 같은 꼴: 검은 전체 화면 · 왼쪽 위 × · 가운데 「2 / 3」 · 오른쪽 위 「⋯」, 좌우로 쓸어넘긴다.
 * 「⋯」가 여는 판은 웹과 같은 고르기 판(`ActionSheet`)이고, 이미 뜬 이 화면 안에 깐다(`within`).
 * 판에서 고르면 보기를 **먼저 닫고** 그 일을 한다 — iOS 는 닫히는 창 위에 다음 창을 못 띄워 닫힌 뒤(`onDismiss`)에 한다.
 */
export function PhotoViewer({
  userId,
  photos,
  at,
  onAt,
  onClose,
  choicesFor,
}: {
  userId: string | null;
  photos: readonly MyPhoto[];
  at: number | null;
  onAt: (position: number) => void;
  onClose: () => void;
  choicesFor: (photo: MyPhoto, position: number) => ActionChoice[];
}) {
  const client = useClient();
  const [menu, setMenu] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  /** 주소를 받는 중 · 그리는 중(점) · 그렸다 · 못 받았거나 못 그렸다(실패 줄) */
  const [stage, setStage] = useState<'loading' | 'shown' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const after = useRef<(() => void) | null>(null);
  const position = at ?? 1;
  const photo = at === null ? undefined : photos[position - 1];
  const total = photos.length;

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 사진이 바뀌면 앞 사진을 먼저 걷는다. 새 주소가 올 때까지 앞 사진을 새 번호로 보이지 않는다
    setSource(null);
    setStage('loading');
    if (photo !== undefined) {
      void settled(photoSource(client, photo, userId ?? undefined), 'photoSource', () => null).then((next) => {
        if (!live) return;
        setSource(next);
        if (next === null) setStage('failed');
      });
    }
    return () => {
      live = false;
    };
  }, [client, photo, userId, attempt]);

  const latest = useRef({ position, total, onAt });
  useLayoutEffect(() => {
    latest.current = { position, total, onAt };
  });
  // eslint-disable-next-line react-hooks/refs -- 넘기는 손길 함수는 렌더 뒤 손가락이 닿을 때만 돌아 ref 를 읽는다. 규칙은 함수를 받는 쪽이 언제 부르는지 모른다
  const [swipe] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < SWIPE_PX) return;
        const now = latest.current;
        const next = now.position + (gesture.dx < 0 ? 1 : -1);
        if (next >= 1 && next <= now.total) now.onAt(next);
      },
    }),
  );

  const dismissed = () => {
    const run = after.current;
    after.current = null;
    run?.();
  };

  /** 판은 제 줄을 고르면 스스로 닫는다(`onClose` → `setMenu(false)`) — 여기는 보기를 닫고 그 일을 한다 */
  const choose = (choice: ActionChoice) => {
    onClose();
    if (Platform.OS === 'ios') after.current = choice.run;
    else choice.run();
  };

  const choices = photo === undefined ? [] : choicesFor(photo, position).map((choice) => ({ ...choice, run: () => choose(choice) }));

  return (
    <Modal
      visible={photo !== undefined}
      animationType="fade"
      onDismiss={dismissed}
      onRequestClose={() => {
        if (menu) setMenu(false);
        else onClose();
      }}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={onClose} style={styles.icon}>
            <Icon name="close" color={COLOR.onPhoto} />
          </Pressable>
          <View style={styles.count}>
            {position === 1 && <WordText style={styles.lead}>대표</WordText>}
            <WordText style={styles.countText}>
              {position} / {total}
            </WordText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={PHOTO_MENU_LABEL} onPress={() => setMenu(true)} style={styles.icon}>
            <Icon name="more" color={COLOR.onPhoto} />
          </Pressable>
        </View>
        <View style={styles.stage} {...swipe.panHandlers}>
          {source !== null && stage !== 'failed' && (
            <Image
              source={{ uri: source }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              onLoad={() => setStage('shown')}
              onError={() => setStage('failed')}
            />
          )}
          {stage === 'loading' && <LoadingDots inline style={styles.middle} />}
          {stage === 'failed' && (
            <View style={styles.middle}>
              <Card style={styles.failure}>
                <FailureLine onRetry={() => setAttempt((n) => n + 1)}>{PHOTO_LOAD_FAILED_NOTE}</FailureLine>
              </Card>
            </View>
          )}
        </View>
      </SafeAreaView>
      {/* 판은 안전 영역 밖, 화면 끝까지 깐다 — 아래 여백은 판이 홈 막대만큼 스스로 비운다 */}
      <ActionSheet within open={menu} onClose={() => setMenu(false)} label={PHOTO_MENU_LABEL} choices={choices} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.photoBack },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  count: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lead: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLOR.onPhoto, color: COLOR.photoBack, fontSize: TYPE.fine, fontFamily: FONT.bold },
  countText: { color: COLOR.onPhoto, fontSize: TYPE.body, fontFamily: FONT.bold },
  stage: { flex: 1 },
  middle: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  failure: { alignSelf: 'stretch', paddingHorizontal: 20, paddingVertical: 16 },
});
