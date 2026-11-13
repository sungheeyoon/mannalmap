import { SCORE_GAUGE, scoreGaugeArcs } from '@design';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { COLOR, ELEMENT_TONE, FONT, TYPE } from './tokens';
import { WordText } from './word-text';

/**
 * **점수 반원 게이지** — 웹 `app/ui/score-gauge.tsx` 와 같은 꼴이다. 지름 · 굵기 · 호는 `src/lib/design/gauge.ts` 한 원본이고,
 * 색은 바탕 `track` · 찬 호 `earth-mid` 토큰이다. 그림은 꾸밈이라 낭독기에 안 읽히고, 수는 글자로 선다.
 */
export function ScoreGauge({ score }: { score: number }) {
  const { width, height, track, fill } = scoreGaugeArcs(score);
  return (
    <View style={{ width, height }}>
      <Svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
        <Path d={track} stroke={COLOR.track} strokeWidth={SCORE_GAUGE.stroke} strokeLinecap="round" />
        {fill !== null && <Path d={fill} stroke={ELEMENT_TONE.土.mid} strokeWidth={SCORE_GAUGE.stroke} strokeLinecap="round" />}
      </Svg>
      <View style={styles.value}>
        <WordText style={styles.number}>
          {score}
          <WordText style={styles.unit}>점</WordText>
        </WordText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  number: { fontFamily: FONT.bold, fontSize: TYPE.figure, lineHeight: TYPE.figure + 4, color: COLOR.foreground },
  unit: { fontFamily: FONT.bold, fontSize: TYPE.lead },
});
