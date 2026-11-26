import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { filesUnder } from './source-files';

/**
 * **앱 글자는 글자 모양 여섯 벌(`TYPE_TITLE` … `TYPE_CAPTION`)을 편다**(ADR 0274). 웹 `TYPE_*` 와 크기가 같은 글을 화면이 `fontSize` ·
 * `lineHeight` 로 손으로 적으면 줄 높이가 화면마다 갈렸다(2026-11-26 감사: 같은 20px 구역 제목이 28 · 29). 웹과 같은 값은 2026-11-26 에
 * 상수로 옮겼고, 남은 손 짝은 아래 **줄어들기 표**가 파일마다 센다 — 늘면 붉고, 줄면 표도 같은 PR 에서 줄인다(0 이 되면 줄을 지운다).
 * 표에 남은 것은 웹과 값이 다른 자리(운영자가 화면마다 그림을 보고 접는다)와, 약속 표(`src/lib/design/contract.ts` 의 `values`)가 글자를 그대로 재는
 * `ui/section-error.tsx` 다.
 *
 * 14px(`TYPE.note`) · 16px(`TYPE.field`) 은 웹에 짝 모양이 없어 세지 않는다. 앱 화면은 react-native 를 들여 vitest 에서 그릴 수 없어 글자로 읽는다.
 */
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'mobile', 'src');
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 파일 → 손으로 적은 짝(`fontSize: TYPE.<여섯 단>` 과 `lineHeight` 가 한 스타일에 선 것)의 수 */
const HAND_WRITTEN: Readonly<Record<string, number>> = {
'mobile/src/app/about.tsx': 1,
  'mobile/src/app/help.tsx': 1,
  'mobile/src/app/matching-intro.tsx': 3,
  'mobile/src/app/me/(tabs)/matching/index.tsx': 2,
  'mobile/src/app/me/match/[matchId].tsx': 2,
  'mobile/src/app/me/matching/adult-check.tsx': 2,
  'mobile/src/app/me/people/[personId].tsx': 4,
  'mobile/src/app/me/requests.tsx': 1,
  'mobile/src/app/signup.tsx': 1,
  'mobile/src/app/support.tsx': 1,
  'mobile/src/chart/fortune.tsx': 1,
  'mobile/src/chart/parts.tsx': 1,
  'mobile/src/chat/detail-panel.tsx': 1,
  'mobile/src/chat/dialogs.tsx': 1,
  'mobile/src/chat/profile-sheet.tsx': 1,
  'mobile/src/chat/room.tsx': 3,
  'mobile/src/compat/relation-map.tsx': 3,
  'mobile/src/compat/result.tsx': 1,
  'mobile/src/credits/credits.tsx': 5,
  'mobile/src/credits/store-section.tsx': 1,
  'mobile/src/home/self-card.tsx': 1,
  'mobile/src/matching/people.tsx': 2,
  'mobile/src/matching/today.tsx': 5,
  'mobile/src/people/birth-fields.tsx': 2,
  'mobile/src/people/parts.tsx': 3,
  'mobile/src/people/person-sheets.tsx': 2,
  'mobile/src/reading/contents.tsx': 1,
  'mobile/src/reading/feedback.tsx': 1,
  'mobile/src/reading/markdown.tsx': 7,
  'mobile/src/reading/result.tsx': 1,
  'mobile/src/reading/save-self.tsx': 2,
  'mobile/src/settings/parts.tsx': 1,
  'mobile/src/settings/survey-screen.tsx': 2,
  'mobile/src/share/view.tsx': 1,
  'mobile/src/ui/notice-screen.tsx': 1,
  'mobile/src/ui/section-error.tsx': 1,
};

/** 단 밖 글자 크기 — 큰 장식 숫자 · 사진 위 큰 이름. 웹 `app/ui/scale.test.ts` 의 `OUTSIDE_SCALE` 와 같은 꼴 */
const RAW_SIZE: readonly { at: string; value: number; why: string }[] = [
  { at: 'mobile/src/reading/result.tsx', value: 64, why: '비유 앞 큰 따옴표(장식) — 웹 `reading-result.tsx` 의 5rem 짝' },
  { at: 'mobile/src/matching/today.tsx', value: 32, why: '오늘의 인연 사진 위의 큰 이름 — 웹 `today-card.tsx` 의 2.25rem 짝' },
  { at: 'mobile/src/compat/result.tsx', value: 56, why: '궁합 지수 숫자 강조 — 웹 `match-index.tsx` 의 3.5rem 짝' },
];

const files = filesUnder(SRC)
  .filter((path) => /\.tsx?$/.test(path))
  .map((path) => ({ file: relative(ROOT, path), text: code(readFileSync(path, 'utf8')) }))
  .filter(({ file }) => file !== 'mobile/src/ui/tokens.ts');

const handWrittenIn = (text: string) =>
  [...text.matchAll(/\{[^{}]*\}/g)].filter((match) => /\bfontSize:\s*TYPE\.(?:title|heading|lead|body|small|fine)\b/.test(match[0]) && /\blineHeight:/.test(match[0])).length;

describe('앱 글자 모양', () => {
  it('화면 파일을 실제로 읽었다', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('손으로 적은 크기 · 줄 높이 짝은 표의 수만큼이다 — 새 글은 `...TYPE_BODY` 처럼 편다', () => {
    const counted = Object.fromEntries(files.map(({ file, text }) => [file, handWrittenIn(text)]).filter(([, count]) => count !== 0));
    expect(counted).toEqual(HAND_WRITTEN);
  });

  it('`fontSize` 에 숫자를 적지 않는다 — 단 밖 값은 표가 까닭과 함께 든다', () => {
    const found = files.flatMap(({ file, text }) =>
      [...text.matchAll(/\bfontSize:\s*(\d+)/g)]
        .map((match) => ({ file, value: Number(match[1]) }))
        .filter((one) => !RAW_SIZE.some((allowed) => allowed.at === one.file && allowed.value === one.value)),
    );
    expect(found).toEqual([]);
  });

  it('단 밖 표의 줄마다 그 자리가 아직 있다', () => {
    for (const { at, value } of RAW_SIZE) {
      expect(files.find(({ file }) => file === at)?.text, at).toMatch(new RegExp(`fontSize:\\s*${value}\\b`));
    }
  });
});
