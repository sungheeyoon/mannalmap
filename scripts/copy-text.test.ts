import { describe, expect, it } from 'vitest';

import { flat, koreanChunks, withoutComments } from './copy-text';

/**
 * **문구 시험의 손이 주석 속 글자를 「있다」로 세지 않는다.** 웹 쪽을 주석째 읽던 때는 웹 화면에서 글자를 지우고 주석에만 남겨도
 * 앱 문구 시험(`mobile-*-copy`)과 함께 쓰는 글자 시험(`shared-words`)이 초록이었다 — 아래 대조가 그 옛 손에서는 붉다.
 */
const WEB_WITH_ONLY_COMMENTS = [
  '/* 앱의 단추는 「공유하기」다 */',
  "// 「저장했어요」는 지웠다",
  'export function Button() {',
  '  return <button>{/* 「다시 보기」 */}공유 링크 복사</button>;',
  '}',
  "const href = 'https://example.com'; // 줄 끝의 주석은 남는다",
].join('\n');

const found = (web: string, chunk: string) => flat(web).includes(flat(chunk));

describe('문구 시험의 손', () => {
  it('옛 손(주석째)은 주석에만 남은 글자를 웹에 있다고 센다 — 구멍의 대조', () => {
    for (const chunk of ['공유하기', '저장했어요', '다시 보기']) expect(found(WEB_WITH_ONLY_COMMENTS, chunk)).toBe(true);
  });

  it('주석을 걷은 웹에는 그 글자가 없다 — 블록 · 줄 · JSX 주석 셋 다', () => {
    const web = withoutComments(WEB_WITH_ONLY_COMMENTS);
    for (const chunk of ['공유하기', '저장했어요', '다시 보기']) expect(found(web, chunk), chunk).toBe(false);
    expect(found(web, '공유 링크 복사')).toBe(true);
    expect(web).toContain("'https://example.com'");
  });

  it('앱 쪽 조각도 주석 속 글자는 안 세고, 틀 글자의 `${` 앞에서 끊는다', () => {
    const app = ['/* 「설명」 */', 'const a = `총 ${count}개`;', "const b = '공유하기';"].join('\n');
    expect(koreanChunks(app)).toEqual(['총', '개', '공유하기']);
  });
});
