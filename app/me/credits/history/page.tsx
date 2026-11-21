import { BUSINESS_INFO } from '@/src/lib/brand/business';
import { refundRequestLine } from '@/src/lib/brand/refund';
import { historyTabOf, purchaseLines, usageLines } from '@/src/lib/reading/credit-history';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { readReadingCredits } from '../remaining';
import { HistoryView } from './history-view';
import { myCreditHistory, myPaidOrders } from './orders';

export const metadata = {
  title: '결제 내역',
  description: '산 풀이권과 받은 풀이권, 풀이에 쓴 풀이권과 환불 신청 방법을 다시 봅니다.',
};

/**
 * **결제 내역** (G-21, ADR 0174 · 0263) — 「구매 내역 / 사용 내역」 두 탭과 그 위의 보유 수 한 줄(운영자 승인 시안 B, ADR 0263).
 * 구매 탭은 산 묶음마다 주문 번호 · 상품 · 금액 · 결제 시각 · 상태와 받은 무료 풀이권을, 사용 탭은 풀이에 쓴 풀이권을 최근 것부터 든다.
 * 전자상거래법 제13조② 의 계약내용을 산 사람이 다시 볼 자리다(카카오페이지 「캐시 내역」의 꼴). 유효기간 줄은 없다 — 산 몫은 무기한(ADR 0212).
 *
 * 화면 안에서 결제를 취소하는 단추는 없다 — 환불은 운영자가 결제한 곳에서 돌려주고 적는다(`docs/ops/runbook/credits.md`). 이 화면은 그
 * 신청에 드는 주문 번호와 길을 보인다. 보유 수는 부속 정보라 못 읽으면 그 줄만 생략한다.
 */
export default async function CreditsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const [orders, history, credits] = await Promise.all([
    myPaidOrders(supabase),
    myCreditHistory(supabase),
    readReadingCredits(supabase),
  ]);
  return (
    <HistoryView
      available={credits.ok && credits.value ? credits.value.available : null}
      purchases={purchaseLines(orders, history)}
      uses={usageLines(history)}
      initialTab={historyTabOf((await searchParams).tab)}
      refundLine={refundRequestLine(BUSINESS_INFO)}
    />
  );
}
