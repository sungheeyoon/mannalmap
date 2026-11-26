import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ICON_SHAPES } from '../src/lib/design/icons';

import { relPath, sourceFilesUnder } from './source-files';

/**
 * **선 아이콘은 한 자료에서 그린다**(ADR 0280). 그림 자료는 `src/lib/design/icons.ts` 하나이고 웹 `app/ui/icons.tsx` 와 앱 `mobile/src/ui/icons.tsx` 가
 * 그 자료로 그린다. 두 쪽이 경로를 저마다 들던 동안 앱의 「⋯」 점이 웹보다 작아졌고(칠한 원 · 선 원), 사진 보기 · 사진 칸 · 설정 줄이 그림을 손으로
 * 다시 세웠다(2026-11-27). 경로 글자를 베끼거나 앱 화면이 `react-native-svg` 로 그림을 세우면 붉다. CI 에 앱 패키지가 없어 글자로 읽는다.
 */
const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
/** 주석은 안 센다 — 설명 속 경로 · 파일 이름 */
const codeOf = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SOURCES = ['app', 'src', 'mobile/src'].flatMap((root) => sourceFilesUnder(join(ROOT, root))).map((file) => ({ file: relPath(file), code: codeOf(readFileSync(file, 'utf8')) }));

/** 앱에서 `react-native-svg` 를 부르는 그림 부품 — 아이콘 · 오행 · 천간 · 로고 · 점수 반원 · 로딩 */
const DRAWING_PARTS = [
  'mobile/src/ui/icons.tsx',
  'mobile/src/ui/element-symbol.tsx',
  'mobile/src/ui/stem-symbol.tsx',
  'mobile/src/ui/logo.tsx',
  'mobile/src/ui/score-gauge.tsx',
  'mobile/src/ui/loading.tsx',
];

/**
 * 그림 부품 밖에서 `react-native-svg` 를 부르는 자리 — 아이콘 한 벌에 짝이 없는 그림만, 까닭과 함께. 그 자리가 그림을 걷어도 이 표 때문에 붉히지 않는다
 * (나란히 도는 PR 이 main 을 붉히지 않게, `src/lib/design/contract.ts` 의 `pending` 과 같은 까닭) — 걷은 PR 이 줄도 지운다.
 */
const DRAWING_EXCEPTIONS: readonly { file: string; why: string }[] = [
  { file: 'mobile/src/ui/top-bar.tsx', why: '뒤로 「<」 — 웹은 화살 「←」(`back`)이고 앱은 운영자가 고른 꺾쇠(2026-10-31)라 한 벌에 짝이 없다' },
  { file: 'mobile/src/ui/parts.tsx', why: '확인 상자의 고름 표시 — 웹은 브라우저가 그리는 확인 상자(`accent-[var(--accent)]`)다' },
  { file: 'mobile/src/share/marks.tsx', why: '첫 화면 입구의 해 — 웹 `app/ui/entry-marks.tsx` 의 `SunMark` 와 같은 값. 입구 그림은 아이콘 한 벌 밖이다' },
  { file: 'mobile/src/auth/kakao-button.tsx', why: '카카오 상징 — 카카오가 정한 그림이다(`src/lib/brand` 의 `KAKAO_SYMBOL`)' },
  { file: 'mobile/src/compat/relation-map.tsx', why: '관계 지도 — 그림이 곧 화면이다' },
  { file: 'mobile/src/reading/result.tsx', why: '궁합풀이 표지의 두 색 면(웹 `app/me/reading/essay.ts` 의 `coverFace`)' },
  { file: 'mobile/src/chat/empty.tsx', why: '빈 대화방의 말풍선 그림(웹 `ChatIllustration`) — 인연 · 채팅은 닫혀 있다(G-135)' },
  { file: 'mobile/src/chart/parts.tsx', why: '만세력 화면의 손그림 꺾쇠 — G-165 가 든다. 경로가 `chevron` 과 같아 아래 「베끼지 않는다」에서도 빠진다' },
];

/** 자료의 경로 글자 — 짧은 것(`m15 15 5 5`)은 다른 그림과 우연히 같을 수 있어 열 자 넘는 것만 본다 */
const PATHS = [
  ...new Set(
    Object.values(ICON_SHAPES)
      .flat()
      .flatMap((shape) => (shape.kind === 'path' && shape.d.length > 10 ? [shape.d] : [])),
  ),
];

describe('선 아이콘 한 벌', () => {
  it('자료를 실제로 읽었다', () => {
    expect(Object.keys(ICON_SHAPES).length).toBeGreaterThan(30);
    expect(PATHS.length).toBeGreaterThan(30);
    expect(SOURCES.length).toBeGreaterThan(500);
  });

  it.each([
    ['app/ui/icons.tsx', "from '@/src/lib/design/icons'"],
    ['mobile/src/ui/icons.tsx', "from '@design'"],
  ])('%s 는 자료로 그리고 경로를 들지 않는다', (file, from) => {
    const code = codeOf(read(file));
    expect(code).toContain(from);
    expect(code).toContain('ICON_SHAPES[name]');
    expect(code).not.toMatch(/\bd="|\bd=\{'|\bd: '/);
  });

  it('자료의 경로를 다른 파일에 베끼지 않는다 — 그림은 `Icon` 을 부른다', () => {
    const allowed = new Set(['src/lib/design/icons.ts', ...DRAWING_EXCEPTIONS.filter((one) => one.file === 'mobile/src/chart/parts.tsx').map((one) => one.file)]);
    const copied = SOURCES.filter(({ file }) => !allowed.has(file)).flatMap(({ file, code }) => PATHS.filter((d) => code.includes(d)).map((d) => `${file} — ${d}`));
    expect(copied).toEqual([]);
  });

  it('앱은 그림 부품과 표의 자리만 `react-native-svg` 를 부른다', () => {
    const allowed = new Set([...DRAWING_PARTS, ...DRAWING_EXCEPTIONS.map((one) => one.file)]);
    /* `import … from` · `require(…)` · 따옴표 둘 다 */
    const drawing = SOURCES.filter(({ file, code }) => file.startsWith('mobile/src/') && /['"]react-native-svg['"]/.test(code)).map(({ file }) => file);
    expect(drawing.filter((file) => !allowed.has(file))).toEqual([]);
  });

  it('예외 표의 줄마다 까닭이 있고 그림 부품과 겹치지 않는다', () => {
    for (const one of DRAWING_EXCEPTIONS) {
      expect(one.why.length, one.file).toBeGreaterThan(10);
      expect(DRAWING_PARTS, one.file).not.toContain(one.file);
    }
  });
});
