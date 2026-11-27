import Svg, { Circle, G, Line } from 'react-native-svg';

import { COLOR } from '@/ui/tokens';

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/** 해 — 「내 사주 보기」 입구의 그림. 웹의 `SunMark`(`app/ui/entry-marks.tsx`)와 같은 값이다 */
export function SunMark({ size = 20, color = COLOR.foreground }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="4.25" stroke={color} strokeWidth={1.5} />
      <G>
        {RAYS.map((deg) => (
          <Line key={deg} x1="12" y1="2.75" x2="12" y2="5" stroke={color} strokeWidth={1.5} strokeLinecap="round" transform={`rotate(${deg} 12 12)`} />
        ))}
      </G>
    </Svg>
  );
}
