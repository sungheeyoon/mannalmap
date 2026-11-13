import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Platform, Text, type TextProps } from 'react-native';

import { keepWordsIn } from '@brand/keep-words';

/** 읽어 주는 글자에는 줄바꿈 금지 글자를 넣지 않는다 */
const plainOf = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainOf).join('');
  return isValidElement(node) ? plainOf((node as ReactElement<{ children?: ReactNode }>).props.children) : '';
};

/**
 * **앱의 글자 한 벌 — 어절 단위로 꺾인다**(ADR 0250). 웹 `body` 의 `word-break: keep-all` 과 같은 뜻이다. iOS 는 RN 의 `hangul-word`,
 * 안드로이드는 어절 안에 U+2060 을 끼운다(`keepWords`). 한 줄보다 길 수 있는 덩어리는 묶지 않아 카드 밖으로 안 나간다.
 * 화면은 RN `Text` 대신 이것을 쓴다 — `scripts/mobile-word-text.test.ts` 가 잰다.
 *
 * - 읽어 주는 글자(`accessibilityLabel`)는 원문이다. 화면이 따로 주면 그 값이 이긴다.
 * - **긁어 복사하는 글자(`selectable`)에는 끼우지 않는다** — 붙여 넣은 주소 · 번호에 보이지 않는 글자가 섞이지 않게.
 * - 안에 글자를 또 두면 그 글자도 이 부품으로 둔다 — 문자열만 고친다.
 */
export function WordText({ children, ...props }: TextProps) {
  if (Platform.OS !== 'android') return <Text lineBreakStrategyIOS="hangul-word" {...props}>{children}</Text>;
  if (props.selectable === true) return <Text {...props}>{children}</Text>;
  const plain = plainOf(children);
  return (
    <Text accessibilityLabel={plain === '' ? undefined : plain} {...props}>
      {keepWordsIn(Children.toArray(children))}
    </Text>
  );
}
