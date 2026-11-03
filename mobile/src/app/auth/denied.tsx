import { router, useLocalSearchParams } from 'expo-router';

import { SIGNED_OUT_EXIT } from '@brand/guide';
import { isChartPath } from '@consent/app-destination';
import { safeReturnPath, withReturnPath } from '@consent/return-path';

import { arriveAt } from '@/auth/arrive';
import { SUPPORT_MAIL_LINE } from '@/info/copy';
import { goHome } from '@/info/go-home';
import { NoticeLine, NoticeScreen } from '@/ui/notice-screen';
import { PrimaryButton, SecondaryButton } from '@/ui/parts';

/** 로그인이 끝나지 못한 자리 — 웹의 `/auth/denied`. 왜인지 모른다고 말하는 것이 정직한 말의 전부다. 애플로 실패해도 오는 자리라 공급자 이름을 안 든다(ADR 0218). 「다시 로그인」은 가려던 곳을 그대로 들고 간다. 결과 화면에서 왔으면 나가는 길도 그 결과다 */
export default function DeniedScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const returnTo = safeReturnPath(next);
  return (
    <NoticeScreen
      title="로그인하지 못했어요"
      description={
        <>
          <NoticeLine>로그인을 마치지 못했어요. 중간에 취소했거나 연결이 끊겼을 수 있어요. 아래 「다시 로그인」을 눌러 주세요.</NoticeLine>
          <NoticeLine>{SUPPORT_MAIL_LINE}</NoticeLine>
        </>
      }
      actions={
        <>
          <PrimaryButton label="다시 로그인" onPress={() => router.replace(withReturnPath('/auth', next) as never)} />
          <SecondaryButton label={SIGNED_OUT_EXIT} onPress={() => (isChartPath(returnTo) ? arriveAt(returnTo) : void goHome())} />
        </>
      }
    />
  );
}
