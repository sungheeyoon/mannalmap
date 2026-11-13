import type { ReactNode } from 'react';

import { READING_STALE_LABEL, READING_STALE_NOTE } from '@/src/lib/reading/notes';
import { seatNicknamesOf, withNicknames, type PairNicknames } from '@/src/lib/reading/display';
import { COMPAT_SCORE_LABEL } from '@/src/lib/reading/copy';
import { ELEMENTS, STEM_INFO, type Element, type Stem } from '@/src/lib/saju';

import { elementScope } from '../../ui/element-tone';
import { ElementSymbol } from '../../ui/element-symbol';
import { FaceSymbol, StemSymbol } from '../../ui/stem-symbol';
import { Icon } from '../../ui/icons';
import { ScoreGauge } from '../../ui/score-gauge';
import { TYPE_SECTION } from '../../ui/surfaces';
import type { CurrentReading } from '@/src/lib/reading';
import { coverFace, readingMinutes } from './essay';
import { discoveryLeadOf } from './discovery-lead';
import { Markdown, READING_COLUMN } from './markdown';
import { ShareReadingButton } from './share-button';
import type { ReadingTarget } from './target';
import { when } from '@/src/lib/reading/when';

/** 궁합풀이 표지의 한 사람 — 이름과 일간(동그라미의 그림 · 오행 soft 색). 화면이 보이는 차례 그대로 준다 */
export type CoverPerson = { readonly name: string; readonly stem: Stem | null };

