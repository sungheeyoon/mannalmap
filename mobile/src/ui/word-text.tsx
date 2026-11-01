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
 * 어절 단위로 꺾이는 글자 — 웹 `body` 의 `word-break: keep-all` 과 같은 뜻이다. iOS 는 RN 의 `hangul-word`, 안드로이드는 `keepWords` 다.
 * 안에 글자를 또 두면 그 글자도 이 부품으로 둔다 — 문자열만 고친다.
 */
export function WordText({ children, ...props }: TextProps) {
  if (Platform.OS !== 'android') return <Text lineBreakStrategyIOS="hangul-word" {...props}>{children}</Text>;
  return (
    <Text accessibilityLabel={plainOf(children)} {...props}>
      {keepWordsIn(Children.toArray(children))}
    </Text>
  );
}
