import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MY_PROFILE_EDIT_LABEL } from '@chat/copy';
import { HOUR_UNKNOWN_LABEL } from '@input/query';
import { ELEMENT_PICTURE_KO, ELEMENTS, STEM_INFO } from '@saju';
import { withFromMe } from '@web-home/from-me';
import { SELF_READING_MAKING } from '@web-home/making';

import { AnchoredMenu } from '@/chat/menu';
import { DayMasterChip, styles as shared } from '@/people/parts';
import { Button } from '@/ui/buttons';
import { ElementSymbol } from '@/ui/element-symbol';
import { StemSymbol } from '@/ui/stem-symbol';
import { alpha, COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Tile } from '@/ui/surfaces';

import type { SelfCardData } from './read';
import { SelfProfile } from './self-profile';

type Ok = Extract<SelfCardData, { kind: 'ok' }>;

/**
 * 내 사주 카드(줄인 판) — 홈에서 오행 면을 입는 것은 이 판 하나다. 일간은 원 · 이름 옆 딱지 · 뒤의 그림이 든다.
 *
 * **고치는 길은 오른쪽 위 「⋯」 메뉴다**(운영자 결정 2026-11-12, 시안 「수정 A안」 — 출생 정보 곁의 작은 글자 「수정」을 바꿨다). 「⋯」 바로
 * 아래에 붙어 뜨는 작은 판이고(`AnchoredMenu` — 대화방 「⋯」와 같은 부품, 웹의 띄움 판과 같은 꼴) 줄은 둘이다 — 「출생 정보 수정」은 프로필의
 * 「출생 정보」 판을 편 채, 「프로필 편집」은 프로필 수정 화면 맨 위로 간다(이름 왼쪽 원의 시트가 가는 곳과 같다). 저장한 사람 카드의 메뉴는
 * 아래에서 뜨는 판 그대로다 — 두 카드의 메뉴 꼴이 다르다(운영자 검토 2026-11-12).
 * 홈의 내 사주에만 선다 — 결과 화면의 사주(`actions` 를 준 판)는 아직 저장 전이라 고칠 것이 없다
 */
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
  const manageable = actions === undefined;

  return (
    <Tile tone={tone.soft} accessibilityLabel={label} style={styles.card}>
      <View pointerEvents="none" style={styles.watermark}>
        <StemSymbol stem={saju.pillars.dayMaster} size={160} opacity={0.15} />
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
          {/* 일간 딱지는 이름 옆이다 — 오른쪽 위는 「⋯」가 든다. 긴 이름은 제 폭 안에서 접히고 딱지는 첫 줄 곁에 그대로 선다 */}
          <View style={[styles.nameRow, manageable && styles.menuRoom]}>
            {card.label !== '' && <Text style={styles.name}>{card.label}</Text>}
            <DayMasterChip stem={saju.pillars.dayMaster} />
          </View>
          <Text style={styles.birth}>
            {query.date}
            {query.hourKnown === false ? '' : ` ${query.time}`} · {query.city}
            {query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ''}
          </Text>
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

      {manageable && (
        <View style={styles.menu}>
          <AnchoredMenu
            label={`${label} 관리`}
            items={[
              { label: '출생 정보 수정', onPress: () => router.push('/me/profile?edit=birth' as never) },
              { label: MY_PROFILE_EDIT_LABEL, onPress: () => router.push('/me/profile' as never) },
            ]}
          >
            <Text style={shared.manageDots}>⋯</Text>
          </AnchoredMenu>
        </View>
      )}
    </Tile>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -32, bottom: -40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  face: { width: 56, height: 56, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surface },
  who: { flex: 1, minWidth: 0 },
  /** 저장한 사람 카드의 「⋯」와 같은 자리 — 카드 끝에서 12 */
  menu: { position: 'absolute', top: 12, right: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  /** 「⋯」(44px, 카드 끝에서 12)가 카드 안쪽 여백(16)을 넘어 들어온 40 과 틈 8 */
  menuRoom: { paddingRight: 48 },
  name: { flexShrink: 1, fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: COLOR.foreground },
  birth: { marginTop: 2, fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  metaphor: { fontFamily: FONT.medium, fontSize: TYPE.lead, lineHeight: 26, color: COLOR.foreground, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.cell, backgroundColor: alpha(COLOR.surface, 0.55) },
  elements: { flexDirection: 'row' },
  element: { flex: 1, alignItems: 'center', gap: 2 },
  elementName: { fontFamily: FONT.medium, fontSize: TYPE.fine },
  elementCount: { fontFamily: FONT.bold, fontSize: TYPE.heading },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, paddingHorizontal: 12 },
});
