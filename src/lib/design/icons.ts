/**
 * **선 아이콘 한 벌의 그림 자료** — 24 격자의 경로 · 원 · 네모다. 웹 `app/ui/icons.tsx` 와 앱 `mobile/src/ui/icons.tsx` 가 이 자료 하나로
 * 그린다(ADR 0280) — 두 쪽이 경로를 저마다 들면 한쪽만 고쳐진다. 새 그림은 여기 더한다 — 화면마다 `<svg>` · `<Svg>` 를 다시 세우지 않는다.
 *
 * - 틀(`ICON_FRAME`)이 칠 없음 · 그림 색 획 1.8 · 둥근 끝 · 둥근 꺾임을 준다. 그림마다 다른 것만 적는다.
 * - 칠은 셋이다 — `ink` 는 그림 색(웹 `currentColor`, 앱 `color`), `light` 는 태극의 밝은 반(웹은 `--taiji-light`, 없으면 비친다 · 앱은 비친다),
 *   `none` 은 없음.
 * - 획 굵기는 24 격자의 값이다 — 작은 자리(12 · 16px)에서 굵기를 되돌리는 것은 부르는 쪽이다(웹 `stroke-*`, 앱 `strokeWidth`).
 *
 * 이 폴더는 React 를 모른다 — 그리는 것은 두 쪽의 `Icon` 이다.
 */
export type IconPaint = 'ink' | 'light' | 'none';

type Paint = { fill?: IconPaint; stroke?: 'ink' | 'none' };

export type IconShape =
  | ({ kind: 'path'; d: string; fillRule?: 'evenodd'; strokeWidth?: number; strokeDasharray?: string } & Paint)
  | ({ kind: 'circle'; cx: number; cy: number; r: number } & Paint)
  | ({ kind: 'rect'; x: number; y: number; width: number; height: number; rx: number } & Paint);

