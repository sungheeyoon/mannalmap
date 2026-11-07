import { isBlocked, type AccountState } from '@account/index';
import { rpcArgs } from '@db';
import { userFacingDbMessage } from '@db-error';
import { mySurveyOf, surveyContextOf, surveyRequest, type MySurvey, type SurveyAnswers, type SurveyContext } from '@survey';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';

import { readAccount } from './settings';

type Row = Record<string, unknown>;
export type SaveAnswer = { ok: true; submittedAt: string | null } | { ok: false; message: string };
export type Loaded = { kind: 'blocked'; state: AccountState } | { kind: 'failed' } | { kind: 'ready'; context: SurveyContext; given: MySurvey | null };

/**
 * **서비스 설문을 읽는 앱의 문 — 앱에서 `service_survey_context` · `my_service_survey` 를 부르는 유일한 자리**(G-143).
 * 줄을 옮기는 것은 웹의 문(`app/me/survey/read.ts`)과 같은 `surveyContextOf` · `mySurveyOf` 다.
 *
 * 못 읽은 것을 「아직 안 썼다」로 내면 빈 칸으로 열리고 적어 둔 글이 덮인다 — 어느 하나라도 못 읽으면 실패 줄이다(웹 `read.ts`).
 */
export async function loadSurvey(): Promise<Loaded> {
  const { state } = await readAccount<{ status: string }>('status');
  if (isBlocked(state)) return { kind: 'blocked', state };
  if (supabase === null) return { kind: 'failed' };
  const [context, given] = await Promise.all([supabase.rpc('service_survey_context'), supabase.rpc('my_service_survey')]);
  if (context.error !== null || given.error !== null) return { kind: 'failed' };
  const contextRow = ((context.data ?? []) as Row[])[0];
  if (contextRow === undefined) return { kind: 'failed' };
  const givenRow = ((given.data ?? []) as Row[])[0];
  return { kind: 'ready', context: surveyContextOf(contextRow), given: givenRow === undefined ? null : mySurveyOf(givenRow) };
}

/** 초안 · 제출을 적는다 — 보내는 값은 웹의 문(`app/me/survey/actions.ts`)과 같은 `surveyRequest` 가 짓는다 */
export async function saveSurvey(answers: SurveyAnswers, submit: boolean): Promise<SaveAnswer> {
  if (supabase === null) return { ok: false, message: NOT_READY };
  const { data, error } = await supabase.rpc('save_service_survey', rpcArgs<'save_service_survey'>(surveyRequest(answers, submit)));
  return error !== null ? { ok: false, message: userFacingDbMessage(error, 'save_service_survey') } : { ok: true, submittedAt: (data as string | null) ?? null };
}
