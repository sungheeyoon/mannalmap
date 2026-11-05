'use client';

import Link from 'next/link';

import { SERVICE_FEATURES } from '@/src/lib/brand/features';
import { ABOUT_LEAD, MEMBER_SIGN_IN_ASK, RESULT_EXAMPLE_STAMP, SIGNED_OUT_REACH, TRIAL_START } from '@/src/lib/brand/guide';
import { READING_EXAMPLE } from '@/src/lib/reading/preview';

import { Markdown } from './me/reading/markdown';
import { BUTTON_PRIMARY } from './ui/buttons';
import { CARD_FACE, PAPER_FACE, TYPE_TITLE } from './ui/surfaces';

/** 사주풀이 줄 — 서비스 소개의 이름 · 조건 그대로다(`/about`) */
const READING_FEATURE = SERVICE_FEATURES.find((feature) => feature.icon === 'reading');

/**
 * **로그인 전 첫 화면의 소개**(ADR 0226) — 무엇을 하는 서비스인지 · 로그인하면 무엇을 받는지를 입력보다 먼저 보인다.
 *
 * 차례는 제목 → 한 줄 → **사주풀이 예시**(풀이 화면의 표지 비유 · 절 제목 · 첫 문단 꼴, 「예시」라고 적힌다) → 로그인 없이 볼 수 있는 것과
 * 사주풀이의 조건 → 두 입구다. 예시 글은 지어 쓰지 않는다 — 개발 기계의 풀이 화면이 세우는 예시 결과와 한 벌이다
 * (`src/lib/reading/preview.ts`). 체험(「로그인 없이 사주 보기」)과 이미 쓰는 사람의 로그인을 가른다 — 점신 웹의 「점신 시작하기」 ·
 * 「기존 회원 로그인하기」와 같은 꼴이다(대장 first-04). 슬라이드도 저절로 넘어가는 소개도 없다 — 한 화면이다.
 *
 * 입력 폼은 여기 없다 — 체험을 고르면 같은 주소의 `#start` 에 선다(`saju-landing.ts`). 로그인은 홈으로 간다(`/auth`, 목적지 기본값).
 */
export function FirstIntro({ onStart }: { onStart: () => void }) {
  return (
    <section aria-labelledby="first-title" className={`${PAPER_FACE} flex flex-col gap-5 px-4 pb-6 pt-5 sm:gap-6 sm:px-10 sm:pb-9 sm:pt-9`}>
      <div className="flex flex-col gap-2 px-1">
        <h1 id="first-title" className={TYPE_TITLE}>
          나는 어떤 사람일까?
        </h1>
        <p className="text-pretty text-body leading-7 text-cream-ink">{ABOUT_LEAD[0]}</p>
      </div>

      {/* 풀이 화면의 표지(“ · 비유)와 본문(절 제목 · 문단)을 같은 부품으로 줄여 세운다 — 누를 자리가 없다 */}
      <figure aria-label={`${READING_FEATURE?.title ?? ''} ${RESULT_EXAMPLE_STAMP}`} className={`${CARD_FACE} border-border bg-surface px-5 pb-5 pt-4`}>
        <span className="flex items-center gap-2 text-small font-semibold text-secondary">
          <span className="rounded-full bg-warning-wash px-2.5 py-1 text-tag font-semibold text-warning">{RESULT_EXAMPLE_STAMP}</span>
          {READING_FEATURE?.title}
        </span>
        <span aria-hidden="true" className="mt-3 block h-7 font-rounded text-display leading-none text-foreground opacity-60">
          “
        </span>
        <blockquote className="text-pretty font-rounded text-heading leading-[1.45] tracking-[-0.01em] text-foreground">
          {READING_EXAMPLE.metaphor}
        </blockquote>
        <div className="mt-4 border-t border-border pt-4">
          <Markdown source={READING_EXAMPLE.excerpt} />
        </div>
      </figure>

      <div className="flex flex-col gap-1 px-1 text-small leading-6 text-secondary">
        <p>{SIGNED_OUT_REACH}</p>
        {READING_FEATURE !== undefined && (
          <p>
            <span className="font-semibold text-foreground">{READING_FEATURE.title}</span> · {READING_FEATURE.note}
          </p>
        )}
      </div>

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
