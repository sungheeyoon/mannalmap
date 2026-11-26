import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OUT_OF_CREDITS_REFUSALS, refusedForCredits } from './refusal';

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations');
/** 잔액이 없어 풀이를 막는 문의 정의 — `grant · revoke … on function` 줄은 정의가 아니라 뺀다 */
const DOOR = /create\s+(?:or\s+replace\s+)?function\s+public\.start_reading_run_for\(/gi;

/**
 * `start_reading_run_for` 의 가장 최근 정의 — 마이그레이션은 이름(시각) 차례로 서므로 마지막 파일의 마지막 정의다(`bundle-price.test.ts` 와 같은 꼴).
 * 옛 마이그레이션 전부를 훑으면 문이 그 문장을 버린 뒤에도 옛 파일이 들고 있어 늘 참이다.
 */
const latestDefinition = (): string => {
  const read = (one: string) => readFileSync(resolve(MIGRATIONS, one), 'utf8');
  const last = readdirSync(MIGRATIONS)
    .filter((one) => one.endsWith('.sql'))
    .sort()
    .filter((one) => [...read(one).matchAll(DOOR)].length > 0)
    .at(-1);
  expect(last).toBeDefined();
  const source = read(last ?? '');
  const start = [...source.matchAll(DOOR)].at(-1)?.index ?? -1;
  /* 몸은 `as $tag$` 와 같은 `$tag$` 사이다 — 파일마다 `$$` · `$function$` 이 갈린다 */
  const tag = /\bas\s+(\$\w*\$)/i.exec(source.slice(start));
  expect(tag).not.toBeNull();
  const open = start + (tag?.index ?? 0) + (tag?.[0].length ?? 0);
  const close = source.indexOf(tag?.[1] ?? '$$', open);
  expect(close).toBeGreaterThan(open);
  return source.slice(open, close);
};

describe('refusedForCredits', () => {
  it('풀이를 여는 문이 잔액으로 막은 거절을 알아본다', () => {
    expect(refusedForCredits({ code: '23514', message: '풀이권을 다 쓰셨습니다.' })).toBe(true);
  });

  it('옛 인연 요청의 거절 문장은 더 풀이권 창이 아니다 — 그 문장을 던지는 문이 없다(대화가 유일한 흐름, `20270109090000`)', () => {
    expect(
      refusedForCredits({
        code: '23514',
        message: '풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 장을 잡고, 동의가 나면 그 한 장으로 궁합 풀이가 만들어집니다.',
      }),
    ).toBe(false);
  });

  /**
   * 꼬리는 바뀌어도 앞머리는 그대로다 — 「번」→「회」 · 「한 번」→「한 장」(`20261209090000`)이 운영 DB 에 오르기 전후로
   * 어느 앱이 떠 있어도 풀이권 창이 열린다. 앞머리에 수를 세는 말을 넣으면 그 배포 순서가 다시 생긴다.
   */
  it('옛 꼬리의 문장도 알아본다 — 마이그레이션과 앱 배포의 순서가 상관없다', () => {
    expect(refusedForCredits({ code: '23514', message: '풀이권을 다 쓰셨습니다. 테스트 기간에는 5번까지 만들 수 있어요.' })).toBe(true);
    expect(refusedForCredits({ code: '23514', message: '풀이권을 다 쓰셨습니다. 테스트 기간에는 5회까지 만들 수 있어요.' })).toBe(true);
    for (const lead of OUT_OF_CREDITS_REFUSALS) {
      expect(lead, lead).not.toMatch(/[번회개장]/);
    }
  });

  it('같은 코드의 다른 거절은 풀이권 창이 아니다 — 보낸 요청이 잡은 몫은 요청을 취소하거나 기다릴 일이다', () => {
    expect(refusedForCredits({ code: '23514', message: '남은 풀이권이 보낸 인연 요청에 걸려 있어요. 요청을 취소하거나 상대의 답을 기다려 주세요.' })).toBe(false);
  });

  it('문장이 같아도 코드가 다르면 아니다', () => {
    expect(refusedForCredits({ code: 'P0001', message: '풀이권을 다 쓰셨습니다.' })).toBe(false);
    expect(refusedForCredits({ code: null, message: null })).toBe(false);
  });

  /** 앞머리는 DB 가 쓴 문장이다 — 문의 마지막 정의가 그 문장을 바꾸거나 버리면 여기서 붉다 */
  it('앞머리마다 풀이를 여는 문의 마지막 정의가 그 문장을 check_violation 으로 던진다', () => {
    const body = latestDefinition();
    for (const lead of OUT_OF_CREDITS_REFUSALS) {
      expect(body, lead).toMatch(new RegExp(`raise exception '${lead}[^']*'\\s+using errcode = 'check_violation'`));
    }
  });
});
