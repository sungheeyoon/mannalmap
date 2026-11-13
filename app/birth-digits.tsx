'use client';

import { useEffect, useRef, useState } from 'react';

import { HOUR_UNKNOWN_HINT } from '@/src/lib/input/copy';
import { BIRTH_DIGIT_LABEL, HOUR_UNKNOWN_CHOICE, type DatePart, type Query } from '@/src/lib/input/query';

import styles from './birth-form.module.css';
import { ChoiceField, DigitsField } from './birth-choices';
import { dateDigitWrong, timeDigitWrong } from '@/src/lib/input/field-errors';
import { dateOfParts, limitsOf, splitDate, splitTime, timeOfParts } from '@/src/lib/input/entry';

/** 칸이 고칠 칸으로 붉어질 때 함께 가리킬 오류 줄 — 붉히는 것은 폼이 정한다(누른 뒤에만, ADR 0252) */
type Invalid = { describedBy: string };

/*
 * 출생 정보 폼(`birth-form.tsx`)의 **숫자 칸** — 생년월일 세 칸과 시각 두 칸. 왜 날짜 · 시각을 기기의 컨트롤이 아니라 숫자로 적게
 * 하는지는 폼의 머리말이 든다. 칸의 모양은 폼과 같은 CSS 모듈(`birth-form.module.css` 의 `.digit`)이다 — 입력 칸의 글자 크기 시험
 * (`app/ui/fields.test.ts`)은 칸을 감싼 요소가 들인 모듈을 따라가므로 이 파일로 떼어도 그 규칙을 본다(G-109).
 */

/**
 * 숫자 한 칸 — **적는 칸이면서 범위를 아는 칸.**
 *
 * 여섯 칸(년·월·일·시·분)이 같은 일을 한다: 숫자만 받고, 자릿수를 넘기지 않는다. 한 벌로 두지 않으면 어느 칸 하나가
 * 「25시」를 조용히 받아들이는 날이 온다.
 *
 * **붉어지는 것은 제출을 누른 뒤다**(ADR 0252) — 적는 도중 「13월」에 붉히던 것을 걷었다. 누르면 폼이 어느 칸이 틀렸는지
 * (`birthFieldErrors`) 받아 그 칸만 붉히고(`invalid`) 칸 아래 줄을 가리킨다.
 *
 * **판정은 여기서 끝나지 않는다.** 이 칸이 아는 것은 자기 범위뿐이라 「2월 30일」이
 * 나 「없는 윤달」은 못 본다 — 그것은 날짜 한 벌이 다 모여야 알 수 있고, 모인 뒤에도
 * 폼이 아니라 변환·엔진이 판정한다(`convertedLine`).
 */
function NumberField({
  label,
  suffix,
  value,
  onChange,
  digits,
  placeholder,
  autoComplete,
  invalid = null,
}: {
  label: string;
  /** 칸 안 오른쪽에 서는 우리말 — 「년」·「월」·「시」. 이것이 있어 자리 이름을 안 물어도 된다 */
  suffix: string;
  value: string;
  onChange: (next: string) => void;
  digits: number;
  placeholder: string;
  autoComplete?: string;
  /** 누른 뒤 이 칸이 고칠 칸인가 — 그 오류 줄을 가리킨다 */
  invalid?: Invalid | null;
}) {
  return (
    <label className={styles.digit}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete={autoComplete}
        aria-label={label}
        // 붉어지는 것은 `aria-invalid` 를 셀렉터로 쓴다(`birth-form.module.css`) — 낭독기가 읽는 값과 눈에 보이는 색이 한 자리다
        aria-invalid={invalid !== null || undefined}
        aria-describedby={invalid?.describedBy}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, digits))}
      />
      <span aria-hidden="true" className={styles.unit}>
        {suffix}
      </span>
    </label>
  );
}

