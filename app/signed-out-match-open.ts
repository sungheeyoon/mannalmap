import 'server-only';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { supabaseEnv } from './auth/config';
import { matchOpenForSignedOut } from './match-opening';

/**
 * 미리 그려지는 로그인 전 화면(첫 화면 · 서비스 소개)이 묻는 인연의 열림 — 그리는 서버가 세션 없이 한 번 묻는다. 못 읽었으면
 * 닫힌 쪽(`false`)이고 로그를 남기지 않는다(`matchOpenForSignedOut`). 인연 카드가 「준비 중」 글을 세울지 고른다(대장 all-10).
 *
 * 브라우저에서 묻지 않는 까닭 — DB 가 안 닿으면 로그인 전 화면의 콘솔에 요청 실패가 선다(`e2e/saju.spec.ts` 가 빈 콘솔을 잰다,
 * DB 없는 익명 차선에서 처음 걸렸다). 화면은 `revalidate` 로 다시 그려져 여닫음을 따라간다.
 */
export async function matchOpenWhilePrerendered(): Promise<boolean> {
  const { url, publishableKey } = supabaseEnv();
  return matchOpenForSignedOut(
    createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}
