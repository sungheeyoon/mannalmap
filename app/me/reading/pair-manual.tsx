'use client';

import { useId, useState, type KeyboardEvent } from 'react';

import {
  MANUAL_CHIPS_LABEL,
  MANUAL_SITUATIONS,
  MANUAL_SITUATION_LABEL,
  type ManualCard,
  type ManualSituation,
} from '@/src/lib/reading/manual';

import { SOFT_CARD_FACE, TYPE_META, TYPE_SECTION } from '../../ui/surfaces';
import { READING_COLUMN } from './markdown';

/**
 * **궁합풀이의 사용 설명서 카드**(ADR 0283) — 상황 칩 넷을 고르면 그 한 줄이 바뀐다. 아래에 「우리 둘은」 · 「자꾸 부딪히는 자리」가 늘 선다.
 *
 * 칩은 탭이다(`role="tab"`) — 고르면 아래 판의 줄이 바뀌는 것이 탭의 일이고(사주표의 `CardTabs` 와 같은 길), 화살표 · Home · End 로 옮긴다. 모양은 풀이
 * 보관함의 종류 칩과 같다(`frame.tsx`) — 폰에서는 둘씩 두 줄, 넓은 화면에서는 한 줄이다. 줄의 길이가 칩마다 달라 판의 높이를 줄 수로 잡아 둔다 —
 * 고를 때마다 아래가 들썩이지 않게.
 */
export function PairManual({ card }: { card: ManualCard }) {
  const base = useId();
  const [shown, setShown] = useState<ManualSituation>('ask');
  const rows = card.lines[shown];
  const tabId = (situation: ManualSituation) => `${base}-tab-${situation}`;

  const move = (event: KeyboardEvent<HTMLButtonElement>, at: number) => {
    const last = MANUAL_SITUATIONS.length - 1;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? (at + 1) % MANUAL_SITUATIONS.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (at + last) % MANUAL_SITUATIONS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setShown(MANUAL_SITUATIONS[next]);
    document.getElementById(tabId(MANUAL_SITUATIONS[next]))?.focus();
  };

  return (
    <section aria-labelledby={`${base}-title`} className={`${READING_COLUMN} flex flex-col gap-4 ${SOFT_CARD_FACE} px-5 pb-6 pt-5 sm:px-7`}>
      <h2 id={`${base}-title`} className={TYPE_SECTION}>
        {card.title}
      </h2>

      <div role="tablist" aria-label={MANUAL_CHIPS_LABEL} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {MANUAL_SITUATIONS.map((situation, at) => {
          const on = situation === shown;
          return (
            <button
              key={situation}
              id={tabId(situation)}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${base}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setShown(situation)}
              onKeyDown={(event) => move(event, at)}
              className={`relative flex min-h-9 items-center justify-center rounded-full px-3.5 text-note font-semibold transition-colors after:absolute after:inset-x-0 after:-inset-y-1 active:scale-[0.97] ${
                on ? 'bg-foreground text-background' : 'bg-surface text-secondary ring-1 ring-border hover:text-foreground'
              }`}
            >
              {MANUAL_SITUATION_LABEL[situation]}
            </button>
          );
        })}
      </div>

      <div
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={tabId(shown)}
        className={`flex flex-col gap-3 ${rows.length > 1 ? 'min-h-[10.5rem] sm:min-h-[7.5rem]' : 'min-h-[6rem] sm:min-h-[4rem]'}`}
      >
        {rows.map((row) =>
          row.label === null ? (
            <p key="one" className="text-pretty text-lead font-medium leading-8 text-foreground">
              {row.text}
            </p>
          ) : (
            <p key={row.label} className="flex flex-col gap-0.5">
              <span className="text-small font-semibold text-secondary">{row.label}</span>
              <span className="text-pretty text-body leading-7 text-foreground">{row.text}</span>
            </p>
          ),
        )}
      </div>

      <dl className="flex flex-col gap-3 border-t border-border pt-4">
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