/**
 * 년·월·일 세 칸 — **전부 적는 칸이다.**
 *
 * 고르는 칸으로 두면 연도는 백 줄이 넘는 목록이 되고, 그렇다고 흔한 해를 미리 넣어
 * 두면 연도를 손대지 않은 사람도 그 해를 고른 것이 된다 — 월·일만 채운 순간 **틀린
 * 해로 계산된 사주**가 나온다. 「고르지 않은 것을 골랐다고 치지 않는다」가 이 폼
 * 전체의 규율이다(`hourKnown` 이 셋인 이유). 숫자를 치는 것이 그 둘을 다 피한다.
 *
 * ## 대신 없는 날짜가 들어올 수 있다
 *
 * 고르는 칸이던 동안에는 「2월 30일」이 **만들어질 수가 없었다.** 적는 칸은 그
 * 보호막을 내주므로, 막는 자리를 대신 세워야 한다. 두 층으로 나눈다.
 *
 * 1. **자리마다의 범위**(월 1~12, 일 1~그 달의 마지막 날) — 다 적힌 날짜는 범위 밖이어도 **그대로 낸다**(`dateOfParts`).
 *    거절은 누른 뒤 `birthFieldErrors` 가 무엇이 틀렸는지 말하며 그 칸을 붉힌다(「2월은 28일까지예요.」) — 판정하는 자리는 그 하나다.
 * 2. **날짜의 존재**(없는 윤달, 29일까지인 음력 달의 30일)는 음력 표가 이유를 붙여
 *    거절하고, 화면은 누른 뒤 그 문장을 칸 아래에 세우고 그 칸을 붉힌다(`invalid`).
 *
 * 폼이 자기 조각을 따로 들고 있으므로 **밖에서 값이 바뀐 것과 자기가 방금 낸
 * 것을 구별해야 한다**(뒤로가기·링크로 들어옴). 마지막으로 올려 보낸 값을
 * 기억해 두고 그것과 다를 때만 조각을 다시 쪼갠다.
 */
export function DateFields({
  value,
  onDate,
  invalid,
}: {
  value: Query;
  onDate: (date: string) => void;
  /**
   * 누른 뒤 붉힐 칸 — 어긋난 한 칸(`part`)이거나, 없으면 덜 적은 칸 전부다. 누르기 전 · 바른 날짜면 `null`
   */
  invalid: (Invalid & { part: DatePart | null }) | null;
}) {
  const [parts, setParts] = useState(() => splitDate(value.date));
  const lastEmitted = useRef(value.date);

  useEffect(() => {
    if (value.date === lastEmitted.current) return;
    setParts(splitDate(value.date));
    lastEmitted.current = value.date;
  }, [value.date]);

  const { years, maxDay } = limitsOf(value.calendar, parts.year, parts.month);
  /** 이 칸을 붉히는가 — 어긋난 칸을 짚었으면 그 칸, 아니면 덜 적은 칸(빈 칸 · 네 자리가 안 된 해, `dateOfParts`) */
  const mark = (part: DatePart): Invalid | null => {
    if (invalid === null) return null;
    return dateDigitWrong(part, parts[part], invalid.part) ? invalid : null;
  };

  const update = (key: keyof typeof parts, next: string) => {
    const changed = { ...parts, [key]: next };
    setParts(changed);
    const date = dateOfParts(changed);
    lastEmitted.current = date;
    onDate(date);
  };

  return (
    <DigitsField label="생년월일" groupStart>
      <NumberField
        label={BIRTH_DIGIT_LABEL.year}
        suffix="년"
        value={parts.year}
        onChange={(next) => update('year', next)}
        digits={4}
        placeholder={String(years.max - 30)}
        autoComplete="bday-year"
        invalid={mark('year')}
      />
      <NumberField
        label={BIRTH_DIGIT_LABEL.month}
        suffix="월"
        value={parts.month}
        onChange={(next) => update('month', next)}
        digits={2}
        placeholder="1~12"
        autoComplete="bday-month"
        invalid={mark('month')}
      />
      <NumberField
        label={BIRTH_DIGIT_LABEL.day}
        suffix="일"
        value={parts.day}
        onChange={(next) => update('day', next)}
        digits={2}
        placeholder={`1~${maxDay}`}
        autoComplete="bday-day"
        invalid={mark('day')}
      />
    </DigitsField>
  );
}

