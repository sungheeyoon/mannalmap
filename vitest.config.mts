import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vitest/config';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(ROOT, 'mobile');

/**
 * **앱(`mobile/src`)의 문도 여기서 돈다**(ADR 0244) — 앱의 별칭은 제 `mobile/tsconfig.json` 이 든다(`@/` 가 `mobile/src` 다).
 *
 * vite 의 `tsconfigPaths` 는 가장 가까운 tsconfig 를 읽는데, 앱의 것은 `expo/tsconfig.base` 를 이어받아 `mobile/node_modules` 가 없는
 * `core` 차선에서는 변환부터 선다(2026-11-08 잼 — `TSCONFIG_ERROR`). 그래서 변환은 뿌리 tsconfig 하나로 하고(`tsconfig`), 앱 파일이
 * 부르는 별칭만 이 손이 앱의 `paths` 로 푼다. `paths` 는 이어받기 없이 그 파일에 적혀 있다.
 */
function mobileAliases(): Plugin {
  const config = JSON.parse(readFileSync(resolve(MOBILE, 'tsconfig.json'), 'utf8')) as {
    compilerOptions: { paths: Record<string, string[]> };
  };
  const rules = Object.entries(config.compilerOptions.paths).map(([key, [target]]) => ({
    prefix: key.replace(/\*$/, ''),
    wildcard: key.endsWith('*'),
    target: resolve(MOBILE, target.replace(/\*$/, '')),
  }));
  /* 긴 이름이 먼저 — `@brand/guide` 가 `@brand/*` 보다, `@/assets/*` 가 `@/*` 보다 */
  rules.sort((a, b) => b.prefix.length - a.prefix.length);
  return {
    name: 'mobile-aliases',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (importer === undefined || !importer.startsWith(MOBILE + sep)) return null;
      const rule = rules.find((one) => (one.wildcard ? source.startsWith(one.prefix) : source === one.prefix));
      if (rule === undefined) return null;
      const target = rule.wildcard ? resolve(rule.target, source.slice(rule.prefix.length)) : rule.target;
      return this.resolve(target, importer, { skipSelf: true });
    },
  };
}

export default defineConfig({
  plugins: [mobileAliases()],
  /* 변환이 읽는 tsconfig — 뿌리 하나다. 앱 파일도 이것으로 변환한다(위 `mobileAliases`) */
  tsconfig: resolve(ROOT, 'tsconfig.json'),
  resolve: {
    // tsconfig.json 의 paths ("@/*") 를 그대로 사용
    tsconfigPaths: true,
    /**
     * **`server-only` 은 Next 가 풀어 주는 이름이다**(G-23 ⑧). 비밀을 읽는 모듈 셋이 첫 줄에
     * 들고, Next 는 서버 층에서 빈 모듈로, 브라우저 층에서 빌드 오류로 푼다. vitest 는 그 층을
     * 모르므로 Next 의 빈 모듈을 그대로 가리킨다 — 시험은 서버에서 도는 코드를 잰다.
     */
    alias: {
      'server-only': fileURLToPath(new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    // 순수 TS 로직 테스트 — DOM 불필요
    environment: 'node',
    // Playwright E2E는 별도 러너에서 실행한다.
    // app/ 은 화면이지만 주소창 코덱처럼 JSX 없는 순수 모듈은 여기서 함께 돈다.
    /**
     * **검사 도구 자신도 시험 사정권 안에 있다.**
     *
     * `scripts/` 는 여태 밖이었다. 그동안 흐름 검사를 묶는 자리에는 아무 시험도 없었고,
     * `&&` 사슬이 뒤 검사를 통째로 건너뛰는 것을 **아무도 못 봤다**(`run-checks.test.ts`).
     *
     * **앱의 문(`mobile/src`)도 같다**(ADR 0244) — 클라이언트를 인자로 받으므로 가짜 클라이언트로 돈다. react-native 를 들이는 화면 ·
     * 훅은 여기서 못 돌고, 그런 파일을 부르는 시험은 쓰지 않는다. 앱의 `tsc` 는 `vitest` 가 없어 시험 파일을 빼고 읽는다(`mobile/tsconfig.json`).
     */
    include: ['src/**/*.test.ts', 'app/**/*.test.ts', 'scripts/**/*.test.ts', 'mobile/src/**/*.test.ts'],
    /**
     * **CI 는 느리다.**
     *
     * 여기 몇몇은 자료를 전수로 훑는다 — 1900~2100 하루 단위 tzdb 대조, 음력 표
     * 왕복, 대운 무작위 500건. 이 기계에서 가장 오래 걸리는 것이 3.3초라 기본 5초에
     * 아슬아슬하게 들어가는데, 공유 러너에서는 넘어간다. 실제로 그것 때문에 배포
     * 브랜치 검증이 빨간불이었다.
     *
     * 늘리는 것은 무엇을 재는지를 바꾸지 않는다 — 안 끝나는 것은 여전히 안 끝난다.
     *
     * **모집단 3000건을 도는 시험은 제 시간을 직접 든다**(`POPULATION_TIMEOUT_MS`).
     * 통관·대조·서열의 보정값이 그것인데, 그 셋 때문에 여기를 넓히면 나머지 1500여
     * 시험의 달아남을 잡는 자리가 함께 헐거워진다.
     */
    testTimeout: process.env.CI ? 30_000 : 5_000,
  },
});
