'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { ABOUT_LEAD, MEMBER_SIGN_IN_ASK, RESULT_EXAMPLE_STAMP, SIGNED_OUT_REACH, TRIAL_START } from '@/src/lib/brand/guide';
import { calculateChart } from '@/src/lib/input/chart';
import { EXAMPLE_QUERY } from '@/src/lib/input/example';

import { SelfCard } from './me/home/self-card';
import { BUTTON_PRIMARY } from './ui/buttons';
import { PAPER_FACE, TYPE_TITLE } from './ui/surfaces';

/**
 * **로그인 전 첫 화면의 소개**(ADR 0226) — 무엇을 하는 서비스인지 · 무엇을 보게 되는지를 입력보다 먼저 보인다.
 *
 * 차례는 제목 → 한 줄 → 결과 예시(엔진이 실제로 계산한 카드, 「예시」라고 적힌다) → 로그인 없이 볼 수 있는 것 → 두 입구다.
 * 체험(「로그인 없이 사주 보기」)과 이미 쓰는 사람의 로그인을 가른다 — 점신 웹의 「점신 시작하기」 · 「기존 회원 로그인하기」와
 * 같은 꼴이다(대장 first-04). 슬라이드도 저절로 넘어가는 소개도 없다 — 한 화면이다.
 *
 * 입력 폼은 여기 없다 — 체험을 고르면 같은 주소의 `#start` 에 선다(`saju-landing.ts`). 로그인은 홈으로 간다(`/auth`, 목적지 기본값).
 */
export function FirstIntro({ onStart }: { onStart: () => void }) {
  /* 미리 그려질 때 한 번 계산된다 — 방문마다 서버를 안 부르고, 엔진은 계산기와 같은 번들이다 */
  const example = useMemo(() => {
    const result = calculateChart(EXAMPLE_QUERY);
    return result.ok ? result.saju : null;
  }, []);

  return (
    <section aria-labelledby="first-title" className={`${PAPER_FACE} flex flex-col gap-5 px-4 pb-6 pt-5 sm:gap-6 sm:px-10 sm:pb-9 sm:pt-9`}>
      <div className="flex flex-col gap-2 px-1">
        <h1 id="first-title" className={TYPE_TITLE}>
          나는 어떤 사람일까?
        </h1>
        <p className="text-pretty text-body leading-7 text-cream-ink">{ABOUT_LEAD[0]}</p>
      </div>

      {example !== null && (
        <SelfCard personId={null} label={RESULT_EXAMPLE_STAMP} query={EXAMPLE_QUERY} saju={example} reading={null} compact />
      )}

      <p className="px-1 text-small leading-6 text-secondary">{SIGNED_OUT_REACH}</p>

      <div className="flex flex-col items-stretch gap-2">
        <button type="button" onClick={onStart} className={`${BUTTON_PRIMARY} w-full`}>
          {TRIAL_START}
        </button>
        <p className="flex flex-wrap items-center justify-center gap-x-1 text-small text-secondary">
          {MEMBER_SIGN_IN_ASK}
          <Link href="/auth" className="inline-flex min-h-11 items-center px-1 font-semibold text-foreground underline underline-offset-4">
            로그인
          </Link>
        </p>
      </div>
    </section>
  );
}
