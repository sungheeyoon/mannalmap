import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isBlocked } from '@account/index';
import { birthLineOf } from '@input/birth-line';
import { UNREADABLE_INPUT_NOTE } from '@input/stored';
import { READING_CONTINUE_NOTE, SELF_READING_MAKING } from '@web-home/making';
import type { ReadingCredits } from '@reading/credits';
import {
  CHART_DETAIL_LABEL,
  COMPAT_OTHER_LABEL,
  PERSON_COMPAT_SECTION,
  PERSON_READING_SECTION,
  READING_INVITE_TOPICS,
  READING_OPEN_LABEL,
  chartTitleOf,
  compatWithLabel,
  readingInviteTitle,
  readingReceivedLine,
} from '@reading/person-screen';
import { resumeAskCleared, resumeAskOf, type ResumeAsk } from '@reading/resume-ask';
import { STEM_INFO, type Stem } from '@saju';

import { useClient } from '@/auth/connected';
import { UNREACHABLE } from '@/auth/signup';
import { readPersonDetail, type PersonDetail, type Read } from '@/people/data';
import { AccountNotice, DayMasterChip, LoadingFrame, NotFound, PillarStrip, ScreenFrame, go, styles as shared } from '@/people/parts';
import { useCompatAdd, useReadingAsk } from '@/people/person-sheets';
import { SajuSections } from '@/people/saju-sections';
import { readReadingView, type ReadingTarget } from '@/reading/api';
import { Button } from '@/ui/buttons';
import { FailureLine } from '@/ui/failure-line';
import { Icon } from '@/ui/icons';
import { PrimaryButton } from '@/ui/parts';
import { settled } from '@/ui/settled';
import { StemSymbol } from '@/ui/stem-symbol';
import { CardFrame, Tile } from '@/ui/surfaces';
import { TopBar } from '@/ui/top-bar';
import { alpha, COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';

/** 받기 시트 · 받은 카드가 쓰는 이 사람의 풀이 칸 — 풀이권 · 읽는 시간 · 도는 시도. 못 읽으면 `null` 이고 카드는 받기로 선다(부속 정보) */
type ReadingSide = { credits: ReadingCredits | null; minutes: number | null; running: boolean };

/**
 * **저장한 사람 화면 — 한 장**(운영자 승인 2026-11-13, ADR 0249 · 웹 `app/me/people/[personId]/page.tsx`). 머리(일간 칩 · 이름 · 출생 한 줄 ·
 * 네 기둥 띠 · 「만세력 자세히」) → 사주풀이 칸 → 궁합 칸. 탭이 없고 머리에 단추도 없다. 만세력은 같은 주소의 `?tab=chart` 다.
 */
export default function PersonScreen() {
  const client = useClient();
  const params = useLocalSearchParams<{ personId: string; from?: string; tab?: string; ask?: string; b?: string; rel?: string }>();
  const [read, setRead] = useState<Read<PersonDetail> | null>(null);
  const [side, setSide] = useState<ReadingSide | null>(null);
  const chart = params.tab === 'chart';

  const load = useCallback(() => {
    void settled(readPersonDetail(client, params.personId), 'readPersonDetail', () => ({ kind: 'failed', message: UNREACHABLE }) as const).then((next) => {
      if (next.kind === 'signed-out') router.replace('/');
      /* 선 화면을 다시 읽다 못 읽으면 가진 것을 그대로 둔다 — 다음에 돌아올 때 메운다(채팅 목록과 같다) */
      else setRead((now) => (now?.kind === 'ok' && next.kind === 'failed' ? now : next));
    });
  }, [client, params.personId]);
  useFocusEffect(load);

  const value = read?.kind === 'ok' ? read.value : null;
  const mine = value !== null && value.person !== null && value.selfPersonId === value.person.personId;
  const target: ReadingTarget | null = value?.person == null || chart ? null : mine ? { kind: 'self' } : { kind: 'person', personId: value.person.personId };
  const query = target === null ? null : JSON.stringify(target);

  /* 돌아올 때마다 다시 읽는다 — 풀이 화면에서 받고 오면 카드가 받은 글로 선다 */
  const loadSide = useCallback(() => {
    if (query === null) return;
    void settled(readReadingView(client, JSON.parse(query) as ReadingTarget), 'readReadingView', () => null).then((answer) => {
      if (answer === null || !answer.ok || answer.value.view !== 'reading') return;
      const { credits, minutes, run } = answer.value;
      setSide({ credits, minutes, running: run?.status === 'running' });
    });
  }, [client, query]);
  useFocusEffect(loadSide);

  const before = <TopBar fallback={params.from === 'me' ? '/me' : '/me/people'} />;
  if (read === null || read.kind === 'signed-out') return <LoadingFrame bar={before} />;
  if (read.kind === 'failed') {
    return (
      <ScreenFrame bar={before}>
        <FailureLine onRetry={load}>{read.message}</FailureLine>
      </ScreenFrame>
    );
  }

  const { state, person, selfPersonId, nickname, readings } = read.value;
  if (isBlocked(state)) {
    return (
      <ScreenFrame bar={before}>
        <AccountNotice state={state} onRetry={load} />
      </ScreenFrame>
    );
  }
  if (person === null) {
    return (
      <ScreenFrame bar={before}>
        <NotFound>
          <PrimaryButton label="사람 목록으로" onPress={() => router.replace('/me/people')} />
        </NotFound>
      </ScreenFrame>
    );
  }

  const fromHome = mine || params.from === 'me';
  if (!person.chart.ok) {
    return (
      <ScreenFrame bar={<TopBar title={person.label} fallback={fromHome ? '/me' : '/me/people'} />}>
        <CardFrame style={styles.unreadable}>
          <Text style={shared.noticeBody}>{person.chart.message}</Text>
          <Text style={shared.meta}>{UNREADABLE_INPUT_NOTE}</Text>
        </CardFrame>
      </ScreenFrame>
    );
  }

  const { saju } = person.chart;

  /* 만세력 화면 — 지금까지 「만세력」 탭에 있던 것 그대로다. 뒤로 가면 이 사람 화면(홈 카드에서 왔으면 홈) */
  if (chart) {
    return (
      <ScreenFrame bar={<TopBar title={chartTitleOf(person.label)} fallback={`/me/people/${person.personId}`} />}>
        <SajuSections saju={saju} />
      </ScreenFrame>
    );
  }

  return (
    <PersonPage
      person={{ personId: person.personId, name: person.label, stem: saju.pillars.dayMaster }}
      saju={saju}
      mine={mine}
      fromHome={fromHome}
      selfPersonId={selfPersonId}
      nickname={nickname?.trim() || '나'}
      readings={readings}
      side={side}
      target={target ?? { kind: 'self' }}
      resume={resumeAskOf(params)}
    />
  );
}

function PersonPage({
  person,
  saju,
  mine,
  fromHome,
  selfPersonId,
  nickname,
  readings,
  side,
  target,
  resume,
}: {
  person: { personId: string; name: string; stem: Stem };
  saju: Parameters<typeof SajuSections>[0]['saju'];
  mine: boolean;
  fromHome: boolean;
  selfPersonId: string | null;
  nickname: string;
  readings: PersonDetail['readings'];
  side: ReadingSide | null;
  target: ReadingTarget;
  /** 풀이권을 사고 돌아왔다 — 다시 열 시트(`?ask=…`, ADR 0251) */
  resume: ResumeAsk | null;
}) {
  const own = readings.find((one) => (mine ? one.kind === 'self' : one.kind === 'person' && one.personA === person.personId)) ?? null;
  const readingHref = mine ? '/me/readings/self' : `/me/readings/${person.personId}`;
  const making = own === null && side?.running === true;
  const credits = side?.credits ?? null;

  /* 이 사람이 들어간 궁합풀이 전부 — 최근 순. 줄은 상대 이름(내 자리는 닉네임) · 비유 · 점수. 누르면 이 화면 위에 그 궁합이 쌓인다 */
  const pairs = mine
    ? []
    : readings
        .filter((one) => one.kind === 'private' && (one.personA === person.personId || one.personB === person.personId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((one) => {
          const first = one.personA === person.personId;
          const other = first ? one.personB : one.personA;
          return {
            key: `${one.personA}:${one.personB}`,
            other,
            name: other === selfPersonId ? nickname : ((first ? one.labelB : one.labelA) ?? ''),
            stem: first ? one.dayMasterB : one.dayMasterA,
            score: one.score,
            metaphor: one.metaphor,
            href: `/me/readings/compat?a=${one.personA}&b=${one.personB}`,
          };
        });
  const seen = new Map(pairs.flatMap((pair) => (pair.other === null ? [] : [[pair.other, pair.href] as const])));

  const ask = useReadingAsk({ name: person.name, target, readingHref, credits });
  const add = useCompatAdd({ person, seen, credits });

  /*
    사고 돌아왔으면 같은 시트를 **다시 연다** — 받기를 저절로 시작하지는 않는다(운영자 승인 2026-11-13, ADR 0251). 풀이권 줄이 새 수를 말하게
    풀이 칸을 다 읽은 뒤(`side`)에 연다. 표시는 한 번 쓰면 주소에서 지운다 — 뒤로 가기 · 다시 그리기로 또 열리지 않게
  */
  const resumed = useRef(false);
  useEffect(() => {
    if (resume === null || side === null || resumed.current) return;
    resumed.current = true;
    router.setParams(resumeAskCleared(resume));
    if (resume.kind === 'compat') add.resume(resume.partnerId, resume.relation);
    else if (own === null && !making) ask.open();
  }, [resume, side, own, making, ask, add]);
  const tone = ELEMENT_TONE[STEM_INFO[person.stem].element];

  return (
    <ScreenFrame bar={<TopBar fallback={fromHome ? '/me' : '/me/people'} />}>
      {/* 머리 — 이 사람이 누구인지(시안 0-1 A). 단추는 두지 않는다 — 받기 · 궁합은 아래 칸이 든다 */}
      <Tile tone={tone.soft} style={styles.header}>
        <View style={styles.watermark}>
          <StemSymbol stem={person.stem} size={160} opacity={0.15} />
        </View>
        <DayMasterChip stem={person.stem} />
        <View style={styles.names}>
          <Text style={shared.title} accessibilityRole="header">{person.name}</Text>
          <Text style={shared.meta}>{birthLineOf(saju)}</Text>
        </View>
        <PillarStrip pillars={saju.pillars} name={person.name} over={tone.soft} />
        <Pressable accessibilityRole="link" onPress={() => go(`/me/people/${person.personId}?tab=chart`)} style={styles.detail}>
          <Text style={[styles.detailText, { color: tone.ink }]}>{CHART_DETAIL_LABEL}</Text>
          <Icon name="chevron" size={14} color={tone.ink} />
        </Pressable>
      </Tile>

      <View style={styles.part}>
        <Text style={shared.section}>{PERSON_READING_SECTION}</Text>
        {own !== null ? (
          <Pressable accessibilityRole="link" onPress={() => go(readingHref)}>
            <CardFrame style={styles.reading}>
              <Text style={[styles.quote, { color: tone.ink }]}>“</Text>
              <Text style={styles.metaphor}>{own.metaphor ?? READING_CONTINUE_NOTE}</Text>
              <View style={styles.readingFoot}>
                <Text style={shared.meta}>{readingReceivedLine(own.createdAt, side?.minutes ?? null)}</Text>
                <View style={styles.open}>
                  <Text style={styles.openText}>{READING_OPEN_LABEL}</Text>
                  <Icon name="chevron" size={14} color={COLOR.foreground} />
                </View>
              </View>
            </CardFrame>
          </Pressable>
        ) : making ? (
          <Pressable accessibilityRole="link" onPress={() => go(readingHref)}>
            <CardFrame style={styles.making}>
              <Text style={styles.rowTitle}>{SELF_READING_MAKING}</Text>
              <Icon name="chevron" size={16} color={COLOR.muted} />
            </CardFrame>
          </Pressable>
        ) : (
          <Tile tone={COLOR.accent} style={styles.invite}>
            <Text style={styles.inviteTitle}>{readingInviteTitle(person.name)}</Text>
            <Text style={styles.inviteTopics}>{READING_INVITE_TOPICS}</Text>
            <View style={styles.inviteFoot}>
              <Button label="사주풀이 받기" variant="secondary-small" onPress={ask.open} />
            </View>
          </Tile>
        )}
      </View>

      {!mine && (
        <View style={styles.part}>
          <Text style={shared.section}>{PERSON_COMPAT_SECTION}</Text>
          <CardFrame>
            {pairs.map((pair) => (
              <Pressable key={pair.key} accessibilityRole="link" onPress={() => go(pair.href)} style={styles.row}>
                <View style={styles.faces}>
                  <Circle stem={person.stem} />
                  <Circle stem={pair.stem} shifted />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{pair.name}</Text>
                  {pair.metaphor !== null && <Text style={shared.meta} numberOfLines={1}>{pair.metaphor}</Text>}
                </View>
                {pair.score !== null && <Text style={styles.score}>{`${pair.score}점`}</Text>}
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={add.open} style={styles.row}>
              <View style={styles.plus}>
                <Icon name="plus" size={16} color={COLOR.secondary} />
              </View>
              <Text style={styles.addText}>{pairs.length > 0 ? COMPAT_OTHER_LABEL : compatWithLabel(person.name)}</Text>
            </Pressable>
          </CardFrame>
        </View>
      )}

      {ask.sheets}
      {add.sheets}
    </ScreenFrame>
  );
}

/** 궁합 줄의 동그라미 하나 — 모르는 일간은 회색 원이다 */
function Circle({ stem, shifted = false }: { stem: Stem | null; shifted?: boolean }) {
  return (
    <View style={[styles.circle, { backgroundColor: stem === null ? COLOR.noneSoft : ELEMENT_TONE[STEM_INFO[stem].element].soft }, shifted && styles.circleShifted]}>
      {stem !== null && <StemSymbol stem={stem} size={20} />}
    </View>
  );
}

const styles = StyleSheet.create({
  unreadable: { gap: 8, padding: 20 },
  header: { gap: 12, padding: 20, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -32, top: 24 },
  names: { gap: 4 },
  detail: { alignSelf: 'flex-end', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailText: { fontFamily: FONT.bold, fontSize: TYPE.small },
  part: { gap: 10 },
  reading: { gap: 8, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  quote: { fontFamily: FONT.bold, fontSize: TYPE.title, lineHeight: 24 },
  metaphor: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 27, color: COLOR.foreground },
  readingFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLOR.border },
  open: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  making: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  invite: { gap: 6, padding: 20 },
  inviteTitle: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 27, color: COLOR.onAccent },
  inviteTopics: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: alpha(COLOR.onAccent, 0.75) },
  inviteFoot: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLOR.border, marginTop: -1 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { flex: 1, fontSize: TYPE.body, lineHeight: 22, fontFamily: FONT.bold, color: COLOR.foreground },
  faces: { flexDirection: 'row' },
  circle: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 2, borderColor: COLOR.surface },
  circleShifted: { marginLeft: -10 },
  score: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, overflow: 'hidden', backgroundColor: COLOR.cream, fontSize: TYPE.small, fontFamily: FONT.bold, color: COLOR.creamInk },
  plus: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLOR.borderStrong },
  addText: { flex: 1, fontSize: TYPE.body, fontFamily: FONT.medium, color: COLOR.secondary },
});
