/**
 * **웹의 주소 — 앱에서 `EXPO_PUBLIC_SITE_URL` 을 읽는 유일한 자리.** 앱의 문 · 사진 문 · 공유 주소 · 약관 셋(웹의 현행 판을 연다, ADR 0172 추기 2026-11-07)이 이 값을 쓴다.
 *
 * 없으면 `null` 이다 — 풀이는 「닿지 못했다」로 서고 약관 셋의 줄이 서지 않는다. 그래서 출시 빌드(EAS 의 `production`)는 이 값이
 * 없으면 `app.config.js` 에서 선다. 개발 · 가짜 서버로 재는 빌드는 그 검사를 안 밟는다(`docs/agents/delegation/local-env.md`).
 * 값은 빌드에 박힌다 — `process.env.EXPO_PUBLIC_…` 을 점으로 바로 읽어야 Expo 가 갈아 끼운다.
 */
const raw = process.env.EXPO_PUBLIC_SITE_URL;

export const SITE_URL: string | null = raw ? raw : null;
