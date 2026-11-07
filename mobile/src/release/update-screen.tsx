import { NoticeLine, NoticeScreen } from '@/ui/notice-screen';
import { PrimaryButton, TextButton } from '@/ui/parts';

import { openPlayListing, openWebAccount, webAccountOpen } from './floor';

/** 업데이트 화면의 글자 — 대장 public-14(확정, 운영자 답 2026-11-07) · 웹 계정 관리 줄은 public-15(확인 전) */
export const UPDATE_REQUIRED = {
  title: '업데이트 알림',
  body: '안정적인 이용을 위해 최신 버전으로 업데이트한 뒤 이용해 주세요.',
  action: '업데이트하기',
  account: '웹에서 탈퇴 · 동의 철회하기',
} as const;

/**
 * **이 빌드가 받아 주는 가장 옛 빌드보다 낮으면 이 화면만 선다**(ADR 0237) — 닫기 · 나중에가 없고 단추는 Play 로 가는 하나다.
 * 한국 앱의 강제 업데이트 창(정육각 · SK엔카 — 단추 하나, 닫기 없음)과 같은 꼴을 앱의 안내 판(`NoticeScreen`)에 그린다. 아래의 작은 줄
 * 하나는 웹의 계정 관리로 간다 — 이 화면이 앱의 철회 · 탈퇴 신청을 가리기 때문이다(ADR 0234 의 「끝난 뒤에도 철회 · 삭제 요청」과 같은 결).
 */
export function UpdateRequiredScreen() {
  return (
    <NoticeScreen
      title={UPDATE_REQUIRED.title}
      description={<NoticeLine>{UPDATE_REQUIRED.body}</NoticeLine>}
      actions={<PrimaryButton label={UPDATE_REQUIRED.action} onPress={openPlayListing} />}
      note={webAccountOpen ? <TextButton label={UPDATE_REQUIRED.account} onPress={openWebAccount} /> : undefined}
    />
  );
}
