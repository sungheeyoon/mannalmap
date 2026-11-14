import { useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BUTTON_OFF_OPACITY } from '@design';
import { dateRefusal } from '@input/chart';
import { convertedLine, dateOfParts, limitsOf, splitDate, splitTime, timeOfParts } from '@input/entry';
import { ADVANCED_SETTINGS, HOUR_UNKNOWN_HINT } from '@input/copy';
import { birthSectionErrors, dateDigitWrong, timeDigitWrong, type BirthSection } from '@input/section-errors';
import { BIRTH_CITY_OPTIONS, BIRTH_DIGIT_LABEL, BIRTH_SELECT_LABEL, DEFAULT_QUERY, HOUR_UNKNOWN_CHOICE, NAME_MAX, TIME_BASES, TIME_BASIS, type Query } from '@input/query';
import { CALENDARS, CALENDAR_KO, GENDERS, GENDER_KO, SUPPORTED_YEAR_RANGE, type CityName, type LateNightRule } from '@saju';

import { FoldIcon } from '@/ui/icons';
import { Choices, DigitField, Field, FieldLabel, Select } from '@/ui/parts';
import { SectionErrorLine, type SectionErrors } from '@/ui/section-error';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

const HOUR_CHOICES = [
  { value: 'known', label: '직접 입력' },
  { value: 'unknown', label: HOUR_UNKNOWN_CHOICE },
] as const;
const RULES: readonly { value: LateNightRule; label: string; hint: string }[] = [
  { value: 'jo', label: '조자시', hint: '경계 23:00' },
  { value: 'ya', label: '야자시', hint: '경계 자정' },
];

/**
 * 출생 정보 칸의 값 — 입력 화면(`mobile/src/app/index.tsx`)과 같은 차례 · 같은 함수다. 저장하는 화면이라고 다른 폼을 두면 한쪽만
 * 고쳐져 같은 값에서 다른 사주가 난다(`app/me/people/manage.tsx`).
 */
export function useBirthForm(initial: Query = DEFAULT_QUERY) {
  const date = splitDate(initial.date);
  const clock = splitTime(initial.time);
  const [name, setName] = useState(initial.name);
  const [gender, setGender] = useState<Query['gender']>(initial.gender);
  const [year, setYear] = useState(date.year);
  const [month, setMonth] = useState(date.month);
  const [day, setDay] = useState(date.day);
  const [calendar, setCalendar] = useState<Query['calendar']>(initial.calendar);
  const [hourChoice, setHourChoice] = useState<'known' | 'unknown'>(initial.hourKnown === false ? 'unknown' : 'known');
  const [hour, setHour] = useState(clock.hour);
  const [minute, setMinute] = useState(clock.minute);
  const [city, setCity] = useState<CityName>(initial.city);
  const [advanced, setAdvanced] = useState(false);
  const [rule, setRule] = useState<LateNightRule>(initial.rule);
  const [basis, setBasis] = useState<Query['basis']>(initial.basis);
  const [saeunFrom, setSaeunFrom] = useState(String(initial.saeunFrom));

  const hourKnown = hourChoice === 'known';
  const query: Query = {
    ...DEFAULT_QUERY,
    name,
    gender,
    calendar,
    date: dateOfParts({ year, month, day }),
    hourKnown,
    /* 범위 밖의 시각은 값이 안 된다 — 「33시」는 계산에 안 간다 */
    time: hourKnown ? timeOfParts({ hour, minute }) : '',
    city,
    rule,
    basis,
    saeunFrom: Number(saeunFrom),
  };

  return {
    query,
    /** 문단 오류(ADR 0252) — 시 · 분 칸의 숫자를 알아 「25시」를 범위로 말한다 */
    errors: birthSectionErrors(query, { name: false, time: { hour, minute } }),
    /** 이름을 묻는 폼의 문단 오류 */
    errorsWithName: birthSectionErrors(query, { time: { hour, minute } }),
    values: { name, gender, year, month, day, calendar, hourChoice, hour, minute, city, advanced, rule, basis, saeunFrom },
    set: { setName, setGender, setYear, setMonth, setDay, setCalendar, setHour, setMinute, setCity, setAdvanced, setRule, setBasis, setSaeunFrom },
    chooseHour: (next: 'known' | 'unknown') => {
      /* 「모름」이면 적어 둔 시각도 지운다 — 다시 「직접 입력」을 골랐을 때 지운 줄 안 값으로 계산되지 않게 */
      if (next === 'unknown') {
        setHour('');
        setMinute('');
      }
      setHourChoice(next);
    },
  };
}

