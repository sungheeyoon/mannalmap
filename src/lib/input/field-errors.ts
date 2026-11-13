import { calculateChart, dateRefusal } from './chart';
import { missingHour, NAME_MISSING, type DatePart, type Query } from './query';

/**
 * **사용자가 고칠 칸 하나의 오류** — 어느 칸(`field`)이 왜(`message`) 틀렸나(ADR 0252).
 *
 * 폼의 판정이 「처음 걸린 문장 하나」만 내면 화면은 그 문장을 단추 곁에 모아 쓸 수밖에 없고, 어느 칸이 비었는지는 칸에 안
 * 보인다(운영자 2026-11-14 「뭐가 없으면 빨간색으로 강조하거나 그러지 않냐」). 그래서 판정이 **칸 이름이 붙은 목록**을 낸다 —
 * 화면은 그 목록을 칸마다 붉은 테와 칸 아래 한 줄로 그리기만 하고 새 판정을 짓지 않는다. 목록의 차례는 화면의 차례(위에서
 * 아래)라 첫 줄이 누른 뒤 데려갈 칸이다.
 *
 * 「남은 풀이권이 없어요」처럼 사용자가 틀린 것이 아닌 안내는 여기 들지 않는다 — 고칠 칸이 없다.
 */
export type FieldError<F extends string> = { readonly field: F; readonly message: string };

/**
 * **보여 줄 오류만 남긴다** — 누른 때 걸린 칸(`flagged`) 가운데 아직 틀린 칸.
 *
 * - 누르기 전에는 아무 칸도 붉지 않다 — 아직 손대지 않은 칸을 처음부터 나무라지 않는다.
 * - 누른 뒤 고쳐서 바르게 된 칸은 그 순간 빠진다 — 오류는 늘 지금 값으로 다시 잰다.
 * - 누른 때 멀쩡했던 칸은 입력하는 도중 틀려도 다음 누름까지 붉히지 않는다. 고쳤다가 다시 틀린 칸도 그렇다 — 고친 칸은
 *   화면의 훅(`useFieldErrors`)이 `flagged` 에서 뺀다.
 *
 * 문장은 지금 값의 것이다 — 「생년월일을 입력해 주세요」였던 칸에 해를 잘못 적으면 그 칸 아래 말이 해의 말로 바뀐다.
 */
export function shownErrors<F extends string>(
  errors: readonly FieldError<F>[],
  flagged: readonly F[],
): Partial<Record<F, string>> {
  const shown: Partial<Record<F, string>> = {};
  for (const one of errors) {
    if (flagged.includes(one.field) && shown[one.field] === undefined) shown[one.field] = one.message;
  }
  return shown;
}

/** 출생 정보 폼의 칸 셋 — 대신 답할 수 없는 것만이다(이름 · 생년월일 · 출생 시각, `missingForCalculation`) */
export type BirthField = 'name' | 'date' | 'hour';

/** 생년월일 오류는 해 · 달 · 날 가운데 어긋난 칸을 함께 든다 — 없으면 덜 적은 칸 전부다 */
export type BirthFieldError = FieldError<BirthField> & { readonly part?: DatePart };

/**
 * 출생 정보 한 벌의 **칸별 오류** — 폼의 차례대로 이름 → 생년월일 → 출생 시각.
 *
 * 문장은 단추를 막던 판정(`missingAnswer` · `calculateChart`)과 같은 함수에서 온다 — 칸 아래에 선 말과 서버가 거절하는 말이
 * 갈리지 않는다. 음력 표의 거절(없는 윤달 등)도 생년월일 칸의 것이다(`dateRefusal`). 날짜 · 시각이 다 바른데 엔진이 거절하면
 * 그 문장도 생년월일 칸에 세운다 — 화면에서 고를 수 있는 값 가운데 계산이 거절하는 것은 날짜뿐이다.
 *
 * `name: false` 는 이름을 묻지 않는 폼(내 출생 정보 — 닉네임으로 부른다)이다.
 */
export function birthFieldErrors(query: Query, { name = true }: { name?: boolean } = {}): BirthFieldError[] {
  const errors: BirthFieldError[] = [];
  if (name && query.name.trim() === '') errors.push({ field: 'name', message: NAME_MISSING });

  const date = query.date === '' ? { message: '생년월일을 입력해 주세요.' } : dateRefusal(query);
  if (date !== null) errors.push({ field: 'date', ...date });

  const hour = missingHour(query);
  if (hour !== null) errors.push({ field: 'hour', message: hour });

  if (date === null && hour === null) {
    const chart = calculateChart(query);
    if (!chart.ok) errors.push({ field: 'date', message: chart.message });
  }
  return errors;
}

/**
 * 생년월일 칸이 걸렸을 때 **붉힐 숫자 칸** — 어긋난 칸을 짚었으면(`refused`) 그 칸, 아니면 덜 적은 칸(빈 칸 · 네 자리가 안 된 해,
 * `dateOfParts`). 웹 · 앱 폼이 같은 셈을 쓴다.
 */
export const dateDigitWrong = (part: DatePart, value: string, refused: DatePart | null): boolean =>
  refused !== null ? refused === part : value === '' || (part === 'year' && value.length < 4);

/** 출생 시각 칸이 걸렸을 때 붉힐 숫자 칸 — 비었거나 범위 밖이라 시각이 안 된 칸(`timeOfParts`) */
export const timeDigitWrong = (value: string, max: number): boolean => value === '' || Number(value) > max;
