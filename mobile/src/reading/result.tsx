import type { CurrentReading } from '@reading/current-reading';
import { seatNicknamesOf, withNicknames, type PairNicknames } from '@reading/display';
import { READING_STALE_LABEL, READING_STALE_NOTE } from '@reading/notes';
import { COMPAT_SCORE_LABEL } from '@reading/copy';
import { ELEMENTS, STEM_INFO, type Element, type Stem } from '@saju';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { Paper, Tile } from '@/ui/surfaces';
import { ElementSymbol } from '@/ui/element-symbol';
import { ScoreGauge } from '@/ui/score-gauge';
import { StemSymbol } from '@/ui/stem-symbol';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import { Markdown } from './markdown';
import { ReadingContents, headingsOf } from './contents';
import type { ReadingTarget } from './api';
import { WordText } from '@/ui/word-text';

const softOf = (element: Element | null | undefined) => (element ? ELEMENT_TONE[element].soft : COLOR.noneSoft);

/** 표지의 면 — 한 사람은 제 색 한 면, 두 사람은 두 색이 비스듬히 만난다(`app/me/reading/essay.ts` 의 `coverFace`) */
export function CoverFace({ tones }: { tones: readonly (Element | null)[] | undefined }) {
  if (tones === undefined) return <View style={[StyleSheet.absoluteFill, { backgroundColor: COLOR.cream }]} />;
  if (tones.length < 2) return <View style={[StyleSheet.absoluteFill, { backgroundColor: softOf(tones[0]) }]} />;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: softOf(tones[0]) }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Polygon points="62,0 100,0 100,100 42,100" fill={softOf(tones[1])} />
      </Svg>
    </View>
  );
}

/** 궁합풀이 표지의 한 사람 — 이름과 일간. 화면이 보이는 차례 그대로 준다(웹의 `CoverPerson`) */
export type CoverPerson = { readonly name: string; readonly stem: Stem | null };

/** 다 된 글 — 표지(비유 · 점수) · 수정 전 경고 · 본문. 글자와 차례는 웹의 `reading-result.tsx` 와 같다 */
export function Result({
  reading,
  target,
  createdLabel,
  minutes,
  tones,
  nicknames,
  betweenSummaryAndBody,
  coverAction,
  belowCover,
  pair,
}: {
  /** 궁합풀이 표지(시안 A, 운영자 승인 2026-11-13) — 두 사람 · 반원 게이지 · 비유 · 날짜를 가운데로. 비공개 궁합만 넘긴다 */
  pair?: readonly [CoverPerson, CoverPerson];
  reading: CurrentReading;
  target: ReadingTarget;
  createdLabel: string | null;
  minutes: number | null;
  tones: readonly (Element | null)[] | undefined;
  /** 두 사람 글의 자리 호칭을 바꿔 넣을 닉네임 — 궁합 화면만 넘긴다 */
  nicknames?: PairNicknames;
  /** 점수 · 한 문장 결론 다음, 본문 전에 세울 내용 — 궁합 화면이 넘긴다 */
  betweenSummaryAndBody?: ReactNode;
  /** 표지 첫 줄 끝의 아이콘 — 공유. 세울지는 `panelChrome().canShare` 한 벌이 정한다 */
  coverAction?: ReactNode;
  /** 표지 바로 아래에 세울 줄 — 표지 아이콘의 실패 줄. 표지 위에 띄우면 비유 글을 덮는다 */
  belowCover?: ReactNode;
}) {
  const seats = nicknames === undefined ? null : seatNicknamesOf(nicknames, reading.viewerIsFirst);
  const named = (text: string) => (seats === null ? text : withNicknames(text, seats));
  const metaphor = reading.metaphor === null ? null : named(reading.metaphor);
  const body = named(reading.output);
  const titles = useMemo(() => headingsOf(body), [body]);

  const meta = (
    <WordText style={styles.meta}>
      {createdLabel} 생성{' · '}읽는 데 약 {minutes}분
    </WordText>
  );

  return (
    <View style={styles.result}>
      {pair !== undefined ? (
        <PairCover pair={pair} score={reading.score} metaphor={metaphor} meta={meta} action={coverAction} />
      ) : reading.score !== null || metaphor !== null ? (
        <Paper style={styles.cover}>
          <CoverFace tones={tones} />
          {metaphor !== null ? (
            <>
              {coverAction !== undefined && <View style={styles.coverAction}>{coverAction}</View>}
              <WordText aria-hidden style={styles.quote}>
                “
              </WordText>
              <WordText style={styles.metaphor}>{metaphor}</WordText>
            </>
          ) : (
            <WordText style={styles.coverTitle}>풀이 결과</WordText>
          )}
          <View style={styles.caption}>
            <View style={styles.grow}>{meta}</View>
            {reading.score !== null && (
              <View style={styles.score}>
                <WordText style={styles.scoreLabel}>{COMPAT_SCORE_LABEL}</WordText>
                <WordText style={styles.scoreValue}>
                  {reading.score} <WordText style={styles.scoreLabel}>/ 100</WordText>
                </WordText>
              </View>
            )}
          </View>
        </Paper>
      ) : (
        meta
      )}

      {belowCover}

      {target.kind !== 'match' && !reading.fromCurrentChart && (
        <Tile tone={COLOR.warningWash} style={styles.stale}>
          <WordText style={styles.staleText}>
            <WordText style={styles.staleLabel}>{READING_STALE_LABEL} </WordText>
            {READING_STALE_NOTE}
          </WordText>
        </Tile>
      )}

      {betweenSummaryAndBody}

      {target.kind === 'match' && (
        <View>
          <WordText style={styles.coverTitle}>두 사람의 풀이</WordText>
          <WordText style={styles.bodyHead}>궁합풀이 결과</WordText>
        </View>
      )}

      <ReadingContents titles={titles} />

      <Markdown source={body} />

      <View aria-hidden style={styles.end}>
        {ELEMENTS.map((element) => (
          <ElementSymbol key={element} element={element} size={20} />
        ))}
      </View>
    </View>
  );
}

