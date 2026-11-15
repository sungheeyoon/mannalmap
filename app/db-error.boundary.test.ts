import { readFileSync } from 'node:fs';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { asPosix, filesUnder } from './ui/source-files';

/**
 * **영어 원문이 사용자 화면에 서는 길이 있는가** (#67).
 *
 * `userFacingDbMessage` 는 잘 지어졌는데 **두 자리에서만** 불렸다. 나머지 서른 몇 자리가
 * `error.message` 를 그대로 냈고, 그래서 `42883`·`42501`·`PGRST202` 의 영어 원문이 화면에
 * 섰다 — 사용자는 할 수 있는 것이 없고 그 문장은 우리 스키마의 속을 말한다.
 *
 * 고친 뒤에 남는 문제는 **되돌아오는 것**이다. 서버 액션을 새로 하나 쓰면서
 * `if (error) return { ok: false, message: error.message }` 를 적는 것이 가장 짧은 길이고,
 * 그 줄은 아무 시험에도 안 걸린다. 화면에는 글자가 서고, 영어라는 것은 그 오류가 실제로
 * 날 때까지 아무도 모른다.
 *
 * 그래서 원본을 읽어서 잠근다. 이 시험이 재는 것은 계산이 아니라 **배선**이다.
 *
 * ## 목록이 줄어든 날
 *
 * 저장된 입력을 세우는 문이 못 읽는 입력을 **값으로** 내면서(`storedChartOf`) 화면 넷이
 * 여기서 빠졌다 — `/me` · 사람 목록 · 사람 상세 · 궁합. 넷 다 `instanceof` 로 예외를 받아
 * `error.message` 를 직접 집던 자리였다. **예외를 값으로 바꾸면 이 목록이 짧아진다**는
 * 것이 그 변경이 남긴 값이다.
 *
 * ## 이름이 `error` 가 아니어도 (2026-09-25)
 *
 * 처음 낱말은 `error.message` 하나였다. 공유 버튼은 받은 거절을 `failure` 라고 부르고
 * `failure.message` 를 화면에 세웠는데 이 시험을 지나갔다 — 서버 액션이 **던지면** 운영의
 * Next 는 그 문장을 영어 안내로 바꿔 보내므로, 그 영어가 그대로 섰다. 그래서 이름을 안 보고
 * **잡은 것**을 본다: `catch (x)` · `.catch((x) => …)` 로 받은 이름의 `.message` 를 센다.
 * 액션이 값으로 낸 `result.message` 는 우리가 쓴 문장이라 세지 않는다.
 *
 * ## 앱도 (ADR 0243)
 *
 * Expo 앱(`mobile/src`)은 같은 `userFacingDbMessage` 를 부르고(`@db-error`) 같은 규칙을 진다 — 앱에는 운영의 Next 같은 덮개도 없어
 * 던진 문장이 그대로 `FailureLine` 에 선다. 잡은 이름은 `.then(성공, 실패)` 의 둘째 함수도 센다 — 앱의 채팅방 문이
 * `(failure: Error) => failure.message` 로 이 시험을 지나갔다. 잡은 이름은 구문 나무로 모은다(`caughtNames`).
 */

const ROOTS = ['app', 'src', 'mobile/src'];
const CODE = /\.tsx?$/;

/** 우리가 안 쓴 문장이 사용자에게 가는 모양 — 오류의 `message` 를 직접 집는다 */
const RAW = /\berror\.message\b|\bError\.message\b/;

/** 함수의 첫 인자 이름 — `(x) => …` · `function (x) {…}` 만. 구조분해는 이름이 아니다 */
const firstParamName = (node: ts.Node | undefined): string | null =>
  node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && node.parameters[0] !== undefined && ts.isIdentifier(node.parameters[0].name)
    ? node.parameters[0].name.text
    : null;

