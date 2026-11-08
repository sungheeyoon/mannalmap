import { movedPhotos } from '@profile';

import type { Done } from '@/answer';

/**
 * **옮기기는 화면에 먼저 서고, 저장이 실패하면 곧바로 옮기기 전 차례로 돌아간다** — 위치 조정이 실패하면 놓은 자리를 걷는 것과 같은 결이다.
 * 다시 읽기(`reload`)는 부르는 쪽이 그 뒤에 따로 한다 — 되돌림이 다시 읽기에 기대면 다시 읽기마저 못 할 때 바뀐 차례가 남는다
 * (「대표로 설정」이 실패했는데 대표가 바뀐 것처럼 보인다). `from` · `to` 는 화면의 칸 번호다(1부터).
 */
export async function moveShownFirst<T>(
  before: readonly T[],
  from: number,
  to: number,
  show: (order: readonly T[]) => void,
  save: () => Promise<Done>,
): Promise<Done> {
  show(movedPhotos(before, from, to));
  const result = await save();
  if (!result.ok) show(before);
  return result;
}
