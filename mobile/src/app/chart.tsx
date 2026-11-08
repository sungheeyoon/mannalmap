import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ChartWant } from '@consent/app-destination';
import { calculateChart } from '@input/chart';
import { queryFromJson, type Query } from '@input/query';
import { TOPIC_TABLE_FOOTNOTE, asOf, elementsFirstLine, said, sajuViewModelOf } from '@saju-view';

import { TimeCorrections, Warnings } from '@/chart/corrections';
import { ElementChart } from '@/chart/elements';
import { FortuneTabs, NowOverlaps } from '@/chart/fortune';
import { Chevron } from '@/chart/parts';
import { PillarChart } from '@/chart/pillars';
import { RelationTable } from '@/chart/relations';
import { StarTable } from '@/chart/stars';
import { StrengthMeter } from '@/chart/strength';
import { YongsinCard } from '@/chart/yongsin';
import { SelfCard } from '@/home/self-card';
import { PillarStrip } from '@/people/parts';
import { SavePersonForReading } from '@/reading/save-self';
import { TopBar } from '@/ui/top-bar';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { CardFrame } from '@/ui/surfaces';

/**
 * 사주 결과 — 앱의 첫 결과는 사주 카드 · 계산값 한 줄 · 다음 행동이 먼저이고, 전문 표는 「만세력 보기」 아래 접혀 있다(#940). 표의 절 차례와 값은 웹의 `app/saju/view.tsx` · `sajuViewModelOf` 그대로다.
 */
export default function ChartScreen() {
  const params = useLocalSearchParams<{ query?: string; want?: string }>();
  const query = useMemo(() => queryFromJson(params.query), [params.query]);
  /* 주소로도 오는 값이다 — 없거나 깨졌으면 볼 명식이 없으니 적는 자리로 돌려보낸다 */
  if (query === null) return <Redirect href={{ pathname: '/', params: { another: '1' } }} />;
  const want = params.want === 'save' || params.want === 'reading' ? params.want : null;
  return <ChartBody query={query} want={want} />;
}

function ChartBody({ query, want }: { query: Query; want: ChartWant | null }) {
  /* 기준 시각은 화면을 연 때 하나다 — 표의 「현재」와 옆에 적은 시각이 갈리지 않는다 */
  const [viewedAt] = useState(() => Date.now());
  const result = useMemo(() => calculateChart(query), [query]);
  const model = useMemo(() => (result.ok ? sajuViewModelOf(result.saju, viewedAt) : null), [result, viewedAt]);
  const [tableOpen, setTableOpen] = useState(false);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <TopBar title="사주 결과" fallback="/" />
      <ScrollView contentContainerStyle={styles.content}>
        {!result.ok || model === null ? (
          <Text style={styles.failure}>{result.ok ? '' : result.message}</Text>
        ) : (
          <>
            <SelfCard
              label="사주 카드"
              card={{ kind: 'ok', personId: '', label: query.name.trim(), query, saju: model.saju, metaphor: null, hasReading: false, making: false, face: null }}
              pillars={<PillarStrip pillars={model.saju.pillars} name={query.name.trim()} />}
              actions={false}
            />
            <Text style={styles.firstLine}>{elementsFirstLine(model.saju.analysis.elements)}</Text>

            <SavePersonForReading query={query} want={want} />

            <CardFrame>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: tableOpen }} onPress={() => setTableOpen(!tableOpen)} style={styles.tableHead}>
                <Text style={styles.tableTitle}>만세력 보기</Text>
                <Chevron open={tableOpen} />
              </Pressable>
            </CardFrame>

            {tableOpen && (
              <>
                <PillarChart saju={model.saju} />
                <StarTable saju={model.saju} />
                <ElementChart saju={model.saju} />
                <StrengthMeter saju={model.saju} />
                <YongsinCard saju={model.saju} />
                <RelationTable saju={model.saju} coverage={said(model.utterances, (topic) => topic === TOPIC_TABLE_FOOTNOTE)} />
                <NowOverlaps now={model.now} />
                <FortuneTabs saju={model.saju} now={model.now} asOf={asOf(model.now)} />
                <TimeCorrections saju={model.saju} />
                <Warnings saju={model.saju} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { padding: 16, gap: 12 },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger },
  firstLine: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground, marginHorizontal: 4 },
  tableHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 16 },
  tableTitle: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
});
