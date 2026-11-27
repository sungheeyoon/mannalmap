import { useEffect, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  BackHandler,
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CHECK_BOX, FIELD, checkBoxTop } from '@design';
import { digitOutOfRange } from '@input/entry';

import { Button } from './buttons';
import { FoldIcon } from './icons';
import { Press } from './press';
import { COLOR, FONT, CONTROL, RADIUS, TYPE } from './tokens';

/** 칸 위의 이름 — 칸이 같은 이름을 제 낭독 이름으로 들면(`Select`) `aria-hidden` 으로 두 번 읽히지 않게 한다 */
export function FieldLabel({ children, 'aria-hidden': hidden }: { children: ReactNode; 'aria-hidden'?: boolean }) {
  return <Text aria-hidden={hidden} style={styles.label}>{children}</Text>;
}

/**
 * **적는 칸의 초점 · 오류 꼴** — 웹 출생 정보 폼의 칸(`app/birth-form.module.css` 「초점 · 오류 — 모든 칸이 같은 고리」)과 같다. 초점이면 테가
 * 크림 먹색이 되고 둘레에 3 의 옅은 고리가 선다. 누른 뒤 걸린 칸(`refused`)은 붉은 테 2 가 이기고, 그 칸에 초점이 오면 고리도 옅은 붉은색이다.
 * 앱의 적는 칸은 이 둘(`Field` · `DigitField`)이 한 벌이라 웹 `FIELD`(가입 · 프로필의 칸 — 먹색 테 · 2 고리)와는 테 색 · 고리 두께가 조금 다르다.
 *
 * **고리는 칸(`TextInput`)이 아니라 칸을 싼 틀이 칠한다**(`ringLook`). 틀은 칸보다 사방으로 고리 두께만큼 크고 바깥 여백을 그만큼 거둬, 칸의
 * 자리 · 크기는 틀이 없을 때와 같다. 초점이면 틀의 바탕이 고리 색이 되어 칸 둘레 3 에 보인다 — 웹의 `box-shadow: 0 0 0 3px` 와 같은 모양이다.
 * 그림자(`boxShadow`)로 그리지 않는 까닭은 안드로이드의 둘이다.
 * - 칸에 그림자를 주면 RN 이 칸의 바탕 그림을 새로 갈아 끼우고, 안드로이드는 그때 칸의 안쪽 여백을 그 바탕 그림(테마의 입력칸 바탕)의 여백으로
 *   되돌린다. 레이아웃의 여백은 그대로라 RN 이 다시 보내지 않아, 한 번 초점이 갔던 칸은 글자 · 커서가 왼쪽 테에 붙은 채 남았다(초점이 빠진 뒤에도).
 * - 틀에 그림자를 주면 고리가 틀 밖에 그려지는데, 칸을 옮겨 누를 때 안드로이드가 그 바깥을 다시 그리지 않아 고리가 앞 칸에 남고 새 칸에는 늦게 섰다.
 *
 * 테 색은 있던 테 그림을 고쳐 칠할 뿐이라 칸에 둔다. 틀은 납작하게 접히지 않는다(`collapsable={false}`) — 고리가 서고 빠질 때 틀이 생겼다
 * 없어지면 칸이 다른 부모로 옮겨 앉아 초점을 잃는다. `scripts/mobile-text-input-shadow.test.ts` 가 칸의 그림자를 잠근다.
 */
function focusLook(focused: boolean, refused: boolean) {
  return [focused && styles.focus, refused && styles.wrong];
}

function ringLook(focused: boolean, refused: boolean) {
  return [styles.ring, focused && (refused ? styles.ringWrong : styles.ringOn)];
}

/** 초점 고리의 두께 — 웹 출생 정보 폼의 `0 0 0 3px` */
const RING = 3;

/** 글을 적는 칸 */
export function Field({
  value,
  onChange,
  maxLength,
  placeholder,
  label,
  autoCapitalize,
  refused = false,
  inputRef,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  placeholder?: string;
  /** 읽어 주는 이름 — 칸 위 글자는 칸에 안 붙는다 */
  label: string;
  autoCapitalize?: 'none' | 'characters';
  refused?: boolean;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  /** 저장하는 동안 잠근다 — 그 사이 적은 것은 저장이 끝나 폼이 비면 사라진다 */
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View collapsable={false} style={ringLook(focused, refused)}>
      <TextInput
        ref={inputRef}
        editable={!disabled}
        accessibilityState={{ disabled }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.control, ...focusLook(focused, refused), disabled && styles.off]}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={COLOR.muted}
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
      />
    </View>
  );
}

