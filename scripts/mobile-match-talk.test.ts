import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱의 인연 흐름은 하나다**(운영자 2026-11-04) — 카드 → 첫 말 → 답하면 대화 → 원하면 상세 궁합. 앱은 스위치를 묻지 않고, 옛 흐름(요청 때 예약 · 수락 · 거절 · 여덟 글자)의 코드가 없다.
 * 덱의 움직임은 `mobile-deck-talk.test.ts`, 화면의 전후는 가짜 서버 그림으로 잰다(`docs/agents/delegation/local-env.md` 「앱을 웹 번들로 재기」).
 */
const ROOT = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const appSources = readdirSync(join(ROOT, 'mobile/src'), { recursive: true, encoding: 'utf8' })
  .filter((name) => /\.tsx?$/.test(name))
  .map((name) => ({ name: `mobile/src/${name}`, text: withoutComments(read(`mobile/src/${name}`)) }));

describe('흐름은 하나다', () => {
  it.each(['match_talk_open', 'p_expected_kind', 'talkOpen', 'detail_open', 'MK001', 'refusedForSwitchMoved'])('앱 코드에 %s 가 없다', (word) => {
    expect(appSources.filter((one) => one.text.includes(word)).map((one) => one.name)).toEqual([]);
  });

  it('대화 시작은 상대 하나만 싣는다', () => {
    const doors = read('mobile/src/matching/talk-doors.ts');
    const body = doors.slice(doors.indexOf('export async function startTalk'));
    expect(body).toContain("rpc('request_match', { p_candidate_user_id: candidateUserId })");
  });

  it('요청 문을 부르는 앱 코드는 대화 시작 한 곳이다', () => {
    expect(appSources.filter((one) => one.text.includes(".rpc('request_match'")).map((one) => one.name)).toEqual(['mobile/src/matching/talk-doors.ts']);
  });

  it('옛 흐름의 화면 · 문이 없다 — 받은 요청 띠 · 요청 확인 창 · 수락 고지 · 풀이권 창', () => {
    const all = appSources.map((one) => one.text).join('\n');
    for (const name of ['RequestsBand', 'RequestConfirm', 'MatchAcceptNotice', 'useCreditsNotice', 'outOfCreditsNow', 'requestMatch(', 'CompatChip', 'MATCH_ACCEPT_', 'REQUEST_RESERVES_NOTE', 'REJECTION_IS_FINAL_NOTE']) {
      expect(all, name).not.toContain(name);
    }
  });
});

describe('상세 궁합', () => {
  it('상세 칸은 동의만 보낸다 — 거절이 없다', () => {
    const panel = read('mobile/src/chat/detail-panel.tsx');
    expect(panel).toContain('respondToRequest(detail.requestId)');
    expect(withoutComments(panel)).not.toContain('거절');
    expect(read('mobile/src/reading/api.ts')).toContain('JSON.stringify({ requestId, accept: true })');
  });

  it('취소 안내는 문이 cancelled 라고 답했을 때만 선다 — 상대가 먼저 답하면 없는 일이다', () => {
    const withdraw = read('mobile/src/chat/withdraw.tsx');
    expect(withdraw).toMatch(/if \(result\.status === 'cancelled'\) router\.replace\('\/me\/chat\?withdrawn=1'/);
    expect(withdraw).toMatch(/else onStayed\(\);/);
    expect(read('mobile/src/chat/detail-panel.tsx')).toMatch(/if \(result\.status === 'cancelled'\) onNote\(DETAIL_CANCELLED\);/);
  });

  it('결과 화면 · 방에는 여덟 글자가 없다 — 글이 선 뒤에만 풀이 칸이 선다', () => {
    for (const file of ['mobile/src/matching/doors.ts', 'mobile/src/chat/reads.ts', 'mobile/src/app/me/match/[matchId].tsx', 'mobile/src/chat/room.tsx']) {
      const text = withoutComments(read(file));
      expect(text, file).not.toMatch(/my_chart|partner_chart|storedChartSnapshot|dayMaster/);
    }
    expect(read('mobile/src/app/me/match/[matchId].tsx')).toContain("const written = result.detail?.state === 'ready';");
  });
});