export function BirthFields({
  form,
  namePlaceholder,
  showName = true,
  disabled = false,
  errors,
}: {
  form: ReturnType<typeof useBirthForm>;
  /** 누른 뒤의 문단 오류(`useSectionErrors`) — 없으면 아무 칸도 붉지 않다 */
  errors?: SectionErrors<BirthSection>;
  namePlaceholder?: string;
  showName?: boolean;
  /** 저장하는 동안 칸 · 고르기를 다 잠근다 — 저장이 끝나 폼이 비면 그 사이 고친 값이 사라진다 */
  disabled?: boolean;
}) {
  const { query, values, chooseHour: pickHour } = form;
  const refused = dateRefusal(query)?.part ?? null;
  const shown = errors?.shown ?? {};
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const yearRef = useRef<ComponentRef<typeof TextInput>>(null);
  /** 칸을 고치면 그 칸의 문단 줄만 걷힌다(ADR 0252) */
  const edited =
    <T,>(section: BirthSection, setter: (next: T) => void) =>
    (next: T) => {
      errors?.edit(section);
      setter(next);
    };
  const set = {
    ...form.set,
    setName: edited('name', form.set.setName),
    setGender: edited('name', form.set.setGender),
    setYear: edited('date', form.set.setYear),
    setMonth: edited('date', form.set.setMonth),
    setDay: edited('date', form.set.setDay),
    setCalendar: edited('date', form.set.setCalendar),
    setHour: edited('hour', form.set.setHour),
    setMinute: edited('hour', form.set.setMinute),
  };
  const chooseHour = edited('hour', pickHour);
  const dateWrong = (part: 'year' | 'month' | 'day') => shown.date !== undefined && dateDigitWrong(part, values[part], refused);
  const monthRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dayRef = useRef<ComponentRef<typeof TextInput>>(null);
  const hourRef = useRef<ComponentRef<typeof TextInput>>(null);
  const minuteRef = useRef<ComponentRef<typeof TextInput>>(null);

  const { years, maxDay } = limitsOf(values.calendar, values.year, values.month);
  const converted = convertedLine(query);
  /**
   * 문단의 첫 적는 칸을 데려갈 자리로 단다 — 누른 뒤 맨 위 걸린 문단이면 그 칸으로 스크롤하고 초점을 준다(`useSectionErrors`).
   * 그 칸의 ref(다음 칸으로 넘기는 데 쓴다)도 함께 채운다.
   */
  type Input = ComponentRef<typeof TextInput> | null;
  const nameField = (node: Input) => {
    nameRef.current = node;
    errors?.anchor('name')(node);
  };
  const yearField = (node: Input) => {
    yearRef.current = node;
    errors?.anchor('date')(node);
  };
  const hourField = (node: Input) => {
    hourRef.current = node;
    errors?.anchor('hour')(node);
  };

  return (
    <View style={styles.fields}>
      <View>
        <View style={styles.pair}>
          {showName && (
            <View style={styles.half}>
              <FieldLabel>이름</FieldLabel>
              <Field inputRef={nameField} value={values.name} onChange={set.setName} maxLength={NAME_MAX} placeholder={namePlaceholder} label="이름" disabled={disabled} refused={shown.name !== undefined} />
            </View>
          )}
          <View style={styles.half}>
            <FieldLabel>성별</FieldLabel>
            <Choices disabled={disabled} value={values.gender} onPick={set.setGender} options={GENDERS.map((one) => ({ value: one, label: GENDER_KO[one] }))} />
          </View>
        </View>
        <SectionErrorLine message={shown.name} />
      </View>

      <View style={styles.group}>
        <FieldLabel>생년월일</FieldLabel>
        <View style={styles.row}>
          <DigitField inputRef={yearField} value={values.year} onChange={set.setYear} label={BIRTH_DIGIT_LABEL.year} disabled={disabled} unit="년" placeholder={String(years.max - 30)} digits={4} min={years.min} max={years.max} refused={dateWrong('year')} onFull={() => monthRef.current?.focus()} />
          <DigitField inputRef={monthRef} value={values.month} onChange={set.setMonth} label={BIRTH_DIGIT_LABEL.month} disabled={disabled} unit="월" placeholder="1~12" digits={2} min={1} max={12} advanceEarly refused={dateWrong('month')} onFull={() => dayRef.current?.focus()} />
          <DigitField inputRef={dayRef} value={values.day} onChange={set.setDay} label={BIRTH_DIGIT_LABEL.day} disabled={disabled} unit="일" placeholder={`1~${maxDay}`} digits={2} min={1} max={maxDay} advanceEarly refused={dateWrong('day')} onFull={() => (values.hourChoice === 'known' ? hourRef.current?.focus() : Keyboard.dismiss())} />
        </View>
        {/* 못 바꾼 까닭은 누른 뒤에는 아래 생년월일 줄이 같은 말을 한다 — 두 번 세우지 않는다 */}
        {converted !== null && (converted.ok || shown.date === undefined) && (
          <WordText style={[styles.converted, !converted.ok && styles.refused]}>{converted.text}</WordText>
        )}
        <View style={styles.row}>
          <Choices disabled={disabled} value={values.calendar} onPick={set.setCalendar} options={CALENDARS.map((one) => ({ value: one, label: CALENDAR_KO[one] }))} />
        </View>
        {/* 문단 「생년월일」의 줄 — 양력 · 음력 · 음력 윤달 줄 아래(ADR 0252) */}
        <SectionErrorLine message={shown.date} gap={6} />
      </View>

      <View style={styles.group}>
        <View style={styles.rail}>
          <WordText style={styles.railLabel}>출생 시각</WordText>
          <Choices disabled={disabled} value={values.hourChoice} onPick={chooseHour} options={HOUR_CHOICES} />
        </View>
        {values.hourChoice === 'unknown' && <WordText style={styles.choiceHint}>{HOUR_UNKNOWN_HINT}</WordText>}

      {values.hourChoice === 'known' && (
        /* 묶음 안이라 사이가 6 이다 — 따로 서던 때의 18 을 맞춘다 */
        <View style={[styles.rail, styles.timeRow]}>
          <View style={styles.railHead}>
            <WordText style={styles.railLabel}>시각</WordText>
            <WordText style={styles.railNote}>24시간</WordText>
          </View>
          <View style={styles.railBody}>
            <DigitField inputRef={hourField} value={values.hour} onChange={set.setHour} label={BIRTH_DIGIT_LABEL.hour} disabled={disabled} unit="시" placeholder="0~23" digits={2} min={0} max={23} refused={shown.hour !== undefined && timeDigitWrong(values.hour, 23)} onFull={() => minuteRef.current?.focus()} />
            <DigitField inputRef={minuteRef} value={values.minute} onChange={set.setMinute} label={BIRTH_DIGIT_LABEL.minute} disabled={disabled} unit="분" placeholder="0~59" digits={2} min={0} max={59} refused={shown.hour !== undefined && timeDigitWrong(values.minute, 59)} onFull={Keyboard.dismiss} />
          </View>
        </View>
      )}
        {/* 문단 「출생 시각」의 줄 — 시 · 분 줄(「모름」이면 고르는 줄) 아래 */}
        <SectionErrorLine message={shown.hour} gap={6} />
      </View>

      <View style={styles.rail}>
        <WordText aria-hidden style={styles.railLabel}>{BIRTH_SELECT_LABEL.city.label}</WordText>
        <Select {...BIRTH_SELECT_LABEL.city} disabled={disabled} value={values.city} onPick={set.setCity} options={BIRTH_CITY_OPTIONS} />
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: values.advanced, disabled }} disabled={disabled} onPress={() => set.setAdvanced(!values.advanced)} style={[styles.disclosure, disabled && styles.off]}>
        <WordText style={styles.disclosureLabel}>고급 설정</WordText>
        <WordText style={styles.disclosureSummary} numberOfLines={1}>{ADVANCED_SETTINGS.summary}</WordText>
        <FoldIcon open={values.advanced} />
      </Pressable>

      {values.advanced && (
        <View style={styles.fields}>
          <WordText style={styles.advancedIntro}>{ADVANCED_SETTINGS.intro}</WordText>
          <View style={styles.rail}>
            <WordText aria-hidden style={styles.railLabel}>{BIRTH_SELECT_LABEL.rule.label}</WordText>
            <Select {...BIRTH_SELECT_LABEL.rule} value={values.rule} onPick={set.setRule} options={RULES} disabled={disabled || values.hourChoice === 'unknown'} />
          </View>
          <View style={styles.rail}>
            <WordText aria-hidden style={styles.railLabel}>{BIRTH_SELECT_LABEL.basis.label}</WordText>
            <Select {...BIRTH_SELECT_LABEL.basis} disabled={disabled} value={values.basis} onPick={set.setBasis} options={TIME_BASES.map((one) => ({ value: one, label: TIME_BASIS[one].label, hint: TIME_BASIS[one].hint }))} />
          </View>
          <View style={styles.rail}>
            <WordText style={styles.railLabel}>세운 연도</WordText>
            <DigitField value={values.saeunFrom} onChange={set.setSaeunFrom} label={BIRTH_DIGIT_LABEL.saeun} disabled={disabled} unit="년" placeholder="2026" digits={4} min={SUPPORTED_YEAR_RANGE.min} max={SUPPORTED_YEAR_RANGE.max} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 18 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  group: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  rail: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timeRow: { marginTop: 12 },
  railHead: { width: 64, minHeight: 44, justifyContent: 'center' },
  railLabel: { width: 64, minHeight: 44, lineHeight: 44, fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  railNote: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted, marginTop: -14 },
  railBody: { flex: 1, flexDirection: 'row', gap: 6 },
  converted: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary, marginVertical: 2 },
  refused: { color: COLOR.danger },
  off: { opacity: BUTTON_OFF_OPACITY },
  disclosure: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  choiceHint: { marginLeft: 72, fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 16, color: COLOR.secondary },
  advancedIntro: { fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 20, color: COLOR.secondary },
  disclosureLabel: { flexShrink: 0, fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  /* 요약이 남은 폭을 차지하고 오른쪽에 붙는다 — 화살표와는 8(웹 `.disclosure` 의 gap) */
  disclosureSummary: { flex: 1, minWidth: 0, marginHorizontal: 8, textAlign: 'right', fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
});
