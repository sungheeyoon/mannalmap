import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SERVICE_NAME } from '@brand';
import { ABOUT_LEAD, MATCHING_INTRO_TITLE } from '@brand/guide';
import { calculateChart, dateRefusal } from '@input/chart';
import { convertedLine, dateOfParts, limitsOf, timeOfParts } from '@input/entry';
import { DEFAULT_QUERY, HOUR_UNKNOWN_CHOICE, NAME_MAX, TIME_BASES, TIME_BASIS, type Query } from '@input/query';
import { CALENDARS, CALENDAR_KO, CITY_LONGITUDES, GENDERS, GENDER_KO, SUPPORTED_YEAR_RANGE, type CityName, type LateNightRule } from '@saju';

import { chartPath } from '@consent/app-destination';
import { readGate } from '@/home/gate';
import { POLICY_TITLE, SUPPORT_TITLE } from '@/info/copy';
import { Choices, DigitField, Field, FieldLabel, KeyboardDoneBar, PrimaryButton, Select } from '@/ui/parts';
import { Mark } from '@/share/marks';
import { Logo } from '@/ui/logo';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { CardFrame, Paper } from '@/ui/surfaces';

const CITIES = Object.keys(CITY_LONGITUDES) as CityName[];
const HOUR_CHOICES = [
  { value: 'known', label: '직접 입력' },
  { value: 'unknown', label: HOUR_UNKNOWN_CHOICE },
] as const;
const RULES: readonly { value: LateNightRule; label: string; hint: string }[] = [
  { value: 'jo', label: '조자시', hint: '경계 23:00' },
  { value: 'ya', label: '야자시', hint: '경계 자정' },
];

/**
 * 입구 — 로그인과 가입을 끝낸 사람은 앱을 열면 홈이다. 아니면(모르면) 입력 화면이고, 만세력까지 로그인을 묻지 않는다(ADR 0213).
 * 홈의 「다른 사람 사주 보기」는 `another` 를 들고 와 입력 화면을 그대로 연다.
 *
 * 돌아올 때마다 다시 본다 — 결과 화면에서 로그인하고 돌아온 사람에게 「로그인」이 남지 않고, 적어 둔 값 위에서 홈으로 튕기지도 않는다.
 */
