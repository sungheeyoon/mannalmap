import { redirect } from 'next/navigation';

import { MATCHING_START_LEAVE } from '@/src/lib/brand/guide';
import { safeReturnPath } from '@/src/lib/consent';
import {
  ADULT_CHECK_LINE,
  ADULT_CHECK_TITLE,
  ADULT_CHECK_UNAVAILABLE,
  ADULT_CHECK_VISIBLE,
  adultCheckNeeded,
} from '@/src/lib/matching/adult-check';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { NoticeScreen } from '../../../ui/notice-screen';
import { myAdultCheck } from './state';

export const metadata = {
  title: '성인 확인',
  robots: { index: false, follow: false },
};

/**
 * 성인 확인 안내(ADR 0214) — 앱의 `mobile/src/app/me/matching/adult-check.tsx` 와 같은 자리다. 스위치가 켜졌고 미확인인 사람을
 * 관문(`proxy.ts`)이 인연 주소에서 이리로 보낸다. 꺼져 있거나 이미 확인했으면 온 주소로 돌아간다.
 *
 * **업체를 끼우는 자리.** 업체가 정해지기 전이라 단추가 없고 「지금은 할 수 없어요」 줄이 선다. 업체가 정해지면 그 업체의 창을 여는
 * 단추를 여기 두고, 서버가 결과를 검증해 `confirm_adult_check` 를 적은 뒤 이 화면이 상태를 다시 읽어 `next` 로 간다.
 */
export default async function AdultCheckPage({ searchParams }: PageProps<'/me/matching/adult-check'>) {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const { next } = await searchParams;
  const state = await myAdultCheck();
  if (state !== null && !adultCheckNeeded(state)) redirect(safeReturnPath(next));

  return (
    <NoticeScreen
      title={ADULT_CHECK_TITLE}
      description={
        <>
          <p>{ADULT_CHECK_LINE}</p>
          <p>{ADULT_CHECK_VISIBLE}</p>
          <p>{ADULT_CHECK_UNAVAILABLE}</p>
        </>
      }
      note={<p>{MATCHING_START_LEAVE}</p>}
    />
  );
}
