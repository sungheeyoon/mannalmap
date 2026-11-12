import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { COLOR } from './tokens';

export type IconName = 'home' | 'people' | 'chat' | 'bell' | 'gear' | 'chevron' | 'plus' | 'taiji' | 'search' | 'ticket' | 'undo' | 'close' | 'arrow' | 'flag' | 'exchange' | 'spark' | 'reading' | 'alert' | 'more' | 'block' | 'send' | 'lock' | 'check';

/** 웹의 `app/ui/icons.tsx` 와 같은 24 격자 · 같은 경로 값이다. 이름은 곁의 글자나 단추의 이름이 든다 */
const shapes = (color: string): Record<IconName, ReactNode> => ({
  home: <Path d="M4 11 12 4.5l8 6.5v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z" />,
  people: (
    <>
      <Circle cx="9" cy="8.5" r="3.2" />
      <Path d="M3.5 19.5c.5-3.4 2.4-5.2 5.5-5.2s5 1.8 5.5 5.2M15.5 6a3 3 0 0 1 0 5.6M16.5 14.4c2.5.3 3.8 2 4.1 4.6" />
    </>
  ),
  chat: <Path d="M5.5 5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5V17h-1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />,
  bell: (
    <>
      <Path d="M6.2 10a5.8 5.8 0 0 1 11.6 0c0 5.6 2 6.8 2 7.5H4.2c0-.7 2-1.9 2-7.5Z" />
      <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  gear: (
    <>
      {/* 톱니는 Lucide `settings`(lucide-static 0.460.0, ISC — https://lucide.dev/license)의 경로 그대로다. 옛 그림은 이가 뾰족하고 잘려 보였다(2026-11-05) */}
      <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  reading: <Path d="M12 6.5C10.2 5 7.6 4.5 4 4.8v13.4c3.6-.3 6.2.2 8 1.8 1.8-1.6 4.4-2.1 8-1.8V4.8c-3.6-.3-6.2.2-8 1.7Zm0 0V20" />,
  spark: <Path d="M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2Z" />,
  chevron: <Path d="m9 5.5 6.5 6.5L9 18.5" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  taiji: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 3a9 9 0 0 1 0 18 4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9ZM13.4 16.5a1.4 1.4 0 1 0-2.8 0 1.4 1.4 0 1 0 2.8 0Z" fill={color} fillRule="evenodd" stroke="none" />
      <Circle cx="12" cy="7.5" r="1.4" fill={color} stroke="none" />
    </>
  ),
  search: (
    <>
      <Circle cx="10.5" cy="10.5" r="6" />
      <Path d="m15 15 5 5" />
    </>
  ),
  ticket: (
    <>
      <Path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4Z" />
      <Path d="M14.5 6.5v11" strokeDasharray="1.6 2" />
    </>
  ),
  undo: (
    <>
      <Path d="M9 14 4.5 9.5 9 5" />
      <Path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />
    </>
  ),
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  check: <Path d="M5 12.4 10 17l9-10" />,
  send: <Path d="M12 19.5V5m-6 6 6-6 6 6" />,
  lock: (
    <>
      <Rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  arrow: <Path d="M5 12h13m-5-5.5L18.5 12 13 17.5" />,
  flag: <Path d="M5.5 21V4.5m0 0c4-2 7 2 13 0v9c-6 2-9-2-13 0" />,
  exchange: <Path d="M5 8.5h13.5M15 5l3.5 3.5L15 12M19 15.5H5.5M9 12l-3.5 3.5L9 19" />,
  alert: (
    <>
      <Path d="M12 3.8 21 19.5H3Z" />
      <Path d="M12 10v4.2M12 17v.1" />
    </>
  ),
  more: (
    <>
      <Circle cx={6} cy={12} r={1.2} fill={color} stroke="none" />
      <Circle cx={12} cy={12} r={1.2} fill={color} stroke="none" />
      <Circle cx={18} cy={12} r={1.2} fill={color} stroke="none" />
    </>
  ),
  block: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="m6 6 12 12" />
    </>
  ),
});

export function Icon({ name, size = 24, color = COLOR.foreground, strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {shapes(color)[name]}
    </Svg>
  );
}

/**
 * 펼침 표시 — 닫힘은 아래, 열림은 위를 본다. 웹처럼 `chevron` 한 그림을 돌려 쓴다(`app/birth-choices.tsx` 의 `rotate-90` · `-rotate-90`).
 * 글자(「⌄」 · 「⌃」)로 두면 서체마다 굵기 · 높낮이가 달라 칸 안에서 처져 보였다(운영자 2026-11-12). 기본값은 웹 고르기 칸의
 * `.chevron`(`app/birth-form.module.css` — 16px · 굵기 2.6 · muted)이다.
 * 꾸밈이라 낭독기에 안 읽힌다 — 열렸는지는 누르는 칸의 `expanded` 가 말한다.
 */
export function FoldIcon({ open, size = 16, color = COLOR.muted, strokeWidth = 2.6 }: { open: boolean; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
      <Icon name="chevron" size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
}
