import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { LOADING, LOADING_LABEL } from '@design';

import { EASE, MOTION, useReducedMotion } from './motion';
import { COLOR, ELEMENT_TONE } from './tokens';

/*
  **로딩 두 모양** — 웹 `app/ui/loading.tsx` 와 같은 이름 · 같은 값이다(운영자 결정 2026-11-08). 크기 · 각도는 `LOADING`, 시간은 `MOTION` 으로
  한 원본(`src/lib/design/tokens.json`)에서 난다.

  - `LoadingDots` — 목 · 화 · 토 · 금 · 수 다섯 점이 차례로 튀어 오른다. 처음 불러오는 동안 본문이 비는 자리의 공용 로딩이다
  - `LoadingOrbit` — 로고의 「나」 둘레를 물 · 나무 · 흙이 돈다. 오래 걸리는 자리(풀이를 만드는 동안 · 앱의 첫 진입)에만 쓴다

  둘 다 `MOTION.delay` 안에 끝나는 로딩에서는 보이지 않고, 움직임을 줄인 기기에는 멈춘 모양이다. 글자는 없고 낭독기에만 「불러오는 중」이다.
*/

/** 웹은 네이티브 애니메이션 모듈이 없다 — 그 자리에서는 JS 로 돈다 */
const NATIVE = Platform.OS !== 'web';

const DOT_TONES = [ELEMENT_TONE.木.mid, ELEMENT_TONE.火.mid, ELEMENT_TONE.土.mid, ELEMENT_TONE.金.mid, ELEMENT_TONE.水.mid];

/** 빠른 로딩에서 깜박이지 않게 — `MOTION.delay` 가 지나야 보인다 */
function useShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const later = setTimeout(() => setShown(true), MOTION.delay);
    return () => clearTimeout(later);
  }, []);
  return shown;
}

/** 0 → 1 → 0 을 `period` 마다 — 오르내리는 쪽은 `rise` 둘, 나머지는 쉰다. `wait` 만큼 늦게 처음 시작한다 */
function usePulse(still: boolean, period: number, rise: number, wait = 0): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const step = (toValue: number) => Animated.timing(value, { toValue, duration: rise, easing: EASE.loop, useNativeDriver: NATIVE });
    const run = Animated.sequence([
      Animated.delay(wait),
      Animated.loop(Animated.sequence([step(1), step(0), Animated.delay(period - 2 * rise)])),
    ]);
    run.start();
    return () => {
      run.stop();
      value.setValue(0);
    };
  }, [value, still, period, rise, wait]);
  return value;
}

/** 0 → 1 을 `period` 마다 고르게 — 한 바퀴 */
function useTurn(still: boolean, period: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const run = Animated.loop(Animated.timing(value, { toValue: 1, duration: period, easing: (t) => t, useNativeDriver: NATIVE }));
    run.start();
    return () => {
      run.stop();
      value.setValue(0);
    };
  }, [value, still, period]);
  return value;
}

/** 로딩이 낭독기에 하는 말 — 장식으로 쓰는 자리(곁에 상태 글이 이미 있는 자리)는 숨긴다 */
const spoken = (decorative: boolean) =>
  decorative ? ({ 'aria-hidden': true } as const) : ({ accessible: true, accessibilityRole: 'progressbar', accessibilityLabel: LOADING_LABEL } as const);

/**
 * **오행 다섯 점** — 처음 불러오는 동안 본문이 비는 화면의 공용 로딩. 기본 자리는 남은 본문 높이를 채우고 그 세로 · 가로 가운데다
 * (운영자 지시 2026-11-08) — 맨 위 줄 · 머리 · 아래 탭 막대를 뺀 높이의 가운데다. 부모는 높이를 가져야 한다: `flex: 1` 인 판이거나,
 * ScrollView 면 `contentContainerStyle` 에 `flexGrow: 1` 이다.
 * `inline` 은 화면 안 한 칸(풀이 칸)을 채우는 동안 — 높이를 채우지 않고 그 칸의 가운데다.
 */
export function LoadingDots({ inline = false, style }: { inline?: boolean; style?: StyleProp<ViewStyle> }) {
  const shown = useShown();
  const still = useReducedMotion();
  return (
    <View {...spoken(false)} style={[styles.place, inline && styles.inline, style]}>
      <View style={[styles.dots, !shown && styles.hidden]}>
        {DOT_TONES.map((tone, at) => (
          <Dot key={tone} tone={tone} at={at} still={still} />
        ))}
      </View>
    </View>
  );
}

