import { calculateChart, dateRefusal } from './chart';
import { HOUR_UNKNOWN_CHOICE, type DatePart, type Query } from './query';

/**
 * **문단의 오류** — 폼의 어느 문단(`section`)이 왜(`message`) 틀렸나(ADR 0252).
 *
 * 문단은 칸 몇 줄의 묶음이다 — 출생 정보 폼이면 「이름 · 성별」 줄, 「생년월일 + 양력 · 음력 · 음력 윤달」, 「출생 시각 + 시 · 분」,
 * 「출생지」. 오류 한 줄은 그 문단의 마지막 줄 아래 왼쪽에 선다. 판정이 「처음 걸린 문장 하나」만 내면 화면은 그 문장을 단추
 * 아래에 모아 쓸 수밖에 없다 — 그래서 판정이 **문단 이름이 붙은 목록**을 내고, 화면(웹 `app/ui/section-error.tsx` · 앱
 * `mobile/src/ui/section-error.tsx`)은 그리기만 한다. 목록의 차례는 화면의 차례(위에서 아래)다.
 *
 * 칸과 상관없는 거절(저장 실패 · 연결 · 풀이권 0장)은 여기 들지 않는다 — 그것은 단추 아래 줄(`FormError` · `FailureLine`)이다.
 */
export type SectionError<S extends string> = { readonly section: S; readonly message: string };

/**
 * 누른 순간 붉힐 문단 — 지금 걸린 문단 전부(ADR 0252 의 3). 한 문단이 두 번 걸려도 한 번만 든다.
 */
export function flaggedOnPress<S extends string>(errors: readonly SectionError<S>[]): S[] {
  return [...new Set(errors.map((one) => one.section))];
}

/**
 * 그 문단의 칸을 고쳤다 — **그 문단만** 걷는다(ADR 0252 의 4). 다른 문단의 줄은 그대로 선다. 다시 틀려도 다음 누름까지 안 선다.
 */
export function afterEdit<S extends string>(flagged: readonly S[], section: S): readonly S[] {
  return flagged.includes(section) ? flagged.filter((one) => one !== section) : flagged;
}

/**
 * **보여 줄 줄** — 누른 때 걸린 문단(`flagged`) 가운데 지금도 틀린 문단의 첫 문장.
 *
 * 문장은 지금 값의 것이다. 걸린 문단이 다른 문단을 고친 덕에 풀렸으면(궁합의 「같은 사람 두 번」) 그 줄도 안 선다.
 */
export function shownSections<S extends string>(
  errors: readonly SectionError<S>[],
  flagged: readonly S[],
): Partial<Record<S, string>> {
  const shown: Partial<Record<S, string>> = {};
  for (const one of errors) {
    if (flagged.includes(one.section) && shown[one.section] === undefined) shown[one.section] = one.message;
  }
  return shown;
}

/** 이름 칸이 비었을 때의 말 — 폼의 제출(`missingAnswer`)과 문단 아래 줄(`birthSectionErrors`)이 같은 글자다 */
export const NAME_MISSING = '이름을 입력해 주세요.';
/** 생년월일 칸이 비었을 때의 말(`missingForCalculation` 과 같은 글자) */
export const DATE_MISSING = '생년월일을 입력해 주세요.';
/** 출생 시각을 「직접 입력」으로 골랐는데 시각이 아직 안 됐을 때 */
export const TIME_MISSING = '출생 시각을 입력해 주세요.';
/** 출생 시각의 두 갈래를 다 안 골랐을 때 */
export const HOUR_CHOICE_MISSING = `출생 시각을 입력하거나 「${HOUR_UNKNOWN_CHOICE}」을 골라 주세요.`;

/**
 * 시 · 분 칸이 다 적혔는데 범위 밖이다 — 「25시」. 덜 적은 것은 아직 틀린 것이 아니다(`null`, 위 `TIME_MISSING` 이 말한다).
 * 시각은 범위 밖이면 값이 안 되므로(`timeOfParts`) `Query` 만으로는 이 말을 못 짓는다 — 칸의 숫자를 받는다.
 */
export function timePartsRefusal(parts: { hour: string; minute: string }): string | null {
  if (parts.hour !== '' && Number(parts.hour) > 23) return '시는 0~23으로 입력해 주세요.';
  if (parts.minute !== '' && Number(parts.minute) > 59) return '분은 0~59로 입력해 주세요.';
  return null;
}

