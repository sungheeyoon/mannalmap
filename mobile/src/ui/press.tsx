import { Pressable, StyleSheet, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';

import { BUTTON_PRESSED_SCALE } from '@design';

import { KEEP_VIEW } from './keep-view';
import { COLOR } from './tokens';

/**
 * **누르는 자리의 반응 — 웹의 `active:` 와 같은 값**(ADR 0281). 화면이 RN `Pressable` 을 맨손으로 쓰면 손가락 아래에서 아무것도
 * 안 바뀌어 눌렸는지 모른다 — 웹은 누를 자리마다 `active:` 가 선다. 반응의 갈래는 웹의 같은 자리를 따른다:
 *
 * - `shrink` 단추 · 칩 · 카드 단추 — 웹 `PRESS` 의 `active:scale-[0.97]`(앱 `Button` 과 같은 값)
 * - `icon` 아이콘 단추 · 하단 탭 — 웹 `ICON_BUTTON*` · 하단 독의 `active:scale-95`(앱 `IconButton` 과 같은 값)
 * - `fade` 글자만 있는 누름 — 웹 `BUTTON_TERTIARY` 의 `active:opacity-55`
 * - `row` 목록의 줄 — 웹 홈 줄 · 메뉴의 `active:bg-surface-sunken`
 *
 * 안드로이드 물결(`android_ripple`)은 쓰지 않는다 — 공용 단추 · 면과 같이 iOS · 웹과 한 반응이다. 누르면 바탕이 서는 둥근 자리라 모서리를
 * 지킨다(`KEEP_VIEW`). 못 누를 때(`disabled`)는 반응하지 않는다. 스타일 함수(`({ pressed }) => …`)도 그대로 받는다.
 */
export type PressFeel = 'shrink' | 'icon' | 'fade' | 'row';

type PressProps = Omit<PressableProps, 'style'> & {
  feel: PressFeel;
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
};

export function Press({ feel, style, disabled, ...props }: PressProps) {
  return (
    <Pressable
      {...KEEP_VIEW}
      {...props}
      disabled={disabled}
      style={(state) => [typeof style === 'function' ? style(state) : style, state.pressed && disabled !== true && FEEL[feel]]}
    />
  );
}

const FEEL = StyleSheet.create({
  shrink: { transform: [{ scale: BUTTON_PRESSED_SCALE }] },
  icon: { transform: [{ scale: 0.95 }] },
  fade: { opacity: 0.55 },
  row: { backgroundColor: COLOR.surfaceSunken },
});
