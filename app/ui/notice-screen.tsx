import type { ReactNode } from 'react';

import { Logo } from './logo';
import { TYPE_TITLE } from './surfaces';

/**
 * **안내 화면의 틀 하나** — 막히거나 끝난 자리가 다 이 모양으로 선다: 로고 · 제목 · 설명 · 주 단추 · 보조 줄.
 *
 * 2026-10-09 화면 점검(A5)에서 이 자리들이 세 모양이었다 — 404 · 로그인 실패는 가운데 크림 카드에 왼쪽 정렬, 막힌 공유
 * 링크는 카드 없이 가운데 정렬, 베타 종료는 넓은 카드에 단추 없음. 같은 처지의 화면이 모양만 달라 사용자가 어느 쪽이
 * 이 앱의 「막힌 화면」인지 정하게 됐다. 지금 이 틀을 쓰는 자리는 404(`app/not-found.tsx`) · 오류(`app/error-screen.tsx`) ·
 * 로그인과 로그인 실패(`app/auth/**`) · 막힌 공유 링크(`app/share/not-found.tsx`) · 베타 종료(`app/closed`) · 없는
 * 사람 · 인연(`app/me/{compat,people/[personId],match/[matchId]}/not-found.tsx`)이다.
 *
 * **정렬은 가운데 카드 · 왼쪽 글이다**(ADR 0109 추기 2026-10-09). 카드는 화면 가운데 서서 「여기서 멈췄다」를 말하고,
 * 글은 왼쪽에서 시작해 두 줄 넘는 설명도 줄머리가 흔들리지 않는다.
 *
 * 링크는 부르는 쪽이 지어 넘긴다 — `app/ui` 는 `app` 의 다른 모듈(`HomeLink` 등)을 부르지 않는다(`scripts/layers.test.ts`).
 */
export function NoticeScreen({
  title,
  description,
  children,
  actions,
  note,
  narrow = false,
}: {
  /** 제목 — 체언형 또는 해요체 한 문장. 마침표는 안 찍는다 */
  title: ReactNode;
  /** 무슨 일인지 + 무엇을 하면 되는지. 문단을 나누려면 `<p>` 여럿을 넘긴다 */
  description?: ReactNode;
  /** 설명과 단추 사이에 서는 것(로그인 화면의 「로그인하면」 줄 넷) */
  children?: ReactNode;
  /** 주 단추가 앞이고, 보조 단추가 뒤다. 좁은 화면에서는 위아래로 선다 */
  actions?: ReactNode;
  /** 단추 아래 작은 한 줄 */
  note?: ReactNode;
  /**
   * 데스크톱(`sm:` 이상)에서 카드를 432px(여백 40, 글줄 352)로 좁힌다 — 숨고처럼 좁은 한 열에 글과 단추가 끝에서 끝까지 선다. 로그인 화면만 쓴다
   * (운영자 결정 2026-11-06, ADR 0228 추기). 글줄은 로그인 단추의 천장(`SIGN_IN_BUTTON.maxWidth` 360)보다 좁아 천장이 닿지 않는다. 좁은 화면은 그대로다
   */
  narrow?: boolean;
}) {
  return (
    <main className="app-shell grid w-full flex-1 place-items-center py-12 sm:py-20">
      <section className={`flex w-full max-w-lg flex-col gap-6 rounded-card bg-cream p-6 sm:p-10 ${narrow ? 'sm:max-w-[432px]' : ''}`}>
        <header className="flex flex-col gap-2">
          <span className="grid size-16 place-items-center rounded-full bg-surface shadow-card">
            <Logo className="size-10" />
          </span>
          <h1 className={`mt-3 text-balance ${TYPE_TITLE}`}>{title}</h1>
          {description !== undefined && (
            <div className="flex flex-col gap-3 text-body leading-7 text-secondary">{description}</div>
          )}
        </header>
        {children}
        {actions !== undefined && <div className="flex flex-col gap-2 sm:flex-row">{actions}</div>}
        {note !== undefined && <div className="flex flex-col gap-1 text-small leading-5 text-secondary">{note}</div>}
      </section>
    </main>
  );
}