/**
 * 출생시각 — **24시간으로만 묻는다.**
 *
 * 오전·오후를 따로 고르게 하면 「오후 12시 30분」이 0시 30분인지 12시 30분인지에서
 * 갈리고, 그 한 칸이 시주를 통째로 바꾼다. 자시 규칙(조자시 23:00 경계)도 23시가
 * 23시로 적혀 있을 때만 사람이 대조할 수 있다.
 *
 * 시각을 아는가는 「출생 시각」 고르는 칸이다(「직접 입력 · 모름」). 체크박스는 **꺼진 상태가 답처럼
 * 보이지 않아서** 쓰지 않는다 — 시각을 안 넣고 체크도 안 한 사람이 자기가 아직 아무것도 고르지 않았다는 것을 모른다
 * (`hourKnown` 이 `null`·`false`·`true` 셋인 이유). 주소에서 온 입력이 `null` 이면 두 선택지 모두 꺼져 있고 시각 칸은
 * 서지 않는다 — 고르기 전에는 어느 쪽도 고른 것이 아니다.
 *
 * 「모름」을 고르면 적어 둔 시각도 지운다. 남겨 두면 "모름인데 14:30" 이 상태로
 * 남고, 다시 「직접 입력」을 고르는 순간 사용자가 지웠다고 생각한 값으로 계산된다.
 */
export function TimeFields({
  value,
  onChange,
  invalid,
}: {
  value: Query;
  onChange: (next: Query) => void;
  /** 누른 뒤 출생 시각이 고칠 칸인가 — 고르지 않았으면 고르는 칸이, 시각이 덜 됐으면 덜 적었거나 범위 밖인 칸이 붉다 */
  invalid: Invalid | null;
}) {
  const [parts, setParts] = useState(() => splitTime(value.time));
  const lastEmitted = useRef(value.time);

  useEffect(() => {
    if (value.time === lastEmitted.current) return;
    setParts(splitTime(value.time));
    lastEmitted.current = value.time;
  }, [value.time]);

  const update = (key: keyof typeof parts, next: string) => {
    const changed = { ...parts, [key]: next };
    setParts(changed);
    const time = timeOfParts(changed);
    lastEmitted.current = time;
    onChange({ ...value, hourKnown: true, time });
  };

  const choose = (known: boolean) => {
    if (!known) {
      setParts({ hour: '', minute: '' });
      lastEmitted.current = '';
      onChange({ ...value, hourKnown: false, time: '' });
      return;
    }
    const time = timeOfParts(parts);
    lastEmitted.current = time;
    onChange({ ...value, hourKnown: true, time });
  };

  const known = value.hourKnown === true;
  /** 그 칸이 시각의 한 자리로 아직 못 쓰이는가 — 비었거나 범위 밖이다 */
  const mark = (one: string, max: number): Invalid | null => (invalid !== null && timeDigitWrong(one, max) ? invalid : null);

  return (
    <>
      <ChoiceField
        label="출생 시각"
        labelAt="rail"
        groupStart
        invalid={value.hourKnown === null ? invalid : null}
        value={value.hourKnown === null ? '' : value.hourKnown ? 'known' : 'unknown'}
        onPick={(next) => choose(next === 'known')}
        options={[
          { value: 'known', label: '직접 입력' },
          { value: 'unknown', label: HOUR_UNKNOWN_CHOICE, hint: <>{HOUR_UNKNOWN_HINT}</> },
        ]}
      />
      {/*
        시·분도 **적는 칸**이다. 24시간이라 시는 스물넷, 분은 예순 줄짜리 목록이 되는데, 두 자리를 치는 편이
        어느 쪽이든 빠르다. 범위를 벗어나면 시각을 내보내지 않으므로 「25:70」이 계산으로 흘러가지 않는다.
        「직접 입력」일 때만 선다 — 「모름」이거나 아직 안 골랐으면(주소에서 온 `null`) 이 칸이 빠진다.
      */}
      {known && (
        <DigitsField label="시각" hint="24시간" rail>
          <NumberField
            label={BIRTH_DIGIT_LABEL.hour}
            suffix="시"
            value={parts.hour}
            onChange={(next) => update('hour', next)}
            digits={2}
            placeholder="0~23"
            invalid={mark(parts.hour, 23)}
          />
          <NumberField
            label={BIRTH_DIGIT_LABEL.minute}
            suffix="분"
            value={parts.minute}
            onChange={(next) => update('minute', next)}
            digits={2}
            placeholder="0~59"
            invalid={mark(parts.minute, 59)}
          />
        </DigitsField>
      )}
    </>
  );
}
