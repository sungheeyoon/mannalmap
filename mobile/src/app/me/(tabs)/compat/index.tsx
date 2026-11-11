import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isBlocked } from '@account/index';

import { useClient } from '@/auth/connected';
import { readPicker, type PickerData } from '@/compat/data';
import { CompatPicker } from '@/compat/picker';
import { RelationMap } from '@/compat/relation-map';
import { CompatResultStep } from '@/compat/result-step';
import type { Read } from '@/people/data';
import { AccountNotice, LoadingFrame, ScreenFrame, go, styles as shared } from '@/people/parts';
import { FailureLine } from '@/ui/failure-line';
import { COLOR, FONT, TYPE } from '@/ui/tokens';
import { RowLine } from '@/ui/surfaces';
import { settled } from '@/ui/settled';
import { UNREACHABLE } from '@/auth/signup';

/**
 * 궁합 — 앱에는 `/compat` 이 없어(입구 결정) 이 주소가 두 걸음을 다 든다. `a` · `b` 가 있으면 두 명식을 보고, 없으면 두 사람을 정한다.
 * `pickA` · `pickB` 는 고르는 칸을 채워 연다 — 주소에는 person id 만 실린다.
 */
export default function CompatScreen() {
  const params = useLocalSearchParams<{ a?: string; b?: string; pickA?: string; pickB?: string }>();
  if (params.a !== undefined && params.b !== undefined) return <CompatResultStep a={params.a} b={params.b} back="/me/compat" />;
  return <PickStep pickA={params.pickA} pickB={params.pickB} />;
}

function Loading() {
  return (
    <LoadingFrame />
  );
}

function PickStep({ pickA, pickB }: { pickA?: string; pickB?: string }) {
  const client = useClient();
  const [read, setRead] = useState<Read<PickerData> | null>(null);

  const load = useCallback(() => {
    void settled(readPicker(client), 'readPicker', () => ({ kind: 'failed', message: UNREACHABLE }) as const).then((next) => {
      if (next.kind === 'signed-out') router.replace('/');
      else setRead((now) => (now?.kind === 'ok' && next.kind === 'failed' ? now : next));
    });
  }, [client]);
  /* 탭을 옮겨도 이 화면이 남으니 돌아올 때마다 다시 읽는다 — 저장한 사람이 늘면 고를 수 있다. 고르는 칸의 값은 칸이 들고 있어 안 날아가고,
     그사이 지운 사람을 든 칸만 빈다(`dropUnlisted`) */
  useFocusEffect(load);

  if (read === null || read.kind === 'signed-out') return <Loading />;
  if (read.kind === 'failed') {
    return (
      <ScreenFrame>
        <Text style={shared.section}>궁합 새로 보기</Text>
        <FailureLine onRetry={load}>{read.message}</FailureLine>
      </ScreenFrame>
    );
  }

  const { state, people, compats, map } = read.value;
  const latest = compats[0];

  return (
    <ScreenFrame keyboard>
      <Text style={shared.section}>궁합 새로 보기</Text>
      {isBlocked(state) ? (
        <AccountNotice state={state} onRetry={load} />
      ) : (
        <>
          <CompatPicker people={people} pickA={pickA} pickB={pickB} />
          <Text style={shared.meta}>
            직접 입력한 사람은 <Text style={shared.bodyStrong}>저장한 사람에 추가되지 않아요.</Text>
          </Text>
          {latest !== undefined && (
            <RowLine accessibilityRole="link" onPress={() => go('/me/readings?kind=compat&from=compat')} style={styles.summary}>
              <View style={styles.summaryBody}>
                <Text style={styles.summaryTitle}>
                  궁합풀이 <Text style={shared.meta}>{compats.length}</Text>
                </Text>
                <Text style={shared.meta} numberOfLines={1}>최근 {`${latest.labelA ?? ''} × ${latest.labelB ?? ''}`}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </RowLine>
          )}
          {map !== null && <RelationMap model={map.model} canAdd={map.canAdd} />}
        </>
      )}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryBody: { flex: 1, minWidth: 0 },
  summaryTitle: { fontSize: TYPE.body, fontFamily: FONT.bold, color: COLOR.foreground },
  chevron: { fontSize: TYPE.lead, color: COLOR.muted },
});
