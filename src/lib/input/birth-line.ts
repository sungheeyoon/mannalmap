import { GENDER_KO, type Saju } from '../saju';

import { HOUR_UNKNOWN_LABEL } from './query';

/**
 * **사람 화면 머리의 출생 한 줄** — 「1991년 7월 21일 · 남성 · 출생 시각 모름」(운영자 승인 시안 2026-11-13, 저장한 사람 화면 A).
 *
 * 값은 명식이 이미 든 입력(`saju.meta.inputTime`)에서 읽는다 — 웹의 사람 화면은 계산 입력을 문 밖으로 안 내므로(`app/me/payload.ts`)
 * 출생지는 이 줄에 없다. 성별 · 시각 모름은 사람 목록과 같은 글자(`GENDER_KO` · `HOUR_UNKNOWN_LABEL`)다 — 같은 사실에 한 표기.
 * 웹 · 앱이 이 함수 하나를 부른다.
 */
export function birthLineOf(saju: Pick<Saju, 'meta'>): string {
  const { inputTime, hourKnown, gender } = saju.meta;
  const date = `${inputTime.year}년 ${inputTime.month}월 ${inputTime.day}일`;
  const hour =
    hourKnown && inputTime.hour !== null
      ? `${String(inputTime.hour).padStart(2, '0')}:${String(inputTime.minute ?? 0).padStart(2, '0')}`
      : HOUR_UNKNOWN_LABEL;
  return [date, GENDER_KO[gender], hour].join(' · ');
}