/** 다 된 글 — 표지(비유 · 점수) · 수정 전 경고 · 본문 */
export function Result({
  reading,
  target,
  isMock,
  tones,
  betweenSummaryAndBody,
  nicknames,
  canShare = false,
  discoveryInCover = false,
  pair,
}: {
  /**
   * 궁합풀이 표지(시안 A, 운영자 승인 2026-11-13) — 두 사람 · 반원 게이지 · 비유 · 날짜를 가운데로 세운다. 화면 머리에 서던 두 사람 줄이
   * 표지 안으로 들어온다. 비공개 궁합(`/me/compat`)만 넘긴다 — 인연 궁합은 일간 그림을 안 세운다(ADR 0215)
   */
  pair?: readonly [CoverPerson, CoverPerson];
  /** 상세 궁합 — 글 첫 문단(발견 한 줄)을 표지의 비유와 점수 사이로 올린다(`discoveryLeadOf`) */
  discoveryInCover?: boolean;
  reading: CurrentReading;
  target: ReadingTarget;
  isMock: boolean;
  tones: readonly (Element | null)[] | undefined;
  betweenSummaryAndBody?: ReactNode;
  /** 두 사람 글의 자리 호칭을 바꿔 넣을 닉네임 — 궁합 화면만 넘긴다 */
  nicknames?: PairNicknames;
  /**
   * 표지 첫 줄(“ 의 줄) 오른쪽 끝에 공유 아이콘을 세우는가 — 세울지는 `panelChrome().canShare` 한 벌이 정한다(인연 궁합 · 예시 글 ·
   * 만드는 중에는 안 선다). 글 끝의 「공유 링크 복사」와 같은 일 · 같은 이름이다. 비유가 없는 글은 표지에 첫 줄이 없어 아이콘 없이
   * 글 끝 단추만 선다
   */
  canShare?: boolean;
}) {
  /*
    **모델 글이 서는 두 자리(본문 · 한 줄 요약) 모두 자리 호칭을 지금의 닉네임으로 바꾼다.** 프롬프트에는 이름이
    안 실리므로(운영자 2026-10-15) 글은 「첫번째님」·「두번째님」으로 온다. 호칭이 없는 옛 글은 그대로 돌아간다.
  */
  const seats = nicknames === undefined ? null : seatNicknamesOf(nicknames, reading.viewerIsFirst);
  const named = (text: string): string => (seats === null ? text : withNicknames(text, seats));
  const { lead: discovery, rest: body } = discoveryInCover
    ? discoveryLeadOf(named(reading.output))
    : { lead: null, rest: named(reading.output) };
  const metaphor = reading.metaphor === null ? null : named(reading.metaphor);

  /*
    **표지의 색은 부르는 화면이 정한다** — 대상의 일간이다. 모르면(부르는 화면이 안 넘기면) 크림 한 장이다:
    회색 표지는 「못 읽은 명식」의 뜻이라, 몰라서 안 넘긴 자리에 쓰면 거짓말이 된다.
  */
  const face = tones === undefined ? null : coverFace(tones);
  /** 한 사람 풀이의 표지 — 천간 그림이 선다 */
  const single = tones !== undefined && tones.length === 1;
  const firstTone = tones?.[0] ?? null;

  const meta = (
    <>
      {isMock && (
        <span className="rounded-full bg-warning-wash px-2.5 py-1 text-tag font-semibold text-warning">
          예시 결과
        </span>
      )}
      <time dateTime={reading.createdAt} className="tabular-nums">
        {when(reading.createdAt)} 생성
      </time>
      <span aria-hidden="true">·</span>
      <span>읽는 데 약 {readingMinutes(body)}분</span>
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      {/*
        **비유 한 줄이 이 글의 표지다** — 에세이 앱의 표지처럼 가장 크게 세운다(시안 3차 warm). 점수는 표지의
        오른쪽 아래, 비유가 흐르는 자리를 밀어내지 않는 곳에 선다. 비유는 길이가 들쭉날쭉하다(마흔 자 안팎을
        시키지만 막는 자리는 120자) — 한 줄을 전제하지 않고 `text-pretty` 로 고르게 나눈다.
      */}
      {pair !== undefined ? (
        <PairCover
          pair={pair}
          score={reading.score}
          metaphor={metaphor}
          discovery={discovery}
          meta={meta}
          share={canShare ? <ShareReadingButton target={target} look="icon" /> : null}
        />
      ) : reading.score !== null || metaphor !== null ? (
        <figure
          className={`${elementScope(firstTone)} relative rounded-card px-6 pb-6 pt-7 sm:px-10 sm:pb-8 sm:pt-10 ${face === null ? 'bg-cream' : ''}`}
          style={face === null ? undefined : { background: face.background }}
        >
          {/*
            한 사람 풀이의 표지 — 그 사람의 천간 그림(저장한 사람 카드의 딱지와 같은 것). 일간을 모르면 오행 상징. **위 구석이 아니라
            비유 옆에 선다**(2026-10-27 운영자 선택 「H′」) — 위 구석은 공유 아이콘의 자리라, 그림이 단추 밑에 깔리지 않게 한 단 내렸다
          */}
          {/*
            **그림만 표지 밖을 자른다** — 표지 전체를 `overflow-hidden` 으로 두면 공유 아이콘의 실패 판(주소를 손으로 긁는 판)이 좁은 폰에서
            표지 테에 잘렸다(320px, #855 검토). 자르는 층은 그림 한 겹이고, 판은 표지 위에 떠서 다 보인다
          */}
          {single && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-card">
              <FaceSymbol
                stem={reading.dayMasterA}
                element={firstTone}
                className="absolute -right-10 top-16 size-48 opacity-20 sm:-right-14 sm:top-20 sm:size-56"
              />
            </span>
          )}
          {metaphor !== null ? (
            <>
              {/*
                **공유는 표지 첫 줄 끝에 아이콘 하나**(2026-10-27 운영자 선택 「H′」) — 들어오자마자 보내는 길이 글의 얼굴 곁에 보인다. 제목 줄
                끝(안 D)에서 옮겼다. 줄 높이(h-10)는 그대로 두고 단추가 위 여백으로 조금 나간다 — 아이콘이 서도 비유가 안 밀린다
              */}
              <span className="relative flex h-10 items-start justify-between gap-3">
                <span aria-hidden="true" className="block h-10 font-rounded text-[5rem] leading-none text-[var(--ink)] opacity-70">
                  “
                </span>
                {canShare && (
                  <span className="-mr-2 -mt-2">
                    <ShareReadingButton target={target} look="icon" />
                  </span>
                )}
              </span>
              {/* 내린 그림이 비유 끝 글자에 겹치지 않게, 그림이 선 표지는 글 오른쪽을 그림 폭만큼 비운다 */}
              <blockquote
                className={`relative mt-2 max-w-[18em] text-pretty font-rounded text-title leading-[1.4] tracking-[-0.02em] text-foreground sm:text-figure ${single ? 'sm:pr-28' : ''}`}
              >
                {metaphor}
              </blockquote>
            </>
          ) : (
            <p className="relative text-small font-semibold text-secondary">풀이 결과</p>
          )}
          {discovery !== null && (
            <p data-discovery className="relative mt-5 max-w-[32em] text-pretty text-lead font-medium leading-7 text-foreground">
              {discovery}
            </p>
          )}
          <figcaption className="relative mt-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] pt-4">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-small text-secondary">{meta}</span>
            {reading.score !== null && (
              <span className="flex flex-col items-end">
                <span className="text-small font-semibold text-secondary">{COMPAT_SCORE_LABEL}</span>
                <span className="flex items-baseline gap-1">
                  <span className="text-figure font-bold leading-none tabular-nums text-foreground">{reading.score}</span>
                  <span className="text-small font-semibold text-secondary">/ 100</span>
                </span>
              </span>
            )}
          </figcaption>
        </figure>
      ) : (
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-small text-secondary">{meta}</p>
      )}
      {/*
        **늘 참인 사실은 여기 안 적는다.** 여기 서는 것은 **실제로 갈리는** 한 줄뿐이다 — 지금과 다른
        명식으로 만든 글. 새로 만들면 지금 것이 사라진다는 경고는 되돌릴 수 없는 누름 **직전**에 필요한
        말이라 확인 창이 든다. 색만으로 말하지 않는다 — 「수정 전」 낱말이 함께 선다.
      */}
      {target.kind !== 'match' && !reading.fromCurrentChart && (
        <p className="flex gap-2.5 rounded-card bg-warning-wash px-4 py-3.5 text-note leading-6 text-foreground">
          <Icon name="alert" className="mt-0.5 size-5 text-warning" />
          <span>
            <span className="mr-1.5 font-semibold text-warning">{READING_STALE_LABEL}</span>
            {READING_STALE_NOTE}
          </span>
        </p>
      )}
      {betweenSummaryAndBody}
      <div className={`${elementScope(firstTone)} flex flex-col gap-2 pt-4 sm:pt-8`}>
        {target.kind === 'match' && (
          <header className={READING_COLUMN}>
            <p className="text-small font-semibold text-secondary">두 사람의 풀이</p>
            <h2 className={`mt-1 ${TYPE_SECTION}`}>궁합풀이 결과</h2>
          </header>
        )}
        <article id={`reading-${reading.id}`}>
          <Markdown source={body} />
        </article>
        {/* 글의 끝 — 다섯 상징이 마침표 자리에 선다 */}
        <span aria-hidden="true" className="mt-12 flex justify-center gap-3 opacity-80">
          {ELEMENTS.map((element) => (
            <ElementSymbol key={element} element={element} className="size-5" />
          ))}
        </span>
      </div>
    </div>
  );
}

