import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TAB_GROUP, TAB_ROUTE, appHeadStands, compatStepId, dockStands, tabMoves, type ShellState } from '../src/lib/app-shell';

/**
 * **앱의 뒤로가기는 부품 하나다**(운영자 2026-10-31) — `<` 아이콘만, 맨 위 왼쪽 고정. 화면마다 제 뒤로가기를 다시 지으면
 * 모양과 자리가 또 갈린다. `router.back` 은 `mobile/src/ui/top-bar.tsx` 안에만 있고, 라우트마다 그 줄을 세우거나 안 세우는 까닭이 아래 표에 있다.
 */
const MOBILE = join(import.meta.dirname, '..', 'mobile', 'src');
const PART = 'ui/top-bar.tsx';

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const sources = filesIn(MOBILE).map((path) => ({ file: relative(MOBILE, path), text: readFileSync(path, 'utf8') }));
const textOf = (file: string) => sources.find((one) => one.file === file)?.text ?? '';

/** 뒤로가기가 아닌 화살표 글자와 그 사유 */
const GLYPH_OK: Record<string, string> = {
  'chart/parts.tsx': '표를 좌우로 넘기라는 안내 글자다',
};

/** 맨 위 줄이 없는 라우트와 그 사유 — 여기 없는 라우트는 줄을 세워야 한다 */
const NO_BAR: Record<string, string> = {
  'app/index.tsx': '앱의 입구 — 돌아갈 곳이 없다',
  'app/signup.tsx': '나가는 길이 로그아웃을 함께 하는 「다른 구글 계정」 줄이다 — 세션을 든 채 앞으로 돌아가면 다시 이 화면이다',
  'app/auth/index.tsx': '막다른 안내 판 — replace 로만 오고 나가는 길은 「처음으로」다',
  'app/auth/denied.tsx': '막다른 안내 판 — replace 로만 오고 나가는 길은 판 안의 두 단추다',
  'app/closed.tsx': '서비스 종료 고지 — 돌아갈 곳이 없게 관문이 보낸 자리다',
  'app/me/(tabs)/index.tsx': '탭 첫 화면 — 앱 머리',
  'app/me/(tabs)/matching/index.tsx': '탭 첫 화면 — 앱 머리',
  'app/me/(tabs)/chat/index.tsx': '탭 첫 화면 — 앱 머리',
  'app/me/discovery.tsx': '화면 없이 설정으로 넘긴다',
  'app/+not-found.tsx': '없는 주소의 안내 판 — 나가는 길은 판 안의 「홈으로」다',
  'app/dev-parts.tsx': '개발에서만 서는 부품 견본 — 앱 안의 길이 없다',
};

/** 라우트가 직접 쓰거나, 그 라우트가 곧바로 부르는 부품이 쓰면 그 화면에 줄이 선다 */
function drawsBar(file: string): boolean {
  const text = textOf(file);
  if (/<TopBar\b|<InfoScreen\b/.test(text)) return true;
  return [...text.matchAll(/from '@\/([^']+)'/g)].some((match) => /<TopBar\b/.test(textOf(`${match[1]}.tsx`)));
}

