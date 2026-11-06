import { Redirect, router } from 'expo-router';

import { SUPPORT_EMAIL } from '@brand';
import { SERVICE_ENDED_ON, serviceIsOver } from '@consent/gate';
import { SERVICE_ENDED_TITLE, serviceEndedNote } from '@consent/notice';

import { NoticeLine, NoticeScreen } from '@/ui/notice-screen';
import { PrimaryButton } from '@/ui/parts';

/**
 * 서비스 종료 — 웹의 `/closed`. 실제 종료 때만 선다(`SERVICE_ENDED_ON`, ADR 0234) — 끝나지 않았으면 돌려보낸다: 링크 하나로
 * 「끝났습니다」를 아무 때나 띄우면 거짓말이다. 종료의 고지라 합니다체다(ADR 0135).
 */
export default function ClosedScreen() {
  if (SERVICE_ENDED_ON === null || !serviceIsOver(new Date())) return <Redirect href={'/me' as never} />;

  return (
    <NoticeScreen
      title={SERVICE_ENDED_TITLE}
      description={
        <>
          <NoticeLine>{serviceEndedNote(SERVICE_ENDED_ON)}</NoticeLine>
          <NoticeLine>함께해 주셔서 고맙습니다. 남은 문의는 {SUPPORT_EMAIL}으로 보내 주세요.</NoticeLine>
          <NoticeLine>선택 동의 철회와 탈퇴 신청은 설정에서 계속하실 수 있습니다.</NoticeLine>
        </>
      }
      actions={<PrimaryButton label="설정" onPress={() => router.push('/me/settings' as never)} />}
    />
  );
}
