/**
 * **문이 이름 없이 막았을 때 서는 문장** — 세션이 끝났거나 정책이 막았다(`app/db-error.ts` 가 `28000` · `42501` · `PGRST301` 에 세운다).
 *
 * 이 문장이 든 실패 줄(`app/ui/failure-line.tsx`)은 곁에 「다시 로그인」 링크를 단다(ADR 0164 「덧」). 줄이 문장을 알아보려면 같은 값을 들어야
 * 하고, 부품은 `app/` 의 다른 파일을 모르므로(ADR 0085) 문장이 `src/lib` 에 산다 — 앱(`mobile/src/settings/parts.tsx`)도 같은 값을 들고,
 * 그래서 앱이 `app/` 에서 닿는 파일은 `app/db-error.ts` 하나다(`scripts/mobile-closure.test.ts`). 클라이언트 표지가 없는 파일이라 서버 쪽에서 들여도 값이다.
 */
export const SIGN_IN_AGAIN_NOTE = '이 작업을 할 권한이 없어요. 다시 로그인한 뒤 시도해 주세요.';