describe('앱의 뒤로가기', () => {
  it('router.back · canGoBack 은 부품 안에만 있다', () => {
    const outside = sources.filter(({ file, text }) => file !== PART && /\.(back|canGoBack)\(/.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')) && /\brouter\b/.test(text));
    expect(outside.map(({ file }) => file)).toEqual([]);
  });

  it('화살표 글자나 다른 뒤로 아이콘을 다시 짓지 않는다', () => {
    const glyphs = sources.filter(({ file }) => !(file in GLYPH_OK)).filter(({ text }) => /[>}\s][‹←]\s*[{\p{L}]/u.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
    expect(glyphs.map(({ file }) => file)).toEqual([]);
    const icons = sources.filter(({ text }) => /name="back"|function (BackLink|Back)\b/.test(text));
    expect(icons.map(({ file }) => file)).toEqual([]);
  });

  it('뒤로 갈 곳이 있는 라우트는 모두 맨 위 줄을 세운다', () => {
    const routes = sources.map(({ file }) => file).filter((file) => file.startsWith('app/') && !file.endsWith('_layout.tsx'));
    expect(routes.filter((file) => !(file in NO_BAR) && !drawsBar(file))).toEqual([]);
  });

  it('줄이 없는 라우트의 표에 사라진 파일이 남지 않는다', () => {
    expect(Object.keys(NO_BAR).filter((file) => textOf(file) === '')).toEqual([]);
  });

  it('맨 위 줄을 쓰는 틀은 안전 영역의 위를 또 내지 않는다', () => {
    const doubled = sources.filter(({ text }) => /<TopBar\b/.test(text) && /<SafeAreaView (?![^>]*edges=)[^>]*>/.test(text));
    expect(doubled.map(({ file }) => file)).toEqual([]);
    const edgedTop = sources.filter(({ text }) => /<TopBar\b/.test(text) && /edges=\{\[[^\]]*'top'/.test(text));
    expect(edgedTop.map(({ file }) => file)).toEqual([]);
  });

  it('앱 머리는 탭 첫 화면에만 선다', () => {
    for (const path of ['/me', '/me/', '/me/compat', '/me/matching', '/me/chat']) expect(appHeadStands(path), path).toBe(true);
    for (const path of ['/me/settings', '/me/people', '/me/people/1', '/me/readings', '/me/requests', '/me/match/1', '/me/matching/history', '/me/chat/1', '/me/credits']) {
      expect(appHeadStands(path), path).toBe(false);
    }
    expect(appHeadStands('/me/compat', { a: '1', b: '2' })).toBe(false);
    expect(appHeadStands('/me/compat', { pickA: '1' } as never)).toBe(true);
  });

  it('탭 첫 화면으로 가는 길은 goTab 하나다 — 그냥 부르면 하위 화면 위에 탭 묶음이 새로 쌓여 입력 · 스크롤을 잃는다', () => {
    const direct = sources.filter(({ text }) => /router\.(push|navigate)\(\s*['"`]\/me(\/compat|\/matching|\/chat)?['"`]/.test(text));
    expect(direct.map(({ file }) => file)).toEqual([]);
  });

  it('궁합 탭의 자리는 고르기와 결과를 가른다', () => {
    expect(compatStepId()).toBe('');
    expect(compatStepId({ pickA: '1' } as never)).toBe('');
    expect(compatStepId({ a: '1' })).toBe('');
    expect(compatStepId({ a: '1', b: '2' })).not.toBe('');
    expect(compatStepId({ a: '1', b: '2' })).not.toBe(compatStepId({ a: '1', b: '3' }));
  });

  it('탭 묶음의 화면 넷은 탭 주소 넷과 같은 파일이다', () => {
    const dir = join(MOBILE, 'app', 'me', TAB_GROUP);
    const routes = filesIn(dir).map((path) => relative(dir, path).replace(/\.tsx$/, '')).filter((name) => !name.endsWith('_layout'));
    /* 궁합은 제 스택이 있어 탭의 이름이 폴더다 */
    expect(routes.map((name) => (name === 'compat/index' ? 'compat' : name)).sort()).toEqual(Object.values(TAB_ROUTE).sort());
    expect(textOf(`app/me/${TAB_GROUP}/compat/_layout.tsx`)).toMatch(/<Stack\b/);
  });

  /**
   * **탭 이동은 화면의 순서를 바꾸지 않는다**(#1126) — 스택 하나에서 아래에 있던 탭 화면을 맨 위로 올리면 안드로이드가 화면을 떼어 본문이 빈다.
   * 걸음은 걷기(POP) · 탭 켜기(JUMP_TO) · 궁합의 고르기로 가기(NAVIGATE + pop)뿐이다.
   */
  describe('탭으로 가는 걸음', () => {
    const tabs = (index: number, compat?: Partial<ShellState>) => ({
      name: TAB_GROUP,
      state: {
        key: 'tabs-1',
        index,
        routes: [{ name: 'index' }, { name: 'compat', ...(compat === undefined ? {} : { state: compat }) }, { name: 'matching/index' }, { name: 'chat/index' }],
      },
    });
    const me = (index: number, routes: ShellState['routes']): ShellState => ({ key: 'me-1', index, routes });
    const picker = { name: 'index', params: {} };
    const result = { name: 'index', params: { a: '1', b: '2' } };

    it('탭 첫 화면에서는 탭만 켠다', () => {
      expect(tabMoves(me(0, [tabs(0)]), 'compat')).toEqual([{ type: 'JUMP_TO', payload: { name: 'compat' }, target: 'tabs-1' }]);
    });

    it('선 탭을 다시 누르면 아무것도 안 한다', () => {
      expect(tabMoves(me(0, [tabs(0)]), 'index')).toEqual([]);
    });

    it('하위 화면에서는 묶음까지 걷고 탭을 켠다', () => {
      expect(tabMoves(me(2, [tabs(0), { name: 'people/index' }, { name: 'people/[personId]' }]), 'chat/index')).toEqual([
        { type: 'POP', payload: { count: 2 }, target: 'me-1' },
        { type: 'JUMP_TO', payload: { name: 'chat/index' }, target: 'tabs-1' },
      ]);
    });

    it('하위 화면에서 연 궁합 결과(묶음이 하나 더 쌓인다) 위에서도 처음 묶음으로 돌아간다', () => {
      const second = { name: TAB_GROUP, state: { key: 'tabs-2', index: 1, routes: [{ name: 'index' }, { name: 'compat' }] } };
      expect(tabMoves(me(2, [tabs(1), { name: 'people/[personId]' }, second]), 'index')).toEqual([
        { type: 'POP', payload: { count: 2 }, target: 'me-1' },
        { type: 'JUMP_TO', payload: { name: 'index' }, target: 'tabs-1' },
      ]);
    });

    it('궁합은 고르기 자리로 간다 — 결과가 위에 있을 때만 걸음을 더한다', () => {
      const toPicker = { type: 'NAVIGATE', payload: { name: 'index', params: {}, merge: true, pop: true }, target: 'compat-1' };
      expect(tabMoves(me(0, [tabs(1, { key: 'compat-1', index: 1, routes: [picker, result] })]), 'compat')).toEqual([toPicker]);
      expect(tabMoves(me(0, [tabs(0, { key: 'compat-1', index: 1, routes: [picker, result] })]), 'compat')).toEqual([
        { type: 'JUMP_TO', payload: { name: 'compat' }, target: 'tabs-1' },
        toPicker,
      ]);
      expect(tabMoves(me(0, [tabs(1, { key: 'compat-1', index: 0, routes: [picker] })]), 'compat')).toEqual([]);
    });

    it('걸음에 화면을 다시 쌓거나 자리를 바꾸는 것이 없다', () => {
      const all = [
        tabMoves(me(1, [tabs(3, { key: 'compat-1', index: 1, routes: [picker, result] }), { name: 'settings' }]), 'compat'),
        tabMoves(me(0, [tabs(2)]), 'index'),
      ].flatMap((moves) => moves ?? []);
      expect(all.length).toBeGreaterThan(0);
      for (const move of all) expect(['POP', 'JUMP_TO'].includes(move.type) || (move.type === 'NAVIGATE' && move.payload.pop)).toBe(true);
    });

    it('스택에 묶음이 없으면 걸음을 내지 않는다 — 부르는 쪽이 주소로 간다', () => {
      expect(tabMoves(me(0, [{ name: 'people/index' }]), 'index')).toBeNull();
      expect(tabMoves(me(0, [{ name: TAB_GROUP }]), 'index')).toBeNull();
    });

    it('앱은 탭을 옮길 때 스택의 자리를 다시 쓰라고 하지 않는다', () => {
      const reorders = sources.filter(({ text }) => /dangerouslySingular/.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
      expect(reorders.map(({ file }) => file)).toEqual([]);
    });
  });

  it('탭 막대는 대화방에서만 걷힌다', () => {
    expect(dockStands('/me/chat/1')).toBe(false);
    for (const path of ['/me', '/me/settings', '/me/people/1', '/me/chat']) expect(dockStands(path), path).toBe(true);
  });
});
