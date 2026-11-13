import { createContext, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

import { shownErrors, type FieldError } from '@input/field-errors';

import { Icon } from './icons';
import { COLOR, FONT, TYPE } from './tokens';
import { WordText } from './word-text';

/**
 * **칸 + 오류 줄 한 벌** — 웹 `app/ui/field-error.tsx` 와 같은 규칙이다(ADR 0252).
 *
 * - 붉은색(`COLOR.danger`)은 사용자가 고칠 칸에만 — 빈 칸 · 같은 사람 둘 · 없는 날짜 · 형식. 다음 단계 안내(「남은 풀이권이 없어요」)는 아니다.
 * - 제출 단추를 누른 순간 걸린 칸마다 테가 붉고(`Field` · `DigitField` 의 `error`) 칸 바로 아래에 붉은 한 줄이 붙는다(`FieldErrorLine`).
 *   칸은 읽어 주는 이름에 그 이유를 함께 싣는다(`invalidLabel`). 단추는 잠그지 않는다.
 * - 입력하는 도중에는 띄우지 않고, 이미 붉은 칸은 바르게 되는 순간 풀린다(`shownErrors`).
 * - 누르면 첫 붉은 칸으로 스크롤하고(그 화면의 `FieldScrollView`) 초점을 준다.
 */

/** 칸 바로 아래 붉은 한 줄 — 말이 없으면 안 선다 */
export function FieldErrorLine({ message }: { message: string | null | undefined }) {
  if (message == null) return null;
  return (
    <View style={styles.line}>
      <View style={styles.icon}>
        <Icon name="alert" size={16} color={COLOR.danger} strokeWidth={2} />
      </View>
      <WordText style={styles.text}>{message}</WordText>
    </View>
  );
}

/** 칸의 읽어 주는 이름 — 붉은 줄이 서 있으면 그 이유를 이름 뒤에 잇는다(웹의 `aria-describedby`) */
export const invalidLabel = (label: string, message: string | null | undefined): string =>
  message == null ? label : `${label}, ${message}`;

const ScrollHost = createContext<RefObject<ComponentRef<typeof ScrollView> | null> | null>(null);

/**
 * 오류 칸으로 데려갈 수 있는 스크롤 — 폼이 든 화면의 `ScrollView` 를 이것으로 둔다. 안의 `useFieldErrors` 가 첫 붉은 칸의 자리를
 * 이 스크롤 안에서 재어 옮긴다.
 */
export function FieldScrollView({ ref, children, ...props }: ScrollViewProps & { ref?: Ref<ComponentRef<typeof ScrollView>>; children?: ReactNode }) {
  const own = useRef<ComponentRef<typeof ScrollView>>(null);
  const bind = (node: ComponentRef<typeof ScrollView> | null) => {
    own.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref != null) (ref as RefObject<ComponentRef<typeof ScrollView> | null>).current = node;
  };
  return (
    <ScrollHost.Provider value={own}>
      <ScrollView ref={bind} {...props}>
        {children}
      </ScrollView>
    </ScrollHost.Provider>
  );
}

type Anchor = { view: ComponentRef<typeof View> | null; focus?: () => void };

/**
 * 폼 하나의 칸 오류 — 지금 값으로 잰 목록(`errors`)을 받아 보여 줄 것만 돌려준다.
 *
 * `anchor(field, focus)` 를 그 칸을 감싼 `View` 의 `ref` 로 단다. `press()` 는 제출 단추가 부른다 — 오류가 없으면 `true`, 있으면
 * 걸린 칸을 붉히고 그려진 뒤 첫 칸(목록의 차례 = 화면의 차례)으로 스크롤해 초점을 준다.
 */
export function useFieldErrors<F extends string>(errors: readonly FieldError<F>[]) {
  const scroll = useContext(ScrollHost);
  const [flagged, setFlagged] = useState<readonly F[]>([]);
  const [presses, setPresses] = useState(0);
  const anchors = useRef(new Map<F, Anchor>());
  const latest = useRef(errors);
  const lastPresses = useRef(0);
  /*
    고쳐서 바르게 된 칸은 걸린 목록에서 뺀다 — 다시 틀려도 다음 누름까지 붉지 않다(입력하는 도중에는 띄우지 않는다). 렌더 중에 고치는 상태는
    React 가 받는 꼴이다(값이 바뀔 때만 한 번).
  */
  const stillWrong = flagged.filter((field) => errors.some((one) => one.field === field));
  if (stillWrong.length !== flagged.length) setFlagged(stillWrong);
  const shown = shownErrors(errors, stillWrong);

  useEffect(() => {
    latest.current = errors;
  });

  useEffect(() => {
    if (presses === lastPresses.current) return;
    lastPresses.current = presses;
    const first = latest.current.map((one) => anchors.current.get(one.field)).find((one) => one?.view != null);
    if (first?.view == null) return;
    const inner = scroll?.current?.getInnerViewRef();
    if (inner != null) {
      first.view.measureLayout(inner, (_x, y) => scroll?.current?.scrollTo({ y: Math.max(0, y - 96), animated: true }));
    }
    if (first.focus !== undefined) first.focus();
    else {
      const node = findNodeHandle(first.view);
      if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, [presses, scroll]);

  return {
    /** 칸마다 설 말 — 걸린 칸만 든다(출생 정보 폼에 그대로 넘긴다) */
    shown,
    /** 그 칸 아래에 설 말 — 없으면 `null` */
    messageOf: (field: F): string | null => shown[field] ?? null,
    /** 그 칸을 감싼 `View` 에 다는 `ref` — 누른 뒤 데려갈 자리와 초점(적는 칸이면 그 칸의 `focus`) */
    anchor: (field: F, focus?: () => void) => (view: ComponentRef<typeof View> | null) => {
      if (view === null) anchors.current.delete(field);
      else anchors.current.set(field, { view, focus });
    },
    press: (): boolean => {
      setFlagged(errors.map((one) => one.field));
      if (errors.length === 0) return true;
      setPresses((n) => n + 1);
      return false;
    },
    clear: () => setFlagged([]),
  };
}

/** 웹 `FieldErrorLine` — 14px 굵은 붉은 글씨 · 경고 그림 16 · 칸과 6 띄움 */
const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  icon: { paddingTop: 2 },
  text: { flexShrink: 1, fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.bold, color: COLOR.danger },
});
