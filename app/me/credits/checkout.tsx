'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  bundleMark,
  bundleOrderName,
  discountAgainstSingles,
  READING_BUNDLE_VALID_YEARS,
  READING_BUNDLES,
  won,
} from '@/src/lib/reading/bundle';

import { BUTTON_TERTIARY_FACE } from '../../ui/buttons';
import { TYPE_META, TYPE_NAME } from '../../ui/surfaces';
import { withReturnTo, type ReturnTo } from './return-to';

/**
 * **풀이권 묶음 · 유의사항** (G-21, ADR 0175 · 0212).
 *
 * 리디 충전 화면의 꼴이다(ADR 0175) — 묶음 목록 → 그 아래 작은 글씨 유의사항 다섯 줄과 「자세히 알아보기」(`/refund`). 이용약관 ·
 * 처리방침은 바닥글이 든다. 유의사항의 환불 신청 줄(`refundLine`)은 서버가 사업자 이메일로 지어 넘긴다(`checkoutRefundLine`).
 *
 * **웹에는 결제 단추가 없다** — 풀이권은 앱에서 스토어 인앱결제로만 판다(ADR 0212). 단추 자리에는 판매 준비 줄이 선다.
 */
export function Checkout({ refundLine, back }: { refundLine: string; back: ReturnTo | null }) {
  const [credits, setCredits] = useState<number>(READING_BUNDLES[0].credits);

  return (
    <>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">풀이권 고르기</legend>
        {READING_BUNDLES.map((bundle) => {
          const discount = discountAgainstSingles(bundle.credits, bundle.price);
          const mark = bundleMark(bundle.credits);
          const on = bundle.credits === credits;
          return (
            <label
              key={bundle.credits}
              className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-card border px-4 py-3 ${
                on ? 'border-accent bg-surface ring-2 ring-accent' : 'border-border bg-surface hover:border-border-strong'
              }`}
            >
              <input
                type="radio"
                name="bundle"
                value={bundle.credits}
                checked={on}
                onChange={() => setCredits(bundle.credits)}
                className="size-5 shrink-0 accent-[var(--accent)]"
              />
              <span className="flex flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={TYPE_NAME}>{bundleOrderName(bundle.credits)}</span>
                  {mark !== null && (
                    <span className="rounded-full bg-cream px-2 py-0.5 text-fine font-semibold text-cream-ink">
                      {mark}
                    </span>
                  )}
                </span>
                {discount > 0 && <span className={TYPE_META}>1장 대비 {discount}% 할인</span>}
              </span>
              <span className="text-body font-semibold tabular-nums text-foreground">{won(bundle.price)}</span>
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-col gap-3">
        <p className={TYPE_META}>풀이권 판매 준비 중이에요.</p>

        <ul aria-label="유의사항" className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-fine leading-[1.125rem] text-secondary">
          <li>
            미사용 유료 풀이권은 실제 결제한 금액을 기준으로 환불합니다. 청약철회 기간(7일)이 지난 뒤 단순 변심으로 환불하면,
            미사용분에 해당하는 금액의 10%를 환불수수료로 공제합니다.
          </li>
          <li>{refundLine}</li>
          <li>
            정상적으로 제공된 풀이는 단순 변심으로 환불되지 않습니다. 풀이가 제공되지 않거나 표시·광고 또는 계약 내용과
            다르게 제공된 경우에는 관계 법령에 따라 재제공 또는 환불을 요청할 수 있습니다.
          </li>
          <li>구매 전 무료 풀이권으로 풀이 한 편을 먼저 받아 볼 수 있습니다.</li>
          <li>
            {/* 시행일 전에 받은 몫은 시행일부터 센다 — 약관 제13조⑥ · 환불정책과 같은 기준(ADR 0173 추기) */}
            유료 풀이권은 구매일로부터 {READING_BUNDLE_VALID_YEARS}년, 무료로 받은 풀이권은 받은 날(약관 시행일 전에 받은 풀이권은
            시행일)로부터 1년이 지나면 소멸됩니다.
          </li>
        </ul>
        <Link href={withReturnTo('/refund?from=credits', back)} className={`${BUTTON_TERTIARY_FACE} self-start text-fine font-medium text-secondary`}>
          자세히 알아보기
        </Link>
      </div>
    </>
  );
}
