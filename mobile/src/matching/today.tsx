import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CHAT_USES_NO_CREDIT } from '@consent/disclosure';
import { TALK_SCORE_INFO, TALK_SCORE_LABEL, TALK_START_LABEL, TALK_START_NOTE, TALK_START_TITLE } from '@chat/room/detail-copy';
import { DISCOVERY_EMPTY } from '@discovery/copy';
import { elementOf, supplyOf, type DeckCard } from '@matching/deck-card';
import { PASSED_LIMIT } from '@matching/deck-state';
import { REQUEST_UNSURE } from '@matching/requests';
import { activityText } from '@presence';
import { ELEMENT_PICTURE_KO, type Element } from '@saju';

import { ElementSymbol } from '@/ui/element-symbol';
import { goTab } from '@/ui/go-tab';
import { Icon } from '@/ui/icons';
import { PrimaryButton } from '@/ui/parts';
import { ConfirmDialog, DialogText } from '@/ui/confirm-dialog';
import { DetailSheet } from '@/ui/sheet';
import { ELEVATION } from '@design';
import { alpha, COLOR, ELEMENT_TONE, FIXED, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { Card, CardFrame, Paper, RowCard, Tile } from '@/ui/surfaces';

import { PersonPhoto, PhotoBars, ReportBlock } from './people';
import { WordText } from '@/ui/word-text';

const tileOf = (element: Element | null) => (element === null ? COLOR.noneSoft : ELEMENT_TONE[element].soft);

/** 오늘의 인연 한 장 — 사진이 주인공이고 그 위에 고르는 데 필요한 것만 선다. 끌어서 넘기지 않는다(운영자 2026-09-25) */
export function TodayCard({ card, onInfo, onBlocked }: { card: DeckCard; onInfo: () => void; onBlocked: () => void }) {
  const [at, setAt] = useState(0);
  const count = card.photoUrls?.length ?? 0;
  const names = card.highlights.map((highlight) => {
    const known = elementOf(highlight.element);
    return known !== null ? ELEMENT_PICTURE_KO[known] : highlight.element;
  });
  const top = count > 1 ? 32 : 12;

  return (
    <Tile tone={tileOf(supplyOf(card))} key={card.candidateUserId} style={styles.card}>
      <PersonPhoto
        userId={card.candidateUserId}
        nickname={card.nickname}
        position={at + 1}
        hasPhoto={card.hasPhoto}
        focus={card.photoFocus?.[at]}
        tone={card.avatarElement ?? supplyOf(card)}
        initialSize={120}
        initialAbove
      />
      {count > 1 && <PhotoBars count={count} at={at} onPick={setAt} />}

      {card.exploration && (
        <View style={[styles.exploration, { top }]}>
          <Icon name="spark" size={16} />
          <WordText style={styles.explorationText}>색다른 인연</WordText>
        </View>
      )}
      <View style={[styles.onPhoto, { top }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="자세히 보기" onPress={onInfo} style={styles.info}>
          <WordText style={styles.infoText}>i</WordText>
        </Pressable>
        <ReportBlock userId={card.candidateUserId} nickname={card.nickname} onPhoto onBlocked={onBlocked} />
      </View>

      <View style={styles.face} pointerEvents="none">
        <FaceScrim />
        <View style={styles.faceHead}>
          <View style={styles.flex}>
            <WordText style={styles.nickname} numberOfLines={1}>
              {card.nickname}
            </WordText>
            {card.activity != null && <WordText style={styles.activity}>{activityText(card.activity)}</WordText>}
          </View>
          <WordText style={styles.scoreTalk}>{`${TALK_SCORE_LABEL} ${card.previewScore}점`}</WordText>
        </View>
        <WordText style={styles.verdict}>{card.verdict}</WordText>
        {card.highlights.length > 0 && (
          <View style={styles.supply} accessible accessibilityLabel={card.highlights.map((highlight) => highlight.text).join(' ')}>
            <View style={styles.dots}>
              {card.highlights.map((highlight, index) => {
                const known = elementOf(highlight.element);
                return (
                  <View key={highlight.element} style={[styles.dot, { backgroundColor: tileOf(known), marginLeft: index === 0 ? 0 : -10 }]}>
                    <ElementSymbol element={known} size={24} />
                  </View>
                );
              })}
            </View>
            <View style={styles.flex}>
              <WordText style={styles.supplyHead}>이 사람이 채워 주는 기운</WordText>
              <WordText style={styles.supplyNames} numberOfLines={1}>
                {names.join(' · ')}
              </WordText>
            </View>
          </View>
        )}
        {card.intro !== null && (
          <WordText style={styles.introLine} numberOfLines={1}>
            {card.intro}
          </WordText>
        )}
      </View>
    </Tile>
  );
}

/**
 * 글 밑의 어둠막 — 흰 사진 위에서도 흰 글자가 읽히게. 멈춤은 웹의 `FACE_SCRIM` 과 같다.
 * SVG 로 그리면 안드로이드에서 처음 잰 크기로 굳어 카드 일부만 덮는다 — 뷰의 그라디언트는 뷰를 따라간다.
 */
const FACE_SCRIM = `linear-gradient(to top, ${[[0.86, 0], [0.78, 30], [0.62, 55], [0.38, 72], [0.14, 86], [0, 100]].map(([amount, at]) => `${alpha(FIXED.black, amount)} ${at}%`).join(', ')})`;

function FaceScrim() {
  return <View style={[StyleSheet.absoluteFill, { backgroundImage: FACE_SCRIM }]} />;
}

/** 단추 줄 — 사진 아래. 대화 시작이 채운 주 단추로 가장 넓다 */
export function DeckButtons({ canUndo, busy, onUndo, onPass, onRequest }: { canUndo: boolean; busy: boolean; onUndo: () => void; onPass: () => void; onRequest: () => void }) {
  const label = TALK_START_LABEL;
  return (
    <View style={styles.buttons}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 인연으로 되돌리기"
        accessibilityState={{ disabled: !canUndo }}
        disabled={!canUndo}
        onPress={onUndo}
        style={[styles.undo, !canUndo && styles.off]}
      >
        <Icon size={20} name="undo" color={canUndo ? COLOR.foreground : COLOR.muted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 인연으로 지나가기"
        disabled={busy}
        onPress={onPass}
        style={[styles.pass, busy && styles.off]}
      >
        <Icon size={20} name="close" />
        <WordText style={styles.passText}>다음 인연</WordText>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={onRequest} style={[styles.request, busy && styles.off]}>
        <WordText style={styles.requestText}>{label}</WordText>
      </Pressable>
    </View>
  );
}

/** 판정의 까닭 · 채워 주는 기운 — ⓘ 시트와 지나친 인연 시트가 같은 것을 든다 */
export function CardDetails({ card, explorationNote }: { card: DeckCard; explorationNote: string | null }) {
  return (
    <>
      <View style={styles.reasonBox}>
        <WordText style={styles.detailVerdict}>{card.verdict}</WordText>
        <WordText style={styles.body}>{card.reason}</WordText>
      </View>
      <CardFrame style={styles.supplyBox}>
        <WordText style={styles.supplyTitle}>이 사람이 채워 주는 기운</WordText>
        {card.highlights.length > 0 ? (
          card.highlights.map((highlight) => {
            const known = elementOf(highlight.element);
            return (
              <View key={highlight.element} style={styles.supplyRow}>
                <View style={[styles.supplyDot, { backgroundColor: tileOf(known) }]}>
                  <ElementSymbol element={known} size={24} />
                </View>
                <View style={styles.flex}>
                  {known !== null && <WordText style={[styles.supplyName, { color: ELEMENT_TONE[known].ink }]}>{ELEMENT_PICTURE_KO[known]}</WordText>}
                  <WordText style={styles.small}>{highlight.text}</WordText>
                </View>
              </View>
            );
          })
        ) : (
          <WordText style={styles.body}>{card.reason}</WordText>
        )}
        <WordText style={styles.small}>{card.balanceLabel}</WordText>
        {card.exploration && explorationNote !== null && <WordText style={styles.note}>{explorationNote}</WordText>}
      </CardFrame>
      <CardFrame style={styles.letter}>
        {card.intro !== null ? (
          <>
            <WordText style={styles.letterText}>{card.intro}</WordText>
            <WordText style={styles.signature}>— {card.nickname}</WordText>
          </>
        ) : (
          <WordText style={styles.small}>자기소개 없음</WordText>
        )}
      </CardFrame>
    </>
  );
}

/** 폰의 ⓘ 시트 — 사진 위에 못 둔 것 전부와 참고 점수 고지 */
export function CardSheet({
  card,
  open,
  onClose,
  explorationNote,
  notice,
  onBlocked,
}: {
  card: DeckCard;
  open: boolean;
  onClose: () => void;
  explorationNote: string | null;
  notice: string | null;
  onBlocked: () => void;
}) {
  return (
    <DetailSheet open={open} title={card.nickname} onClose={onClose} menu={<ReportBlock userId={card.candidateUserId} nickname={card.nickname} onBlocked={onBlocked} />}>
      <CardDetails card={card} explorationNote={explorationNote} />
      <WordText style={styles.fine}>{TALK_SCORE_INFO}</WordText>
      {notice !== null && <WordText style={styles.meta}>{notice}</WordText>}
    </DetailSheet>
  );
}

/** 대화 시작 창 — 풀이권이 안 든다. 첫 말 한 건의 제한을 누르기 전에 읽는다 */
export function TalkConfirm({ card, open, onClose, onConfirm, busy }: { card: DeckCard; open: boolean; onClose: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <ConfirmDialog open={open} onClose={onClose} title={`${card.nickname} ${TALK_START_TITLE}`} confirmLabel={TALK_START_LABEL} onConfirm={onConfirm} busy={busy}>
      <DialogText>{TALK_START_NOTE}</DialogText>
      <DialogText>{CHAT_USES_NO_CREDIT}</DialogText>
    </ConfirmDialog>
  );
}

/** 실패 · 방금 한 일 — 한 자리에 한 줄. 대화가 섰는지 모르면 인연 기록으로 가는 길을 단다 */
export function Feedback({ failure, flash }: { failure: string | null; flash: string }) {
  return (
    <>
      {failure !== null && (
        <RowCard style={styles.failureBox}>
          <WordText style={styles.failure} accessibilityRole="alert">
            {failure}
          </WordText>
          {failure === REQUEST_UNSURE && (
            <Pressable accessibilityRole="link" onPress={() => router.push('/me/matching/history')} style={styles.textLink}>
              <WordText style={styles.textLinkText}>인연 기록 보기</WordText>
            </Pressable>
          )}
        </RowCard>
      )}
      {flash !== '' && (
        <View style={styles.flashBox} accessibilityLiveRegion="polite">
          <WordText style={styles.flash}>{flash}</WordText>
        </View>
      )}
    </>
  );
}

/**
 * 소개할 사람이 없다 — 궤도 그림은 앱에 아직 없다(G-123). 두 줄 · 다시 읽는 단추 · 갈 길 둘.
 * 덱은 탭에 돌아와도 다시 서지 않아 단추가 없으면 「다시 확인해 주세요」를 할 길이 없다. 「다른 사람 사주」는 `another` 를 든다 — 없으면 입구가 로그인한 사람을 홈으로 되돌린다.
 */
export function EmptyDeck({ onRecheck }: { onRecheck: () => void }) {
  const links: readonly { open: () => void; label: string }[] = [
    { open: () => router.push('/?another=1' as never), label: '다른 사람 사주 보기' },
    { open: () => goTab('/me/compat'), label: '궁합 보러 가기' },
  ];
  return (
    <Paper style={styles.quiet}>
      <WordText style={styles.quietTitle}>{DISCOVERY_EMPTY.title}</WordText>
      <WordText style={styles.body}>{DISCOVERY_EMPTY.line}</WordText>
      <PrimaryButton label={DISCOVERY_EMPTY.recheck} onPress={onRecheck} />
      {links.map((link) => (
        <CardFrame key={link.label} accessibilityRole="link" onPress={link.open} style={styles.quietLink}>
          <WordText style={[styles.quietLinkText, styles.flex]}>{link.label}</WordText>
          <Icon name="arrow" size={16} color={COLOR.secondary} />
        </CardFrame>
      ))}
    </Paper>
  );
}

/** 덱이 서지 않는 자리 — 이유 한 줄과 갈 길 하나 */
export function QuietPlace({ title, line, href, action }: { title: string; line: string; href: string; action: string }) {
  return (
    <Paper style={styles.quiet}>
      <WordText style={styles.quietTitle}>{title}</WordText>
      <WordText style={styles.body}>{line}</WordText>
      <PrimaryButton label={action} onPress={() => router.push(href as never)} />
    </Paper>
  );
}

/** 지나친 인연 — 최근 순 타일. 누르면 ⓘ 와 같은 시트가 펴지고 「다시 만나보기」는 그 안에만 선다 */
export function PassedConnections({
  cards,
  working,
  explorationNote,
  onRestore,
  onBack,
  feedback,
}: {
  cards: readonly DeckCard[];
  working: boolean;
  explorationNote: string | null;
  onRestore: (card: DeckCard) => Promise<string | null>;
  onBack: () => void;
  feedback: React.ReactNode;
}) {
  const [looking, setLooking] = useState<DeckCard | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <View style={styles.passed}>
      <View style={styles.passedHead}>
        <WordText style={styles.quietTitle} accessibilityRole="header">
          지나친 인연
          {cards.length > 0 && (
            <WordText style={styles.count}>
              {'  '}
              {cards.length} / {PASSED_LIMIT}
            </WordText>
          )}
        </WordText>
        {cards.length > 0 && <WordText style={styles.body}>잠깐 지나쳤어도, 다시 궁금해질 수 있으니까요.</WordText>}
      </View>
      {cards.length === 0 ? (
        <View style={styles.passedEmpty}>
          <View style={styles.passedEmptyIcon}>
            <Icon size={20} name="undo" color={COLOR.creamInk} />
          </View>
          <View style={styles.flex}>
            <WordText style={styles.name}>지나친 인연이 여기에 모여요</WordText>
            <WordText style={styles.body}>다시 궁금해진 사람을 살펴보고,</WordText>
            <WordText style={styles.body}>한 번 더 알아갈 수 있는 자리예요.</WordText>
          </View>
        </View>
      ) : (
        <View style={styles.tiles}>
          {cards.map((card) => (
            <Card
              key={card.candidateUserId}
              accessibilityRole="button"
              onPress={() => {
                setFailure(null);
                setLooking(card);
              }}
              style={styles.tile}
            >
              <View style={styles.tilePhoto}>
                <PersonPhoto userId={card.candidateUserId} nickname={card.nickname} hasPhoto={card.hasPhoto} focus={card.photoFocus?.[0]} tone={card.avatarElement ?? supplyOf(card)} initialSize={48} />
                <View style={[styles.tileDot, { backgroundColor: tileOf(supplyOf(card)) }]}>
                  <ElementSymbol element={supplyOf(card)} size={20} />
                </View>
              </View>
              <View style={styles.tileBody}>
                <WordText style={styles.name} numberOfLines={1}>
                  {card.nickname}
                </WordText>
                <WordText style={styles.tileScore}>{`${TALK_SCORE_LABEL} ${card.previewScore}점`}</WordText>
                <WordText style={styles.small} numberOfLines={2}>
                  {card.highlights[0]?.text ?? card.reason}
                </WordText>
              </View>
            </Card>
          ))}
        </View>
      )}
      {feedback}
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.textLink}>
        <WordText style={styles.textLinkText}>오늘의 인연 계속 보기</WordText>
      </Pressable>
      <WordText style={styles.fine}>최근 {PASSED_LIMIT}명을 보관해요. 목록에서 빠진 인연은 마지막으로 넘긴 뒤 하루가 지나면 다시 추천될 수 있어요.</WordText>

      {looking !== null && (
        <DetailSheet open title={looking.nickname} onClose={() => setLooking(null)}>
          <CardDetails card={looking} explorationNote={explorationNote} />
          {failure !== null && (
            <WordText style={styles.failure} accessibilityRole="alert">
              {failure}
            </WordText>
          )}
          <PrimaryButton
            label={restoring ? '복원하는 중…' : '다시 만나보기'}
            disabled={working || restoring}
            onPress={async () => {
              setRestoring(true);
              setFailure(null);
              const message = await onRestore(looking);
              setRestoring(false);
              if (message === null) setLooking(null);
              else setFailure(message);
            }}
          />
        </DetailSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  off: { opacity: 0.55 },
  card: { flex: 1, minHeight: 320, padding: 0, overflow: 'hidden', boxShadow: ELEVATION.float },
  exploration: { position: 'absolute', left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
  explorationText: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  onPhoto: { position: 'absolute', right: 12, flexDirection: 'row', gap: 8 },
  info: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: alpha(FIXED.black, 0.42) },
  infoText: { fontFamily: FONT.bold, fontStyle: 'italic', fontSize: TYPE.heading, color: COLOR.onPhoto },
  face: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 10, paddingHorizontal: 20, paddingTop: 96, paddingBottom: 20 },
  faceHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  nickname: { fontFamily: FONT.bold, fontSize: 32, lineHeight: 40, color: COLOR.onPhoto },
  activity: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.onPhotoSoft },
  scoreTalk: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 28, color: COLOR.onPhoto },
  verdict: { fontFamily: FONT.medium, fontSize: TYPE.lead, lineHeight: 24, color: COLOR.onPhotoStrong },
  supply: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dots: { flexDirection: 'row', paddingLeft: 4 },
  dot: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 2, borderColor: COLOR.surface },
  supplyHead: { fontFamily: FONT.bold, fontSize: TYPE.fine, lineHeight: 16, color: COLOR.onPhotoFaint },
  supplyNames: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: COLOR.onPhoto },
  introLine: { fontFamily: FONT.medium, fontSize: TYPE.note, lineHeight: 20, color: COLOR.onPhotoSoft },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  undo: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  pass: { flex: 1, flexDirection: 'row', minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface },
  passText: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  request: { flex: 1.3, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: COLOR.accent },
  requestText: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.onAccent },
  reasonBox: { gap: 4 },
  detailVerdict: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: COLOR.foreground },
  body: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.secondary },
  supplyBox: { gap: 8, padding: 16 },
  supplyTitle: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
  supplyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supplyDot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border },
  supplyName: { fontFamily: FONT.bold, fontSize: TYPE.lead, lineHeight: 22 },
  small: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  note: { paddingTop: 12, borderTopWidth: 1, borderTopColor: COLOR.border, fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 20, color: COLOR.secondary },
  letter: { gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  letterText: { fontFamily: FONT.medium, fontSize: TYPE.field, lineHeight: 28, color: COLOR.foreground },
  signature: { alignSelf: 'flex-end', fontFamily: FONT.medium, fontSize: TYPE.body, color: COLOR.creamInk },
  fine: { fontFamily: FONT.medium, fontSize: TYPE.fine, lineHeight: 20, color: COLOR.secondary },
  meta: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.muted },
  failureBox: { gap: 4 },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 19, color: COLOR.danger },
  textLink: { minHeight: 44, justifyContent: 'center' },
  textLinkText: { fontFamily: FONT.bold, fontSize: TYPE.note, color: COLOR.foreground },
  flashBox: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  flash: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.foreground },
  quiet: { gap: 24 },
  quietTitle: { fontFamily: FONT.bold, fontSize: TYPE.heading, lineHeight: 28, color: COLOR.foreground },
  quietLink: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 12 },
  quietLinkText: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  passed: { gap: 20 },
  passedHead: { gap: 4 },
  count: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.secondary },
  passedEmpty: { flexDirection: 'row', gap: 12 },
  passedEmptyIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSunken },
  name: { fontFamily: FONT.bold, fontSize: TYPE.field, color: COLOR.foreground },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47.5%', padding: 0, overflow: 'hidden' },
  tilePhoto: { aspectRatio: 1 },
  tileDot: { position: 'absolute', left: 8, bottom: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 2, borderColor: COLOR.surface },
  tileBody: { gap: 4, padding: 12 },
  tileScore: { fontFamily: FONT.bold, fontSize: TYPE.small, color: COLOR.foreground },
});
