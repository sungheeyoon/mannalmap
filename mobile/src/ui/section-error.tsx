import { createContext, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, StyleSheet, type ScrollViewProps, type TextInput, type View } from 'react-native';

import { afterEdit, flaggedOnPress, shownSections, sideOf, type SectionError } from '@input/section-errors';

import { COLOR, FONT, TYPE } from './tokens';
import { WordText } from './word-text';

/**
 * **문단 아래 오류 한 줄** — 웹 `app/ui/section-error.tsx` 와 같은 규칙이다(ADR 0252).
 *
 * 문단(칸 몇 줄의 묶음) 마지막 줄 아래 · 왼쪽 정렬 · 작은 굵은 붉은 글씨 · 8 띄움. 말이 없으면 안 선다 — 빈 자리를 잡아 두지 않는다.
 * 글자 모양은 단추 아래 줄(`FormError`)과 같다 — 자리만 문단 아래다.
 */
export function SectionErrorLine({ message, gap = 0 }: { message: string | null | undefined; gap?: number }) {
  if (message == null) return null;
  /* 둘레가 이미 사이(`gap`)를 두는 판이면 그만큼 뺀다 — 문단 마지막 줄과는 늘 8 이다 */
  return <WordText style={[styles.text, { marginTop: 8 - gap }]}>{message}</WordText>;
}

const ScrollHost = createContext<RefObject<ComponentRef<typeof ScrollView> | null> | null>(null);

/**
 * 걸린 문단으로 데려갈 수 있는 스크롤 — 폼이 든 화면의 `ScrollView` 를 이것으로 둔다. 안의 `useSectionErrors` 가 맨 위 걸린 문단의
 * 자리를 이 스크롤 안에서 재어 옮긴다.
 */
export function SectionScrollView({ ref, children, ...props }: ScrollViewProps & { ref?: Ref<ComponentRef<typeof ScrollView>>; children?: ReactNode }) {
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

/** 이미 제 `ref` 를 든 스크롤(풀이 화면의 `ReadingScrollView`)이 걸린 문단으로 데려가는 자리를 내준다 */
export function SectionScrollHost({ scroll, children }: { scroll: RefObject<ComponentRef<typeof ScrollView> | null>; children: ReactNode }) {
  return <ScrollHost.Provider value={scroll}>{children}</ScrollHost.Provider>;
}

/** 데려갈 자리 — 문단을 감싼 `View` 이거나 문단의 첫 적는 칸(`TextInput`, 그때는 그 칸이 초점을 받는다) */
type AnchorNode = ComponentRef<typeof View> | ComponentRef<typeof TextInput>;
type Anchor = { view: AnchorNode | null; focus?: () => void };

/** 폼 부품이 받는 문단 오류 한 벌 — 보여 줄 줄, 그 문단을 고쳤다는 알림, 데려갈 자리 */
export type SectionErrors<S extends string> = {
  shown: Partial<Record<S, string>>;
  edit: (section: S) => void;
  /** 그 문단을 감싼 `View` 에 다는 `ref` — 누른 뒤 데려갈 자리와 초점(적는 칸이면 그 칸의 `focus`) */
  anchor: (section: S, focus?: () => void) => (view: AnchorNode | null) => void;
};

/**
 * 폼 하나의 문단 오류 — 지금 값으로 잰 목록(`errors`, `src/lib`)을 받아 보여 줄 줄만 돌려준다(웹 `useSectionErrors` 와 같은 규칙).
 *
 * - `press()` 는 제출 단추가 부른다. 오류가 없으면 `true`. 있으면 걸린 문단을 **모두** 세우고, 그려진 뒤 맨 위 문단(목록의 차례 =
 *   화면의 차례)으로 스크롤해 초점을 준다.
 * - `edit(section)` 은 그 문단의 칸을 고칠 때 부른다 — 그 문단의 줄과 붉은 테만 걷힌다.
 */
export function useSectionErrors<S extends string>(errors: readonly SectionError<S>[]) {
  const scroll = useContext(ScrollHost);
  const [flagged, setFlagged] = useState<readonly S[]>([]);
  const [presses, setPresses] = useState(0);
  const anchors = useRef(new Map<S, Anchor>());
  const latest = useRef(errors);
  const lastPresses = useRef(0);

  useEffect(() => {
    latest.current = errors;
  });

  useEffect(() => {
    if (presses === lastPresses.current) return;
    lastPresses.current = presses;
    const first = latest.current.map((one) => anchors.current.get(one.section)).find((one) => one?.view != null);
    if (first?.view == null) return;
    const inner = scroll?.current?.getInnerViewRef();
    if (inner != null) {
      first.view.measureLayout(inner, (_x, y) => scroll?.current?.scrollTo({ y: Math.max(0, y - 96), animated: true }));
    }
    /* 적는 칸을 그대로 자리로 단 문단이면(출생 정보 폼) 그 칸이 초점을 받는다 */
    const view = first.view;
    if (first.focus !== undefined) first.focus();
    else if ('isFocused' in view) view.focus();
    else {
      const node = findNodeHandle(view);
      if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, [presses, scroll]);

  return {
    /** 문단마다 설 말 — 걸린 문단만 든다 */
    shown: shownSections(errors, flagged),
    edit: (section: S) => setFlagged((now) => afterEdit(now, section)),
    anchor: (section: S, focus?: () => void) => (view: AnchorNode | null) => {
      if (view === null) anchors.current.delete(section);
      else anchors.current.set(section, { view, focus });
    },
    press: (): boolean => {
      setFlagged(flaggedOnPress(errors));
      if (errors.length === 0) return true;
      setPresses((n) => n + 1);
      return false;
    },
    clear: () => setFlagged([]),
  };
}

/** 두 사람을 한 폼에서 받을 때(궁합) — 이름 앞에 쪽을 붙인 한 벌에서 한쪽 것만 꺼내 그쪽 폼에 넘긴다(`prefixed`) */
export function sideSections<S extends string, P extends string>(
  sections: SectionErrors<`${P}.${S}`>,
  side: P,
): SectionErrors<S> {
  return {
    shown: sideOf<S>(sections.shown, side),
    edit: (section) => sections.edit(`${side}.${section}`),
    anchor: (section, focus) => sections.anchor(`${side}.${section}`, focus),
  };
}

/** 웹 `SectionErrorLine` 의 `mt-2 text-small font-medium leading-5 text-danger` */
const styles = StyleSheet.create({
  text: { textAlign: 'left', fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.danger },
});
