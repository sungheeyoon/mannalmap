import { accountLineOf } from '@/src/lib/account/sign-in-line';
import { adultCheckCleared } from '@/src/lib/matching/adult-check';

import { supabaseOnServer } from '../../auth/server-client';
import { signedInUser } from '../../auth/signed-in';
import { redirectToSignIn } from '../../auth/sign-in-redirect';
import { openOf, readMatchOpen } from '../../match-opening';
import { readAccount } from '../account';
import { myAdultCheck } from '../matching/adult-check/state';
import { myDiscoveryProfile } from '../discovery/discovery-profile';
import { myPhotos } from '../profile/photos';
import { SettingsView } from './view';

export const metadata = {
  title: '설정',
  description: '로그인 정보와 계정 상태를 확인하고 계정을 관리합니다.',
};

/**
 * 설정 화면 — 여기는 **읽기만** 한다. 그림(무리의 차례 · 맨 위 내 프로필)은 `view.tsx`, 줄의 모양은 `card.tsx` 한 벌이 든다.
 */
export default async function SettingsPage() {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  /** 온보딩을 안 묻는 화면이라 `self_person_id` 를 안 읽고, 대신 동의 칸과 이름을 함께 읽는다 */
  const [{ state, row: account }, discoveryProfile, photoless, matchOpen, adultCheck] = await Promise.all([
    readAccount(supabase, ['status', 'nickname', 'improvement_consent', 'notice_version', 'notice_ack_at']),
    myDiscoveryProfile(),
    /*
      **사진이 한 장도 없다고 읽었을 때만 참이다.** 못 읽었으면 거짓 — 「사진 추가」는 덧붙이는 한 줄이라 안 서는 것이 원래
      모습이고, 사진이 있는 사람에게 「사진 추가」를 세우지 않는다(ADR 0078). 이 화면을 오류 경계로 보내지도 않는다.
    */
    myPhotos().then(
      (photos) => photos.length === 0,
      () => false,
    ),
    readMatchOpen(supabase).then(openOf),
    /* 참여 스위치 아래 줄이 성인 확인 전인지 가른다 — 못 읽으면 `null` 이고 줄은 단정하지 않는 쪽을 고른다(`participationHelp`) */
    myAdultCheck(),
  ]);

  return (
    <SettingsView
      data={{
        state,
        account,
        discoveryProfile,
        photoless,
        matchOpen,
        adultCleared: adultCheckCleared(adultCheck),
        accountLine: accountLineOf(user.email, user.providers),
        userId: user.id,
        pushAvailable: Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY),
      }}
    />
  );
}
