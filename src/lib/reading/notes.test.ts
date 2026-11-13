import { describe, expect, it } from 'vitest';

import {
  readingCostLine,
  readingNoneNote,
  READING_ALREADY_RUNNING_NOTE,
  READING_FAILED_NOTE,
  READING_FIRST_FAILED_NOTE,
  READING_LEAVE_SAFE_NOTE,
  readingCreditsLabel,
  readingCreditsNote,
  readingWaitNote,
} from './notes';

/**
 * **기다리는 동안 화면이 하는 말**은 값이지 장식이 아니다.
 *
 * 앞 문구는 「보통 1분 안에 완성됩니다. 이 화면을 그대로 두어 주세요」였다. 두 문장이
 * 다 틀렸다 — 1분은 잰 적이 없고, 화면을 그대로 둘 필요도 없다.
 */
describe('기다리는 동안의 문구', () => {
  /**
   * **재지 않은 숫자를 약속으로 말하지 않는다.**
   *
   * 상한은 우리가 정한 값이라 검증이 필요 없는 사실이고, 「보통 이만큼」은 재야 하는
   * 주장이다. 재기 전에는 아는 쪽만 말한다.
   */
  it('상한에서 지어 내므로 상한이 바뀌면 문구도 바뀐다', () => {
    expect(readingWaitNote(240_000)).toBe('길면 4분까지 걸려요.');
    expect(readingWaitNote(120_000)).toBe('길면 2분까지 걸려요.');

    // 손으로 적은 숫자였다면 이 둘이 같았을 것이다
    expect(readingWaitNote(240_000)).not.toBe(readingWaitNote(120_000));
  });

  it('재어 본 적 없는 「보통 얼마」를 말하지 않는다', () => {
    const note = readingWaitNote(240_000);

    for (const promise of ['보통', '평균', '대개', '안에 완성']) {
      expect(note, promise).not.toContain(promise);
    }
  });

  /**
   * **경고를 지우는 것이 그 변경의 결과다.**
   *
   * 만드는 일이 누름의 요청 안에서 돌던 동안에는 「새로고침하면 중단될 수 있습니다」가
   * 참이었다. 응답 뒤로 옮긴 뒤에는 거짓이다 — 남겨 두면 하지 않아도 되는 걱정을
   * 시키고, 사용자는 그 화면 앞에 붙들려 앉아 있게 된다.
   *
   * 문구가 배선을 따라오지 않으면 **화면이 옛 제약을 계속 파는 셈**이라 여기서 잡는다.
   */
  it('나가도 되고 새로고침해도 된다고 말한다', () => {
    expect(READING_LEAVE_SAFE_NOTE).toContain('새로고침');

    for (const scare of ['중단', '그대로 두어', '닫지 마']) {
      expect(READING_LEAVE_SAFE_NOTE, scare).not.toContain(scare);
    }
  });

  /**
   * 아무것도 시작하지 않은 **성공**이 있다. 실패가 아니므로 실패라고 말하지 않되,
   * 말없이 지나가지도 않는다 — 그게 「눌렀는데 그대로」의 자리였다.
   */
  it('이미 도는 시도를 실패가 아니라 상태로 말한다', () => {
    expect(READING_ALREADY_RUNNING_NOTE).toContain('이미 만들고');

    for (const blame of ['실패', '오류', '문제가']) {
      expect(READING_ALREADY_RUNNING_NOTE, blame).not.toContain(blame);
    }
    // 무엇이 되고 있는지까지 — 상태만 알리고 끝내면 사용자는 다시 누른다
    expect(READING_ALREADY_RUNNING_NOTE).toContain('다 만들어지면');
    expect(READING_ALREADY_RUNNING_NOTE).toContain('이 화면에 나타나요');
  });
});

/**
 * **풀이권은 세는 것이지 적어 두는 것이 아니다**(`reading_credit_limit`). 화면이 하는
 * 말도 그 사실을 따라야 한다 — 「차감」과 「반환」이라는 낱말이 여기 들어오면 사용자는
 * 어딘가에 자기 잔고가 적혀 있다고 믿고, 실패한 뒤에 그것이 돌아왔는지 확인하러 간다.
 */
