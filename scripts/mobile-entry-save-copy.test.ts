import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { chartPath, chartWantOf, currentPath } from '../src/lib/consent/app-destination';
import { safeReturnPath, withReturnPath } from '../src/lib/consent/return-path';
import { CHART_SIGN_IN, MATCHING_INTRO_EXAMPLE, matchingStartSteps } from '../src/lib/brand/guide';
import { DEFAULT_QUERY, queryFromJson, type Query } from '../src/lib/input/query';

/**
 * **앱 입구와 결과 화면 저장의 잠금** — 글자는 웹의 것이고(입구의 줄은 머리글 · 바닥글, 저장은 `app/save-for-reading.tsx`), 앱에 화면이 있는 안내는 웹을 열지 않으며,
 * 풀이권을 팔지 않는 앱은 구매를 권하지 않는다.
 */
const read = (file: string) => readFileSync(join(import.meta.dirname, '..', file), 'utf8');

describe('앱 입구', () => {
  const entry = read('mobile/src/app/index.tsx');

  it('로그인 글자는 웹 머리글의 그것이다', () => {
    expect(read('app/site-header.tsx')).toMatch(/^\s*로그인\s*$/m);
    expect(entry).toMatch(/<Text[^>]*>로그인<\/Text>/);
  });

  it('입력 없이 들어가는 길 · 서비스 소개 · 고객센터 · 약관 및 정책이 로그인 없이 닿는다 — 첫 화면에 인연 입구는 없다(ADR 0226)', () => {
    expect(entry).toContain("router.push('/auth'");
    expect(entry).not.toContain('/matching-intro');
    expect(entry).toContain("router.push('/about'");
    expect(entry).toContain("router.push('/support'");
    expect(entry).toContain("router.push('/policies'");
  });

  it('제목 아래는 웹 `/` 와 같은 두 탭이고, 궁합 탭은 로그인 전 궁합 결과 대신 기존 글자로 로그인에 잇는다(ADR 0226)', () => {
    const web = read('app/home-hero.tsx');
    expect(web).toContain("title: '내 사주 보기'");
    expect(entry).toContain("label: '내 사주 보기'");
    expect(entry).toContain('label: COMPAT_ENTRY');
    expect(entry).toContain('accessibilityRole="tablist"');
    /* 웹 탭의 면 — 판은 칸 모서리의 꺼진 면, 켜진 칸은 흰 면과 카드 그림자 */
    expect(web).toContain('rounded-cell bg-surface-sunken p-0.5');
    expect(entry).toMatch(/tabs: \{[^}]*RADIUS\.cell[^}]*COLOR\.surfaceSunken/);
    expect(entry).toMatch(/tabOn: \{[^}]*COLOR\.surface,[^}]*ELEVATION\.card/);
    /* 궁합 탭 — 로그인 화면의 그 제목, 웹 로그인 전 궁합 결과의 단추 · 풀이권 줄과 같은 상수, 갈 곳은 지금의 궁합 로그인 길 */
    for (const name of ['COMPAT_SIGN_IN_TITLE', 'COMPAT_CREDIT_NOTE', 'COMPAT_SIGN_IN_ACTION']) expect(entry).toContain(name);
    expect(read('app/pair-taste.tsx')).toContain('{COMPAT_SIGN_IN_ACTION}');
    expect(read('app/pair-taste.tsx')).toContain('{COMPAT_CREDIT_NOTE}');
    expect(entry).toContain("withReturnPath('/auth', '/me/compat')");
    /* 주 단추는 웹 첫 화면과 같은 글자다 */
    expect(entry).toContain("'무료로 내 사주 보기'");
    expect(read('app/saju-calculator.tsx')).toContain("'무료로 내 사주 보기'");
  });

  it('주 단추 바로 아래 이미 쓰는 사람의 한 줄이 웹 첫 화면과 같은 글자로 선다 — 제목 아래 설명 줄은 없다(ADR 0226)', () => {
    const button = entry.indexOf('<PrimaryButton label={signedOut');
    const line = entry.indexOf('{MEMBER_SIGN_IN_ASK}');
    expect(button).toBeGreaterThan(-1);
    expect(line).toBeGreaterThan(button);
    expect(read('app/saju-calculator.tsx')).toContain('{MEMBER_SIGN_IN_ASK}');
    /* 웹 첫 화면처럼 제목 아래 설명 줄이 없다 — `ABOUT_LEAD` 는 서비스 소개의 글이다 */
    expect(entry).not.toContain('ABOUT_LEAD');
  });

  it('입구는 관문의 답 하나로 고르고, 못 읽은 답은 다시 시도하기다', () => {
    expect(entry).toContain('entryFor(gate.kind, opened)');
    expect(entry).toContain('label="다시 시도하기"');
    expect(entry).toContain("<Redirect href={'/signup' as never} />");
  });

  it('입구는 바닥글 나열을 옮기지 않고, 따로 된 소개 판 주소가 없다', () => {
    expect(entry).not.toContain('GUIDE_LINKS');
    expect(entry).not.toContain('/landing');
    expect(existsSync(join(import.meta.dirname, '../mobile/src/app/landing.tsx'))).toBe(false);
  });
});

