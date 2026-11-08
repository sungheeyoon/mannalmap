import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, type EasingFunction } from 'react-native';

import { EASING, MOTION } from '@design';

import { settled } from './settled';

/** 움직임의 시간(ms) — 웹 `--motion-*` 와 한 원본(`src/lib/design/tokens.json`, ADR 0242) */
export { MOTION };

/** 웹의 이징 낱말을 앱의 `Easing` 으로 — 이름은 `EASING` 과 같다 */
const CURVES: Record<(typeof EASING)[keyof typeof EASING], EasingFunction> = {
  ease: Easing.ease,
  'ease-in-out': Easing.inOut(Easing.ease),
};

export const EASE: Record<keyof typeof EASING, EasingFunction> = {
  quick: CURVES[EASING.quick],
  loop: CURVES[EASING.loop],
};

/**
 * 움직임을 줄인 기기인가 — 줄였으면 도는 움직임(띠 · 숨 · 만남)을 세우지 않는다(웹의 `prefers-reduced-motion`, `app/ui/motion.ts`).
 * 기기 설정을 바꾸면 곧바로 따른다.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void settled(AccessibilityInfo.isReduceMotionEnabled(), 'isReduceMotionEnabled', () => false).then(setReduced);
    const listening = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => listening.remove();
  }, []);
  return reduced;
}
