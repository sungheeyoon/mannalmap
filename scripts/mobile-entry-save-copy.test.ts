import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { chartPath, currentPath } from '../src/lib/consent/app-destination';
import { safeReturnPath, withReturnPath } from '../src/lib/consent/return-path';
import { matchingStartSteps } from '../src/lib/brand/guide';
import { DEFAULT_QUERY, queryFromJson, type Query } from '../src/lib/input/query';

/**
 * **앱 입구와 결과 화면 저장의 잠금** — 글자는 웹의 것이고(입구의 줄은 머리글 · 바닥글, 저장은 `app/save-for-reading.tsx`), 앱에 화면이 있는 안내는 웹을 열지 않으며,
 * 풀이권을 팔지 않는 앱은 구매를 권하지 않는다.
 */
const read = (file: string) => readFileSync(join(import.meta.dirname, '..', file), 'utf8');

describe('앱 입구', () => {
  const entry = read('mobile/src/app/index.tsx');

  it('로그인 글자는 웹 머리글의 그것이고 안내 링크는 웹 바닥글과 같은 상수다', () => {
    expect(read('app/site-header.tsx')).toMatch(/^\s*로그인\s*$/m);
    expect(entry).toMatch(/<Text[^>]*>로그인<\/Text>/);
    expect(read('app/site-footer.tsx')).toContain('GUIDE_LINKS');
    expect(entry).toContain("from '@brand/links'");
  });

  it('입력 없이 들어가는 길과 소개로 가는 길이 있다', () => {
    expect(entry).toContain("router.push('/auth'");
    expect(entry).toContain("href: '/landing'");
  });
});

