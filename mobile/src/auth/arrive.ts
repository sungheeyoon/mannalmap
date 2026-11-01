import { isChartPath } from '@consent/app-destination';
import { router } from 'expo-router';

/**
 * 로그인 · 가입을 마치고 목적지로 — 결과 화면은 스택 아래에 그대로 있어 거기까지 돌아간다. 같은 결과가 겹치지 않고, 펼친 표도 그대로이며, 뒤로 가면 입력 화면이다(ADR 0213).
 * 나머지는 지금 자리를 갈아 끼운다.
 */
export function arriveAt(path: string): void {
  if (isChartPath(path)) router.dismissTo(path as never);
  else router.replace(path as never);
}