export default function EntryScreen() {
  const { another } = useLocalSearchParams<{ another?: string }>();
  const [entry, setEntry] = useState<'checking' | 'home' | 'birth'>(another === undefined ? 'checking' : 'birth');
  const [signedIn, setSignedIn] = useState(another !== undefined);

  useFocusEffect(
    useCallback(() => {
      let watching = true;
      void readGate().then((gate) => {
        if (!watching) return;
        setSignedIn(gate.kind === 'in');
        setEntry((now) => (now !== 'checking' ? now : gate.kind === 'in' ? 'home' : 'birth'));
      });
      return () => {
        watching = false;
      };
    }, []),
  );

  if (entry === 'checking') return <View style={styles.screen} />;
  if (entry === 'home') return <Redirect href={'/me' as never} />;
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
  const [failure, setFailure] = useState<string | null>(null);

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
      setFailure(result.message);
      return;
    }
    setFailure(null);
    router.push(chartPath(query) as never);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.brandRow}>
            {/* 로고는 웹의 그 파일이다 — 앱에 사본을 두지 않는다 */}
            <Logo size={32} />
            <Text style={styles.brand}>{SERVICE_NAME}</Text>
            {/* 이미 계정이 있는 사람의 길 — 웹 머리글의 그 자리다. 생년월일을 안 적어도 들어간다. 이미 로그인한 사람에게는 안 선다 */}
            {signedOut && (
              <Pressable accessibilityRole="link" onPress={() => router.push('/auth' as never)} style={styles.signIn}>
                <Text style={styles.signInText}>로그인</Text>
              </Pressable>
            )}
          </View>
          <Paper style={styles.paper}>
            {signedOut ? (
              <View style={styles.head}>
                <Text accessibilityRole="header" style={styles.title}>나는 어떤 사람일까?</Text>
                <Text style={styles.lead}>{ABOUT_LEAD[0]}</Text>
                <Pressable accessibilityRole="link" onPress={() => router.push('/matching-intro')} style={styles.intro}>
                  <Text style={styles.introText}>{MATCHING_INTRO_TITLE}</Text>
                  <Mark name="arrow" size={16} color={COLOR.secondary} />
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.title, styles.titleAlone]}>출생 정보를 입력해 주세요</Text>
            )}

            <CardFrame style={styles.form}>
              <View style={styles.pair}>
                <View style={styles.half}>
                  <FieldLabel>이름</FieldLabel>
                  <Field value={name} onChange={setName} maxLength={NAME_MAX} />
                </View>
                <View style={styles.half}>
                  <FieldLabel>성별</FieldLabel>
                  <Choices value={gender} onPick={setGender} options={GENDERS.map((one) => ({ value: one, label: GENDER_KO[one] }))} />
                </View>
              </View>

              <View style={styles.group}>
                <FieldLabel>생년월일</FieldLabel>
                <View style={styles.row}>
                  <DigitField value={year} onChange={setYear} unit="년" placeholder={String(years.max - 30)} digits={4} min={years.min} max={years.max} refused={refused === 'year'} onFull={() => monthRef.current?.focus()} />
                  <DigitField inputRef={monthRef} value={month} onChange={setMonth} unit="월" placeholder="1~12" digits={2} min={1} max={12} advanceEarly refused={refused === 'month'} onFull={() => dayRef.current?.focus()} />
                  <DigitField inputRef={dayRef} value={day} onChange={setDay} unit="일" placeholder={`1~${maxDay}`} digits={2} min={1} max={maxDay} advanceEarly refused={refused === 'day'} onFull={() => (hourKnown ? hourRef.current?.focus() : Keyboard.dismiss())} />
                </View>
                {converted !== null && (
                  <Text style={[styles.converted, !converted.ok && styles.failure]}>{converted.text}</Text>
                )}
                <View style={styles.row}>
                  <Choices value={calendar} onPick={setCalendar} options={CALENDARS.map((one) => ({ value: one, label: CALENDAR_KO[one] }))} />
                </View>
              </View>

              <View style={styles.rail}>
                <Text style={styles.railLabel}>출생 시각</Text>
                <Choices value={hourChoice} onPick={chooseHour} options={HOUR_CHOICES} />
              </View>

              {hourChoice === 'known' && (
                <View style={styles.rail}>
                  <View style={styles.railHead}>
                    <Text style={styles.railLabel}>시각</Text>
                    <Text style={styles.railNote}>24시간</Text>
                  </View>
                  <View style={styles.railBody}>
                    <DigitField inputRef={hourRef} value={hour} onChange={setHour} unit="시" placeholder="0~23" digits={2} min={0} max={23} onFull={() => minuteRef.current?.focus()} />
                    <DigitField inputRef={minuteRef} value={minute} onChange={setMinute} unit="분" placeholder="0~59" digits={2} min={0} max={59} onFull={Keyboard.dismiss} />
                  </View>
                </View>
              )}

              <View style={styles.rail}>
                <Text style={styles.railLabel}>출생지</Text>
                <Select value={city} onPick={setCity} options={CITIES.map((one) => ({ value: one, label: one }))} />
              </View>
            </CardFrame>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: advanced }}
              onPress={() => setAdvanced(!advanced)}
              style={styles.disclosure}
            >
              <Text style={styles.disclosureLabel}>고급 설정</Text>
              <Text style={styles.disclosureSummary}>자시 · 시간 기준 · 세운 {advanced ? '⌃' : '⌄'}</Text>
            </Pressable>

            {advanced && (
              <CardFrame style={styles.form}>
                <View style={styles.rail}>
                  <Text style={styles.railLabel}>자시</Text>
                  <Select value={rule} onPick={setRule} options={RULES} disabled={hourChoice === 'unknown'} />
                </View>
                <View style={styles.rail}>
                  <Text style={styles.railLabel}>시간 기준</Text>
                  <Select
                    value={basis}
                    onPick={setBasis}
                    options={TIME_BASES.map((one) => ({ value: one, label: TIME_BASIS[one].label, hint: TIME_BASIS[one].hint }))}
                  />
                </View>
                <View style={styles.rail}>
                  <Text style={styles.railLabel}>세운 연도</Text>
                  <DigitField value={saeunFrom} onChange={setSaeunFrom} unit="년" placeholder="2026" digits={4} min={SUPPORTED_YEAR_RANGE.min} max={SUPPORTED_YEAR_RANGE.max} />
                </View>
              </CardFrame>
            )}

            {/* 폼이 짧은 화면에서도 단추는 엄지가 닿는 맨 아래에 선다 */}
            <View style={styles.action}>
              {failure !== null && <Text style={styles.failure}>{failure}</Text>}
              <PrimaryButton label={signedOut ? '내 사주 보기' : '사주 보기'} onPress={submit} />
            </View>
          </Paper>

          {signedOut && (
            <View accessibilityLabel="안내" style={styles.links}>
              {ENTRY_LINKS.map((link) => (
                <Pressable key={link.label} accessibilityRole="link" onPress={link.open} style={styles.link}>
                  <Text style={styles.linkText}>{link.label}</Text>
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
  head: { gap: 4, marginHorizontal: 4 },
  lead: { fontSize: TYPE.body, lineHeight: 24, fontFamily: FONT.medium, color: COLOR.creamInk },
  intro: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  introText: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.secondary },
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
  disclosureLabel: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  disclosureSummary: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary },
  action: { marginTop: 'auto', paddingTop: 12, gap: 10 },
  converted: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.secondary, marginVertical: 2 },
  failure: { fontSize: TYPE.small, fontFamily: FONT.medium, color: COLOR.danger, marginHorizontal: 6 },
});
