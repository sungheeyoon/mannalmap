import type { DoorRefusal } from '@reading/door';
import { router } from 'expo-router';

/**
 * **문이 자격으로 거절한 때의 길** — 웹의 관문이 보내는 곳과 같다. 다시 시도할 수 있는 거절(`unavailable`)과 없는 것(`not-found`)은 칸에 남는다.
 *
 * 문(`settings/photos.ts`)과 화면이 함께 부른다 — 화면 파일(`panel.tsx`)에 살 때는 문이 화면을 불렀다(G-182). 문은 화면을 안 부른다
 * (`scripts/mobile-door-direction.test.ts`).
 */
export function followRefusal(refused: DoorRefusal): void {
  if (refused.refused === 'sign-in') router.replace('/');
  else if (refused.refused === 'signup' || refused.refused === 'closed') router.replace('/signup');
}
