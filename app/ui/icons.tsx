/**
 * **선 아이콘 한 벌** — `currentColor` 하나로 서서 다크 화면에서 글자색을 따라간다.
 *
 * 이모지를 안 쓴다. 이모지는 기기마다 그림이 다르고 색을 못 바꾼다. 머리글 · 하단 독 · 화면 단추가 같은
 * 그림을 쓰도록 여기 한 곳에 둔다(채택한 부드러움 시안에서 옮겼다 — ADR 0109).
 * 늘 `aria-hidden` 이다 — 이름은 곁의 글자나 단추의 `aria-label` 이 든다.
 *
 * **그림 자료는 `src/lib/design/icons.ts` 하나다**(ADR 0280) — 앱 `mobile/src/ui/icons.tsx` 도 같은 자료로 그린다. 새 그림은 그 자료에 더한다 —
 * 화면마다 `<svg>` 를 다시 세우지 않는다(`scripts/design-icons.test.ts`).
 *
 * 작은 자리(12 · 16px)의 그림은 선이 가늘어지지 않게 부르는 쪽이 `stroke-*` 로 굵기를 되돌린다 — 선 굵기는 24 격자의 값이라 크기를 줄이면 함께 준다.
 * 아래 꺾쇠는 `chevron` 을 90° 돌린다.
 */
import { ICON_FRAME, ICON_SHAPES, type IconName, type IconPaint, type IconShape } from '@/src/lib/design/icons';

export type { IconName };

/** 칠의 낱말 → 웹 값. 태극의 밝은 반은 둘러싼 자리가 `--taiji-light` 를 주면 그 색, 없으면 비친다(`entry-marks.tsx`) */
const PAINT: Record<IconPaint, string> = { ink: 'currentColor', light: 'var(--taiji-light, transparent)', none: 'none' };

function Shape({ shape }: { shape: IconShape }) {
  const fill = shape.fill === undefined ? undefined : PAINT[shape.fill];
  const stroke = shape.stroke === undefined ? undefined : PAINT[shape.stroke];
  switch (shape.kind) {
    case 'path':
      return <path d={shape.d} fill={fill} fillRule={shape.fillRule} stroke={stroke} strokeWidth={shape.strokeWidth} strokeDasharray={shape.strokeDasharray} />;
    case 'circle':
      return <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} stroke={stroke} />;
    case 'rect':
      return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} fill={fill} stroke={stroke} />;
  }
}

/** 그림의 몸만 — 틀(`<svg>`)을 스스로 세우는 자리(첫 화면 입구의 `TaijiMark`)가 부른다 */
export function IconShapes({ name }: { name: IconName }) {
  return (
    <>
      {ICON_SHAPES[name].map((shape, at) => (
        <Shape key={at} shape={shape} />
      ))}
    </>
  );
}

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={ICON_FRAME.viewBox}
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_FRAME.strokeWidth}
      strokeLinecap={ICON_FRAME.strokeLinecap}
      strokeLinejoin={ICON_FRAME.strokeLinejoin}
    >
      <IconShapes name={name} />
    </svg>
  );
}
