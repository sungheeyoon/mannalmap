import Link from 'next/link';

import { birthLineOf } from '@/src/lib/input/birth-line';
import { READING_CONTINUE_NOTE, SELF_READING_MAKING } from '@/src/lib/home/making';
import type { ReadingEntry } from '@/src/lib/reading';
import type { ReadingCredits } from '@/src/lib/reading/credits';
import {
  CHART_DETAIL_LABEL,
  COMPAT_OTHER_LABEL,
  PERSON_COMPAT_SECTION,
  PERSON_READING_SECTION,
  READING_OPEN_LABEL,
  compatWithLabel,
  readingReceivedLine,
} from '@/src/lib/reading/person-screen';
import { STEM_INFO, type Saju, type Stem } from '@/src/lib/saju';

import { BUTTON_TERTIARY } from '../../../ui/buttons';
import { elementScope } from '../../../ui/element-tone';
import { Icon } from '../../../ui/icons';
import { StemSymbol } from '../../../ui/stem-symbol';
import { CARD_FRAME, COLUMN, TYPE_SECTION, TYPE_TITLE } from '../../../ui/surfaces';
import type { ReadingTarget } from '../../reading/target';
import { DayMasterChip, PillarStrip } from '../chart-bits';
import { CompatAdd, ReadingInvite, type Partner } from './person-sheets';

/** 궁합 칸의 한 줄 — 상대 이름(내 자리는 닉네임) · 두 사람의 일간 · 점수 · 비유 · 그 궁합으로 가는 주소 */
export type PersonPair = {
  readonly key: string;
  readonly other: string | null;
  readonly name: string;
  readonly stems: readonly [Stem, Stem | null];
  readonly score: number | null;
  readonly metaphor: string | null;
  readonly href: string;
};

/**
 * **저장한 사람 화면을 그린다** — 읽기는 `page.tsx` 가 다 하고 여기는 받은 값만 그린다(화면은 그리기만 한다, `docs/architecture.md`).
 * 위에서부터 머리 → 사주풀이 칸 → 궁합 칸(ADR 0248).
 */
