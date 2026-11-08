import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HOUR_UNKNOWN_LABEL } from '@input/query';
import { ELEMENT_PICTURE_KO, ELEMENTS, STEM_INFO } from '@saju';
import { withFromMe } from '@web-home/from-me';
import { SELF_READING_MAKING } from '@web-home/making';

import { DayMasterChip } from '@/people/parts';
import { Button } from '@/ui/buttons';
import { ElementSymbol } from '@/ui/element-symbol';
import { StemSymbol } from '@/ui/stem-symbol';
import { alpha, COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Tile } from '@/ui/surfaces';

import type { SelfCardData } from './read';
import { SelfProfile } from './self-profile';

type Ok = Extract<SelfCardData, { kind: 'ok' }>;

/** 내 사주 카드(줄인 판) — 홈에서 오행 면을 입는 것은 이 판 하나다. 일간은 원 · 딱지 · 뒤의 그림이 든다 */
export function SelfCard({
  card,
  actions,
  label = '내 사주',
  pillars,
}: {
  card: Ok;
  /** 단추 자리를 바꿔 세운다 — 아직 저장 안 된 사주를 결과 화면에 세울 때. `false` 면 단추가 없다 */
  actions?: ReactNode;
  /** 읽는 이름 — 결과 화면의 사주는 내 사주인지 아직 모른다 */
  label?: string;
  /** 오행 위에 서는 네 기둥 — 결과 화면이 든다 */
  pillars?: ReactNode;
}) {
  const { saju, query } = card;
  const dayElement = STEM_INFO[saju.pillars.dayMaster].element;
  const tone = ELEMENT_TONE[dayElement];
  const counts = saju.analysis.elements.counts;

  return (
    <Tile tone={tone.soft} accessibilityLabel={label} style={styles.card}>
      <View pointerEvents="none" style={styles.watermark}>
        <StemSymbol stem={saju.pillars.dayMaster} size={160} opacity={0.15} />
      </View>
      <View style={styles.chip}>
        <DayMasterChip stem={saju.pillars.dayMaster} />
      </View>
      <View style={styles.head}>
        {card.face !== null ? (
          <SelfProfile face={card.face} stem={saju.pillars.dayMaster} />
        ) : (
          <View style={styles.face}>
            <StemSymbol stem={saju.pillars.dayMaster} size={32} />
          </View>
        )}
        <View style={styles.who}>
          {card.label !== '' && <Text style={[styles.name, styles.nameRoom]}>{card.label}</Text>}
          <View style={styles.birthRow}>
            <Text style={styles.birth}>
              {query.date}
              {query.hourKnown === false ? '' : ` ${query.time}`} · {query.city}
              {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ''}
            </Text>
            {/* 홈의 내 사주만 — 결과 화면의 사주(`actions` 를 준 판)는 아직 저장 전이라 고칠 것이 없다. 고치는 폼은 프로필의 「출생 정보」 판이다 */}
            {actions === undefined && (
              <Pressable accessibilityRole="link" accessibilityLabel="출생 정보 수정" hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} onPress={() => router.push('/me/profile?edit=birth' as never)}>
                <Text style={styles.edit}>수정</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {card.metaphor !== null && (
        <Text style={styles.metaphor} numberOfLines={2}>
          <Text style={{ color: tone.ink }}>“</Text>
          {card.metaphor}
          <Text style={{ color: tone.ink }}>”</Text>
        </Text>
      )}

      {pillars}

      <View accessibilityLabel="오행 분포" style={styles.elements}>
        {ELEMENTS.map((element) => {
          const count = counts[element];
          const color = count === 0 ? COLOR.muted : ELEMENT_TONE[element].ink;
          return (
            <View key={element} style={styles.element}>
              <ElementSymbol element={element} size={24} />
              <Text style={[styles.elementName, { color }]}>{ELEMENT_PICTURE_KO[element]}</Text>
              <Text style={[styles.elementCount, { color }]}>{count}</Text>
            </View>
          );
        })}
      </View>

      {actions ?? (
        <View style={styles.actions}>
          <Button accessibilityRole="link" label={card.hasReading ? '사주풀이 보기' : card.making ? SELF_READING_MAKING : '사주풀이 받기'} onPress={() => router.push(withFromMe('/me/readings/self') as never)} style={styles.action} />
          <Button accessibilityRole="link" variant="secondary" label="만세력 보기" onPress={() => router.push(`/me/people/${card.personId}?tab=chart` as never)} style={styles.action} />
        </View>
      )}
    </Tile>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -32, bottom: -40 },
  chip: { position: 'absolute', top: 16, right: 16, zIndex: 1 },
  nameRoom: { paddingRight: 80 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  face: { width: 56, height: 56, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surface },
  who: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bold, fontSize: TYPE.heading, color: COLOR.foreground },
  birthRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, marginTop: 2 },
  birth: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  edit: { fontFamily: FONT.bold, fontSize: TYPE.fine, color: COLOR.secondary, textDecorationLine: 'underline' },
  metaphor: { fontFamily: FONT.medium, fontSize: TYPE.lead, lineHeight: 26, color: COLOR.foreground, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.cell, backgroundColor: alpha(COLOR.surface, 0.55) },
  elements: { flexDirection: 'row' },
  element: { flex: 1, alignItems: 'center', gap: 2 },
  elementName: { fontFamily: FONT.medium, fontSize: TYPE.fine },
  elementCount: { fontFamily: FONT.bold, fontSize: TYPE.heading },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, paddingHorizontal: 12 },
});
