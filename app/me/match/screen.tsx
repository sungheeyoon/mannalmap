import { DETAIL_NOT_YET } from '@/src/lib/chat/room/detail-copy';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { BUTTON_SECONDARY_SMALL, ICON_BUTTON_GHOST } from '../../ui/buttons';
import { Icon } from '../../ui/icons';
import { EMPTY_SLOT, TYPE_META, TYPE_NAME } from '../../ui/surfaces';
import { ReportBlock } from '../requests/report-block';
import { PartnerFace } from '../partner-sheet';
import { ReadingSection } from '../reading/section';
import { readAccount } from '../account';
import { backOf, placeOf } from '../../came-from';
import { UUID } from '../../uuid';
import { matchDetailForViewer } from '../chat/[matchId]/room-detail';
import { matchResultForViewer, type SharedResult } from './result';

/** 결과가 어느 틀에 서나 — 제 주소(`/me/match/[id]`)의 한 화면, 또는 풀이 보관함의 옆 칸(ADR 0134, `../compat/screen.tsx` 와 같다) */
type MatchFrame = 'page' | 'shelf';

/**
 * 공유 결과 — **상세 궁합의 동의가 연 글.**
 *
 * **상대의 `Saju` · `ChartEvidence` · 여덟 글자는 이 화면에 오지 않는다**(ADR 0010 · 0012 · 0215). 여덟 글자는 글을 쓰는 데만
 * 쓰이고, 정확한 생년월일시·출생지·상대 원국 전체 판정·근거 패널은 계속 서버 경계 안에 남는다.
 */
export async function MatchScreen({
  matchId,
  query,
  frame,
}: {
  matchId: string;
  query: { from?: string | string[]; kind?: string | string[] };
  frame: MatchFrame;
}) {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  /**
   * **그릴 것을 정하기 전에 답이 나온다**(`/me/compat` 과 같은 규율).
   *
   * 거절을 화면 안쪽 컴포넌트에 두면 그것이 그려질 때는 응답이 이미 흘러나가기
   * 시작했을 수 있고, 그러면 404 를 부르고도 200 이 나간다.
   */
  /* 내 닉네임은 글의 자리 호칭을 바꿔 넣을 때만 쓴다(`Result`). 닉네임은 가입 때 정해 늘 있다 — 못 읽은 드문 때는 빈 값이고, 그 자리는 호칭 그대로 선다(`withNicknames`) */
  const [result, account, detailRead] = await Promise.all([
    matchResultForViewer(matchId),
    readAccount(supabase, ['status', 'nickname']),
    UUID.test(matchId) ? matchDetailForViewer(supabase, matchId) : null,
  ]);
  /*
    글은 상세 궁합의 동의 뒤에만 서므로 글이 없는 동안 할 일은 방에 있다(ADR 0215). 만드는 중 · 완료만 글 칸이 선다.
    상태를 못 읽었으면 글 칸이 제 상태를 읽어 선다.
  */
  const noReadingYet = detailRead !== null && detailRead.state !== 'ready' && detailRead.state !== 'making';
  const myNickname = account.row?.nickname ?? '';

  /**
   * **없는 Match 와 못 보는 Match 를 같은 말로 거절한다.**
   *
   * 갈리면 응답 차이만으로 그 Match 가 실재하는지 알아낼 수 있다. 여기서 두 경우가
   * 같아지는 것은 문장을 맞춰 적어서가 아니라 **답이 한 자리에서 나오기 때문**이다 —
   * `matchResultForViewer` 는 둘 다 `null` 을 내고, 그 `null` 을 응답으로 바꾸는
   * 곳이 이 한 줄뿐이다.
   */
  if (result === null) notFound();

  /* 방으로 돌아가는 ← 는 이 Match 의 방이다 — `matchId` 는 위 문이 UUID 로 걸렀고 실제로 볼 수 있는 Match 다 */
  const place = placeOf(query, frame === 'shelf' ? `/me/readings/match/${matchId}` : `/me/match/${matchId}`);
  const back = backOf('match', { ...place, matchId });
  /* 보관함 옆 칸에서 ← 가 보관함으로 가면 넓은 화면에서는 안 선다 — 책장이 이미 옆에 있다(사주풀이와 같다) */
  const besideShelf = frame === 'shelf' && place.from === 'shelf';
  const Title = frame === 'page' ? 'h1' : 'h2';
  /*
    **방으로 가는 길은 머리에 선다**(화면 감사 2026-10-09). 맺어진 뒤 가장 먼저 할 일인데, 글 끝(설문 뒤 약 3000px)에만
    있었다. 방에서 왔으면 ← 가 이미 그 방이라(`backOf` 의 `chat`) 한 머리에 같은 이름 · 같은 곳이 둘 서지 않게 뺀다.
  */
  const room = `/me/chat/${result.matchId}`;
  const toRoom = room !== null && back.href !== room ? room : null;

  return (
    /*
      **다른 화면과 같은 폭·같은 머리를 쓴다.** 여기만 제 손으로 여백과 제목을 그리고
      있어서, 소식에서 이 화면으로 들어오면 앱이 한 번 갈아 끼워지는 것처럼 보였다.
    */
    <Frame frame={frame}>
      <header className="flex items-center gap-3">
        {/* ← 는 온 곳으로 간다(ADR 0134) — 글자 대신 아이콘이고, 가는 곳의 이름은 보조기기가 읽는다 */}
        <Link
          href={back.href}
          aria-label={back.label}
          className={`${ICON_BUTTON_GHOST} ${besideShelf ? 'lg:hidden' : ''}`}
        >
          <Icon name="back" className="size-5" />
        </Link>
        <PartnerFace
          size={40}
          partner={{
            userId: result.partnerUserId,
            nickname: result.partnerNickname,
            intro: result.partnerIntro,
            photoUrls: result.partnerPhotoUrls,
            photoFocus: result.partnerPhotoFocus,
            tone: null,
          }}
          menu={<ReportBlock userId={result.partnerUserId} nickname={result.partnerNickname} />}
        />
        {/* 제목 하나가 두 줄을 든다 — 보조기기에는 「{닉네임} 님 궁합 결과」 한 이름으로 읽힌다 */}
        <Title className="min-w-0 flex-1">
          <span className={`${TYPE_NAME} block break-words`}>
            {result.partnerNickname} 님
          </span>{' '}
          <span className={`${TYPE_META} block`}>궁합 결과</span>
        </Title>
        <div className="flex shrink-0 items-center gap-1">
          {toRoom !== null && (
            <Link href={toRoom} className={`${BUTTON_SECONDARY_SMALL} shrink-0`}>
              <Icon name="chat" className="size-[18px]" />
              {CHAT_TAB_LABEL}
            </Link>
          )}
          {/* 끊는 자리는 머리의 「⋯」다(ADR 0158) */}
          <ReportBlock userId={result.partnerUserId} nickname={result.partnerNickname} />
        </div>
      </header>

      {noReadingYet ? (
        <section className={EMPTY_SLOT}>
          <p className="text-body leading-7 text-secondary">{DETAIL_NOT_YET}</p>
          <Link href={`/me/chat/${matchId}`} className={`${BUTTON_SECONDARY_SMALL} mt-3`}>
            <Icon name="chat" className="size-[18px]" />
            {CHAT_TAB_LABEL}
          </Link>
        </section>
      ) : (
        <Result result={result} myNickname={myNickname} />
      )}
    </Frame>
  );
}