export function PersonView({
  person,
  mine,
  fromHome,
  own,
  minutes,
  making,
  target,
  readingHref,
  credits,
  pairs,
  partners,
}: {
  person: { personId: string; name: string; saju: Saju };
  mine: boolean;
  fromHome: boolean;
  own: ReadingEntry | null;
  minutes: number | null;
  making: boolean;
  target: ReadingTarget;
  readingHref: string;
  credits: ReadingCredits | null;
  pairs: readonly PersonPair[];
  partners: readonly Partner[];
}) {
  const element = STEM_INFO[person.saju.pillars.dayMaster].element;

  return (
    /* 저장한 사람 목록(`../page.tsx`)과 같은 기둥에 선다(`COLUMN`) — 목록에서 들어와도 제목 자리가 안 옮긴다 */
    <main className={`app-shell flex ${COLUMN} flex-1 flex-col gap-5 py-8 sm:gap-6 sm:py-12`}>
      {/*
        **뒤로 가기는 판 밖 위의 작은 글자 하나**(2026-10-26 운영자 「너무 크다」) — 사주풀이 화면의 「← 홈」(`ReadingBack`)과 같은 꼴 ·
        같은 자리. 글자는 돌아갈 화면의 이름이다.
      */}
      <Link href={fromHome ? '/me' : '/me/people'} className={`${BUTTON_TERTIARY} self-start`}>
        <Icon name="back" className="size-4" />
        {fromHome ? '홈' : '저장한 사람'}
      </Link>

      {/*
        **머리 — 이 사람이 누구인지**(시안 0-1 A). 일간 색 판에 일간 칩 · 큰 이름 · 출생 한 줄 · 네 기둥 띠(일주 칸만 테, 글자마다 오행 색) ·
        오른쪽 아래 「만세력 자세히」. 단추는 두지 않는다 — 받기 · 궁합은 아래 칸이 든다.
      */}
      <header className={`${elementScope(element)} relative flex flex-col gap-3 overflow-hidden rounded-card bg-[var(--tile)] p-5 sm:p-8`}>
        <StemSymbol
          stem={person.saju.pillars.dayMaster}
          className="pointer-events-none absolute -right-8 top-6 size-40 opacity-15 sm:size-56"
        />
        <DayMasterChip stem={person.saju.pillars.dayMaster} className="relative self-start" />
        <div className="relative flex flex-col gap-1">
          <h1 className={`min-w-0 break-keep [overflow-wrap:anywhere] ${TYPE_TITLE}`}>{person.name}</h1>
          <p className="text-small tabular-nums text-secondary">{birthLineOf(person.saju)}</p>
        </div>
        <div className="relative mt-1">
          <PillarStrip pillars={person.saju.pillars} name={person.name} />
        </div>
        <Link
          href={`/me/people/${person.personId}?tab=chart${fromHome && !mine ? '&from=me' : ''}`}
          className="relative inline-flex min-h-11 items-center gap-0.5 self-end text-small font-semibold text-[var(--ink)] hover:opacity-70"
        >
          {CHART_DETAIL_LABEL}
          <Icon name="chevron" className="size-4" />
        </Link>
      </header>

      <section aria-labelledby="person-reading" className="flex flex-col gap-2.5">
        <h2 id="person-reading" className={`${TYPE_SECTION} px-1`}>
          {PERSON_READING_SECTION}
        </h2>
        {own !== null ? (
          <ReadingCard own={own} minutes={minutes} href={readingHref} element={element} />
        ) : making ? (
          <Link href={readingHref} className={`${CARD_FRAME} flex min-h-16 items-center gap-3 px-5 py-4 hover:bg-surface-sunken`}>
            <span className="min-w-0 flex-1 text-body font-semibold">{SELF_READING_MAKING}</span>
            <Icon name="chevron" className="size-4 shrink-0 text-muted" />
          </Link>
        ) : (
          <ReadingInvite name={person.name} target={target} readingHref={readingHref} credits={credits} />
        )}
      </section>

      {!mine && (
        <section aria-labelledby="person-compat" className="flex flex-col gap-2.5">
          <h2 id="person-compat" className={`${TYPE_SECTION} px-1`}>
            {PERSON_COMPAT_SECTION}
          </h2>
          <div className={`${CARD_FRAME} flex flex-col`}>
            {pairs.length > 0 && (
              <ul className="flex flex-col">
                {pairs.map((pair) => (
                  <li key={pair.key} className="-mt-px border-t border-border">
                    <Link href={pair.href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-sunken">
                      <PairFaces stems={pair.stems} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body font-semibold">{pair.name}</span>
                        {pair.metaphor !== null && <span className="truncate text-small leading-5 text-secondary">{pair.metaphor}</span>}
                      </span>
                      {pair.score !== null && (
                        <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-small font-semibold tabular-nums text-cream-ink">
                          {pair.score}점
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className={pairs.length > 0 ? 'border-t border-border' : ''}>
              <CompatAdd
                person={{ personId: person.personId, name: person.name }}
                partners={partners}
                credits={credits}
                label={pairs.length > 0 ? COMPAT_OTHER_LABEL : compatWithLabel(person.name)}
              />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

/** 받은 사주풀이 — 비유 한 줄을 크게, 아래에 받은 날 · 읽는 시간과 「읽기」. 카드 전체가 그 글로 간다 */
function ReadingCard({ own, minutes, href, element }: { own: ReadingEntry; minutes: number | null; href: string; element: Parameters<typeof elementScope>[0] }) {
  return (
    <Link href={href} className={`${CARD_FRAME} ${elementScope(element)} flex flex-col gap-2.5 px-5 pb-4 pt-5 hover:bg-surface-sunken`}>
      <Icon name="quote" className="size-6 text-[var(--ink)]" />
      <p className="break-keep text-lead font-bold leading-[1.45]">{own.metaphor ?? READING_CONTINUE_NOTE}</p>
      <span className="flex items-center justify-between gap-3 border-t border-border pt-2.5 text-fine text-secondary">
        <span>{readingReceivedLine(own.createdAt, minutes)}</span>
        <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
          {READING_OPEN_LABEL}
          <Icon name="chevron" className="size-3.5" />
        </span>
      </span>
    </Link>
  );
}

/** 궁합 줄의 두 동그라미 — 이 사람이 앞, 상대가 살짝 겹쳐 뒤. 모르는 일간은 회색 원이다 */
function PairFaces({ stems }: { stems: readonly [Stem, Stem | null] }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center">
      {stems.map((stem, index) => (
        <span
          key={index}
          className={`${elementScope(stem === null ? null : STEM_INFO[stem].element)} grid size-8 place-items-center rounded-full bg-[var(--tile)] ring-2 ring-surface ${index === 1 ? '-ml-2.5' : ''}`}
        >
          {stem !== null && <StemSymbol stem={stem} className="size-5" />}
        </span>
      ))}
    </span>
  );
}
