'use client';

import { useId, useState } from 'react';

import {
  FLOW_BOX,
  FLOW_NOTE,
  FLOW_NOW_LABEL,
  FLOW_PIN,
  FLOW_TITLE,
  flowChartOf,
  flowLabelOf,
  flowNowYearOf,
  flowSpokenOf,
  type FlowPin,
  type PairFlow as Flow,
} from '@/src/lib/reading/flow';
import type { ManualSeat } from '@/src/lib/reading/manual';
import type { Element } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { READING_COLUMN } from './markdown';

/**
 * **우리 둘의 흐름** — 궁합풀이의 마지막 덩어리(ADR 0284, 결정 대기). 두 사람의 열 해를 곡선 둘로 — 위가 받쳐 주는 해, 아래가 쉬어 가는 해다.
 * 붙는 글자는 두 이름 · 「지금」 · 꼭대기 · 바닥 · 한 문장 · 「확정이 아니에요」뿐이고 눈금 숫자가 없다(시안 「우리 둘의 흐름」). 높낮이를 말로 읽는
 * 것은 낭독기뿐이다(`flowSpokenOf`).
 *
 * 곡선의 색은 그 사람의 일간 색이다 — 표지의 동그라미와 같은 색이라 이름표 없이도 누구의 곡선인지 이어진다. 두 사람의 색이 같으면 둘째 곡선을
 * 점선으로 그린다(색이 혼자 정보를 지지 않는다). 해 사이마다 위에 선 사람의 옅은 색을 깐다.
 *
 * 「지금」은 보는 날의 해다(`flowNowYearOf`) — 글을 만든 해가 아니다. 처음 그릴 때 한 번 잰다.
 */
export function PairFlow({
  flow,
  shown,
  names,
  tones,
  line,
}: {
  flow: Flow;
  /** 고른 차례의 두 자리 — 앞이 위에 그려지고 범례도 이 차례다 */
  shown: readonly [ManualSeat, ManualSeat];
  /** 두 자리의 지금 이름 — 「님」 없이 */
  names: Readonly<Record<ManualSeat, string>>;
  /** 두 자리의 일간 오행 — 모르면 `null`(회색) */
  tones: Readonly<Record<ManualSeat, Element | null>>;
  /** 그래프 밑 한 문장 — 자리 호칭을 지금 이름으로 바꾼 것 */
  line: string;
}) {
  const id = useId();
  const [nowYear] = useState(() => flowNowYearOf(new Date()));
  const chart = flowChartOf(flow, shown, nowYear);
  const dashed = tones[shown[0]] === tones[shown[1]];
  const { width, height, top, bottom, left, right, nowY } = FLOW_BOX;
  const from = flow.years[0].year;
  const to = flow.years[flow.years.length - 1].year;

  return (
    <section aria-labelledby={`${id}-title`} className={`${READING_COLUMN} mt-8 flex flex-col gap-5`}>
      <h3 id={`${id}-title`} className="flex items-center gap-2.5 text-heading font-bold leading-[1.45] tracking-[-0.01em] text-foreground">
        <span aria-hidden="true" className="h-6 w-1.5 shrink-0 rounded-full bg-[var(--mid,var(--border-strong))]" />
        <span>{FLOW_TITLE}</span>
      </h3>

      <figure className="flex flex-col gap-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={flowLabelOf([names[shown[0]], names[shown[1]]], from, to)}
          className="h-auto w-full overflow-visible"
        >
          {chart.bands.map((band) =>
            band.seat === null ? null : (
              <rect
                key={band.x}
                className={elementScope(tones[band.seat])}
                x={band.x}
                y={top - 8}
                width={band.width}
                height={bottom - top + 16}
                style={{ fill: 'var(--tile)', opacity: 0.6 }}
              />
            ),
          )}
          <line x1={left} y1={(top + bottom) / 2} x2={right} y2={(top + bottom) / 2} strokeDasharray="2 4" style={{ stroke: 'var(--border-strong)' }} />
          {[...chart.curves].reverse().map((curve) => (
            <path
              key={curve.seat}
              className={elementScope(tones[curve.seat])}
              d={curve.d}
              fill="none"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={dashed && curve.seat === shown[1] ? '7 6' : undefined}
              style={{ stroke: 'var(--ink)' }}
            />
          ))}
          {chart.now !== null && (
            <g>
              <line x1={chart.now.x} y1={top - 12} x2={chart.now.x} y2={bottom + 8} strokeWidth={1.4} strokeDasharray="3 3" style={{ stroke: 'var(--foreground)' }} />
              <text x={chart.now.x} y={nowY} textAnchor="middle" style={{ fill: 'var(--foreground)', fontSize: 12, fontWeight: 700 }}>
                {FLOW_NOW_LABEL}
              </text>
            </g>
          )}
          {chart.trough !== null && <Pin pin={chart.trough} dark={false} />}
          {chart.peak !== null && <Pin pin={chart.peak} dark />}
        </svg>

        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-small font-semibold text-secondary">
          {shown.map((seat) => (
            <li key={seat} className={`${elementScope(tones[seat])} flex items-center gap-1.5`}>
              <svg aria-hidden="true" viewBox="0 0 22 6" className="h-1.5 w-[22px]">
                <line
                  x1={1}
                  y1={3}
                  x2={21}
                  y2={3}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={dashed && seat === shown[1] ? '5 4' : undefined}
                  style={{ stroke: 'var(--ink)' }}
                />
              </svg>
              {names[seat]}
            </li>
          ))}
        </ul>
        <ol className="sr-only">
          {flowSpokenOf(flow, shown, names).map((spoken) => (
            <li key={spoken}>{spoken}</li>
          ))}
        </ol>
      </figure>

      <p className="text-pretty text-lead leading-[1.85] text-foreground/90">{line}</p>
      <p className="text-small leading-5 text-secondary">{FLOW_NOTE}</p>
    </section>
  );
}

/** 꼭대기(짙은 딱지) · 바닥(옅은 딱지) — 점과 그 위의 딱지 */
function Pin({ pin, dark }: { pin: FlowPin; dark: boolean }) {
  return (
    <g>
      <circle cx={pin.x} cy={pin.y} r={6} strokeWidth={2} style={{ fill: dark ? 'var(--foreground)' : 'var(--surface)', stroke: 'var(--foreground)' }} />
      <rect
        x={pin.box.x}
        y={pin.box.y}
        width={pin.box.width}
        height={FLOW_PIN.height}
        rx={FLOW_PIN.height / 2}
        strokeWidth={dark ? 0 : 1.2}
        style={{ fill: dark ? 'var(--foreground)' : 'var(--surface)', stroke: 'var(--foreground)' }}
      />
      <text
        x={pin.box.x + pin.box.width / 2}
        y={pin.box.y + 15}
        textAnchor="middle"
        style={{ fill: dark ? 'var(--background)' : 'var(--foreground)', fontSize: 12, fontWeight: 700 }}
      >
        {pin.text}
      </text>
    </g>
  );
}