describe('로그인 시점과 목적지 (ADR 0213)', () => {
  const entry = read('mobile/src/app/index.tsx');
  const save = read('mobile/src/reading/save-self.tsx');

  it('입력에서 만세력까지 로그인 · 서버 호출이 없다', () => {
    expect(entry).not.toContain('signInWithGoogle');
    expect(entry).not.toContain('supabase');
    const submit = entry.slice(entry.indexOf('const submit'), entry.indexOf('return (', entry.indexOf('const submit')));
    expect(submit).toContain('calculateChart(query)');
    expect(submit).toContain('router.push(chartPath(query)');
    for (const file of readdirSync(join(import.meta.dirname, '../mobile/src/chart'))) {
      expect(read(`mobile/src/chart/${file}`)).not.toMatch(/supabase|fetch\(/);
    }
  });

  it('세션이 없으면 관문은 DB 에 닿기 전에 답한다 — 결과 화면의 저장 칸은 그 답을 먼저 본다', () => {
    const gate = read('mobile/src/home/gate.ts');
    expect(gate.indexOf("data.session === null) return { kind: 'out' }")).toBeGreaterThan(-1);
    expect(gate.indexOf("data.session === null) return { kind: 'out' }")).toBeLessThan(gate.indexOf("from('app_user')"));
    const context = save.slice(save.indexOf('function useSaveContext'), save.indexOf('export function SavePersonForReading'));
    expect(context.indexOf('readGate()')).toBeGreaterThan(-1);
    expect(context.indexOf('readGate()')).toBeLessThan(context.indexOf("from('app_user')"));
  });

  it.each(['이 사주가 내 삶에서는 어떤 뜻일까요?', '성향부터 일과 연애, 운의 흐름까지 글로 풀어드려요.', '로그인하고 계속하기', '로그인하면 이 입력으로 돌아와요. 사주풀이는 저장한 뒤에 받을 수 있고, 풀이권 1장을 써요.'])('로그인 카드 글자는 웹의 것 — %s', (words) => {
    expect(read('app/save-for-reading.tsx')).toContain(words);
    expect(save).toContain(words);
  });

  it('로그인 카드는 저장 · 풀이를 대신 누르지 않는다', () => {
    const card = save.slice(save.indexOf('function SignInCard'), save.indexOf('/** 저장한 사람으로 저장한다'));
    expect(card).toContain('useStart(chartPath(query), { standingThere: true })');
    expect(card).not.toMatch(/addPerson|saveSelfPerson|start_reading|\/me\/readings/);
  });

  it.each([
    ['mobile/src/share/start.ts', "withReturnPath('/signup', destination)"],
    ['mobile/src/app/auth/index.tsx', "withReturnPath('/signup', destination)"],
    ['mobile/src/app/me/_layout.tsx', "withReturnPath('/signup', currentPath(pathname, search))"],
    ['mobile/src/app/me/_layout.tsx', "withReturnPath('/auth', currentPath(pathname, search))"],
    ['mobile/src/reading/save-self.tsx', "withReturnPath('/signup', chartPath(query))"],
  ])('%s 은 가입 · 로그인으로 보낼 때 목적지를 든다', (file, carried) => {
    expect(read(file)).toContain(carried);
    expect(read(file)).not.toMatch(/(push|replace)\('\/signup'\)|href="\/signup"/);
  });

  it('인연 입구는 남은 단계만 미리 말한다 — 끝낸 단계는 건너뛴다', () => {
    expect(matchingStartSteps([]).map((step) => step.key)).toEqual(['sign-in', 'signup', 'self']);
    expect(matchingStartSteps(['sign-in']).map((step) => step.key)).toEqual(['signup', 'self']);
    expect(read('mobile/src/app/auth/index.tsx')).toContain("destination.startsWith('/me/matching') && <MatchingSteps done={[]} />");
    expect(read('mobile/src/app/signup.tsx')).toContain("<MatchingSteps done={['sign-in']} />");
  });

  it('풀이는 보유 수 → 확인창 차례이고, 앱에 로그인 전 풀이 · 기기 저장이 없다', () => {
    const panel = read('mobile/src/reading/panel.tsx');
    expect(panel).toContain('CREDITS_AVAILABLE_LABEL');
    expect(read('mobile/src/reading/dialogs.tsx')).toContain('풀이권 1장을 사용하시겠어요?');
    expect(entry).not.toContain('AsyncStorage');
    expect(save).not.toContain('AsyncStorage');
  });

  it('가입 화면은 목적지를 좁힌 뒤 간다', () => {
    expect(read('mobile/src/app/signup.tsx')).toContain('router.replace(safeReturnPath(next) as never)');
  });

  describe('출생 정보가 목적지 주소를 지나도 그대로다', () => {
    const query: Query = { ...DEFAULT_QUERY, name: '김 A&B=#+%?/', date: '1990-02-03', time: '23:41', hourKnown: true, gender: 'male', calendar: 'lunar', city: '부산', rule: 'ya', saeunFrom: 2030 };

    it('chart → signup?next → 가입 끝 → chart', () => {
      const signup = new URL(withReturnPath('/signup', chartPath(query)), 'https://local.invalid');
      const back = new URL(safeReturnPath(signup.searchParams.get('next')), 'https://local.invalid');
      expect(back.pathname).toBe('/chart');
      expect(queryFromJson(back.searchParams.get('query') ?? undefined)).toEqual(query);
    });

    it('밖으로 가는 목적지는 받지 않는다', () => {
      expect(safeReturnPath('https://evil.example/chart')).toBe('/me');
      expect(safeReturnPath('//evil.example')).toBe('/me');
    });
  });

  it('지금 주소 — 동적 조각은 경로에 있으니 빼고 물음만 싣는다', () => {
    expect(currentPath('/me/chat/abc', { matchId: 'abc' })).toBe('/me/chat/abc');
    expect(currentPath('/me/readings/compat', { a: '1', b: '2' })).toBe('/me/readings/compat?a=1&b=2');
    expect(currentPath('/help', { '#': 'credits' })).toBe('/help');
  });
});

describe('결과 화면의 저장', () => {
  const screen = read('mobile/src/reading/save-self.tsx');
  const web = read('app/save-for-reading.tsx');

  it.each(['이 사주가 내 사주 맞나요?', '첫 화면에 입력한 정보예요.', '내 사주로 저장', '다른 사람의 사주예요', '저장하고 계속하기', '저장한 사람 관리 →'])('%s', (words) => {
    expect(web).toContain(words);
    expect(screen).toContain(words);
  });

  it('내 사주 물음이 저장 카드보다 먼저 갈린다 — 묻지 않고 내 사주로 저장하지 않는다', () => {
    const body = screen.slice(screen.indexOf('export function SavePersonForReading'), screen.indexOf('/** 저장한 사람으로 저장한다'));
    expect(body.indexOf('<SelfConfirm')).toBeGreaterThan(-1);
    expect(body.indexOf('<SelfConfirm')).toBeLessThan(body.indexOf('<SaveCard'));
    expect(screen.slice(screen.indexOf('function SaveCard'), screen.indexOf('function SelfConfirm'))).not.toContain('saveSelfPerson');
  });
});

describe('앱에 있는 화면은 앱에서 연다', () => {
  it.each([
    ['mobile/src/settings/settings-screen.tsx', "router.push('/privacy'"],
    ['mobile/src/credits/credits.tsx', "router.push('/refund?from=credits'"],
  ])('%s', (file, path) => {
    const text = read(file);
    expect(text).toContain(path);
    expect(text).not.toContain('openBrowserAsync');
  });
});

describe('앱은 풀이권을 팔지 않는다', () => {
  it('풀이권 부족 창에 구매 단추가 없고 판매가 닫힌 웹의 글자가 선다', () => {
    const dialogs = read('mobile/src/reading/dialogs.tsx');
    expect(dialogs).not.toContain('BUY_CREDITS_LABEL');
    expect(dialogs).not.toContain('/me/credits');
    expect(dialogs).toContain('SALE_CLOSED_NOTE');
    expect(dialogs).toContain('SALE_CLOSED_OK');
    expect(read('mobile/src/reading/api.ts')).not.toContain('my_reading_sale_is_open');

    const today = read('mobile/src/matching/today.tsx');
    expect(today).not.toContain('BUY_CREDITS_LABEL');
    expect(today).toContain('SALE_CLOSED_NOTE');
    expect(read('mobile/src/matching/doors.ts')).not.toContain('my_reading_sale_is_open');
  });
});

describe('인연 탭', () => {
  it('덱을 읽기 전에 참여를 열고 못 열면 까닭을 낸다', () => {
    const doors = read('mobile/src/matching/doors.ts');
    const deck = doors.slice(doors.indexOf('export function readDeck'));
    expect(deck.indexOf('openParticipation()')).toBeGreaterThan(-1);
    expect(deck.indexOf('openParticipation()')).toBeLessThan(deck.indexOf("rpc('my_discovery_board')"));
    expect(deck).toContain('saveFailureOf(opened)');
  });
});
