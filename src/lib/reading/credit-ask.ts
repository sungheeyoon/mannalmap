import { BUY_CREDITS_LABEL, CREDITS_BUY_THEN_USE_NOTE, SALE_CLOSED_NOTE, SALE_CLOSED_OK, readingCostLine } from './notes';
import { outOfCredits } from './panel-chrome';

/**
 * **풀이권을 쓰는 확인은 모든 자리가 한 꼴이다**(운영자 2026-11-13 「풀이권이 없을 때는 모든 곳에서 같은 프로세스로」, ADR 0251).
 * 저장한 사람 화면의 받기 · 궁합 사이 시트, 풀이 화면 · 궁합풀이 화면의 받기 · 다시 받기 확인 창(궁합 탭의 「궁합 보기」가 여는 그 화면 포함)이
 * 이 판정 하나를 부른다. 따로 뜨던 「풀이권이 부족해요」 창은 걷었다.
 *
 * - `use` — 「풀이권 1장을 사용해요. (남은 풀이권 N장)」과 실행 단추([받기] · [궁합 보기] · [사주풀이 받기] · [다시 받기] — 부르는 자리가 든다) / [취소]
 * - `buy` — 0장이고 살 수 있을 때(앱 · 안드로이드): 「남은 풀이권이 없어요.」 / 「구매하면 바로 받을 수 있어요.」와 [풀이권 구매] / [취소]
 * - `closed` — 0장이고 살 수 없을 때(웹 · iOS): 「남은 풀이권이 없어요.」 / 「지금은 풀이권을 구매할 수 없어요.」와 [확인] 하나
 *
 * 0장의 판정은 `outOfCredits`(만드는 중인 몫이 있으면 0장이 아니다)이고, 눌렀는데 문이 「풀이권이 없다」고 답했으면(`spent`) 같은 꼴로 바뀐다.
 * [풀이권 구매] 뒤에 돌아와 같은 확인을 다시 여는 표시는 `resume-ask.ts` 다.
 */
export type CreditAskShape =
  | { readonly kind: 'use'; readonly lines: readonly string[]; readonly cancelLabel: string }
  | { readonly kind: 'buy'; readonly lines: readonly string[]; readonly confirmLabel: string; readonly cancelLabel: string }
  | { readonly kind: 'closed'; readonly lines: readonly string[]; readonly confirmLabel: string; readonly cancelLabel: null };

export const CREDIT_ASK_CANCEL = '취소';

export function creditAskShape(
  credits: { readonly available: number; readonly reserved: number } | null,
  { spent, canBuy }: { readonly spent: boolean; readonly canBuy: boolean },
): CreditAskShape {
  if (!spent && !outOfCredits(credits)) {
    return { kind: 'use', lines: [readingCostLine(credits?.available ?? null)], cancelLabel: CREDIT_ASK_CANCEL };
  }
  const none = readingCostLine(0);
  return canBuy
    ? { kind: 'buy', lines: [none, CREDITS_BUY_THEN_USE_NOTE], confirmLabel: BUY_CREDITS_LABEL, cancelLabel: CREDIT_ASK_CANCEL }
    : { kind: 'closed', lines: [none, SALE_CLOSED_NOTE], confirmLabel: SALE_CLOSED_OK, cancelLabel: null };
}

/**
 * 풀이 화면 · 궁합풀이 화면의 확인 창 제목 — 사람 화면의 시트 제목(「{이름}의 사주풀이를 받을까요?」)과 같은 물음이다. 「풀이권 1장을
 * 사용하시겠어요?」는 0장 꼴에서 거짓이 되어 걷었고, 쓰는 수는 창 안의 풀이권 줄이 말한다(ADR 0251).
 */
export const readingConfirmTitle = (noun: string, again: boolean): string => `${noun}를 ${again ? '다시 ' : ''}받을까요?`;