/**
 * **궁합풀이 표지 — 시안 A 「점수를 가운데 크게」**(운영자 승인 2026-11-13). 위에서부터 가운데로 두 사람(동그라미 + 이름) → 반원 게이지와 큰
 * 「82점」 · 작은 「궁합 점수」 → 비유 한 줄(큰 명조) → 날짜 · 읽는 시간. 큰 따옴표와 구분선은 걷었다. 점수가 없는 옛 궁합은 게이지와 그 이름이
 * 빠지고 이름 → 비유 → 날짜만 선다. 공유 아이콘은 표지 오른쪽 위 그대로다(#1142).
 */
function PairCover({
  pair,
  score,
  metaphor,
  discovery,
  meta,
  share,
}: {
  pair: readonly [CoverPerson, CoverPerson];
  score: number | null;
  metaphor: string | null;
  discovery: string | null;
  meta: ReactNode;
  share: ReactNode;
}) {
  return (
    <figure className="relative flex flex-col items-center gap-4 rounded-card bg-cream px-5 pb-6 pt-6 text-center sm:px-10 sm:pb-8 sm:pt-8">
      {share !== null && <span className="absolute right-2 top-2 sm:right-3 sm:top-3">{share}</span>}
      {/* 아이콘 자리(44px)만큼 양옆을 비워 긴 이름이 단추 밑에 깔리지 않는다 */}
      <p className="flex max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-10 text-lead font-bold text-foreground">
        <CoverName person={pair[0]} />
        <span className="text-small font-semibold text-secondary">×</span>
        <CoverName person={pair[1]} />
      </p>
      {score !== null && (
        <div className="mt-1 flex flex-col items-center gap-1.5">
          <ScoreGauge score={score} />
          <p className="text-small font-semibold text-secondary">{COMPAT_SCORE_LABEL}</p>
        </div>
      )}
      {metaphor !== null && (
        <blockquote className="max-w-[18em] text-pretty font-rounded text-heading leading-[1.45] tracking-[-0.02em] text-foreground sm:text-title">
          {metaphor}
        </blockquote>
      )}
      {discovery !== null && (
        <p data-discovery className="max-w-[32em] text-pretty text-lead font-medium leading-7 text-foreground">
          {discovery}
        </p>
      )}
      <figcaption className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-small text-secondary">{meta}</figcaption>
    </figure>
  );
}

/** 동그라미(그 사람의 일간 그림 · 오행 soft 색) + 이름 — 일간을 모르면 회색 동그라미만 선다 */
function CoverName({ person }: { person: CoverPerson }) {
  const element = person.stem === null ? null : STEM_INFO[person.stem].element;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span aria-hidden="true" className={`${elementScope(element)} grid size-8 shrink-0 place-items-center rounded-full bg-[var(--tile)]`}>
        {person.stem !== null && <StemSymbol stem={person.stem} className="size-5" />}
      </span>
      <span className="min-w-0 break-words">{person.name}</span>
    </span>
  );
}
