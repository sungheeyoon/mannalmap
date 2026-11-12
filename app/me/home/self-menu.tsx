'use client';

import Link from 'next/link';

import { MY_PROFILE_EDIT_LABEL } from '@/src/lib/chat/copy';

import { ICON_BUTTON_QUIET } from '../../ui/buttons';
import { useDetailsMenu } from '../../ui/details-menu';
import { Icon } from '../../ui/icons';
import { MENU_ITEM, MENU_PANEL } from '../../ui/surfaces';

/**
 * 홈 내 사주 카드의 「⋯」 — **저장한 사람 카드의 관리 메뉴(`app/me/people/person-menu.tsx`)와 같은 단추 · 같은 판 · 같은 줄이다**
 * (운영자 결정 2026-11-12, 시안 「수정 A안」). 여닫는 자리(`useDetailsMenu`) · 단추(`ICON_BUTTON_QUIET`) · 판(`MENU_PANEL`) ·
 * 줄(`MENU_ITEM`)을 그대로 쓰고, 읽는 이름도 같은 꼴이다(「{카드 이름} 관리」).
 *
 * 줄은 둘이다(운영자 검토 2026-11-12 — 시안이 둘이었다). 「출생 정보 수정」은 프로필 화면의 「출생 정보」 판을 편 채 열고(`/me/profile#birth`),
 * 「프로필 편집」은 그 화면 맨 위로 간다(`/me/profile` — 이름 왼쪽 원의 「내 프로필」 시트가 가는 곳과 같고, 글자도 그 단추의 상수다).
 * 두 줄 다 고치러 가는 길이라 줄 앞 그림은 두지 않는다 — 앱의 판과 같은 꼴이다.
 *
 * 그림은 점 셋(`more`)이다 — 운영자가 고른 꼴이고 앱의 「⋯」와 같다. 웹 저장한 사람 카드의 단추는 같은 면에 연필과 점 둘(`manage`)을 든다.
 *
 * 이름 줄의 한가운데 높이에 선다 — 폰은 이름 줄(28px), 넓은 화면은 원과 이름이 선 머리(56px)의 한가운데다.
 */
export function SelfCardMenu() {
  const { menu, close } = useDetailsMenu();

  return (
    <details ref={menu} className="absolute right-3 top-3 z-20 sm:right-6 sm:top-9.5">
      <summary className={`${ICON_BUTTON_QUIET} list-none [&::-webkit-details-marker]:hidden`} aria-label="내 사주 관리">
        <Icon name="more" className="size-5" />
      </summary>

      <div className={`${MENU_PANEL} absolute right-0 top-13 z-40 w-56 p-1.5`}>
        <Link href="/me/profile#birth" onClick={close} className={`${MENU_ITEM} text-foreground`}>
          출생 정보 수정
        </Link>
        <Link href="/me/profile" onClick={close} className={`${MENU_ITEM} text-foreground`}>
          {MY_PROFILE_EDIT_LABEL}
        </Link>
      </div>
    </details>
  );
}
