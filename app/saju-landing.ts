import { SAJU_PATH } from '@/src/lib/consent';
import { queryFromSearchParams } from '@/src/lib/input/query';

import { RESUME_DRAFTS } from './reading-draft';

/**
 * **세션이 갈라 세우는 두 주소**(ADR 0144) — `/` 는 로그인 전 첫 화면, `/saju` 는 로그인한 사람의 계산 자리다.
 *
 * 두 화면은 미리 그려지고 세션을 브라우저에서 안다 — 여기서 고른 주소로 그 화면이 `replace` 로 옮긴다(방문 기록에 떠난
 * 주소가 안 남는다). `#` 뒤는 서버에 안 오므로(ADR 0007) 옮기는 것도 브라우저가 한다.
 */

/** 주소창의 두 조각 — `window.location` 의 그 이름 그대로(`?…` · `#…`, 없으면 빈 문자열) */
type Address = { search: string; hash: string };

/**
 * **「로그인 없이 사주 보기」를 고른 자리의 표식**(ADR 0226) — `/#start`. 로그인 전 첫 화면은 소개가 먼저이고, 이 표식이 서야
 * 입력 폼이 선다. 주소에 싣는 까닭은 뒤로 가기다 — 폼에서 뒤로 가면 소개로, 결과에서 뒤로 가면 빈 폼으로 온다.
 * 입력이 아니라 계산기는 빈 폼으로 읽는다(`queryFromSearchParams` 가 `null`).
 */
export const TRIAL_MARK = 'start';

/** 체험으로 바로 여는 주소 — 서비스 소개 · 열 수 없는 공유 링크의 「무료로 내 사주 보기」가 든다 */
export const TRIAL_PATH = `/#${TRIAL_MARK}`;

/**
 * 로그인한 사람이 `/` 에 왔을 때 — 입력을 든 주소면 `/saju` 에 그 입력째, 아니면 홈.
 *
 * `#` 뒤는 무엇이든 그대로 싣는다 — 계산 입력이든 이어 보기 낱말(`resume-reading`)이든 가르지 않는다. 옛 `?` 링크는
 * 입력으로 읽히는 것만 싣는다(`hash-query.ts` 가 그 링크를 읽는다) — 입력이 아닌 쿼리만 든 `/` 는 홈이다. 체험 표식은
 * 입력이 아니라 빈 계산 자리로 간다.
 */
export function memberLandingOf({ search, hash }: Address): string {
  if (hash === `#${TRIAL_MARK}`) return SAJU_PATH;
  if (hash.length > 1) return `${SAJU_PATH}${search}${hash}`;
  if (search.length > 1 && queryFromSearchParams(new URLSearchParams(search)) !== null) return `${SAJU_PATH}${search}`;
  return '/me';
}

/** 로그인하지 않은 사람이 `/saju` 에 왔을 때 — 같은 쿼리와 `#` 뒤를 들고 첫 화면으로 */
export function visitorLandingOf({ search, hash }: Address): string {
  return `/${search}${hash}`;
}

/**
 * 로그인 전 첫 화면이 **소개**를 세울지 **체험**(입력 · 결과)을 세울지(ADR 0226) — 주소가 든 값(`useHashParams`)만 본다.
 *
 * 체험은 체험 표식 · 입력으로 읽히는 값(결과 링크 · 옛 `?` 링크) · 로그인을 다녀온 낱말(`resume-reading`)이다. 입력이 아닌 값
 * (`?utm_source=…` · 모르는 `#` 뒤)은 소개다 — 광고 링크로 온 사람도 소개부터 본다.
 */
export function firstScreenStageOf(params: URLSearchParams): 'intro' | 'trial' {
  if (params.has(TRIAL_MARK)) return 'trial';
  if ([...params.keys()].some((key) => Object.hasOwn(RESUME_DRAFTS, key))) return 'trial';
  return queryFromSearchParams(params) !== null ? 'trial' : 'intro';
}
