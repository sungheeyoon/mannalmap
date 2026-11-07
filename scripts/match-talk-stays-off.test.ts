import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { NOTICE_ACK_FLOOR, NOTICE_VERSION, noticeAckHolds, noticeFor } from '../src/lib/consent/notice';

/**
 * **대화가 유일한 흐름이다**(`20270109090000`) — 스위치 표가 지워진 채 남고, 새 화면은 요청 문에 기대 종류를 싣지 않는다.
 * 흐름은 `supabase/tests/99_match_talk_and_detail.test.sql` 이, 남긴 임시 호환 인자는 `99_match_request_expected_kind.test.sql` 이 잰다.
 */
const migrationsDir = join(process.cwd(), 'supabase/migrations');
const migrations = readdirSync(migrationsDir).sort().map((name) => ({ name, text: readFileSync(join(migrationsDir, name), 'utf8') }));

describe('대화의 스위치는 없다', () => {
  it('마지막으로 스위치를 만지는 마이그레이션이 그 표를 지운다', () => {
    const touching = migrations.filter(({ text }) => /public\.match_talk_switch\b/.test(text));
    expect(touching.at(-1)?.text).toContain('drop table public.match_talk_switch;');
  });
});

/** **새 화면은 기대 종류를 안 싣는다** — 인자는 깔린 옛 앱의 임시 호환이다(그 마이그레이션 머리말의 제거 조건) */
describe('화면의 요청 문은 상대만 싣는다', () => {
  const sourceOf = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
  const callsOf = (text: string) => text.match(/\.rpc\('request_match',\s*\{[^}]*\}/g) ?? [];

  it.each([
    ['app/me/discovery/actions.ts', [undefined]],
  ])('%s', (path, kinds) => {
    expect(callsOf(sourceOf(path)).map((call) => /p_expected_kind: '(\w+)'/.exec(call)?.[1])).toEqual(kinds);
  });

  it('다른 화면 코드는 이 문을 안 부른다', () => {
    const callers = (dir: string): string[] =>
      readdirSync(join(process.cwd(), dir), { withFileTypes: true, recursive: true })
        .filter((one) => one.isFile() && /\.tsx?$/.test(one.name) && !/\.test\./.test(one.name))
        .map((one) => join(one.parentPath, one.name))
        .filter((path) => /\.rpc\('request_match'/.test(readFileSync(path, 'utf8')))
        .map((path) => path.replace(`${process.cwd()}/`, ''));
    expect([...callers('app'), ...callers('mobile/src')].sort()).toEqual(['app/me/discovery/actions.ts', 'mobile/src/matching/talk-doors.ts']);
  });
});

/** 대화가 유일한 흐름이 된 판이다 — `docs/legal/match-talk-notice-draft.md` 「켜는 날의 차례」 6. 판을 다시 올리면 이 시험을 함께 고친다 */
describe('게시 고지는 대화 · 상세 궁합의 판이다', () => {
  const operator = { name: '만세력 운영자', officer: '홍길동', contact: 'ops@example.com' };
  const noticeText = () => JSON.stringify(noticeFor(operator));

  /* v13 은 대화 · 상세 궁합과 무관한 내용 개정이다(애플 로그인 · 이용 정지 기록, ADR 0220) — 대화 · 상세 궁합의 판은 그 위의 v14 다 */
  it('내용 개정이라 판본과 재확인 기준을 함께 올려 확인한 사람 전원이 다시 읽는다', () => {
    /* v15(공개 서비스 · 카카오, ADR 0225 추기) · v16(카카오계정 이메일, ADR 0224 추기) · v17(운영 기간 · Play 결제 · 구매 제한 기록 · 만 14세, ADR 0234 — 기준은 v16 에 두었다, 운영자 답 2026-11-07) · v18(앱 푸시, ADR 0236 — 기준도 올렸다)이 그 위에 올랐다 — 대화 · 상세 궁합의 줄은 그대로 실린다 */
    expect(NOTICE_VERSION).toBe('notice-v18');
    expect(NOTICE_ACK_FLOOR).toBe('notice-v18');
    expect(noticeAckHolds('notice-v13')).toBe(false);
    expect(noticeAckHolds('notice-v18')).toBe(true);
  });

  it('처리방침은 새 흐름의 글이고 옛 흐름의 줄이 없다', () => {
    const text = noticeText();
    expect(text).not.toContain('궁합 요청이 수락되어 궁합풀이가 자동으로 만들어질 때');
    expect(text).not.toContain('서로의 사주팔자 여덟 글자가 공개돼요');
    expect(text).toContain('상세 궁합 요청을 받은 분이 동의했을 때');
    expect(text).toContain('상세 궁합을 요청하거나 동의하지 않고');
    expect(text).toContain('대화는 상대의 수락 없이 열립니다');
  });
});
