'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

import { CREDITS_AVAILABLE_LABEL, CREDITS_SCREEN_LEAD, SALE_CLOSED_NOTE } from '@/src/lib/reading/notes';

import { MENU_PANEL, TYPE_META } from '../../ui/surfaces';
import { useDetailsMenu } from '../../ui/details-menu';

/**
 * 상단 풀이권은 설정처럼 펼친다 — 잔액 · 사용처 · 구매 길(B안, 운영자 2026-10-12).
 *
 * **판은 설정 메뉴(`site-header.tsx` 의 톱니)와 한 벌이다** — 모서리 `1.25rem` · 그림자 `shadow-float` · 테 `ring-border` · 폭 `w-72` ·
 * 머리글 아래 같은 높이(62px)에 선다. 폰에서는 이 칸이 화면 오른쪽 끝이 아니라(종 · 톱니가 오른쪽에 있다) 단추 밑에 붙이면 판이 화면 왼쪽
 * 밖으로 나간다 — 그래서 화면에 붙여(`fixed`) 설정 판과 같은 오른쪽 끝(16px)에 세운다. 안쪽 여백은 설정 판의 글자 들여쓰기(판 8px + 줄
 * 12px)와 같은 20px 다. 글자는 앱의 단(`TYPE_META` 13px · 본문 15px · 큰 수는 홈의 수와 같은 2rem 굵게)이다.
 *
 * **구매 길은 늘 판매가 닫힌 줄이다** — 웹은 풀이권을 팔지 않는다(ADR 0212). 열 때 판매를 묻던 문과 「풀이권 구매」 링크는 걷었다(ADR 0272).
 */
export function CreditsMenu({ available, label, children, className }: {
  available: number;
  label: string;
  children: ReactNode;
  className: string;
}) {
  const pathname = usePathname();
  const { menu, close } = useDetailsMenu();
  const shownAt = useRef(pathname);

  useEffect(() => {
    if (shownAt.current === pathname) return;
    shownAt.current = pathname;
    close();
  }, [pathname, close]);

  return (
    <details ref={menu} className="relative shrink-0">
      <summary aria-label={label} className={`${className} list-none [&::-webkit-details-marker]:hidden`}>
        {children}
      </summary>
      {/* 랜드마크(`section` + 이름)로 세우지 않는다 — 설정 판처럼 여는 단추(`summary`)의 이름이 이 판의 이름이다 */}
      <div className={`${MENU_PANEL} fixed right-4 top-15.5 z-50 w-72 max-w-[calc(100vw-2rem)] p-5 sm:absolute sm:right-0 sm:top-12`}>
        <p className={TYPE_META}>{CREDITS_AVAILABLE_LABEL}</p>
        <p className="mt-2 flex items-baseline gap-1.5 text-title font-bold leading-none tabular-nums text-foreground">
          {available}<span className="text-lead font-semibold">장</span>
        </p>
        <p className="mt-4 text-body leading-6 text-secondary">{CREDITS_SCREEN_LEAD[0]}</p>
        <p className={`mt-1 ${TYPE_META}`}>{CREDITS_SCREEN_LEAD[1]}</p>
        <p className="mt-4 border-t border-border pt-4 text-body leading-6 text-secondary">{SALE_CLOSED_NOTE}</p>
      </div>
    </details>
  );
}
