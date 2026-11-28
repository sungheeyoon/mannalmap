'use client';

import { useId, useState, type KeyboardEvent } from 'react';

import {
  MANUAL_CHIPS_LABEL,
  MANUAL_CORE_LABEL,
  MANUAL_JUMP_LABEL,
  MANUAL_SITUATIONS,
  MANUAL_SITUATION_LABEL,
  MANUAL_TABS_LABEL,
  MANUAL_TITLE,
  type ManualCard,
  type ManualSituation,
} from '@/src/lib/reading/manual';

import { SOFT_CARD_FACE, TYPE_META } from '../../ui/surfaces';
import { READING_COLUMN } from './markdown';

/** 카드의 자리 — 표지 아래 결론 한 줄의 「사용 설명서 ›」가 이리로 내린다 */
export const manualAnchorOf = (readingId: string): string => `manual-${readingId}`;

/** 탭 줄 안에서 화살표 · Home · End 로 옮길 다음 자리 — 아니면 `null` */
function nextIn(event: KeyboardEvent<HTMLButtonElement>, at: number, count: number): number | null {
  const last = count - 1;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') return (at + 1) % count;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') return (at + last) % count;
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return last;
  return null;
}

/**
 * **표지 아래 결론 한 줄**(ADR 0283 추기 — 운영자 「결론부터 보고 싶어 하는 사람」) — 첫 칸 사람의 「한 줄 사용법」 한 줄과, 글 끝의 카드로
 * 내리는 「사용 설명서 ›」뿐이다. 카드는 글 끝(공유 · 다시 받기 바로 위)에 선다.
 */
export function ManualLead({ card, anchor }: { card: ManualCard; anchor: string }) {
  return (
    <section aria-label={card.lead.label} className={`${READING_COLUMN} flex flex-col gap-1.5 ${SOFT_CARD_FACE} px-5 pb-2 pt-4`}>
      <p className={TYPE_META}>{card.lead.label}</p>
      <p className="text-pretty text-lead font-semibold leading-7 text-foreground">{card.lead.text}</p>
      <a
        href={`#${anchor}`}
        className="-mr-2 inline-flex min-h-11 items-center self-end rounded-full px-2 text-note font-semibold text-secondary underline-offset-4 hover:text-foreground hover:underline"
      >
        {MANUAL_JUMP_LABEL}
      </a>
    </section>
  );
}

/**
 * **궁합풀이의 사용 설명서 카드**(ADR 0283) — 위에 두 칸(내가 끼면 「{상대} 사용 설명서 | 내 사용 설명서」, 남 둘이면 「{A} | {B}」), 고른 칸의
 * 「한 줄 사용법」, 상황 칩 넷과 그 한 줄, 아래에 「우리 둘은」 · 「자꾸 부딪히는 자리」가 늘 선다.
 *
 * 두 칸과 칩은 둘 다 탭이다(`role="tab"`) — 고르면 아래 판의 줄이 바뀐다(사주표의 `CardTabs` 와 같은 길). 화살표 · Home · End 로 옮긴다. 칸을
 * 바꿔도 고른 상황은 그대로다 — 같은 장면을 두 사람 쪽에서 견줘 본다. 줄의 길이가 칩마다 달라 판의 높이를 잡아 둔다 — 고를 때마다 아래가
 * 들썩이지 않게.
 */
export function PairManual({ card, anchor }: { card: ManualCard; anchor: string }) {
  const base = useId();
  const [tab, setTab] = useState(0);
  const [shown, setShown] = useState<ManualSituation>('ask');
  const person = card.tabs[tab];
  const tabId = (at: number) => `${base}-person-${at}`;
  const chipId = (situation: ManualSituation) => `${base}-chip-${situation}`;

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, at: number) => {
    const next = nextIn(event, at, card.tabs.length);
    if (next === null) return;
    event.preventDefault();
    setTab(next);
    document.getElementById(tabId(next))?.focus();
  };
  const moveChip = (event: KeyboardEvent<HTMLButtonElement>, at: number) => {
    const next = nextIn(event, at, MANUAL_SITUATIONS.length);
    if (next === null) return;
    event.preventDefault();
    setShown(MANUAL_SITUATIONS[next]);
    document.getElementById(chipId(MANUAL_SITUATIONS[next]))?.focus();
  };

  return (
    <section
      id={anchor}
      aria-labelledby={`${base}-title`}
      className={`${READING_COLUMN} flex scroll-mt-20 flex-col gap-4 ${SOFT_CARD_FACE} px-4 pb-6 pt-4 sm:px-6`}
    >
      <h2 id={`${base}-title`} className="sr-only">
        {MANUAL_TITLE}
      </h2>

      <div role="tablist" aria-label={MANUAL_TABS_LABEL} className="grid grid-cols-2 gap-1 rounded-cell bg-surface p-1 ring-1 ring-border">
        {card.tabs.map((one, at) => {
          const on = at === tab;
          return (
            <button
              key={one.seat}
              id={tabId(at)}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${base}-person`}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(at)}
              onKeyDown={(event) => moveTab(event, at)}
              className={`flex min-h-11 items-center justify-center rounded-cell px-2 py-1.5 text-center text-note font-bold leading-5 transition-colors ${
                on ? 'bg-foreground text-background' : 'text-secondary hover:text-foreground'
              }`}
            >
              <span className="text-balance break-keep">{one.title}</span>
            </button>
          );
        })}
      </div>

      <div id={`${base}-person`} role="tabpanel" aria-labelledby={tabId(tab)} className="flex flex-col gap-4 px-1">
        <p className="flex flex-col gap-0.5">
          <span className={TYPE_META}>{MANUAL_CORE_LABEL}</span>
          <span className="text-pretty text-lead font-semibold leading-7 text-foreground">{person.core}</span>
        </p>

        <div role="tablist" aria-label={MANUAL_CHIPS_LABEL} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {MANUAL_SITUATIONS.map((situation, at) => {
            const on = situation === shown;
            return (
              <button
                key={situation}
                id={chipId(situation)}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`${base}-line`}
                tabIndex={on ? 0 : -1}
                onClick={() => setShown(situation)}
                onKeyDown={(event) => moveChip(event, at)}
                className={`relative flex min-h-9 items-center justify-center rounded-full px-3.5 text-note font-semibold transition-colors after:absolute after:inset-x-0 after:-inset-y-1 active:scale-[0.97] ${
                  on ? 'bg-foreground text-background' : 'bg-surface text-secondary ring-1 ring-border hover:text-foreground'
                }`}
              >
                {MANUAL_SITUATION_LABEL[situation]}
              </button>
            );
          })}
        </div>

        <p
          id={`${base}-line`}
          role="tabpanel"
          aria-labelledby={chipId(shown)}
          className="min-h-[6rem] text-pretty text-body leading-7 text-foreground sm:min-h-[4rem]"
        >
          {person.lines[shown]}
        </p>
      </div>

      <dl className="mx-1 flex flex-col gap-3 border-t border-border pt-4">
        {[card.us, card.clash].map((line) => (
          <div key={line.label} className="flex flex-col gap-0.5">
            <dt className={TYPE_META}>{line.label}</dt>
            <dd className="text-pretty text-body leading-7 text-foreground">{line.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