describe('인연 소개 (#940)', () => {
  const intro = read('mobile/src/app/matching-intro.tsx');

  it('세션 · 회원을 안 읽는다 — 서버에 묻는 것은 인연이 열려 있는가 하나다(ADR 0222)', () => {
    expect(intro).not.toMatch(/supabase|fetch\(|readGate|\.rpc\(|useDeck|@\/matching\/(?!opening')|PersonPhoto/);
    expect(intro).toContain('useMatchOpen()');
  });

  it('예시 카드에는 사람도 누를 자리도 없다 — 눌러도 아무에게도 안 간다', () => {
    const card = intro.slice(intro.indexOf('<Tile'), intro.indexOf('</Tile>'));
    expect(card).not.toMatch(/Pressable|onPress|nickname|activity|photo/i);
    expect(MATCHING_INTRO_EXAMPLE.stamp).toBe('예시');
    expect(MATCHING_INTRO_EXAMPLE.note).toContain('실제 회원이 아니에요');
  });

  it('예시의 판정은 그 점수 칸의 실제 글자다', () => {
    const table = read('src/lib/discovery/index.ts');
    expect(table).toContain(`[75, '${MATCHING_INTRO_EXAMPLE.verdict}']`);
    expect(MATCHING_INTRO_EXAMPLE.score).toBeGreaterThanOrEqual(75);
  });

  it('규칙은 카드 · 방 · 약관과 같은 상수를 읽고, 없는 본인인증을 약속하지 않는다', () => {
    for (const name of ['TALK_START_NOTE', 'CHAT_USES_NO_CREDIT', 'DETAIL_INTRO', 'SIGNUP_NOTICE_DISCOVERY']) expect(intro).toContain(name);
    expect(read('src/lib/brand/terms.ts')).toContain('인연 찾기와 대화방은 휴대폰 본인확인을 마친 만 19세 이상 이용자만 이용할 수 있습니다');
    expect(intro).not.toMatch(/본인인증|본인확인|성인 확인/);
  });

  it('참여는 로그인 화면의 단계 안내로 잇는다', () => {
    expect(intro).toContain("withReturnPath('/auth', '/me/matching')");
  });
});

describe('앱의 첫 결과 (#940)', () => {
  const chart = read('mobile/src/app/chart.tsx');

  it('사주 카드 → 계산값 한 줄 → 다음 행동 → 만세력 보기 → 표 차례다', () => {
    const order = ['<SelfCard', 'elementsFirstLine(', '<SavePersonForReading', '>만세력 보기<', '{tableOpen && ('].map((mark) => chart.indexOf(mark));
    expect(order.every((at) => at > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('표의 절 열이 모두 접힘 아래에 있다 — 표의 내용을 빼지 않는다', () => {
    const fold = chart.slice(chart.indexOf('{tableOpen && ('));
    for (const part of ['<PillarChart', '<StarTable', '<ElementChart', '<StrengthMeter', '<YongsinCard', '<RelationTable', '<NowOverlaps', '<FortuneTabs', '<TimeCorrections', '<Warnings']) {
      expect(fold).toContain(part);
    }
  });

  it('요약은 계산값만 읽는다 — 서버 · 모델을 부르지 않는다', () => {
    expect(chart).toContain('elementsFirstLine(model.saju.analysis.elements)');
    expect(read('src/lib/saju/view/firstLine.ts')).not.toMatch(/fetch|supabase|import\('/);
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
    /* 계정 줄은 문(`mobile/src/people/self-person.ts`)이 읽는다 — 화면에서는 그 문을 부르는 자리가 관문 뒤다 */
    expect(context.indexOf('readGate()')).toBeLessThan(context.indexOf('readSelfPerson('));
    expect(read('mobile/src/people/self-person.ts')).toContain("from('app_user')");
  });

  it.each(['이 사주가 내 삶에서는 어떤 뜻일까요?', '성향부터 일과 연애, 운의 흐름까지 글로 풀어드려요.'])('로그인 전 다음 행동의 글자는 웹의 것 — %s', (words) => {
    expect(read('app/save-for-reading.tsx')).toContain(words);
    expect(save).toContain(words);
  });

  it('풀이의 로그인 까닭은 풀이권을 말하고 웹의 글자다, 저장의 까닭은 풀이권을 말하지 않는다', () => {
    expect(read('app/save-for-reading.tsx')).toContain(CHART_SIGN_IN.reading.note);
    expect(CHART_SIGN_IN.reading.title).not.toBe(CHART_SIGN_IN.save.title);
    expect(CHART_SIGN_IN.save.note).not.toContain('풀이권');
  });

  it('로그인 전 단추는 누른 일을 주소에 실어 로그인 화면으로 갈 뿐, 저장 · 풀이를 대신 누르지 않는다', () => {
    const card = save.slice(save.indexOf('function SignInCard'), save.indexOf('/** 저장을 누르고 온 사람이'));
    expect(card).toContain("withReturnPath('/auth', chartPath(query, want))");
    expect(card).toContain("signInFor('reading')");
    expect(card).toContain("signInFor('save')");
    expect(card).not.toMatch(/addPerson|saveSelfPerson|start_reading|\/me\/readings/);
  });

  it('로그인 화면 · 돌아온 뒤에 풀이를 요청하거나 풀이권을 쓰는 호출이 없다', () => {
    for (const file of ['mobile/src/app/auth/index.tsx', 'mobile/src/auth/arrive.ts', 'mobile/src/app/chart.tsx', 'mobile/src/app/auth/denied.tsx']) {
      expect(read(file)).not.toMatch(/start_reading|startReading|requestReading|ConfirmMake|addPerson|saveSelfPerson/);
    }
    /* 저장은 효과(useEffect · useFocusEffect)가 아니라 누름에서만 간다 */
    const context = save.slice(save.indexOf('function useSaveContext'), save.indexOf('/**\n * **결과 화면의 다음 행동**'));
    expect(context).not.toMatch(/addPerson|saveSelfPerson/);
  });

  it('누르던 일이 주소를 지난다 — 저장을 누른 사람만 저장 뒤 결과에 남는다', () => {
    expect(chartWantOf(chartPath(DEFAULT_QUERY, 'reading'))).toBe('reading');
    expect(chartWantOf(chartPath(DEFAULT_QUERY, 'save'))).toBe('save');
    expect(chartWantOf(chartPath(DEFAULT_QUERY))).toBeNull();
    expect(chartWantOf('/me/compat?want=save')).toBeNull();
    const auth = new URL(withReturnPath('/auth', chartPath(DEFAULT_QUERY, 'reading')), 'https://local.invalid');
    expect(chartWantOf(safeReturnPath(auth.searchParams.get('next')))).toBe('reading');
    expect(save).toContain("if (want === 'save') onSavedHere();\n      else router.replace('/me/readings/self' as never);");
  });

  it('결과로 돌아갈 때는 스택 아래의 그 화면으로 돌아간다 — 겹치지 않는다', () => {
    expect(read('mobile/src/auth/arrive.ts')).toContain('router.dismissTo(path as never)');
    expect(read('mobile/src/app/auth/index.tsx')).toContain('arriveAt(destination)');
  });

  it.each([
    ['mobile/src/share/start.ts', "withReturnPath('/signup', destination)"],
    ['mobile/src/app/auth/index.tsx', "withReturnPath('/signup', destination)"],
    ['mobile/src/app/me/_layout.tsx', "withReturnPath('/signup', currentPath(pathname, search))"],
    ['mobile/src/app/me/_layout.tsx', "withReturnPath('/auth', currentPath(pathname, search))"],
    ['mobile/src/reading/save-self.tsx', "withReturnPath('/signup', here)"],
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
    expect(read('mobile/src/app/signup.tsx')).toContain('arriveAt(safeReturnPath(next))');
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

/** 약관 셋은 웹의 현행 판을 앱 안 브라우저로 연다(ADR 0172 추기 2026-11-07) — 여는 길은 `info/legal-web.ts` 하나이고 화면은 그것만 부른다 */
describe('약관 셋은 웹의 현행 판을 연다', () => {
  it.each([
    ['mobile/src/settings/settings-screen.tsx', "openLegalPage('/privacy')"],
    ['mobile/src/app/signup.tsx', "openLegalPage('/privacy')"],
    ['mobile/src/credits/credits.tsx', "openLegalPage('/refund')"],
    ['mobile/src/credits/store-section.tsx', "openLegalPage('/refund')"],
  ])('%s', (file, path) => {
    const text = read(file);
    expect(text).toContain(path);
    expect(text).not.toContain('openBrowserAsync');
  });
});

/**
 * **앱은 Android 에서만 Google Play 로 판다**(ADR 0230). 풀이권 부족 창은 Android 에서 판매가 열린 꼴 「풀이권 구매」 · 「닫기」(대장 credits-04)이고,
 * 「풀이권 구매」는 지금 화면과 그 이름을 싣고 `/me/credits` 로 간다 — 결제 완료 창이 그 화면으로 돌려보낸다. iOS 는 아직 팔지 않아 닫힌 꼴(한 줄과 「확인」)이다.
 * 판매가 열렸는지를 묻는 웹의 문(`my_reading_sale_is_open`)은 앱이 부르지 않는다 — 앱의 판매는 그 스위치가 아니라 Play 와 서버의 판정(`store_purchase_refusal`)이다.
 */
describe('앱은 Android 에서만 Google Play 로 판다 (ADR 0230)', () => {
  it('판매 여부는 플랫폼 하나가 가른다 — Android 만', () => {
    expect(read('mobile/src/credits/store.ts')).toMatch(/export const storeAvailable = Platform\.OS === 'android';/);
  });

  it('풀이권 부족 창 — Android 는 「풀이권 구매」 · 「닫기」로 돌아갈 곳을 싣고 상품 화면에, iOS 는 판매가 닫힌 글자', () => {
    const dialogs = read('mobile/src/reading/dialogs.tsx');
    expect(dialogs).toContain("import { storeAvailable } from '@/credits/store';");
    expect(dialogs).toContain('confirmLabel={storeAvailable ? BUY_CREDITS_LABEL : SALE_CLOSED_OK}');
    expect(dialogs).toContain('onConfirm={storeAvailable ? buy : onClose}');
    expect(dialogs).toContain('cancelLabel={storeAvailable ? CREDITS_DIALOG_CLOSE : null}');
    expect(dialogs).toContain('{!storeAvailable && <Text style={styles.line}>{SALE_CLOSED_NOTE}</Text>}');
    expect(dialogs).toMatch(/router\.push\(`\/me\/credits\?back=\$\{back\}&noun=\$\{encodeURIComponent\(noun\)\}`/);
    /* 판매 여부를 다른 값으로 가르지 않는다 — iOS 에 구매 단추가 생기는 길을 막는다 */
    expect(dialogs.match(/BUY_CREDITS_LABEL/g)?.length).toBe(2);
  });

  it('상품 화면의 구매 판은 Android 에서만 선다', () => {
    expect(read('mobile/src/credits/credits.tsx')).toContain('{storeAvailable && <StoreSection');
  });

  it('웹의 판매 스위치 문은 앱이 부르지 않는다 · 인연 쪽에는 구매 단추가 없다', () => {
    expect(read('mobile/src/reading/api.ts')).not.toContain('my_reading_sale_is_open');
    expect(read('mobile/src/matching/today.tsx')).not.toContain('BUY_CREDITS_LABEL');
    expect(read('mobile/src/matching/doors.ts')).not.toContain('my_reading_sale_is_open');
  });
});

describe('인연 탭', () => {
  it('덱을 읽기 전에 참여를 열고 못 열면 까닭을 낸다', () => {
    const doors = read('mobile/src/matching/doors.ts');
    const deck = doors.slice(doors.indexOf('export function readDeck'));
    expect(deck.indexOf('openParticipation(client)')).toBeGreaterThan(-1);
    expect(deck.indexOf('openParticipation(client)')).toBeLessThan(deck.indexOf("rpc('my_discovery_board')"));
    expect(deck).toContain('saveFailureOf(opened)');
  });
});
