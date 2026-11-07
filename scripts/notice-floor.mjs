import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 정의 — 대소문자를 가리지 않는다(`pg_dump` 꼴의 `CREATE OR REPLACE FUNCTION` 도 정의다) */
const CREATED = /create\s+(?:or\s+replace\s+)?function\s+public\.notice_ack_floor\(\)/gi;

/**
 * 마이그레이션 한 파일의 글에서 **마지막 `notice_ack_floor()` 정의가 돌려주는 판본** — 정의가 없으면 `null`.
 *
 * @param {string} source 마이그레이션 글
 * @returns {string | null} `notice-v18` 꼴
 */
export function noticeFloorOf(source) {
  const created = [...source.matchAll(CREATED)].at(-1);
  if (created === undefined) return null;
  const body = source.slice(created.index);
  const found = /select\s+'(notice-v[1-9]\d*)'::text/i.exec(body.slice(0, body.indexOf('$$;')));
  return found === null ? null : found[1];
}

/**
 * **서버의 재확인 기준** — 마지막으로 `public.notice_ack_floor()` 를 정의한 마이그레이션이 돌려주는 판본(ADR 0237).
 *
 * 웹 · 앱은 이 값을 상수로 들지 않고 일정의 문(`current_beta_schedule()` 의 `notice_ack_floor`)으로 읽는다. 시험만 원본을 읽는다 —
 * 웹 · 앱이 보내는 판본(`NOTICE_VERSION`)이 이 값보다 낮으면 가입이 다 거절되므로, 그 둘을 견주려고.
 *
 * @param {string} root 저장소 뿌리
 * @returns {string} `notice-v18` 꼴. 못 찾으면 던진다
 */
export function serverNoticeFloor(root = process.cwd()) {
  const dir = join(root, 'supabase/migrations');
  const last = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .filter((name) => new RegExp(CREATED.source, 'i').test(readFileSync(join(dir, name), 'utf8')))
    .at(-1);
  if (last === undefined) throw new Error('public.notice_ack_floor() 를 정의한 마이그레이션이 없다');
  const floor = noticeFloorOf(readFileSync(join(dir, last), 'utf8'));
  if (floor === null) throw new Error(`${last} 의 public.notice_ack_floor() 에서 판본을 못 읽었다`);
  return floor;
}