/** 확인 상자 한 줄 — 줄 전체가 누를 자리이고, 고르면 먹색 테와 크림 면이 선다. 기본값은 꺼짐이다(`app/signup/form.tsx`) */
/** 잠겨도(`disabled`) 고른 줄은 흐리지 않는다 — 무엇을 골랐는지가 보내는 동안에도 읽힌다 */
/** 상자는 글 첫 줄의 가운데에 선다 — `firstLine` 은 첫 글의 스타일이다(그 줄 높이로 위 여백을 낸다, `checkBoxTop`) */
export function CheckRow({ checked, onToggle, refused = false, disabled = false, firstLine, children }: { checked: boolean; onToggle: (next: boolean) => void; refused?: boolean; disabled?: boolean; firstLine: { lineHeight: number }; children: ReactNode }) {
  return (
    <Press
      feel="row"
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onToggle(!checked)}
      style={[styles.check, checked && styles.checkOn, refused && styles.wrong, disabled && !checked && styles.off]}
    >
      <View style={[styles.checkBox, { marginTop: checkBoxTop(firstLine.lineHeight) }, checked && styles.checkBoxOn]}>
        {checked && (
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" fill="none" stroke={COLOR.onAccent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
      </View>
      <View style={styles.checkBody}>{children}</View>
    </Press>
  );
}

/**
 * **단추의 짧은 이름** — `Button` 에 변형 하나를 끼운 것이다. `busy` 는 일하는 중인 그 단추에만 준다 — 못 누르는 것은 `disabled` 와
 * 같고 보조기기가 「처리 중」을 읽는다. 곁의 단추를 막을 때는 `disabled`.
 *
 * 이름 둘(`SecondaryButton` = `secondary-small`, `TextButton` = `tertiary`)은 웹 상수(`BUTTON_SECONDARY_SMALL` · `BUTTON_TERTIARY`)와
 * 어긋난다 — 약속 표(`src/lib/design/contract.ts`)대로 앱을 웹에 맞추는 일은 G-184 다(부르는 파일 28개에 결제 화면이 든다).
 */
type ButtonProps = { label: string; onPress: () => void; disabled?: boolean; busy?: boolean };

/** 작은 보조 단추 — 칸 곁의 「중복 확인」 */
export function SecondaryButton({ label, onPress, disabled = false, busy = false }: ButtonProps) {
  return <Button label={label} onPress={onPress} disabled={disabled} busy={busy} variant="secondary-small" />;
}

/** 글자만 있는 단추 — 처리방침 · 나가는 길 */
export function TextButton({ label, onPress, disabled = false, busy = false }: ButtonProps) {
  return <Button label={label} onPress={onPress} disabled={disabled} busy={busy} variant="tertiary" style={styles.textButton} />;
}

/**
 * 숫자 칸 — 숫자만 받고, 다 적으면 다음 칸으로 간다(범위 밖이면 안 넘어간다 — 웹과 같은 `digitOutOfRange`). 붉은 테는 누른 뒤 그 칸의
 * 문단이 걸렸을 때만이다(`refused`, ADR 0252) — 적는 도중에는 붉히지 않는다.
 */
export function DigitField({
  value,
  onChange,
  unit,
  placeholder,
  digits,
  min,
  max,
  refused = false,
  inputRef,
  onFull,
  advanceEarly = false,
  label,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  unit: string;
  placeholder: string;
  digits: number;
  min: number;
  max: number;
  refused?: boolean;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  onFull?: () => void;
  /** 뒤에 숫자가 더 올 수 없으면 한 자리로도 넘어간다(「5」월). 시각은 끈다 — 「33」이 3시 3분으로 조용히 갈라지면 시주가 틀린다 */
  advanceEarly?: boolean;
  /** 읽어 주는 이름 — 칸 안의 「년」만 읽으면 출생 연도인지 세운 연도인지 안 들린다(웹 `birth-digits.tsx` 의 `aria-label`) */
  label: string;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View collapsable={false} style={[styles.digitRing, ...ringLook(focused, refused)]}>
      <View style={styles.digit}>
        <TextInput
          ref={inputRef}
          editable={!disabled}
          accessibilityState={{ disabled }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.control, styles.digitInput, ...focusLook(focused, refused), disabled && styles.off]}
          value={value}
          onChangeText={(typed) => {
            const next = typed.replace(/\D/g, '').slice(0, digits);
            onChange(next);
            const done = next.length === digits || (advanceEarly && next !== '' && Number(next) * 10 > max);
            if (done && !digitOutOfRange(next, digits, min, max)) onFull?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={COLOR.muted}
          keyboardType="number-pad"
          returnKeyType="done"
          inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_DONE : undefined}
          accessibilityLabel={label}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const KEYBOARD_DONE = 'keyboard-done';

/** iOS 숫자 키패드에는 완료 키가 없다 — 키보드 위에 「완료」를 세운다. 화면에 한 번 둔다 */
export function KeyboardDoneBar() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE}>
      <View style={styles.doneBar}>
        <Press feel="fade" accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.doneButton}>
          <Text style={styles.doneText}>완료</Text>
        </Press>
      </View>
    </InputAccessoryView>
  );
}

/** 고르는 칸 — 선택지가 펼침 없이 다 보인다 */
export function Choices<T extends string>({
  value,
  options,
  onPick,
  disabled = false,
}: {
  value: T | null;
  options: readonly { value: T; label: string }[];
  onPick: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <Press
            key={option.value}
            feel="shrink"
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen, disabled }}
            disabled={disabled}
            onPress={() => onPick(option.value)}
            style={[styles.option, chosen && styles.optionChosen, disabled && styles.off]}
          >
            <Text style={[styles.optionText, chosen && styles.optionTextChosen]} numberOfLines={1}>
              {option.label}{chosen ? ' •' : ''}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}

