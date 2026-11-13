import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SERVICE_NAME } from '@brand';
import { COMPAT_CREDIT_NOTE, COMPAT_ENTRY, COMPAT_SIGN_IN_ACTION, COMPAT_SIGN_IN_TITLE, MEMBER_SIGN_IN_ASK } from '@brand/guide';
import { ELEVATION } from '@design';
import { calculateChart, dateRefusal } from '@input/chart';
import { convertedLine, dateOfParts, limitsOf, timeOfParts } from '@input/entry';
import { ADVANCED_SETTINGS, HOUR_UNKNOWN_HINT } from '@input/copy';
import { BIRTH_CITY_OPTIONS, BIRTH_DIGIT_LABEL, BIRTH_SELECT_LABEL, DEFAULT_QUERY, HOUR_UNKNOWN_CHOICE, NAME_MAX, TIME_BASES, TIME_BASIS, type Query } from '@input/query';
import { CALENDARS, CALENDAR_KO, GENDERS, GENDER_KO, SUPPORTED_YEAR_RANGE, type CityName, type LateNightRule } from '@saju';

import { chartPath } from '@consent/app-destination';
import { entryFor, type Entry, type EntryOpened } from '@consent/entry';
import { withReturnPath } from '@consent/return-path';
import { readGate } from '@/home/gate';
import { POLICY_TITLE, SUPPORT_TITLE } from '@/info/copy';
import { Choices, DigitField, Field, FieldLabel, KeyboardDoneBar, PrimaryButton, SecondaryButton, Select } from '@/ui/parts';
import { SunMark } from '@/share/marks';
import { FormError } from '@/ui/form-error';
import { FoldIcon, Icon } from '@/ui/icons';
import { Logo } from '@/ui/logo';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { CardFrame, Paper } from '@/ui/surfaces';
import { KEEP_VIEW } from '@/ui/keep-view';
import { WordText } from '@/ui/word-text';

const HOUR_CHOICES = [
  { value: 'known', label: '직접 입력' },
  { value: 'unknown', label: HOUR_UNKNOWN_CHOICE },
] as const;
const RULES: readonly { value: LateNightRule; label: string; hint: string }[] = [
  { value: 'jo', label: '조자시', hint: '경계 23:00' },
  { value: 'ya', label: '야자시', hint: '경계 자정' },
];

type Doorway = 'self' | 'pair';

/**
 * 로그인 전 첫 화면의 두 입구 — 웹 `/` 의 탭(`app/home-hero.tsx` 의 `VisitorFace`)과 같은 모양이다: `rounded-cell bg-surface-sunken p-0.5` 판에
 * 켜진 칸은 `bg-surface shadow-card`, 그림은 해(`SunMark`) · 태극(`Icon name="taiji"`). 이름은 웹의 두 탭 글자 그대로다(ADR 0226)
 */
