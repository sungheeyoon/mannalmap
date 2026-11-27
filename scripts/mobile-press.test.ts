import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { filesUnder } from './source-files';

/**
 * **앱 화면의 누름은 `Press` 로 선다 — 손가락 아래에서 눌렸는지 보인다**(ADR 0281). RN `Pressable` 을 맨손으로 쓰면 누르는 동안 아무것도 안
 * 바뀐다 — 2026-11-27 앱 점검이 맨 `Pressable` 119 곳 가운데 눌림 꼴이 선 곳이 열한 파일뿐인 것을 짚었다. 반응(웹 `active:` 와 같은 값)은
 * `mobile/src/ui/press.tsx` 한 곳이 든다. 화면이 `react-native` 의 누름(`Pressable` · `Touchable*`)을 바로 들여오면 붉다.
 *
 * 아직 옮기지 않은 파일은 아래 표가 까닭과 함께 든다 — 사유 없이 늘지 않고, 옮기면 그 줄을 지운다(표는 줄기만 한다). 공용 부품(`mobile/src/ui/`)은
 * 제 반응을 들고 서므로 재지 않는다. CI 에 앱 패키지가 없어 글자로 읽는다.
 */
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'mobile', 'src');

const CLOSED = '인연 · 채팅 화면 — 인연이 닫혀 있다(G-135). 열 때 옮긴다';
const OWN_FEEDBACK = '제 눌림 꼴(`({ pressed })` 스타일)을 이미 든다 — 값만 `Press` 와 다르면 옮길 때 맞춘다';
const MOTION = '누름이 움직임 · 끌기다 — 반응이 그림의 움직임(관계 지도의 사람 · 사진 끌어 옮기기 · 사진 크게 보기)이다';
const NOT_YET = '열린 화면이지만 아직 옮기지 않았다 — 2026-11-27 앱 점검 A5 의 남은 자리(주요 자리 — 머리 · 독 · 도움말 · 궁합 고르기 · 사람 카드 · 사람 화면 — 만 옮겼다)';

/** 맨 누름을 아직 쓰는 파일 — 경로(`mobile/src/` 뒤)와 까닭 */
const PRESS_PENDING: readonly { file: string; why: string }[] = [
  { file: 'app/me/(tabs)/chat/index.tsx', why: CLOSED },
  { file: 'app/me/(tabs)/matching/index.tsx', why: CLOSED },
  { file: 'app/me/match/[matchId].tsx', why: CLOSED },
  { file: 'chat/detail-panel.tsx', why: CLOSED },
  { file: 'chat/dialogs.tsx', why: CLOSED },
  { file: 'chat/ended-talks.tsx', why: CLOSED },
  { file: 'chat/menu.tsx', why: CLOSED },
  { file: 'chat/profile-sheet.tsx', why: CLOSED },
  { file: 'chat/room.tsx', why: CLOSED },
  { file: 'matching/people.tsx', why: CLOSED },
  { file: 'matching/today.tsx', why: CLOSED },
  { file: 'auth/google-button.tsx', why: OWN_FEEDBACK },
  { file: 'auth/kakao-button.tsx', why: OWN_FEEDBACK },
  { file: 'home/lists.tsx', why: OWN_FEEDBACK },
  { file: 'reading/contents.tsx', why: OWN_FEEDBACK },
  { file: 'reading/shelf.tsx', why: OWN_FEEDBACK },
  { file: 'settings/leaving.tsx', why: OWN_FEEDBACK },
  { file: 'settings/parts.tsx', why: OWN_FEEDBACK },
  { file: 'compat/relation-map.tsx', why: MOTION },
  { file: 'settings/photo-grid.tsx', why: MOTION },
  { file: 'settings/photo-viewer.tsx', why: MOTION },
  { file: 'app/chart.tsx', why: NOT_YET },
  { file: 'app/index.tsx', why: NOT_YET },
  { file: 'app/me/readings/index.tsx', why: NOT_YET },
  { file: 'chart/elements.tsx', why: NOT_YET },
  { file: 'chart/parts.tsx', why: NOT_YET },
  { file: 'credits/credits.tsx', why: NOT_YET },
  { file: 'credits/store-section.tsx', why: NOT_YET },
  { file: 'home/self-profile.tsx', why: NOT_YET },
  { file: 'people/birth-fields.tsx', why: NOT_YET },
  { file: 'people/parts.tsx', why: NOT_YET },
  { file: 'people/person-sheets.tsx', why: NOT_YET },
  { file: 'reading/feedback.tsx', why: NOT_YET },
  { file: 'reading/save-self.tsx', why: NOT_YET },
  { file: 'reading/share-button.tsx', why: NOT_YET },
  { file: 'settings/birth-section.tsx', why: NOT_YET },
  { file: 'settings/discovery-rows.tsx', why: NOT_YET },
  { file: 'settings/survey-screen.tsx', why: NOT_YET },
  { file: 'share/view.tsx', why: NOT_YET },
];

const PRESS_NAMES = /^\s*(?:Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TouchableNativeFeedback)(?:\s+as\s+\w+)?\s*$/;

/** `react-native` 에서 누름을 들여오는가 — 여러 줄 · 별칭(`Pressable as Tap`) · `Touchable*` 도 걸린다. 타입(`PressableProps` · `type Pressable`)은 아니다 */
export function importsRawPress(source: string): boolean {
  return [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'react-native'/g)].some(([, names]) => names.split(',').some((name) => PRESS_NAMES.test(name)));
}

const files = filesUnder(SRC)
  .filter((path) => /\.tsx?$/.test(path))
  .map((path) => ({ file: relative(SRC, path).split('\\').join('/'), text: readFileSync(path, 'utf8') }))
  .filter(({ file }) => !file.startsWith('ui/'));

describe('앱 화면의 누름은 반응을 든다', () => {
  it('화면 파일을 실제로 읽었다', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('`react-native` 의 누름을 바로 들여오지 않는다 — `@/ui/press` 의 `Press` 를 쓴다. 남은 파일은 표가 까닭과 함께 든다', () => {
    const raw = files.filter(({ text }) => importsRawPress(text)).map(({ file }) => file);
    expect(raw.filter((file) => !PRESS_PENDING.some((one) => one.file === file))).toEqual([]);
  });

  it('표는 아직 맨 누름을 쓰는 파일만 든다 — 옮겼으면 줄을 지운다', () => {
    const stale = PRESS_PENDING.filter((one) => {
      const found = files.find(({ file }) => file === one.file);
      return found === undefined || !importsRawPress(found.text);
    });
    expect(stale).toEqual([]);
    expect(PRESS_PENDING.every((one) => one.why.length > 20)).toBe(true);
  });

  it('들여오기를 읽는 눈은 다른 표기도 잡는다', () => {
    expect(importsRawPress("import { Pressable, StyleSheet, View } from 'react-native';")).toBe(true);
    expect(importsRawPress("import {\n  BackHandler,\n  Pressable as Tap,\n} from 'react-native';")).toBe(true);
    expect(importsRawPress("import { TouchableOpacity } from 'react-native';")).toBe(true);
    expect(importsRawPress("import { type PressableProps, type PressableStateCallbackType } from 'react-native';")).toBe(false);
    expect(importsRawPress("import { Press } from '@/ui/press';")).toBe(false);
  });
});