describe('풀이권 문구', () => {
  /**
   * **「토큰」이라고 부르지 않는다.** 모델의 토큰과 같은 낱말이 되면 긴 풀이가 더
   * 비싸다고 읽힌다 — 여기서 세는 것은 만드는 횟수 하나뿐이다.
   */
  it('모델의 낱말을 빌려 쓰지 않는다', () => {
    const label = readingCreditsLabel({ available: 3 });

    for (const borrowed of ['토큰', '크레딧', '포인트', 'token']) {
      expect(label, borrowed).not.toContain(borrowed);
    }
    expect(label).toContain('풀이권');
  });

  /** 한도는 사면 늘어나는 값이라(ADR 0106) 「몇 번 중」은 뜻을 잃는다 — 남은 수만 센다 */
  it('남은 수만 말한다', () => {
    expect(readingCreditsLabel({ available: 3 })).toBe('풀이권 3장');
  });

  /** 0개도 선다 — 그 칸은 누르면 구매 길이다 */
  it('0장도 「풀이권 0장」으로 선다', () => {
    expect(readingCreditsLabel({ available: 0 })).toBe('풀이권 0장');
  });

  /**
   * **말할 것이 없으면 안 선다.** 늘 무언가 적혀 있는 줄은 곧 안 읽히고, 그때 정작
   * 말해야 하는 순간에도 안 읽힌다.
   *
   * **다 썼을 때도 마찬가지다.** 한동안 「새로 만들 수는 없지만 이미 만든 풀이는 언제든
   * 다시 볼 수 있어요」가 섰다. 다시 보기가 닫힌 적이 한 번도 없어서 그 줄이 새로 알려
   * 주는 것이 없었다 — 잔액은 머리글이 들고, 다 쓴 사람이 누르면 확인 창의 0장 꼴이 열린다.
   * 그래서 이 함수는 이제 잔액을 묻지 않고, 갈래가 도는 시도 하나뿐이다.
   */
  it('평소에는 아무 말도 하지 않는다', () => {
    expect(readingCreditsNote({ reserved: 0 })).toBeNull();
  });

  /**
   * 도는 시도가 자리를 잡고 있어서 잔액이 하나 줄어 보인다. 이유를 말하지 않으면
   * 「누르지도 않았는데 하나가 사라졌다」로 읽힌다.
   */
  it('만들고 있는 동안에는 왜 하나 줄었는지와 돌아온다는 것을 함께 말한다', () => {
    const note = readingCreditsNote({ reserved: 1 });

    expect(note).toContain('만드는 중인');
    expect(note).toContain('돌려드려요');
  });

  /**
   * **보낸 상세 궁합 요청은 말하지 않는다**(운영자 2026-11-13, 대장 home-15). 남은 수가 이미 예약 몫을 빼고, 인연은 닫혀 있다.
   */
  it('보낸 요청이 잡고 있어도 그 줄은 서지 않는다', () => {
    const credits = { reserved: 0, requested: 2 };
    expect(readingCreditsNote(credits)).toBeNull();
  });
});

/**
 * **실패한 시도는 풀이권을 돌려준다** — 실패로 끝나면 트리거가 예약을 풀고(`settle_reading_credit_for_run`), 잔액은 성공 · 도는
 * 시도만 센다. 실패 줄이 그 사실을 끝에 말한다(운영자 2026-11-13, 대장 home-16).
 */
describe('실패 줄', () => {
  it('처음 받기 · 다시 받기의 실패 줄이 둘 다 풀이권을 돌려줬다고 말한다', () => {
    expect(READING_FIRST_FAILED_NOTE).toBe('풀이를 끝까지 만들지 못했어요. 풀이권은 돌려드렸어요.');
    expect(READING_FAILED_NOTE.endsWith('풀이권은 돌려드렸어요.')).toBe(true);
  });
});

/** 풀이가 없을 때의 카드 — 한 문장 안내와 「남은 풀이권」 줄(운영자 2026-11-13, 대장 home-17) */
describe('빈 카드', () => {
  it('안내는 한 문장이다', () => {
    expect(readingNoneNote('궁합풀이')).toBe('아직 받은 궁합풀이가 없어요.');
  });
  it('수 줄은 쓰는 수와 남은 수를 말하고, 0장이면 없다고 말한다', () => {
    expect(readingCostLine(3)).toBe('풀이권 1장을 사용해요. (남은 풀이권 3장)');
    expect(readingCostLine(0)).toBe('남은 풀이권이 없어요.');
  });
});