/**
 * 궁합풀이 표지 — 시안 A 「점수를 가운데 크게」(웹 `reading-result.tsx` 의 `PairCover`). 두 사람 → 게이지 · 「궁합 점수」 → 비유 → 날짜, 모두 가운데.
 * 큰 따옴표와 구분선은 걷었다. 점수가 없는 옛 궁합은 게이지와 그 이름이 빠진다. 공유 아이콘은 오른쪽 위 그대로다.
 */
function PairCover({
  pair,
  score,
  metaphor,
  meta,
  action,
}: {
  pair: readonly [CoverPerson, CoverPerson];
  score: number | null;
  metaphor: string | null;
  meta: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Paper style={styles.pairCover}>
      {action !== undefined && <View style={styles.pairAction}>{action}</View>}
      <View style={styles.pairNames}>
        <CoverName person={pair[0]} />
        <WordText style={styles.pairTimes}>×</WordText>
        <CoverName person={pair[1]} />
      </View>
      {score !== null && (
        <View style={styles.pairScore}>
          <ScoreGauge score={score} />
          <WordText style={styles.coverTitle}>{COMPAT_SCORE_LABEL}</WordText>
        </View>
      )}
      {metaphor !== null && <WordText style={styles.pairMetaphor}>{metaphor}</WordText>}
      <View style={styles.pairMeta}>{meta}</View>
    </Paper>
  );
}

/** 동그라미(일간 그림 · 오행 soft 색) + 이름 — 일간을 모르면 회색 동그라미만 */
function CoverName({ person }: { person: CoverPerson }) {
  const element = person.stem === null ? null : STEM_INFO[person.stem].element;
  return (
    <View style={styles.pairPerson}>
      <View aria-hidden style={[styles.pairCircle, { backgroundColor: softOf(element) }]}>
        {person.stem !== null && <StemSymbol stem={person.stem} size={20} />}
      </View>
      <WordText style={styles.pairName}>{person.name}</WordText>
    </View>
  );
}

const styles = StyleSheet.create({
  result: { gap: 24 },
  pairCover: { alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },
  pairAction: { position: 'absolute', top: 8, right: 8, zIndex: 1 },
  /* 아이콘 자리(44)만큼 양옆을 비워 긴 이름이 단추 밑에 깔리지 않는다 */
  pairNames: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 10, rowGap: 4, paddingHorizontal: 40, maxWidth: '100%' },
  pairPerson: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  pairCircle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  pairName: { flexShrink: 1, fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 24, color: COLOR.foreground },
  pairTimes: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  pairScore: { alignItems: 'center', gap: 6, marginTop: 4 },
  pairMetaphor: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 29, color: COLOR.foreground, textAlign: 'center' },
  pairMeta: { alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  cover: { overflow: 'hidden', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 },
  coverAction: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  quote: { height: 40, fontFamily: FONT.bold, fontSize: 64, lineHeight: 72, color: COLOR.foreground, opacity: 0.7 },
  metaphor: { marginTop: 8, fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 36, color: COLOR.foreground },
  coverTitle: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  caption: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 32, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLOR.border },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  score: { alignItems: 'flex-end' },
  scoreLabel: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  scoreValue: { fontFamily: FONT.bold, fontSize: TYPE.figure, color: COLOR.foreground },
  stale: { paddingHorizontal: 16, paddingVertical: 14 },
  staleText: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 24, color: COLOR.foreground },
  staleLabel: { fontFamily: FONT.bold, color: ELEMENT_TONE.土.ink },
  bodyHead: { marginTop: 4, fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  end: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 24, opacity: 0.8 },
});
