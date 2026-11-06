import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BUTTON_PRIMARY } from '../ui/buttons';
import { NoticeScreen } from '../ui/notice-screen';
import { SUPPORT_EMAIL } from '@/src/lib/brand';
import { SERVICE_ENDED_ON, SERVICE_ENDED_TITLE, serviceEndedNote, serviceIsOver } from '@/src/lib/consent';

export const metadata = {
  title: SERVICE_ENDED_TITLE,
  description: '서비스가 언제 종료되었는지 알려 드립니다.',
};

/**
 * 끝났다고 말하는 자리 — **`/me` 밖에 선다.**
 *
 * `/signup` 이 밖에 선 것과 같은 까닭이다. 안에 두면 관문이 이 화면 자신도 막는다.
 * 그리고 관문이 `proxy.ts` 로 옮겨 가면서(레이아웃은 앱 안 이동에 안 돈다) **둘 다
 * 튕김이 됐다** — 하나만 「그리는 것」으로 남기면 그 하나는 앱 안에서 걸어 다니는
 * 사람에게 안 선다.
 *
 * ## 여기서도 한 번 묻는다
 *
 * 끝나지 않았는데 이 주소로 들어오면 돌려보낸다. 안 물으면 링크 하나로 「끝났습니다」를
 * 아무 때나 띄울 수 있고, 그것은 거짓말이다. **실제 서비스 종료 때만 선다** — 일정 줄의 종료일이 아니라
 * `SERVICE_ENDED_ON` 이 끝을 말한다(ADR 0225 추기 2026-11-06 · ADR 0234). 「비공개 테스트」 말은 지웠다.
 *
 * 계정 관리로 가는 길을 낸다. 끝난 뒤에도 자료가 남아 있는 동안 철회와 삭제 요청이 필요하다.
 */
export default function ClosedPage() {
  if (SERVICE_ENDED_ON === null || !serviceIsOver(new Date())) redirect('/me');

  /*
    인사하는 자리지만 다른 막힌 화면과 같은 안내 화면의 틀이다(2026-10-09 화면 점검 A5) — 앞서는 넓은 크림 판에 단추가
    없고 길이 글 안의 밑줄 링크뿐이었다. 글자는 그대로이고 그 두 길(계정 관리 · 처리방침)이 단추가 됐다. 2026-10-16 에 문의가 고객 문의 이메일을
    바로 들면서 처리방침 단추는 걷었다 — 그 길은 바닥글에 있다(대장 public-02). 종료와 파기의
    고지라 합니다체를 둔다(ADR 0135 — 이용 제한 · 삭제 · 보존의 고지).
  */
  return (
    <NoticeScreen
      title={SERVICE_ENDED_TITLE}
      description={
        <>
          <p>{serviceEndedNote(SERVICE_ENDED_ON)}</p>
          <p>함께해 주셔서 고맙습니다. 남은 문의는 {SUPPORT_EMAIL}으로 보내 주세요.</p>
          {/* 파기 전까지는 자료가 아직 남아 있다. 그동안 철회와 탈퇴 신청이 닿아야 한다 */}
          <p>선택 동의 철회와 탈퇴 신청은 설정에서 계속하실 수 있습니다.</p>
        </>
      }
      actions={
        <Link href="/me/settings" className={BUTTON_PRIMARY}>
          설정
        </Link>
      }
    />
  );
}
