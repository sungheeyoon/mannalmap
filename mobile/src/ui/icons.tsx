import { ICON_FRAME, ICON_SHAPES, type IconName, type IconPaint, type IconShape } from '@design';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { COLOR } from './tokens';

export type { IconName };

/**
 * **선 아이콘 한 벌** — 그림 자료는 `src/lib/design/icons.ts` 하나이고 웹 `app/ui/icons.tsx` 도 같은 자료로 그린다(ADR 0280). 24 격자 ·
 * 같은 경로 값이다. 화면은 `<Svg>` 로 그림을 다시 세우지 않고 이것을 부른다. 이름은 곁의 글자나 단추의 이름이 든다.
 * 태극의 밝은 반(`light`)은 앱에서 늘 비친다 — 웹의 `--taiji-light` 를 주는 자리(첫 화면 입구의 `TaijiMark`)가 앱에는 없다.
 */
const paintOf = (paint: IconPaint | undefined, color: string): string | undefined => (paint === undefined ? undefined : paint === 'ink' ? color : 'none');

function Shape({ shape, color }: { shape: IconShape; color: string }) {
  const fill = paintOf(shape.fill, color);
  const stroke = paintOf(shape.stroke, color);
  switch (shape.kind) {
    case 'path':
      return <Path d={shape.d} fill={fill} fillRule={shape.fillRule} stroke={stroke} strokeWidth={shape.strokeWidth} strokeDasharray={shape.strokeDasharray} />;
    case 'circle':
      return <Circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} stroke={stroke} />;
    case 'rect':
      return <Rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} fill={fill} stroke={stroke} />;
  }
}

export function Icon({ name, size = 24, color = COLOR.foreground, strokeWidth = ICON_FRAME.strokeWidth }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={ICON_FRAME.viewBox}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap={ICON_FRAME.strokeLinecap}
      strokeLinejoin={ICON_FRAME.strokeLinejoin}
    >
      {ICON_SHAPES[name].map((shape, at) => (
        <Shape key={at} shape={shape} color={color} />
      ))}
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