function EntryTabs({ value, onPick }: { value: Doorway; onPick: (next: Doorway) => void }) {
  const doors: readonly { key: Doorway; label: string }[] = [
    { key: 'self', label: '내 사주 보기' },
    { key: 'pair', label: COMPAT_ENTRY },
  ];
  return (
    <View accessibilityRole="tablist" aria-label="무엇을 볼까요" style={styles.tabs}>
      {doors.map((door) => {
        const on = door.key === value;
        const color = on ? COLOR.foreground : COLOR.secondary;
        return (
          <Pressable
            key={door.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(door.key)}
            {...KEEP_VIEW} style={[styles.tab, on && styles.tabOn]}
          >
            {door.key === 'self' ? <SunMark size={20} color={color} /> : <Icon name="taiji" size={20} color={color} />}
            <WordText style={[styles.tabText, on && styles.tabTextOn]}>{door.label}</WordText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * 입구 — 앱을 열면 관문의 답 하나로 설 곳을 고른다(`entryFor`, ADR 0226). 가입을 마친 회원은 홈, 가입 · 다시 확인할 안내가 남았으면
 * 가입 화면, 세션이 없으면 입력 화면이고 만세력까지 로그인을 묻지 않는다(ADR 0213). **관문을 못 읽었으면 로그인 전으로 읽지 않고
 * 다시 시도하기를 세운다.** 홈의 「다른 사람 사주 보기」는 `another` 를 들고 와 입력 화면을 그대로 연다.
 *
 * 돌아올 때마다 다시 본다 — 결과 화면에서 로그인하고 돌아온 사람에게 「로그인」이 남지 않고, 적어 둔 값 위에서 홈으로 튕기지도 않는다.
 */
export default function EntryScreen() {
  const { another } = useLocalSearchParams<{ another?: string }>();
  const opened: EntryOpened = another === undefined ? 'first' : 'another';
  const [entry, setEntry] = useState<Entry | 'checking'>(opened === 'first' ? 'checking' : 'birth');
  const [signedIn, setSignedIn] = useState(opened === 'another');
  const [failure, setFailure] = useState<string | null>(null);

  const check = useCallback(() => {
    let watching = true;
    void readGate().then((gate) => {
      if (!watching) return;
      setSignedIn(gate.kind === 'in');
      setFailure(gate.kind === 'failed' ? gate.message : null);
      /* 한 번 고른 자리는 다시 안 고른다 — 적어 둔 값 위에서 홈으로 튕기지 않는다. 다시 시도하기만 다시 고른다 */
      setEntry((now) => (now !== 'checking' && now !== 'retry' ? now : entryFor(gate.kind, opened)));
    });
    return () => {
      watching = false;
    };
  }, [opened]);

  useFocusEffect(check);

  if (entry === 'checking') return <View style={styles.screen} />;
  if (entry === 'home') return <Redirect href={'/me' as never} />;
  if (entry === 'signup') return <Redirect href={'/signup' as never} />;
  if (entry === 'retry') {
    return (
      <SafeAreaView style={[styles.screen, styles.retry]}>
        <WordText style={styles.retryLine}>{failure}</WordText>
        <SecondaryButton
          label="다시 시도하기"
          onPress={() => {
            setEntry('checking');
            check();
          }}
        />
      </SafeAreaView>
    );
  }
  return <BirthScreen signedOut={!signedIn} />;
}

/** 로그인 전의 아래 길 — 웹 바닥글을 옮기지 않는다. 자주 묻는 질문 · 문의는 고객센터 안, 약관 셋과 사업자 정보는 약관 및 정책 안이다 */
const ENTRY_LINKS = [
  { label: '서비스 소개', open: () => router.push('/about') },
  { label: SUPPORT_TITLE, open: () => router.push('/support') },
  { label: POLICY_TITLE, open: () => router.push('/policies') },
];

/** 출생 정보 — 칸의 차례와 말은 웹의 `app/birth-form.tsx` 와 같다. 계산은 웹과 같은 `calculateChart` 다 */
function BirthScreen({ signedOut }: { signedOut: boolean }) {
  /* 두 입구 — 웹 `/` 의 「내 사주 보기 · 궁합 보기」 탭(`app/home-hero.tsx`). 로그인 전에만 선다 */
  const [doorway, setDoorway] = useState<Doorway>('self');
  const pair = signedOut && doorway === 'pair';
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Query['gender']>(DEFAULT_QUERY.gender);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [calendar, setCalendar] = useState<Query['calendar']>(DEFAULT_QUERY.calendar);
  const [hourChoice, setHourChoice] = useState<'known' | 'unknown'>('known');
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [city, setCity] = useState<CityName>(DEFAULT_QUERY.city);
  const [advanced, setAdvanced] = useState(false);
  const [rule, setRule] = useState<LateNightRule>(DEFAULT_QUERY.rule);
  const [basis, setBasis] = useState<Query['basis']>(DEFAULT_QUERY.basis);
  const [saeunFrom, setSaeunFrom] = useState(String(DEFAULT_QUERY.saeunFrom));
  const [refusal, setRefusal] = useState<{ message: string; of: string } | null>(null);

  const monthRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dayRef = useRef<ComponentRef<typeof TextInput>>(null);
  const hourRef = useRef<ComponentRef<typeof TextInput>>(null);
  const minuteRef = useRef<ComponentRef<typeof TextInput>>(null);

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
  const { years, maxDay } = limitsOf(calendar, year, month);
  const refused = dateRefusal(query)?.part ?? null;
  const converted = convertedLine(query);
  /* 거절 문구는 그때 낸 값의 것이다 — 값을 고치면 걷힌다. 연도만 적은 날짜는 `query` 에 아직 안 서서 칸의 글자도 함께 본다 */
  const typed = JSON.stringify([query, year, month, day, hour, minute]);
  const failure = refusal?.of === typed ? refusal.message : null;

  const chooseHour = (next: 'known' | 'unknown') => {
    /* 「모름」이면 적어 둔 시각도 지운다 — 다시 「직접 입력」을 골랐을 때 지운 줄 안 값으로 계산되지 않게 */
    if (next === 'unknown') {
      setHour('');
      setMinute('');
    }
    setHourChoice(next);
  };

  /* 계산은 기기 안에서 끝난다 — 서버를 안 부른다. 적은 값은 이 화면이 들고 있어 결과에서 돌아와도 그대로다 */
  const submit = () => {
    const result = calculateChart(query);
    if (!result.ok) {
      setRefusal({ message: result.message, of: typed });
      return;
    }
    setRefusal(null);
    router.push(chartPath(query) as never);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.brandRow}>
            {/* 로고는 웹의 그 파일이다 — 앱에 사본을 두지 않는다 */}
            <Logo size={32} />
            <WordText style={styles.brand}>{SERVICE_NAME}</WordText>
            {/* 이미 계정이 있는 사람의 길 — 웹 머리글의 그 자리다. 생년월일을 안 적어도 들어간다. 이미 로그인한 사람에게는 안 선다 */}
            {signedOut && (
              <Pressable accessibilityRole="link" onPress={() => router.push('/auth' as never)} style={styles.signIn}>
                <WordText style={styles.signInText}>로그인</WordText>
              </Pressable>
            )}
          </View>
          <Paper style={styles.paper}>
            {signedOut ? (
              <View style={styles.head}>
                <WordText accessibilityRole="header" style={styles.title}>나는 어떤 사람일까?</WordText>
                <EntryTabs value={doorway} onPick={setDoorway} />
              </View>
            ) : (
              <WordText style={[styles.title, styles.titleAlone]}>출생 정보를 입력해 주세요</WordText>
            )}

            {/* 궁합 쪽 — 앱에는 로그인 전 궁합 결과가 없어 로그인으로 잇는다(ADR 0213 의 11 · ADR 0226). 입력 판은 내려 두지 않고 숨긴다 — 적던 값이 남는다 */}
            {pair && (
              <View style={styles.compat}>
                <WordText style={styles.compatTitle}>{COMPAT_SIGN_IN_TITLE}</WordText>
                <WordText style={styles.compatNote}>{COMPAT_CREDIT_NOTE}</WordText>
                <View style={styles.compatAction}>
                  <PrimaryButton label={COMPAT_SIGN_IN_ACTION} onPress={() => router.push(withReturnPath('/auth', '/me/compat') as never)} />
                </View>
              </View>
            )}

            <View style={[styles.formArea, pair && styles.hidden]}>
            <CardFrame style={styles.form}>
              <View style={styles.pair}>
                <View style={styles.half}>
                  <FieldLabel>이름</FieldLabel>
                  <Field value={name} onChange={setName} maxLength={NAME_MAX} label="이름" />
                </View>
                <View style={styles.half}>
                  <FieldLabel>성별</FieldLabel>
                  <Choices value={gender} onPick={setGender} options={GENDERS.map((one) => ({ value: one, label: GENDER_KO[one] }))} />
                </View>
              </View>

              <View style={styles.group}>
                <FieldLabel>생년월일</FieldLabel>
                <View style={styles.row}>
                  <DigitField value={year} onChange={setYear} label={BIRTH_DIGIT_LABEL.year} unit="년" placeholder={String(years.max - 30)} digits={4} min={years.min} max={years.max} refused={refused === 'year'} onFull={() => monthRef.current?.focus()} />
                  <DigitField inputRef={monthRef} value={month} onChange={setMonth} label={BIRTH_DIGIT_LABEL.month} unit="월" placeholder="1~12" digits={2} min={1} max={12} advanceEarly refused={refused === 'month'} onFull={() => dayRef.current?.focus()} />
                  <DigitField inputRef={dayRef} value={day} onChange={setDay} label={BIRTH_DIGIT_LABEL.day} unit="일" placeholder={`1~${maxDay}`} digits={2} min={1} max={maxDay} advanceEarly refused={refused === 'day'} onFull={() => (hourKnown ? hourRef.current?.focus() : Keyboard.dismiss())} />
                </View>
                {converted !== null && (
                  <WordText style={[styles.converted, !converted.ok && styles.failure]}>{converted.text}</WordText>
                )}
                <View style={styles.row}>
                  <Choices value={calendar} onPick={setCalendar} options={CALENDARS.map((one) => ({ value: one, label: CALENDAR_KO[one] }))} />
                </View>
              </View>

              <View style={styles.group}>
                <View style={styles.rail}>
                  <WordText style={styles.railLabel}>출생 시각</WordText>
                  <Choices value={hourChoice} onPick={chooseHour} options={HOUR_CHOICES} />
                </View>
                {hourChoice === 'unknown' && <WordText style={styles.choiceHint}>{HOUR_UNKNOWN_HINT}</WordText>}
              </View>

              {hourChoice === 'known' && (
                <View style={styles.rail}>
                  <View style={styles.railHead}>
                    <WordText style={styles.railLabel}>시각</WordText>
                    <WordText style={styles.railNote}>24시간</WordText>
                  </View>
                  <View style={styles.railBody}>
                    <DigitField inputRef={hourRef} value={hour} onChange={setHour} label={BIRTH_DIGIT_LABEL.hour} unit="시" placeholder="0~23" digits={2} min={0} max={23} onFull={() => minuteRef.current?.focus()} />
                    <DigitField inputRef={minuteRef} value={minute} onChange={setMinute} label={BIRTH_DIGIT_LABEL.minute} unit="분" placeholder="0~59" digits={2} min={0} max={59} onFull={Keyboard.dismiss} />
                  </View>
                </View>
              )}

              <View style={styles.rail}>
                <WordText aria-hidden style={styles.railLabel}>{BIRTH_SELECT_LABEL.city.label}</WordText>
                <Select {...BIRTH_SELECT_LABEL.city} value={city} onPick={setCity} options={BIRTH_CITY_OPTIONS} />
              </View>
            </CardFrame>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: advanced }}
              onPress={() => setAdvanced(!advanced)}
              style={styles.disclosure}
            >
              <WordText style={styles.disclosureLabel}>고급 설정</WordText>
              <WordText style={styles.disclosureSummary} numberOfLines={1}>{ADVANCED_SETTINGS.summary}</WordText>
              <FoldIcon open={advanced} />
            </Pressable>

            {advanced && (
              <CardFrame style={styles.form}>
                <WordText style={styles.advancedIntro}>{ADVANCED_SETTINGS.intro}</WordText>
                <View style={styles.rail}>
                  <WordText aria-hidden style={styles.railLabel}>{BIRTH_SELECT_LABEL.rule.label}</WordText>
                  <Select {...BIRTH_SELECT_LABEL.rule} value={rule} onPick={setRule} options={RULES} disabled={hourChoice === 'unknown'} />
                </View>
                <View style={styles.rail}>
                  <WordText aria-hidden style={styles.railLabel}>{BIRTH_SELECT_LABEL.basis.label}</WordText>
                  <Select
                    {...BIRTH_SELECT_LABEL.basis}
                    value={basis}
                    onPick={setBasis}
                    options={TIME_BASES.map((one) => ({ value: one, label: TIME_BASIS[one].label, hint: TIME_BASIS[one].hint }))}
                  />
                </View>
                <View style={styles.rail}>
                  <WordText style={styles.railLabel}>세운 연도</WordText>
                  <DigitField value={saeunFrom} onChange={setSaeunFrom} label={BIRTH_DIGIT_LABEL.saeun} unit="년" placeholder="2026" digits={4} min={SUPPORTED_YEAR_RANGE.min} max={SUPPORTED_YEAR_RANGE.max} />
                </View>
              </CardFrame>
            )}

            {/* 폼이 짧은 화면에서도 단추는 엄지가 닿는 맨 아래에 선다 */}
            <View style={styles.action}>
              {/* 로그인 전에는 웹 첫 화면의 주 단추와 같은 글자다 — 무엇이 무료인지 단추가 말한다(ADR 0131 · 0226) */}
              <View>
                <PrimaryButton label={signedOut ? '무료로 내 사주 보기' : '사주 보기'} onPress={submit} />
                <FormError show={failure !== null}>{failure}</FormError>
              </View>
              {/* 이미 쓰는 사람의 길 — 주 단추 바로 아래 한 줄, 웹 첫 화면과 같은 글자다(ADR 0226). 생년월일 없이 홈으로 간다 */}
              {signedOut && (
                <View style={styles.member}>
                  <WordText style={styles.memberAsk}>{MEMBER_SIGN_IN_ASK}</WordText>
                  <Pressable accessibilityRole="link" onPress={() => router.push('/auth' as never)} style={styles.memberSignIn}>
                    <WordText style={styles.memberSignInText}>로그인</WordText>
                  </Pressable>
                </View>
              )}
            </View>
            </View>
          </Paper>

          {signedOut && (
            <View accessibilityLabel="안내" style={styles.links}>
              {ENTRY_LINKS.map((link) => (
                <Pressable key={link.label} accessibilityRole="link" onPress={link.open} style={styles.link}>
                  <WordText style={styles.linkText}>{link.label}</WordText>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
        <KeyboardDoneBar />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, padding: 16 },
  paper: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 20, paddingBottom: 20, gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 4, marginBottom: 12 },
  brand: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.foreground },
  signIn: { minHeight: 44, justifyContent: 'center', marginLeft: 'auto', paddingLeft: 12 },
  signInText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.secondary },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, marginTop: 12, marginHorizontal: 4 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  titleAlone: { marginHorizontal: 4 },
  head: { gap: 20, marginHorizontal: 4, marginBottom: 4 },
  tabs: { flexDirection: 'row', gap: 2, padding: 2, borderRadius: RADIUS.cell, backgroundColor: COLOR.surfaceSunken },
  tab: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: RADIUS.cell, paddingHorizontal: 8 },
  tabOn: { backgroundColor: COLOR.surface, boxShadow: ELEVATION.card },
  tabText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.secondary },
  tabTextOn: { color: COLOR.foreground },
  formArea: { flexGrow: 1, gap: 12 },
  hidden: { display: 'none' },
  compat: { gap: 8, marginHorizontal: 4, paddingTop: 8 },
  compatAction: { paddingTop: 12 },
  compatTitle: { fontSize: TYPE.heading, lineHeight: 29, fontFamily: FONT.bold, color: COLOR.foreground },
  compatNote: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.secondary },
  member: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: -6 },
  memberAsk: { fontSize: TYPE.small, fontFamily: FONT.medium, color: COLOR.secondary },
  memberSignIn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  memberSignInText: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.foreground, textDecorationLine: 'underline' },
  retry: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  retryLine: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.foreground, textAlign: 'center' },
  title: { fontSize: TYPE.title, lineHeight: 35, fontFamily: FONT.bold, color: COLOR.foreground },
  form: { padding: 16, gap: 18, borderWidth: 0 },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  group: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  rail: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  railHead: { width: 64, minHeight: 44, justifyContent: 'center' },
  railLabel: { width: 64, minHeight: 44, lineHeight: 44, fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary },
  railNote: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted, marginTop: -14 },
  railBody: { flex: 1, flexDirection: 'row', gap: 6 },
  disclosure: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  choiceHint: { marginLeft: 72, fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 16, color: COLOR.secondary },
  advancedIntro: { fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 20, color: COLOR.secondary },
  disclosureLabel: { flexShrink: 0, fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  /* 요약이 남은 폭을 차지하고 오른쪽에 붙는다 — 화살표와는 8(웹 `.disclosure` 의 gap) */
  disclosureSummary: { flex: 1, minWidth: 0, marginHorizontal: 8, textAlign: 'right', fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  action: { marginTop: 'auto', paddingTop: 12, gap: 10 },
  converted: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary, marginVertical: 2 },
  failure: { fontSize: TYPE.small, fontFamily: FONT.medium, color: COLOR.danger, marginHorizontal: 6 },
});
