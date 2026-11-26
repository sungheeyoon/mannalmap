/**
 * 화면이 읽기를 부르는 길 — **던져도 그 화면의 실패 값으로 끝난다.** 받지 않은 거절은 첫 읽기를 기다리는 화면을 빈 채로 멈춘다.
 * 망이 끊긴 것은 supabase-js 가 `{ error }` 로 답하니 던지는 것은 저장소 실패와 응답을 옮기는 코드다.
 * 까닭은 기록에만 간다 — 화면의 글자는 `fallback` 이 고른다. `scripts/mobile-reads.test.ts` 가 받지 않은 `.then(` 을 센다.
 */
export function settled<T, F>(reading: Promise<T>, where: string, fallback: () => F): Promise<T | F> {
  return reading.catch((thrown: unknown) => {
    console.error(where, thrown instanceof Error ? thrown.name : 'unknown');
    return fallback();
  });
}

/**
 * **효과가 걷힌 뒤에 온 답은 버린다**(G-182) — `useEffect(() => settledWhileLive(읽기, 'where', 실패 값, 세울 곳), deps)`. 돌려주는 값이 효과의
 * 걷기다. 화면마다 `let live = true` 를 손으로 적던 것을 한 자리에 모았다 — 대상이 바뀐 뒤 앞 대상의 답이 칸에 서지 않는다.
 */
export function settledWhileLive<T, F>(reading: Promise<T>, where: string, fallback: () => F, apply: (value: T | F) => void): () => void {
  let live = true;
  void settled(reading, where, fallback).then((value) => {
    if (live) apply(value);
  });
  return () => {
    live = false;
  };
}

/**
 * **가장 최근의 부름만 답을 세운다** — 효과 밖에서도 다시 부르는 읽기(「다시 시도하기」)가 겹칠 때. `take()` 가 이 부름의 표를 내고, 표가
 * 아직 최근인지는 그 표를 불러 묻는다. `drop()` 은 지금까지의 표를 다 낡게 한다(효과의 걷기).
 */
export function latestCalls(): { take: () => () => boolean; drop: () => void } {
  let count = 0;
  return {
    take: () => {
      count += 1;
      const mine = count;
      return () => mine === count;
    },
    drop: () => {
      count += 1;
    },
  };
}
