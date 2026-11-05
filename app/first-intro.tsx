'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { SERVICE_FEATURES } from '@/src/lib/brand/features';
import { ABOUT_LEAD, MEMBER_SIGN_IN_ASK, RESULT_EXAMPLE_STAMP, SIGNED_OUT_REACH, TRIAL_START } from '@/src/lib/brand/guide';
import { calculateChart } from '@/src/lib/input/chart';
import { EXAMPLE_QUERY } from '@/src/lib/input/example';
import type { ReadingEntry } from '@/src/lib/reading';
import { PREVIEW_SELF_METAPHOR } from '@/src/lib/reading/preview';

import { SelfCard } from './me/home/self-card';
import { BUTTON_PRIMARY } from './ui/buttons';
import { PAPER_FACE, TYPE_TITLE } from './ui/surfaces';

/** 사주풀이 줄 — 서비스 소개의 이름 · 조건 그대로다(`/about`) */
const READING_FEATURE = SERVICE_FEATURES.find((feature) => feature.icon === 'reading');

/**
 * 예시 카드의 한줄평 자리 — 회원 홈 카드의 한줄평은 내 사주풀이의 비유(`ReadingEntry.metaphor`)다. 예시는 개발 기계의 예시 결과와
 * 한 벌인 비유를 쓴다(`src/lib/reading/preview.ts`) — 새로 지은 글이 아니다. 카드는 이 값의 비유만 읽는다(저장 전 카드라 단추가 없다)
 */
const EXAMPLE_READING: ReadingEntry = {
  kind: 'self',
  personA: null,
  personB: null,
  matchId: null,
  labelA: null,
  labelB: null,
  score: null,
  metaphor: PREVIEW_SELF_METAPHOR,
  createdAt: '',
  fromCurrentChart: true,
  dayMasterA: null,
  dayMasterB: null,
};

/**
 * **로그인 전 첫 화면의 소개**(ADR 0226) — 무엇을 하는 서비스인지 · 로그인하면 무엇이 서는지를 입력보다 먼저 보인다.
 *
 * 차례는 제목 → 한 줄 → **예시 내 사주 카드**(회원 홈의 그 카드 · 「예시」 · 한줄평) → 로그인 없이 볼 수 있는 것과 사주풀이의 조건 → 두 입구다. 체험(「로그인 없이 사주 보기」)과 이미 쓰는 사람의 로그인을 가른다 — 점신 웹의 「점신 시작하기」 ·
 * 「기존 회원 로그인하기」와 같은 꼴이다(대장 first-04). 슬라이드도 저절로 넘어가는 소개도 없다 — 한 화면이다.
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

      {/*
        **회원 홈의 내 사주 카드 그대로**(홈 탭의 줄인 판, `compact`) — 이름 자리에 「예시」, 한줄평은 예시 풀이의 비유다. 저장 전 카드라
        프로필 원(계정 얼굴)과 두 단추(사주풀이 보기 · 만세력 보기 — 열 화면이 없다)는 안 선다
      */}
      {example !== null && (
        <SelfCard personId={null} label={RESULT_EXAMPLE_STAMP} query={EXAMPLE_QUERY} saju={example} reading={EXAMPLE_READING} compact />
      )}

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
