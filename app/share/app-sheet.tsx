'use client';

import Image from 'next/image';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { SERVICE_NAME } from '@/src/lib/brand';

import appIcon from '../apple-icon.png';
import { BUTTON_PRIMARY } from '../ui/buttons';
import { closeSheet, openSheet } from '../ui/sheet';
import { TYPE_SECTION } from '../ui/surfaces';
import { APP_SHEET_DISMISSED_KEY, appOpenHref, shouldOfferApp } from './app-link';
import type { ShareKind } from './path';

/**
 * 제목 · 한 줄 · [앱에서 보기]는 운영자가 불러 준 그대로다(2026-11-13). 「웹으로 계속하기」는 굿닥의 글자다(대장 public-18 확인 전).
 */
const SHEET_COPY = {
  title: `${SERVICE_NAME} 앱에서 볼까요?`,
  note: '내 사주도 바로 볼 수 있어요.',
  open: '앱에서 보기',
  stay: '웹으로 계속하기',
} as const;


/**
 * **「앱에서 볼까요?」 시트** — 안드로이드 폰에서 공유 링크를 열면 글 위에 어두운 면과 함께 아래에서 올라온다(운영자 승인 2026-11-13, ADR 0247).
 *
 * - 글은 그 밑에 이미 다 그려져 있다 — 시트는 묻기만 하고, 닫으면 그대로 읽는다.
 * - 판정은 브라우저에서 한다(user agent · 브라우저 저장소). 서버 HTML 에는 시트가 없다 — 미리보기 수집기와 아이폰 · 데스크톱은 안 본다.
 * - 「웹으로 계속하기」 · 어두운 면 누름 · 뒤로 가기가 닫기다. 닫으면 그 브라우저에서 다시 안 묻는다. 저장소를 못 읽으면 묻되, 닫기는 늘 된다.
 * - [앱에서 보기]는 진짜 링크다 — intent 주소는 누름 안에서 열려야 브라우저가 앱을 띄운다. 누르면 다시 안 묻는 것으로 적고 시트는 그대로 둔다 —
 *   앱으로 넘어갔다 돌아온 사람이 「웹으로 계속하기」로 닫는다.
 * - 「웹으로 계속하기」는 단추가 아니라 작은 회색 글자 줄이다(운영자 2026-11-13) — 한국 서비스가 웹으로 계속 보는 길을 눈에 덜 띄게 둔다
 *   (굿닥 「상대적으로 눈에 띄진 않습니다」, <https://yozm.wishket.com/magazine/detail/1030>). 누를 자리는 44px 이다.
 */
export function AppSheet({ kind, token }: { kind: ShareKind; token: string }) {
  const sheet = useRef<HTMLDialogElement>(null);
  /** 뒤로 가기를 닫기로 쓰려고 쌓은 기록 한 칸이 아직 위에 있나 */
  const pushed = useRef(false);
  /* 서버와 첫 그림은 `null`(시트 없음) — 브라우저에서만 user agent 와 저장소를 읽어 가른다 */
  const href = useSyncExternalStore(noChange, () => offerOnce(kind, token), () => null);

  useEffect(() => {
    if (href === null) return;
    openSheet(sheet.current);
    /* 처음 초점은 판 자체에 — 첫 단추에 두면 열자마자 [앱에서 보기]에 초점 고리가 서서 이미 고른 것처럼 보인다 */
    sheet.current?.focus();
    /* 뒤로 가기 — 같은 주소의 기록 한 칸을 쌓아 두고, 그 칸이 빠지면(popstate) 닫는다. 다른 길로 닫으면 그 칸을 되돌린다 */
    window.history.pushState(null, '');
    pushed.current = true;
    const onBack = () => {
      if (!pushed.current) return;
      pushed.current = false;
      closeSheet(sheet.current);
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, [href]);

  /* 닫은 것은 `onClose` 가 적는다 — 어느 길(단추 · 바깥 · Esc · 뒤로 가기)로 닫혀도 한 번 */
  const dismiss = () => {
    closeSheet(sheet.current);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    }
  };

  if (href === null) return null;

  return (
    <dialog
      ref={sheet}
      aria-labelledby="share-app-sheet-title"
      tabIndex={-1}
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClose={writeDismissed}
      className="mx-auto mb-0 mt-auto w-full max-w-[28rem] outline-none rounded-t-card bg-background p-0 text-foreground backdrop:bg-scrim lg:my-auto lg:rounded-card lg:shadow-float"
    >
      <div className="flex flex-col gap-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 lg:p-6">
        <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-full bg-border-strong lg:hidden" />
        <div className="flex items-center gap-3.5">
          {/*
            앱 아이콘 — 새로 그리지 않고 웹의 앱 아이콘(`app/apple-icon.png`, 홈 화면에 붙이는 그림)을 쓴다. 무신사 · 원티드 · 리멤버가 시트의
            제목 왼쪽에 앱 아이콘을 둔다(<https://yozm.wishket.com/magazine/detail/1030>, 확인 2026-11-13)
          */}
          <Image src={appIcon} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-cell shadow-card" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="share-app-sheet-title" className={TYPE_SECTION}>{SHEET_COPY.title}</h2>
            <p className="text-body text-secondary">{SHEET_COPY.note}</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <a href={href} onClick={writeDismissed} className={`${BUTTON_PRIMARY} w-full`}>
            {SHEET_COPY.open}
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-11 items-center px-3 text-small text-secondary underline underline-offset-4 hover:text-foreground"
          >
            {SHEET_COPY.stay}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** 브라우저의 값은 화면이 떠 있는 동안 안 바뀐다 — 구독할 것이 없다 */
const noChange = () => () => {};

/**
 * 이 공유본에서 시트가 갈 주소 — 처음 한 번만 가르고 그 답을 든다. 닫은 뒤 다시 그려도 시트가 사라지지 않게(닫는 움직임은 `closeSheet` 가
 * 끝낸다) 같은 값을 돌려준다.
 */
const offers = new Map<string, string | null>();
function offerOnce(kind: ShareKind, token: string): string | null {
  const key = `${kind}/${token}`;
  if (!offers.has(key)) {
    const userAgent = window.navigator.userAgent;
    offers.set(key, shouldOfferApp(userAgent, readDismissed()) ? appOpenHref(kind, token, userAgent) : null);
  }
  return offers.get(key) ?? null;
}

/** 닫은 적이 있나 — 못 읽으면 `null`(사생활 창 · 막힌 저장소). 그때는 묻는다 */
function readDismissed(): boolean | null {
  try {
    return window.localStorage.getItem(APP_SHEET_DISMISSED_KEY) === '1';
  } catch {
    return null;
  }
}

/** 닫은 것을 적는다 — 못 적으면 다음에 또 묻는 것뿐이라 그냥 넘어간다 */
function writeDismissed() {
  try {
    window.localStorage.setItem(APP_SHEET_DISMISSED_KEY, '1');
  } catch {
    /* 적지 못해도 이 화면은 닫힌다 */
  }
}
