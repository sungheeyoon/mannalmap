'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ORDER_NUMBER_ASK } from '@/src/lib/account/words';
import {
  BUY_HISTORY_EMPTY,
  HISTORY_TABS,
  HISTORY_TITLE,
  USE_HISTORY_EMPTY,
  type HistoryLine,
  type HistoryTab,
} from '@/src/lib/reading/credit-history';
import { CREDITS_AVAILABLE_LABEL } from '@/src/lib/reading/notes';

import { BUTTON_TERTIARY } from '../../../ui/buttons';
import { COLUMN, FLAT_CARD_FACE, SOFT_CARD_FACE, TYPE_CAPTION, TYPE_META, TYPE_TITLE } from '../../../ui/surfaces';
import { TopBar } from '../../../ui/top-bar';

/**
 * 한 줄 — 카카오페이지 「캐시 내역」의 행 꼴: 위 왼쪽 이름 · 위 오른쪽 값, 그 아래 덧붙임, 맨 아래 왼쪽 시각 · 오른쪽 상태(환불 · 회수는 빨강).
 * 보조 정보와 상태를 오른쪽에 맞추는 것은 토스 TDS 의 목록 꼴이다.
 */
function Row({ line }: { line: HistoryLine }) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-body font-semibold text-foreground">{line.title}</span>
        <span className={`shrink-0 text-body font-semibold tabular-nums ${line.struck ? 'text-muted line-through' : 'text-foreground'}`}>
          {line.value}
        </span>
      </div>
      {line.notes.map((note) => (
        <span key={note} className={`${TYPE_CAPTION} break-all`}>
          {note}
        </span>
      ))}
      <div className="flex items-baseline justify-between gap-3">
        <span className={`${TYPE_CAPTION} tabular-nums`}>{line.when}</span>
        {line.status !== null && (
          <span className={`shrink-0 text-fine font-semibold ${line.danger ? 'text-danger' : 'text-secondary'}`}>{line.status}</span>
        )}
      </div>
    </li>
  );
}

/**
 * 결제 내역의 몸 — 보유 수 한 줄 · 「구매 내역 / 사용 내역」 두 탭 · 환불 신청 절(ADR 0174 · 0263). 읽기와 줄 짓기는 `page.tsx` 가 하고 여기는
 * 받은 줄을 그리기만 한다. 탭은 이미 받은 두 목록 사이를 고르는 것이라 서버에 다시 묻지 않는다 — 고른 탭은 주소(`?tab=use`)에 남겨
 * 새로 고침 · 뒤로 가기에도 그 탭이 선다.
 */
export function HistoryView({
  available,
  purchases,
  uses,
  initialTab,
  refundLine,
}: {
  available: number | null;
  purchases: readonly HistoryLine[];
  uses: readonly HistoryLine[];
  initialTab: HistoryTab;
  refundLine: string;
}) {
  const [tab, setTab] = useState<HistoryTab>(initialTab);
  const lines = tab === 'buy' ? purchases : uses;
  const choose = (next: HistoryTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'use') url.searchParams.set('tab', 'use');
    else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url);
  };

  return (
    <main className={`app-shell flex w-full ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
      <TopBar back={{ href: '/me/credits', label: '풀이권' }}>
        <header className="flex flex-col gap-1">
          <h1 className={TYPE_TITLE}>{HISTORY_TITLE}</h1>
          {available !== null && (
            <p className={TYPE_META}>
              {CREDITS_AVAILABLE_LABEL} <b className="font-semibold text-foreground tabular-nums">{available}장</b>
            </p>
          )}
        </header>
      </TopBar>

      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label={HISTORY_TITLE} className="flex border-b border-border">
          {HISTORY_TABS.map((one) => {
            const selected = tab === one.id;
            return (
              <button
                key={one.id}
                id={`history-tab-${one.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="history-panel"
                onClick={() => choose(one.id)}
                className={`-mb-px min-h-11 flex-1 border-b-2 text-center text-body font-semibold ${
                  selected ? 'border-foreground text-foreground' : 'border-transparent text-muted'
                }`}
              >
                {one.label}
              </button>
            );
          })}
        </div>

        <div id="history-panel" role="tabpanel" aria-labelledby={`history-tab-${tab}`}>
          {lines.length === 0 ? (
            <p className={`${TYPE_META} py-6 text-center`}>{tab === 'buy' ? BUY_HISTORY_EMPTY : USE_HISTORY_EMPTY}</p>
          ) : (
            <ul className={`${FLAT_CARD_FACE} flex flex-col divide-y divide-border overflow-hidden`}>
              {lines.map((line) => (
                <Row key={line.key} line={line} />
              ))}
            </ul>
          )}
        </div>
      </div>

      <section aria-labelledby="refund-how" className={`${SOFT_CARD_FACE} flex flex-col gap-1.5 px-5 py-4`}>
        <h2 id="refund-how" className="text-body font-semibold text-foreground">
          환불 신청
        </h2>
        <p className="text-small leading-6 text-secondary">{refundLine}</p>
        <p className="text-small leading-6 text-secondary">{ORDER_NUMBER_ASK}</p>
        <p>
          <Link href="/refund" className={BUTTON_TERTIARY}>
            환불정책 보기
          </Link>
        </p>
      </section>
    </main>
  );
}
