import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { UNREADABLE_INPUT_NOTE } from '@input/stored';
import { HOUR_UNKNOWN_LABEL } from '@input/query';
import { READING_STALE_LABEL } from '@reading/notes';
import { READING_CONTINUE_NOTE, SELF_READING_MAKING } from '@web-home/making';
import { CALENDAR_KO, GENDER_KO, STEM_INFO } from '@saju';

import { ElementSymbol } from '@/ui/element-symbol';
import { alpha, COLOR, CONTROL, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

import type { MyReading, PersonRow } from './data';
import { EditInputForm } from './edit-input';
import { NoteEditor, RemoveConfirm } from './manage';
import { DayMasterChip, ManageButton, PillarStrip, Sheet, SheetItem, go, styles as shared } from './parts';
import { StemSymbol } from '@/ui/stem-symbol';
import { Tile } from '@/ui/surfaces';
import { WordText } from '@/ui/word-text';

type Panel = 'menu' | 'edit-input' | 'note' | 'remove';

/**
 * 한 사람 = 그 사람의 일간 오행 색을 입은 한 장의 타일. **타일이 곧 상세로 가는 길이다**(`app/me/people/page.tsx`).
 * 손대는 것(출생 정보 · 메모 · 삭제)은 구석의 관리 단추 하나로 물러난다.
 */
export function PersonCard({
  person,
  reading,
  pair,
  making,
  selfPersonId,
  onChanged,
}: {
  person: PersonRow;
  reading: MyReading | null;
  /** 나 × 이 사람의 궁합풀이 — 있으면 궁합 단추가 점수를 달고 그 글로 간다 */
  pair: MyReading | null;
  making: boolean;
  selfPersonId: string | null;
  onChanged: () => void;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const note = person.note?.trim() ?? '';
  const stem = person.chart.ok ? person.chart.saju.pillars.dayMaster : null;
  const tone = stem === null ? null : ELEMENT_TONE[STEM_INFO[stem].element];
  const done = () => {
    setPanel(null);
    onChanged();
  };

  return (
    <View style={styles.item}>
      <Tile tone={tone?.soft ?? COLOR.noneSoft}
        accessibilityRole="link"
        accessibilityLabel={person.label}
        onPress={() => go(`/me/people/${person.personId}`)}
        style={styles.tile}
      >
        {stem !== null && (
          <View style={styles.watermark}>
            <StemSymbol stem={stem} size={128} opacity={0.14} />
          </View>
        )}

        <View style={styles.head}>
          {stem !== null ? (
            <DayMasterChip stem={stem} />
          ) : (
            <View style={styles.unknown}>
              <ElementSymbol element={null} size={20} />
            </View>
          )}
        </View>

        <View>
          <WordText style={shared.name} numberOfLines={1}>{person.label}</WordText>
          {person.chart.ok && (
            <>
              <WordText style={shared.meta}>
                {person.chart.query.calendar === 'solar' ? person.chart.query.date : `${CALENDAR_KO[person.chart.query.calendar]} ${person.chart.query.date}`}
                {person.chart.query.hourKnown === false ? ` · ${HOUR_UNKNOWN_LABEL}` : ` · ${person.chart.query.time}`}
              </WordText>
              <WordText style={shared.meta}>
                {GENDER_KO[person.chart.query.gender]} · {person.chart.query.city}
              </WordText>
            </>
          )}
        </View>

        {note !== '' && (
          <WordText style={styles.note}>
            <WordText style={[styles.noteName, tone !== null && { color: tone.ink }]}>메모 </WordText>
            {note}
          </WordText>
        )}

        {person.chart.ok ? (
          <>
            <PillarStrip pillars={person.chart.saju.pillars} name={person.label} />
            {reading !== null && (
              <WordText style={styles.oneLine} numberOfLines={2}>
                {!reading.fromCurrentChart && <WordText style={styles.stale}>{READING_STALE_LABEL} </WordText>}
                {reading.metaphor ?? READING_CONTINUE_NOTE}
              </WordText>
            )}
            <View style={styles.buttons}>
              <Pressable
                accessibilityRole="link"
                onPress={() => go(`/me/readings/${person.personId}`)}
                style={[styles.button, styles.grow, reading === null ? styles.buttonPrimary : [styles.buttonPlain, { borderColor: `${tone?.ink ?? COLOR.none}2e` }]]}
              >
                <WordText style={[styles.buttonText, { color: tone?.ink ?? COLOR.none }, reading === null && styles.buttonPrimaryText]} numberOfLines={1}>
                  {reading !== null ? '사주풀이 보기' : making ? SELF_READING_MAKING : '사주풀이 받기'}
                </WordText>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={pair?.score != null ? `나와 궁합 ${pair.score}점` : '나와 궁합'}
                onPress={() => go(pair !== null ? `/me/compat?a=${pair.personA}&b=${pair.personB}` : compatPickHref(selfPersonId, person.personId))}
                style={[styles.button, styles.buttonPlain, { borderColor: `${tone?.ink ?? COLOR.none}2e` }]}
              >
                {/* 점수가 있으면 「궁합 82점」 — 무슨 점수인지 말하는 「궁합」은 작고 옅게 선다(운영자 확정 2026-11-08, 대장 all-11) */}
                <WordText style={[styles.buttonText, { color: tone?.ink ?? COLOR.none }]} numberOfLines={1}>
                  {pair?.score != null ? (
                    <>
                      <WordText style={styles.scoreName}>궁합 </WordText>
                      {`${pair.score}점`}
                    </>
                  ) : (
                    '궁합'
                  )}
                </WordText>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.unreadable}>
            <WordText style={shared.noticeBody}>{person.chart.message}</WordText>
            <WordText style={shared.meta}>{UNREADABLE_INPUT_NOTE}</WordText>
          </View>
        )}

        <ManageButton label={`${person.label} 관리`} onPress={() => setPanel('menu')} />
      </Tile>

      {panel === 'edit-input' && person.chart.ok && <EditInputForm personId={person.personId} current={person.chart.query} onDone={done} onCancel={() => setPanel(null)} />}
      {panel === 'note' && <NoteEditor personId={person.personId} note={person.note ?? ''} onDone={done} onCancel={() => setPanel(null)} />}
      {panel === 'remove' && <RemoveConfirm personId={person.personId} label={person.label} onDone={done} onCancel={() => setPanel(null)} />}
      {panel === 'menu' && (
        <Sheet label="닫기" onClose={() => setPanel(null)}>
          <WordText style={shared.section}>{person.label}</WordText>
          {person.chart.ok && <SheetItem label="출생 정보 수정" onPress={() => setPanel('edit-input')} />}
          <SheetItem label={note === '' ? '메모 넣기' : '메모 고치기'} onPress={() => setPanel('note')} />
          <SheetItem label="삭제" danger onPress={() => setPanel('remove')} />
        </Sheet>
      )}
    </View>
  );
}

/** 나 × 그 사람으로 두 칸을 채워 고르는 자리를 연다 — id 만 싣는다(`compatHrefFor`) */
const compatPickHref = (selfPersonId: string | null, personId: string): string =>
  selfPersonId === null || selfPersonId === personId ? `/me/compat?pickA=${personId}` : `/me/compat?pickA=${selfPersonId}&pickB=${personId}`;

const styles = StyleSheet.create({
  item: { gap: 8 },
  tile: { gap: 12, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -24, bottom: -24 },
  head: { minHeight: CONTROL, justifyContent: 'center', paddingRight: 52 },
  unknown: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: alpha(COLOR.surface, 0.72) },
  note: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.cell, backgroundColor: alpha(COLOR.surface, 0.6), fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.foreground },
  noteName: { fontSize: TYPE.fine, fontFamily: FONT.bold },
  oneLine: { minHeight: 40, fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.foreground },
  stale: { fontSize: TYPE.fine, fontFamily: FONT.bold, color: COLOR.secondary },
  buttons: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  grow: { flex: 1 },
  button: { minHeight: CONTROL, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.pill },
  buttonPlain: { borderWidth: 1, backgroundColor: alpha(COLOR.surface, 0.78) },
  buttonPrimary: { backgroundColor: COLOR.accent },
  buttonText: { fontSize: TYPE.small, fontFamily: FONT.bold },
  buttonPrimaryText: { color: COLOR.onAccent },
  scoreName: { fontSize: TYPE.fine, fontFamily: FONT.medium, opacity: 0.72 },
  unreadable: { gap: 4 },
});
