import { checkoutRefundLine } from '@/src/lib/brand/refund';
import { CREDITS_AVAILABLE_LABEL, CREDITS_USAGE_NOTE } from '@/src/lib/reading/notes';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { currentBusinessInfo } from '../../business-info';
import { COLUMN, TYPE_META, TYPE_TITLE } from '../../ui/surfaces';
import { TopBar } from '../../ui/top-bar';
import { Checkout } from './checkout';
import { readReadingCredits } from './remaining';
import { returnToOf } from './return-to';

export const metadata = {
  title: '풀이권 구매',
  description: '풀이권 묶음과 가격, 결제 전에 확인할 것을 적어 둡니다.',
};

/**
 * 풀이권 상품 화면 — 묶음 넷 · 유의사항 (G-21, ADR 0175 · 0212).
 *
 * **웹에서는 팔지 않는다** — 풀이권은 앱에서 스토어 인앱결제로만 판다(ADR 0212). 누구에게나 묶음과 「풀이권 판매 준비 중이에요.」가
 * 선다. 풀이권 창(`useBuyCredits`)은 판매가 열린 계정에게만 이리 오는 단추를 세운다 — 주소로 연 사람도 이 화면을 본다.
 *
 * 제목 아래에 보유 수를 세운다 — 머리글 메뉴와 같은 이름이다(운영자 결정 2026-10-29). 못 읽으면 그 줄만 생략한다. 풀이권 창이
 * 실어 온 돌아갈 곳(`?back=`)은 환불정책 링크로 넘긴다(`return-to.ts`).
 *
 * 제목 위 ← 는 그 돌아갈 곳이고, 실어 온 곳이 없으면(머리글 · 주소로 연 사람) 「나」(`/me`)다(운영자 2026-10-29 「뒤로가기가 없는 게
 * 아쉽네」).
 */
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const back = returnToOf((await searchParams).back);
  const credits = await readReadingCredits(supabase);
  const available = credits.ok && credits.value ? credits.value.available : null;

  return (
    <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
      <TopBar back={back ? { href: back.href, label: back.name } : { href: '/me', label: '나' }}>
        <header className="flex flex-col gap-1">
          <h1 className={TYPE_TITLE}>풀이권 구매</h1>
          <p className={TYPE_META}>{CREDITS_USAGE_NOTE}</p>
        </header>
      </TopBar>

      {available !== null && (
        <p className="flex items-baseline justify-between gap-4 rounded-card bg-cream px-5 py-4 text-body text-cream-ink">
          <span>{CREDITS_AVAILABLE_LABEL}</span>
          <span className="font-semibold tabular-nums">{available}장</span>
        </p>
      )}

      <Checkout refundLine={checkoutRefundLine(currentBusinessInfo())} back={back} />
    </main>
  );
}
