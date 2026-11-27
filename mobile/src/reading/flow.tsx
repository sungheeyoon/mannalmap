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
} from '@reading/flow';
import type { ManualSeat } from '@reading/manual';
import type { Element } from '@saju';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { Heading } from '@/ui/heading';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE_META, TYPE_SECTION, alpha } from '@/ui/tokens';
import { WordText } from '@/ui/word-text';

import { BODY_TEXT } from './markdown';

const inkOf = (element: Element | null) => (element === null ? COLOR.none : ELEMENT_TONE[element].ink);
const softOf = (element: Element | null) => (element === null ? COLOR.noneSoft : ELEMENT_TONE[element].soft);

/**
 * **우리 둘의 흐름**(ADR 0284, 결정 대기) — 웹 `app/me/reading/pair-flow.tsx` 와 같은 자리 · 글자다(`flowChartOf`). 곡선의 색은 그 사람의 일간
 * 색이고, 두 색이 같으면 둘째 곡선이 점선이다. 붙는 글자는 두 이름 · 「지금」 · 꼭대기 · 바닥 · 한 문장 · 「확정이 아니에요」뿐이다. 「지금」은
 * 보는 날의 해다(처음 그릴 때 한 번 잰다).
 */
export function PairFlow({
  flow,
  shown,
  names,
  tones,
  line,
}: {
  flow: Flow;
  shown: readonly [ManualSeat, ManualSeat];
  names: Readonly<Record<ManualSeat, string>>;
  tones: Readonly<Record<ManualSeat, Element | null>>;
  line: string;
}) {
  const [nowYear] = useState(() => flowNowYearOf(new Date()));
  /* 판의 폭은 그려진 뒤에 안다 — 그 폭에 비율을 맞춘다(사람 지도 `relation-map.tsx` 와 같은 길) */
  const [drawn, setDrawn] = useState(0);
  const chart = flowChartOf(flow, shown, nowYear);
  const dashed = tones[shown[0]] === tones[shown[1]];
  const { width, height, top, bottom, left, right, nowY } = FLOW_BOX;
  const from = flow.years[0].year;
  const to = flow.years[flow.years.length - 1].year;
  const spoken = `${flowLabelOf([names[shown[0]], names[shown[1]]], from, to)}. ${flowSpokenOf(flow, shown, names).join('. ')}`;

  return (
    <View style={styles.flow}>
      {/* 본문의 절 머리와 같은 꼴(`markdown.tsx` 의 `heading`) — 일곱째 덩어리다 */}
      <View style={styles.heading}>
        <View style={styles.headingBar} />
        <Heading style={styles.headingText}>{FLOW_TITLE}</Heading>
      </View>

      <View accessible accessibilityRole="image" accessibilityLabel={spoken} style={styles.figure}>
        <View onLayout={(event) => setDrawn(event.nativeEvent.layout.width)} style={{ aspectRatio: width / height }}>
          {drawn > 0 && (
        <Svg width={drawn} height={(drawn * height) / width} viewBox={`0 0 ${width} ${height}`}>
          {chart.bands.map((band) =>
            band.seat === null ? null : (
              <Rect key={band.x} x={band.x} y={top - 8} width={band.width} height={bottom - top + 16} fill={alpha(softOf(tones[band.seat]), 0.6)} />
            ),
          )}
          <Line x1={left} y1={(top + bottom) / 2} x2={right} y2={(top + bottom) / 2} stroke={COLOR.borderStrong} strokeDasharray="2 4" />
          {[...chart.curves].reverse().map((curve) => (
            <Path
              key={curve.seat}
              d={curve.d}
              fill="none"
              stroke={inkOf(tones[curve.seat])}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={dashed && curve.seat === shown[1] ? '7 6' : undefined}
            />
          ))}
          {chart.now !== null && (
            <G>
              <Line x1={chart.now.x} y1={top - 12} x2={chart.now.x} y2={bottom + 8} stroke={COLOR.foreground} strokeWidth={1.4} strokeDasharray="3 3" />
              <SvgText x={chart.now.x} y={nowY} textAnchor="middle" fill={COLOR.foreground} fontSize={12} fontFamily={FONT.bold}>
                {FLOW_NOW_LABEL}
              </SvgText>
            </G>
          )}
          {chart.trough !== null && <Pin pin={chart.trough} dark={false} />}
          {chart.peak !== null && <Pin pin={chart.peak} dark />}
        </Svg>
          )}
        </View>

        <View style={styles.legend}>
          {shown.map((seat) => (
            <View key={seat} style={styles.legendItem}>
              <Svg width={22} height={6} viewBox="0 0 22 6">
                <Line
                  x1={1}
                  y1={3}
                  x2={21}
                  y2={3}
                  stroke={inkOf(tones[seat])}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={dashed && seat === shown[1] ? '5 4' : undefined}
                />
              </Svg>
              <WordText style={styles.legendName}>{names[seat]}</WordText>
            </View>
          ))}
        </View>
      </View>

      {/* 본문 문단과 같은 글자(`markdown.tsx` 의 `BODY_TEXT`) */}
      <WordText style={BODY_TEXT}>{line}</WordText>
      <WordText style={styles.note}>{FLOW_NOTE}</WordText>
    </View>
  );
}

/** 꼭대기(짙은 딱지) · 바닥(옅은 딱지) — 점과 그 위의 딱지 */
function Pin({ pin, dark }: { pin: FlowPin; dark: boolean }) {
  return (
    <G>
      <Circle cx={pin.x} cy={pin.y} r={6} fill={dark ? COLOR.foreground : COLOR.surface} stroke={COLOR.foreground} strokeWidth={2} />
      <Rect
        x={pin.box.x}
        y={pin.box.y}
        width={pin.box.width}
        height={FLOW_PIN.height}
        rx={FLOW_PIN.height / 2}
        fill={dark ? COLOR.foreground : COLOR.surface}
        stroke={COLOR.foreground}
        strokeWidth={dark ? 0 : 1.2}
      />
      <SvgText
        x={pin.box.x + pin.box.width / 2}
        y={pin.box.y + 15}
        textAnchor="middle"
        fill={dark ? COLOR.background : COLOR.foreground}
        fontSize={12}
        fontFamily={FONT.bold}
      >
        {pin.text}
      </SvgText>
    </G>
  );
}

const styles = StyleSheet.create({
  flow: { gap: 20, marginTop: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingBar: { width: 6, height: 24, borderRadius: RADIUS.pill, backgroundColor: COLOR.borderStrong },
  headingText: { ...TYPE_SECTION, flex: 1 },
  figure: { gap: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 20, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendName: { ...TYPE_META, fontFamily: FONT.bold },
  note: { ...TYPE_META },
});
