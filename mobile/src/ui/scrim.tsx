import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';

import { COLOR } from './tokens';

/**
 * **덮개 — 화면 위에 뜨는 판의 바닥 한 벌**(ADR 0242). 시트 · 확인 창 · 신고 창 · 「⋯」 판이 모두 이것 위에 선다 — 덮개 색은 웹의
 * `backdrop:bg-scrim` 과 같은 `COLOR.scrim` 하나다. 앱 화면은 `Modal` 을 직접 안 쓴다(`scripts/mobile-surfaces.test.ts`).
 *
 * - `place` — `bottom` 은 아래에 붙는 시트, `center` 는 가운데 창(옆 16px), `free` 는 판이 제 자리를 스스로 잡는다(누른 자리 곁의 메뉴)
 * - `onOutside` — 바깥을 누르면. `null` 이면 바깥 누름으로 안 닫힌다(적은 것이 있는 창). `outsideLabel` 을 주면 화면 읽기도 그 바깥을 「닫기」로 읽는다
 * - `tint` — `false` 면 덮개 색 없이 바깥 누름만 받는다(작은 띄움 판)
 * - `keyboard` — 글을 받는 창은 키보드 위로 올라선다
 */
export function Scrim({
  open = true,
  place,
  animation,
  onRequestClose,
  onOutside = null,
  outsideLabel,
  tint = true,
  keyboard = false,
  onDismiss,
  children,
}: {
  open?: boolean;
  place: 'bottom' | 'center' | 'free';
  animation: 'slide' | 'fade' | 'none';
  /** 안드로이드의 뒤로 — 안 주면 뒤로로 안 닫힌다 */
  onRequestClose?: () => void;
  onOutside?: (() => void) | null;
  outsideLabel?: string;
  tint?: boolean;
  keyboard?: boolean;
  /** 판이 다 닫힌 뒤 — iOS 는 닫히는 창 위에 다음 창을 못 띄운다 */
  onDismiss?: () => void;
  children: ReactNode;
}) {
  const Frame = keyboard ? KeyboardAvoidingView : View;
  const outside =
    outsideLabel === undefined ? (
      <Pressable style={StyleSheet.absoluteFill} onPress={onOutside ?? undefined} accessibilityElementsHidden importantForAccessibility="no" />
    ) : (
      <Pressable style={StyleSheet.absoluteFill} onPress={onOutside ?? undefined} accessibilityLabel={outsideLabel} />
    );
  return (
    <Modal visible={open} transparent animationType={animation} onRequestClose={onRequestClose} onDismiss={onDismiss}>
      <Frame {...(keyboard ? { behavior: 'padding' as const } : {})} style={[styles.fill, styles[place], tint && styles.tint]}>
        {outside}
        {children}
      </Frame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tint: { backgroundColor: COLOR.scrim },
  bottom: { justifyContent: 'flex-end' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  free: {},
});
