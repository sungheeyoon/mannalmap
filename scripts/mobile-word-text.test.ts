import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱의 글자는 `WordText` 로 선다**(ADR 0250). RN `Text` 를 화면이 바로 쓰면 안드로이드가 한글을 낱말 가운데서 끊는다(「돌려드렸 / 어요」).
 * 어절 단위 줄바꿈은 `mobile/src/ui/word-text.tsx` 한 곳이 들고, 화면은 그 부품을 쓴다. RN `Text` 를 들여오면 붉다 — 예외는 아래 표가
 * 사유와 함께 든다. 사유 없이 늘지 않고, 그 자리가 옮겨지면 표의 줄도 지운다. CI 에 앱 패키지가 없어 글자로 읽는다.
 */
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'mobile', 'src');

/** RN `Text` 를 그대로 쓰는 파일 — 경로(`mobile/src/` 뒤)와 사유 */
const RAW_TEXT_EXCEPTIONS: readonly { file: string; why: string }[] = [
  { file: 'ui/word-text.tsx', why: '이 부품 자신' },
  { file: 'ui/parts.tsx', why: '고르는 칸 · 입력칸 곁의 값 — ADR 0109 추기 2026-11-02 의 「고르는 입력의 값」' },
  { file: 'chat/room.tsx', why: '채팅 말풍선 — 사람이 쓴 글이고 복사되는 글(ADR 0109 추기 2026-11-02)' },
  { file: 'app/dev-parts.tsx', why: '개발 빌드에서만 서는 부품 견줌' },
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** `react-native` 에서 `Text` 를 들여오는가 — 여러 줄 · 별칭(`Text as Label`)도 걸린다. `TextInput` · `TextStyle` 은 아니다 */
export function importsRawText(source: string): boolean {
  return [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'react-native'/g)].some(([, names]) =>
    names.split(',').some((name) => /^\s*Text(?:\s+as\s+\w+)?\s*$/.test(name)),
  );
}

const files = walk(SRC).map((path) => ({ file: relative(SRC, path).split('\\').join('/'), text: readFileSync(path, 'utf8') }));

describe('앱의 글자는 어절 단위로 꺾인다', () => {
  it('화면 파일을 실제로 읽었다', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('RN `Text` 를 바로 들여오지 않는다 — `@/ui/word-text` 의 `WordText` 를 쓴다. 예외는 표가 사유와 함께 든다', () => {
    const raw = files.filter(({ text }) => importsRawText(text)).map(({ file }) => file);
    expect(raw.filter((file) => !RAW_TEXT_EXCEPTIONS.some((one) => one.file === file))).toEqual([]);
  });

  it('표의 예외는 아직 RN `Text` 를 쓰는 파일만 든다 — 옮겼으면 줄을 지운다', () => {
    const stale = RAW_TEXT_EXCEPTIONS.filter((one) => {
      const found = files.find(({ file }) => file === one.file);
      return found === undefined || !importsRawText(found.text);
    });
    expect(stale).toEqual([]);
  });

  it('들여오기를 읽는 눈은 다른 표기도 잡는다', () => {
    expect(importsRawText("import { StyleSheet, Text, View } from 'react-native';")).toBe(true);
    expect(importsRawText("import {\n  Pressable,\n  Text as Label,\n} from 'react-native';")).toBe(true);
    expect(importsRawText("import { TextInput, type TextStyle } from 'react-native';")).toBe(false);
    expect(importsRawText("import { type Text } from 'react-native';")).toBe(false);
  });
});