/** 잡은 것에 붙인 이름 — `catch (failure)` · `.catch((thrown) => …)` · `.then(ok, (failure) => …)` 의 실패 쪽 */
function caughtNames(path: string, text: string): Set<string> {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const names = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isCatchClause(node) && node.variableDeclaration !== undefined && ts.isIdentifier(node.variableDeclaration.name)) {
      names.add(node.variableDeclaration.name.text);
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const handler = method === 'catch' ? node.arguments[0] : method === 'then' ? node.arguments[1] : undefined;
      const name = firstParamName(handler);
      if (name !== null) names.add(name);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

/** 그 파일에서 잡은 이름의 `message` 를 집는가 — 이름이 무엇이든 */
function readsCaughtMessage(path: string, text: string): boolean {
  // `x.message` 의 `x` 가 함수 인자 · `catch` 이름처럼 서는 파일만 나무를 짓는다 — 웹 · 앱 전부를 지으면 이 시험이 5초를 넘는다
  const read = new Set([...text.matchAll(/([A-Za-z_$][\w$]*)\.message\b/g)].map((match) => match[1]));
  const escape = (name: string) => name.replaceAll('$', '\\$');
  const bound = [...read].filter((name) => new RegExp(`[(,]\\s*${escape(name)}\\s*[:),=]|\\b${escape(name)}\\s*=>`).test(text));
  if (bound.length === 0) return false;
  const caught = caughtNames(path, text);
  return bound.some((name) => caught.has(name));
}

const rawIn = (path: string, text: string) => RAW.test(text) || readsCaughtMessage(path, text);

/**
 * **그대로 집어도 되는 자리와 그 까닭.**
 *
 * 목록이지 예외가 아니다 — 새 파일이 여기 들어오려면 까닭을 적어야 하고, 까닭을 적다 보면
 * 대개 「한 문을 지나면 된다」는 답이 나온다.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  'src/lib/matching/requests.ts': '문장을 세우지 않는다 — 풀이권이 없어 막힌 거절인지 앞머리로 가르기만 하고, 세우는 문장은 `userFacingDbMessage` 가 짓는다(ADR 0171 「덧」)',
  'app/db-error.ts': '한 문 그 자체 — 여기서 가른다',
  'app/db-error.test.ts': '그 문을 재는 시험',
  'app/db-error.boundary.test.ts': '이 시험이 찾는 낱말을 스스로 들고 있다',

  /* 오류 경계 — 여기 닿는 Error 는 이미 한 문을 지나 우리말이다(`dbFailure`) */
  'app/me/requests/page.tsx': '오류 경계 — 던지는 자리가 이미 번역한 Error 를 세운다',

  /* 엔진이 우리말로 내는 오류 — DB 거절이 아니다 */
  'src/lib/input/chart.ts': '명식 계산 실패 — 엔진 오류지 DB 거절이 아니다',
  'src/lib/input/stored.ts': 'UnreadableInputError · LunarConversionError 만 옮긴다 — 둘 다 우리말이다',
  'app/me/reading/preview.ts': 'ReadingEvidenceError 만 옮긴다 — `src/lib/reading` 이 우리말로 낸다',

  /* 사용자 화면이 아닌 자리 */
  'app/me/reading/pipeline.ts': '화면이 아니라 DB 에 적는다(`p_failure_detail`)',
  'app/me/reading/press.ts': '맛보기를 잇다가 던진 까닭 — 답에 안 싣고 기록에만 남긴다(`pipeline.ts` 에서 뗀 자리, ADR 0211)',
  'app/me/reading/submit.ts': '화면이 아니라 DB 에 적는다(`p_failure_detail`)',
  'app/me/reading/generator.ts': '`detail` 은 화면이 아니라 DB 에 적힌다(`pipeline.ts`)',
  'app/me/reading/model.ts': 'provider 의 문장 — `detail` 로 DB 에만 간다',
  'app/me/reading/collect.ts': 'webhook 수집기 — 사람이 보는 화면이 없다',
  'app/taste/keyed-taste.ts': '열쇠가 없는 배포의 까닭 — 기록에만 가고 화면은 「실패」로 선다(ADR 0143)',
  'app/taste/keyed-taste-claims.ts': '같다 — 귀속을 못 하면 보통 풀이로 간다',
  'app/taste/taste-carry.ts': '「아까 보던 내용」을 못 세운 까닭 — 기록에만 가고 그 칸만 빈다',
  'app/api/health/route.ts': '바깥 감시의 상태 문 — 원문은 함수 로그에만 가고 답은 `unavailable` 한 낱말이다(G-118)',

  /* 앱 — 원문은 기록(`console.error`)에만 가고 화면에는 우리가 쓴 문장이 선다 */
  'mobile/src/auth/apple.ts': '애플 로그인 거절의 원문 — 기록에만 가고 화면은 `FAILED` 다',
  'mobile/src/auth/kakao.ts': '카카오 로그인 거절의 원문 — 기록에만 가고 화면은 `FAILED` 다',
  'mobile/src/auth/sign-in.ts': '로그인 · 로그아웃 거절의 원문 — 기록에만 가고 화면은 `FAILED` 다',
  'mobile/src/push/device.ts': '푸시 토큰 · 권한을 못 얻은 까닭 — 기록에만 가고 화면에 서는 문장이 없다',
};

const sourceFiles = (dir: string): string[] => filesUnder(dir).filter((path) => CODE.test(path));

describe('DB 거절은 한 문을 지난다', () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root)).map((path) => ({
    path: asPosix(path),
    text: readFileSync(path, 'utf8'),
  }));

  it('오류 원문을 직접 집는 파일은 까닭이 적힌 것들뿐이다', () => {
    const raw = files
      .filter(({ path, text }) => rawIn(path, text))
      .map(({ path }) => path)
      .sort();

    expect(raw).toEqual(Object.keys(ALLOWED).sort());
  });

  /**
   * **목록이 실물보다 오래 살지 않게.** 지워진 파일 이름이 남아 있으면 그 줄은 아무것도
   * 안 잠그면서 잠그는 것처럼 읽힌다.
   */
  it('까닭이 적힌 파일은 다 실재한다', () => {
    const present = new Set(files.map(({ path }) => path));

    expect(Object.keys(ALLOWED).filter((path) => !present.has(path))).toEqual([]);
  });

  /**
   * **서버 액션은 하나도 없다.** 위 목록이 길어지는 것 자체는 막지 않지만, 사용자가 누른
   * 결과로 도는 자리가 거기 끼면 그것은 곧 화면에 서는 글자다.
   */
  it('사용자가 누르는 자리는 목록에 없다', () => {
    const actions = Object.keys(ALLOWED).filter((path) => path.endsWith('actions.ts'));

    expect(actions).toEqual([]);
  });

  it('잡은 이름은 `catch` 절 · `.catch` · `.then` 의 실패 쪽 셋에서 모은다', () => {
    const text = [
      'try { go(); } catch (a) { show(a); }',
      'go().catch((b) => b);',
      'go().catch(function (c) { return c; });',
      'go().then((ok) => ok, (d: Error) => d);',
      'go().then((e) => e);',
    ].join('\n');

    expect([...caughtNames('x.ts', text)].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