function Dot({ tone, at, still }: { tone: string; at: number; still: boolean }) {
  /* 웹의 `hop` — 주기의 30% 에 꼭대기, 60% 에 제자리, 나머지는 쉰다 */
  const lift = usePulse(still, MOTION.shimmer, MOTION.shimmer * 0.3, at * MOTION.stagger);
  const moving = {
    opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [LOADING.dotDim, 1] }),
    transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -LOADING.hop] }) }],
  };
  return <Animated.View style={[styles.dot, { backgroundColor: tone }, still ? styles.dotStill : moving]} />;
}

const PLANETS = [
  { size: LOADING.water, tone: ELEMENT_TONE.水.mid, at: LOADING.waterAt, period: MOTION.flow },
  { size: LOADING.wood, tone: ELEMENT_TONE.木.mid, at: LOADING.woodAt, period: MOTION.orbitMid },
  { size: LOADING.earth, tone: ELEMENT_TONE.土.mid, at: LOADING.earthAt, period: MOTION.orbitFar },
];

/**
 * **궤도(로고)** — 오래 걸리는 자리에만. 멈춘 모양은 로고의 자리 그대로다(물은 위 · 나무는 오른쪽 아래 · 흙은 왼쪽 아래).
 * `decorative` 는 곁에 상태 글이 이미 있는 자리 — 낭독기가 같은 말을 두 번 읽지 않게 숨긴다.
 */
export function LoadingOrbit({ decorative = false, style }: { decorative?: boolean; style?: StyleProp<ViewStyle> }) {
  const shown = useShown();
  const still = useReducedMotion();
  const breath = usePulse(still, MOTION.flow, MOTION.flow / 2);
  const radius = LOADING.orbit / 2 - LOADING.orbitRing - LOADING.orbitLine / 2;
  return (
    <View {...spoken(decorative)} style={[styles.orbit, !shown && styles.hidden, style]}>
      <Svg width={LOADING.orbit} height={LOADING.orbit} style={StyleSheet.absoluteFill}>
        <Circle
          cx={LOADING.orbit / 2}
          cy={LOADING.orbit / 2}
          r={radius}
          fill="none"
          stroke={COLOR.foreground}
          strokeOpacity={LOADING.orbitInk}
          strokeWidth={LOADING.orbitLine}
          strokeDasharray={`0.01 ${LOADING.orbitLine * 2}`}
          strokeLinecap="round"
        />
      </Svg>
      <Animated.View style={[styles.me, { transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, LOADING.breathe] }) }] }]} />
      {PLANETS.map((planet) => (
        <Planet key={planet.tone} {...planet} still={still} />
      ))}
    </View>
  );
}

function Planet({ size, tone, at, period, still }: { size: number; tone: string; at: number; period: number; still: boolean }) {
  const turn = useTurn(still, period);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: [`${at}deg`, `${at + 360}deg`] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
      <View
        style={[
          styles.planet,
          { width: size, height: size, borderRadius: size / 2, left: LOADING.orbit / 2 - size / 2, top: LOADING.orbitRing - size / 2, backgroundColor: tone },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  place: { flexGrow: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  inline: { flexGrow: 0, alignSelf: 'center', paddingVertical: 24 },
  hidden: { opacity: 0 },
  dots: { flexDirection: 'row', gap: LOADING.dotGap, paddingTop: LOADING.hop },
  dot: { width: LOADING.dot, height: LOADING.dot, borderRadius: LOADING.dot / 2 },
  dotStill: { opacity: LOADING.dotStill },
  orbit: { width: LOADING.orbit, height: LOADING.orbit },
  me: {
    position: 'absolute',
    left: (LOADING.orbit - LOADING.me) / 2,
    top: (LOADING.orbit - LOADING.me) / 2,
    width: LOADING.me,
    height: LOADING.me,
    borderRadius: LOADING.me / 2,
    borderWidth: LOADING.meLine,
    borderColor: COLOR.foreground,
    backgroundColor: ELEMENT_TONE.火.mid,
  },
  planet: { position: 'absolute', borderWidth: LOADING.orbitLine, borderColor: COLOR.foreground },
});