/**
 * 펼치는 칸 — 고르면 접힌다.
 *
 * 낭독은 웹의 같은 칸(`app/birth-choices.tsx` 의 `SelectField`)을 따른다 — 머리는 칸 이름과 지금 값을, 펼친 목록은 이름 붙은
 * 라디오 묶음이고 항목마다 골랐는지를 알린다. 고른 것을 배경색으로만 가르지 않는다.
 */
export function Select<T extends string>({
  label,
  name = label,
  value,
  options,
  onPick,
  disabled = false,
}: {
  /** 칸 이름 — 머리가 지금 값과 함께 읽힌다. 화면에 보이는 이름과 같은 상수를 넘긴다 */
  label: string;
  /** 펼친 목록의 묶음 이름 — 보이는 이름이 짧을 때(「자시」 → 「자시 규칙」) */
  name?: string;
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onPick: (next: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  /* 안드로이드 뒤로 가기는 펼친 목록을 먼저 접는다 — 안 받으면 화면을 떠나고 첫 화면이면 앱을 나간다 */
  useEffect(() => {
    if (!open) return;
    const listening = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => listening.remove();
  }, [open]);
  return (
    <View style={styles.selectBox}>
      <Press
        feel="row"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: current?.label }}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen(!open)}
        style={[styles.control, styles.selectHead, open && styles.selectOpen, disabled && styles.off]}
      >
        <Text style={styles.selectText}>{current?.label}</Text>
        <FoldIcon open={open} />
      </Press>
      {open && (
        <View accessibilityRole="radiogroup" accessibilityLabel={name} style={styles.menu}>
          {options.map((option) => (
            <Press
              key={option.value}
              feel="row"
              accessibilityRole="radio"
              accessibilityState={{ checked: option.value === value }}
              onPress={() => {
                onPick(option.value);
                setOpen(false);
              }}
              style={[styles.menuItem, option.value === value && styles.menuChosen]}
            >
              <Text style={styles.selectText}>{option.label}</Text>
              {option.hint !== undefined && <Text style={styles.hint}>{option.hint}</Text>}
            </Press>
          ))}
        </View>
      )}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled = false, busy = false }: ButtonProps) {
  return <Button label={label} onPress={onPress} disabled={disabled} busy={busy} variant="primary" />;
}

const styles = StyleSheet.create({
  label: { fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.secondary, marginBottom: 2 },
  control: { ...FIELD, fontFamily: FONT.medium, color: COLOR.foreground },
  wrong: { borderColor: COLOR.danger, borderWidth: 2 },
  focus: { borderColor: COLOR.creamInk },
  /* 칸을 싼 틀 — 사방 고리 두께만큼 크고 그만큼 바깥 여백을 거둔다. 모서리는 칸의 모서리 + 고리라 고리가 칸의 둥근 테를 따라 선다 */
  ring: { margin: -RING, padding: RING, borderRadius: RADIUS.cell + RING },
  ringOn: { backgroundColor: COLOR.accentSoft },
  ringWrong: { backgroundColor: COLOR.dangerWash },
  doneBar: { alignItems: 'flex-end', backgroundColor: COLOR.surfaceSunken, borderTopWidth: 1, borderTopColor: COLOR.border },
  doneButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  doneText: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  /* 숫자칸의 틀이 줄의 한 칸을 차지한다 — 안의 칸 · 단위 자리(`digit`)는 틀이 없을 때와 같다 */
  digitRing: { flex: 1 },
  digit: { flex: 1, justifyContent: 'center' },
  digitInput: { paddingLeft: 12, paddingRight: 34 },
  unit: { position: 'absolute', right: 14, fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.secondary },
  row: { flexDirection: 'row', gap: 6, flex: 1 },
  option: {
    flex: 1,
    minHeight: CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.cell,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: COLOR.surfaceSunken,
    paddingHorizontal: 4,
  },
  optionChosen: { backgroundColor: COLOR.accentWash, borderColor: COLOR.creamInk },
  optionText: { fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.secondary },
  optionTextChosen: { color: COLOR.creamInk, fontFamily: FONT.bold },
  selectBox: { flex: 1 },
  selectHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectOpen: { borderColor: COLOR.creamInk },
  off: { opacity: 0.55 },
  selectText: { fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.foreground },
  menu: { marginTop: 6, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.borderStrong, overflow: 'hidden', backgroundColor: COLOR.surface },
  menuItem: { minHeight: CONTROL, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  menuChosen: { backgroundColor: COLOR.accentWash },
  hint: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.muted, marginTop: 2 },
  check: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  checkOn: { borderColor: COLOR.foreground, backgroundColor: COLOR.cream },
  checkBox: { width: CHECK_BOX, height: CHECK_BOX, alignItems: 'center', justifyContent: 'center', borderRadius: 4, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  checkBoxOn: { borderColor: COLOR.accent, backgroundColor: COLOR.accent },
  checkBody: { flex: 1, gap: 4 },
  textButton: { alignItems: 'flex-start' },
});
