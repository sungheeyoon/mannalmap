/**
 * **Supabase 의 주소와 공개 키 — 앱에서 `EXPO_PUBLIC_SUPABASE_URL` · `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 를 읽는 유일한 자리**
 * (`mobile/src/site.ts` 와 같은 꼴). 로그인 세션을 드는 클라이언트(`auth/client.ts`)와 세션 없는 공유본 클라이언트(`share/read.ts`)가 이 값을 쓴다.
 *
 * 둘 중 하나라도 없으면 `null` 이다 — 설정 전에도 계산 화면은 서고, 로그인 자리가 까닭을 말한다.
 * 값은 빌드에 박힌다 — `process.env.EXPO_PUBLIC_…` 을 점으로 바로 읽어야 Expo 가 갈아 끼운다.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_ENV: { readonly url: string; readonly publishableKey: string } | null =
  url && publishableKey ? { url, publishableKey } : null;
