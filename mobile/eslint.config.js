const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/**
 * 앱의 린트 — `expo lint`. 뿌리의 린트는 `mobile/` 을 안 본다.
 * 시험(`*.test.ts`)은 뿌리의 vitest 가 돌린다(ADR 0243) — 앱의 차선에는 `vitest` 가 없어 `import/no-unresolved` 로 선다.
 */
module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', '**/*.test.ts']),
  expoConfig,
]);