/** 출생 정보 폼의 문단 셋 — 대신 답할 수 없는 것만이다. 출생지는 기본값이 있어 걸리지 않는다 */
export type BirthSection = 'name' | 'date' | 'hour';

/**
 * 출생 정보 한 벌의 **문단별 오류** — 폼의 차례대로 이름 · 성별 → 생년월일 → 출생 시각.
 *
 * 문장은 단추를 막던 판정(`missingAnswer` · `dateRefusal` · `calculateChart`)과 같은 글자다 — 문단 아래 줄과 서버가 거절하는 말이
 * 갈리지 않는다. 날짜 · 시각이 다 바른데 엔진이 거절하면 그 문장도 생년월일 문단의 것이다 — 화면에서 고를 수 있는 값 가운데
 * 계산이 거절하는 것은 날짜뿐이다.
 *
 * - `name: false` 는 이름을 묻지 않는 폼이다(내 출생 정보 — 닉네임으로 부른다).
 * - `time` 은 시 · 분 칸의 숫자다. 주면 「25시」를 「시는 0~23으로 입력해 주세요.」(달 칸의 「월은 1~12로 입력해 주세요.」와 같은 꼴)로 말한다(`timePartsRefusal`).
 */
export function birthSectionErrors(
  query: Query,
  { name = true, time }: { name?: boolean; time?: { hour: string; minute: string } } = {},
): SectionError<BirthSection>[] {
  const errors: SectionError<BirthSection>[] = [];
  if (name && query.name.trim() === '') errors.push({ section: 'name', message: NAME_MISSING });

  const date = query.date === '' ? DATE_MISSING : (dateRefusal(query)?.message ?? null);
  if (date !== null) errors.push({ section: 'date', message: date });

  const hour =
    query.hourKnown === null
      ? HOUR_CHOICE_MISSING
      : query.hourKnown && query.time === ''
        ? ((time === undefined ? null : timePartsRefusal(time)) ?? TIME_MISSING)
        : null;
  if (hour !== null) errors.push({ section: 'hour', message: hour });

  if (date === null && hour === null) {
    const chart = calculateChart(query);
    if (!chart.ok) errors.push({ section: 'date', message: chart.message });
  }
  return errors;
}

/**
 * 생년월일 문단이 걸렸을 때 **붉힐 숫자 칸** — 어긋난 칸을 짚었으면(`refused`) 그 칸, 아니면 덜 적은 칸(빈 칸 · 네 자리가 안 된 해).
 * 웹 · 앱 폼이 같은 셈을 쓴다.
 */
export const dateDigitWrong = (part: DatePart, value: string, refused: DatePart | null): boolean =>
  refused !== null ? refused === part : value === '' || (part === 'year' && value.length < 4);

/** 출생 시각 문단이 걸렸을 때 붉힐 숫자 칸 — 비었거나 범위 밖이라 시각이 안 된 칸(`timeOfParts`) */
export const timeDigitWrong = (value: string, max: number): boolean => value === '' || Number(value) > max;

/**
 * 두 사람을 한 폼에서 받을 때(궁합) — 문단 이름 앞에 어느 쪽인지 붙인다(`a.name` · `b.date`). 한 폼의 누름 하나가 두 사람의
 * 문단을 함께 세우고, 맨 위 문단이 첫 사람 쪽이다.
 */
export const prefixed = <P extends string, S extends string>(
  prefix: P,
  errors: readonly SectionError<S>[],
): SectionError<`${P}.${S}`>[] => errors.map((one) => ({ section: `${prefix}.${one.section}` as `${P}.${S}`, message: one.message }));

/** 붙인 이름의 줄에서 한쪽 것만 꺼낸다 — 그쪽 폼에 넘긴다 */
export function sideOf<S extends string>(shown: Partial<Record<string, string>>, prefix: string): Partial<Record<S, string>> {
  const side: Partial<Record<string, string>> = {};
  for (const [key, message] of Object.entries(shown)) {
    if (key.startsWith(`${prefix}.`)) side[key.slice(prefix.length + 1)] = message;
  }
  return side as Partial<Record<S, string>>;
}
