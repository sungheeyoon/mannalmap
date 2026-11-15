/**
 * **웹과 앱이 함께 거는 코드 규칙의 몸** (ADR 0086, `docs/agents/code-rules/locks.md`).
 *
 * 뿌리 `eslint.config.mjs` 와 앱 `mobile/eslint.config.js` 가 이 한 벌을 읽는다 — 두 설정이 저마다 적으면 한쪽만 고쳐진다.
 * 어느 규칙을 어디에 거는지(앱의 라우트는 `export default` 가 필요하다 같은 갈림)는 두 설정이 저마다 정하고, 여기는 규칙의 값만 든다.
 * CommonJS 인 까닭은 앱 설정이 `require` 로 읽어서다. 이 파일이 바뀌면 앱 차선도 돈다(`scripts/ci-plan.mjs` 의 `MOBILE_REACH`).
 */

/**
 * **모양은 셋뿐이다** — `type`(interface 0건), 상수 표, 함수. 제 손으로 짓는 클래스가 하나 생기면 그 안의 판단은 vitest 가 닿기
 * 어려운 자리로 들어간다(ADR 0080 의 같은 결). 어느 내장을 잇는지는 `scripts/code-rules.test.ts` 가 이름으로 든다.
 */
const CODE_SHAPE = [
  { selector: 'TSEnumDeclaration', message: 'enum 을 쓰지 않는다 — 문자열 리터럴 유니언으로 적는다 (CODING_STANDARDS.md)' },
  {
    selector: 'ClassDeclaration:not([superClass]), ClassExpression:not([superClass])',
    message: 'class 는 내장(Error·Date)을 잇는 자리에만 쓴다 — 나머지는 type 과 함수다 (CODING_STANDARDS.md)',
  },
];

/** 코드에 남기는 미결은 표시가 아니라 간극 대장의 `G-nn` 줄이나 이슈다(`docs/agents/code-rules/comments.md`) */
const NO_LOOSE_ENDS = ['error', { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'anywhere' }];

/** 찍어 보는 `console.log` 는 없다 — 기록에 남기는 `error` · 지나간 일의 `warn` 만(`docs/agents/code-rules/failures.md` 「`console`」) */
const NO_CONSOLE = ['error', { allow: ['error', 'warn'] }];

module.exports = { CODE_SHAPE, NO_LOOSE_ENDS, NO_CONSOLE };
