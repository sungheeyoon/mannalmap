const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const { CODE_SHAPE, NO_LOOSE_ENDS, NO_CONSOLE } = require('../eslint-code-rules.cjs');

/**
 * 앱의 린트 — `expo lint`. 뿌리의 린트는 `mobile/` 을 안 본다.
 * 시험(`*.test.ts`)은 뿌리의 vitest 가 돌린다(ADR 0243) — 앱의 차선에는 `vitest` 가 없어 `import/no-unresolved` 로 선다.
 *
 * **웹의 코드 규칙 가운데 앱에 맞는 것만 건다**(`docs/agents/code-rules/locks.md` 「린트가 잠근 것 · 시험이 잠근 것」). 값은 웹과 한 벌이다
 * (`eslint-code-rules.cjs`). 안 거는 것과 까닭:
 * - 층의 방향 · 화면의 DB 호출 · 열쇠 · 모델 자리(`eslint.config.mjs`) — 웹의 폴더(`src/lib` · `app/`)를 두고 짠 규칙이다. 앱의 것은
 *   시험이 든다(`scripts/mobile-closure.test.ts` · `scripts/mobile-screen-db.test.ts` · `scripts/mobile-supabase-env.test.ts`)
 * - `export default` 금지는 `src/app` 밖에만 — Expo Router 는 라우트 파일의 default export 를 화면으로 읽는다
 */
const SOURCE = '{ts,tsx,js,jsx,mjs,cjs}';

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', '**/*.test.ts']),
  expoConfig,
  {
    /** 안 걸리는 예외 표시는 지운다 — 남겨 두면 다음 사람이 그 줄을 또 끈다 */
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    /** 모양 · 미결 — 앱의 소스와 재기 도구 */
    files: [`src/**/*.${SOURCE}`, `scripts/**/*.${SOURCE}`],
    rules: {
      'no-restricted-syntax': ['error', ...CODE_SHAPE],
      'no-warning-comments': NO_LOOSE_ENDS,
    },
  },
  {
    /** `interface` → `type` — 타입 규칙의 플러그인은 `.ts` · `.tsx` 에만 걸려 있다(`eslint-config-expo`) */
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/consistent-type-definitions': ['error', 'type'] },
  },
  {
    /** 찍어 보는 자리는 재기 도구(`scripts/`)뿐이다 */
    files: [`src/**/*.${SOURCE}`],
    rules: { 'no-console': NO_CONSOLE },
  },
  {
    files: [`src/**/*.${SOURCE}`],
    ignores: ['src/app/**'],
    rules: { 'import/no-default-export': 'error' },
  },
]);