/** 그림 틀 — 두 쪽의 `<svg>` · `<Svg>` 가 같은 값을 든다 */
export const ICON_FRAME = { viewBox: '0 0 24 24', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

type PathOptions = Omit<Extract<IconShape, { kind: 'path' }>, 'kind' | 'd'>;

const path = (d: string, options: PathOptions = {}): IconShape => ({ kind: 'path', d, ...options });
const circle = (cx: number, cy: number, r: number, paint: Paint = {}): IconShape => ({ kind: 'circle', cx, cy, r, ...paint });

/** 연필 — 「고치기」와 관리(`manage`)의 몸 */
const PENCIL = 'M4 16.2 14.1 6.1a1.9 1.9 0 0 1 2.7 2.7L6.7 18.9l-3.2.5Z';

export const ICON_SHAPES = {
  home: [path('M4 11 12 4.5l8 6.5v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z')],
  people: [circle(9, 8.5, 3.2), path('M3.5 19.5c.5-3.4 2.4-5.2 5.5-5.2s5 1.8 5.5 5.2M15.5 6a3 3 0 0 1 0 5.6M16.5 14.4c2.5.3 3.8 2 4.1 4.6')],
  reading: [path('M12 6.5C10.2 5 7.6 4.5 4 4.8v13.4c3.6-.3 6.2.2 8 1.8 1.8-1.6 4.4-2.1 8-1.8V4.8c-3.6-.3-6.2.2-8 1.7Zm0 0V20')],
  chat: [path('M5.5 5h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5V17h-1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z')],
  bell: [path('M6.2 10a5.8 5.8 0 0 1 11.6 0c0 5.6 2 6.8 2 7.5H4.2c0-.7 2-1.9 2-7.5Z'), path('M10 20.5a2.2 2.2 0 0 0 4 0')],
  /** 톱니는 Lucide `settings`(lucide-static 0.460.0, ISC — https://lucide.dev/license)의 경로 그대로다 */
  gear: [
    path(
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z',
    ),
    circle(12, 12, 3),
  ],
  arrow: [path('M5 12h13m-5-5.5L18.5 12 13 17.5')],
  back: [path('M19 12H6m5-5.5L5.5 12l5.5 5.5')],
  chevron: [path('m9 5.5 6.5 6.5L9 18.5')],
  close: [path('M6 6l12 12M18 6 6 18')],
  plus: [path('M12 5v14M5 12h14')],
  /**
   * 궁합 — 첫 화면 입구의 태극과 같은 몸(웹 `app/ui/entry-marks.tsx` 의 `TaijiShapes`). 궁합 요청 · 요청 소식도 이 그림이다.
   * 먹색 반의 아래 점은 칠하지 않고 **뚫는다**(`evenodd`) — 밝은 반과 같은 것(면이든 비침이든)이 보인다
   */
  taiji: [
    circle(12, 12, 9, { fill: 'light', stroke: 'ink' }),
    path('M12 3a9 9 0 0 1 0 18 4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9ZM13.4 16.5a1.4 1.4 0 1 0-2.8 0 1.4 1.4 0 1 0 2.8 0Z', { fill: 'ink', fillRule: 'evenodd', stroke: 'none' }),
    circle(12, 7.5, 1.4, { fill: 'ink', stroke: 'none' }),
  ],
  search: [circle(10.5, 10.5, 6), path('m15 15 5 5')],
  spark: [path('M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2Z')],
  alert: [path('M12 3.8 21 19.5H3Z'), path('M12 10v4.2M12 17v.1')],
  quote: [path('M5 17.5c0-4.6 1.4-8 5-10M13.5 17.5c0-4.6 1.4-8 5-10M5 17.5h4.2v-4.3H5M13.5 17.5h4.2v-4.3h-4.2')],
  ticket: [
    path('M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4Z'),
    path('M14.5 6.5v11', { strokeDasharray: '1.6 2' }),
  ],
  undo: [path('M9 14 4.5 9.5 9 5'), path('M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3')],
  send: [path('M12 19.5V5m-6 6 6-6 6 6')],
  lock: [{ kind: 'rect', x: 5, y: 10.5, width: 14, height: 9.5, rx: 2.5 }, path('M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5')],
  /** 점 셋 — 칠하지 않은 작은 원에 획을 둘러 점이 된다(반지름 1.2 + 획 반 0.9) */
  more: [circle(6, 12, 1.2), circle(12, 12, 1.2), circle(18, 12, 1.2)],
  flag: [path('M5.5 21V4.5m0 0c4-2 7 2 13 0v9c-6 2-9-2-13 0')],
  block: [circle(12, 12, 8.5), path('m6 6 12 12')],
  /** 연필과 점 둘 — 「고칠 것들이 여기 있다」 */
  manage: [path(PENCIL), path('M20 15.5h.01M20 19h.01', { strokeWidth: 2.4 })],
  pencil: [path(PENCIL)],
  note: [path('M5 4.5h14v15H5Z'), path('M8.5 9h7M8.5 12.5h7M8.5 16h4')],
  remove: [path('M5 7h14M9.5 7V4.8h5V7M7 7l.9 12.2h8.2L17 7'), path('M10.5 10.5v6M13.5 10.5v6')],
  check: [path('M5 12.4 10 17l9-10')],
  link: [path('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2')],
  /** 위치 조정 — 네 쪽 화살표(G-98) */
  move: [path('M12 3.5v17M3.5 12h17M9.5 6 12 3.5 14.5 6M9.5 18l2.5 2.5 2.5-2.5M6 9.5 3.5 12 6 14.5M18 9.5l2.5 2.5-2.5 2.5')],
  /** 주고받기 — 마주 선 두 화살표(요청 카드의 받는 기운 ⇄ 주는 기운, 대장 matching-10) */
  exchange: [path('M5 8.5h13.5M15 5l3.5 3.5L15 12M19 15.5H5.5M9 12l-3.5 3.5L9 19')],
  /**
   * 공유 — Lucide `share`(lucide-static 0.460.0, ISC — https://lucide.dev/license)의 경로 그대로다(위 화살표 + 상자). **앱만 부른다** —
   * 웹은 공유창을 안 연다(ADR 0063)
   */
  share: [path('M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13')],
} satisfies Record<string, readonly IconShape[]>;

export type IconName = keyof typeof ICON_SHAPES;