/** 틀 — 제 주소면 한 화면(`main`), 보관함이면 옆 칸의 글 한 편(`article`)이다. 보관함의 `main` 은 레이아웃이 세웠다 */
function Frame({ frame, children }: { frame: MatchFrame; children: ReactNode }) {
  return frame === 'page' ? (
    <main className="app-shell flex w-full flex-1 flex-col gap-8 py-8 sm:py-12">{children}</main>
  ) : (
    <article className="flex min-w-0 flex-col gap-8">{children}</article>
  );
}

function Result({ result, myNickname }: { result: SharedResult; myNickname: string }) {
  return (
    <>
      {/*
        **점수는 여기 한 자리에서만 난다.** 예전에는 이 자리에 `match-v0` 대시보드가
        섰다. 그것을 내린 것은 지표가 틀려서가 아니라 **한 화면에 점수가 둘이면 사용자가
        무엇을 믿을지 정해야 하기 때문**이다 — 사용자에게 보이는 점수는 현재 결과의
        일부이고(`prd-archive`), `match-v0` 는 그 뒤 코드에서도 걷었다.
      */}
      {/*
        **여기에는 만드는 버튼이 없다** (ADR 0215).

        상세 궁합은 방에서 청하고 받은 사람이 누를 때 만들어진다. 실패 뒤 다시 만들기도 방의 상세 칸이 든다 —
        글이 없는 동안 이 화면은 방으로 가는 길만 세운다(위 `noReadingYet`).
      */}
      <ReadingSection
        target={{ kind: 'match', matchId: result.matchId }}
        heading={`${result.partnerNickname} 님과의 궁합풀이`}
        headingHidden
        automatic
        bare
        discoveryInCover
        nicknames={{ viewer: myNickname, partner: result.partnerNickname }}
        /* 결과는 비유 → 발견 → 점수 → 글이다 — 여덟 글자 카드 · 일간 표지를 안 세운다. 글자를 돌려주지 않는다(ADR 0215) */
      />
    </>
  );
}
