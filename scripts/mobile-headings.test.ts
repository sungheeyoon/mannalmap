import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { filesUnder } from './source-files';

/**
 * **앱의 화면 제목 · 구역 제목은 제목 부품(`mobile/src/ui/heading.tsx` 의 `Heading`)으로 선다**(ADR 0274). 모양(`TYPE_TITLE` · `TYPE_SECTION`)만
 * 펴면 TalkBack 이 제목으로 읽지 않아 「제목 단위로 건너뛰기」에 안 걸렸다(2026-11-26 감사: 20px 이상 글 44 중 역할 14). 부품이 역할과 모양을 함께 든다.
 *
 * 보는 것: 한 파일 안에서 스타일 키의 값이 20px 이상(`...TYPE_TITLE` · `...TYPE_SECTION` · `fontSize: TYPE.title|heading`)인데 그 키로 선
 * `<WordText>` · `<Text>`. 제목이 아닌 큰 글(점수 · 첫 글자 · 비유 문장 · 로고 글자)은 `NOT_HEADING` 이 까닭과 함께 든다. 앱 화면은 vitest 에서
 * 그릴 수 없어 글자로 읽는다 — 다른 파일의 스타일(`shared.title`)을 빌린 글은 이 시험이 못 본다.
 */
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'mobile', 'src');
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 제목이 아닌 큰 글 — 파일 · 스타일 키 */
const NOT_HEADING: readonly { file: string; key: string; why: string }[] = [
  { file: 'mobile/src/app/index.tsx', key: 'brand', why: '첫 화면 로고 옆 서비스 이름' },
  { file: 'mobile/src/app/matching-intro.tsx', key: 'score', why: '궁합 점수 숫자' },
  { file: 'mobile/src/app/me/people/[personId].tsx', key: 'quote', why: '비유 앞 큰 따옴표(장식)' },
  { file: 'mobile/src/compat/relation-map.tsx', key: 'cardScoreValue', why: '관계 카드의 점수 숫자' },
  { file: 'mobile/src/home/self-card.tsx', key: 'elementCount', why: '오행 개수 숫자' },
  { file: 'mobile/src/matching/today.tsx', key: 'detailVerdict', why: '궁합 판정 한마디(본문)' },
  { file: 'mobile/src/matching/today.tsx', key: 'infoText', why: '오늘의 인연 안내 문장' },
  { file: 'mobile/src/matching/today.tsx', key: 'supplyNames', why: '채워 주는 오행 이름(값)' },
  { file: 'mobile/src/reading/result.tsx', key: 'metaphor', why: '풀이의 비유 문장' },
  { file: 'mobile/src/reading/result.tsx', key: 'pairMetaphor', why: '궁합풀이의 비유 문장' },
  { file: 'mobile/src/settings/settings-screen.tsx', key: 'initial', why: '사진 없는 자리의 첫 글자' },
  { file: 'mobile/src/share/view.tsx', key: 'brand', why: '공유 그림의 서비스 이름' },
  { file: 'mobile/src/share/view.tsx', key: 'pairMetaphor', why: '공유 그림의 궁합 비유 문장' },
  { file: 'mobile/src/share/view.tsx', key: 'metaphorText', why: '공유 그림의 비유 문장' },
];

const BIG = /\.\.\.TYPE_(?:TITLE|SECTION)\b|\bfontSize:\s*TYPE\.(?:title|heading)\b/;

const files = filesUnder(SRC)
  .filter((path) => /\.tsx$/.test(path))
  .map((path) => ({ file: relative(ROOT, path), text: code(readFileSync(path, 'utf8')) }));

/** 큰 글 스타일 키로 선 `WordText` · `Text` — 파일 · 키 */
function bigTexts(file: string, text: string): { file: string; key: string }[] {
  const keys = [...text.matchAll(/^\s*(\w+):\s*\{([^\n]*)\}/gm)].filter((match) => BIG.test(match[2])).map((match) => match[1]);
  return keys.flatMap((key) =>
    [...text.matchAll(new RegExp(`<(?:WordText|Text)\\b(?:[^>]|=>)*?style=\\{\\[?\\s*(?:styles|shared|s)\\.${key}\\b`, 'g'))].map(() => ({ file, key })),
  );
}

describe('앱 제목', () => {
  it('화면 파일을 실제로 읽었다', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('제목 부품이 낭독기 제목 역할을 든다', () => {
    expect(files.find(({ file }) => file === 'mobile/src/ui/heading.tsx')?.text).toMatch(/accessibilityRole="header"/);
  });

  it('20px 이상 글은 `Heading` 으로 선다 — 제목이 아니면 표가 까닭과 함께 든다', () => {
    const listed = (one: { file: string; key: string }) =>
      NOT_HEADING.some((row) => row.file === one.file && row.key === one.key);
    const found = files.flatMap(({ file, text }) => bigTexts(file, text)).filter((one) => !listed(one));
    expect(found).toEqual([]);
  });

  it('표의 줄마다 그 큰 글이 아직 있다', () => {
    const all = files.flatMap(({ file, text }) => bigTexts(file, text));
    for (const row of NOT_HEADING) {
      expect(all.some((one) => one.file === row.file && one.key === row.key), `${row.file} ${row.key}`).toBe(true);
    }
  });
});
