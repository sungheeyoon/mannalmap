'use client';

import { useEffect, useRef, useState } from 'react';

import { markNotificationsRead } from './actions';
import { announceNotificationsUnreadMoved } from './unread-signal';
import { actionAnswer } from '../../ui/action-answer';
import { FailureLine } from '../../ui/failure-line';

/**
 * 소식 화면에 실제로 들어오면 읽음으로 바꾼다.
 *
 * 서버에서 처리하면 `Link` 의 미리 가져오기만으로도 읽은 셈이 된다. 브라우저에 이
 * 화면이 마운트된 뒤에만 실행해, 내 사주의 버튼·상단 내비게이션·직접 주소 입력 중
 * 어느 길로 왔든 같은 사건으로 남긴다.
 */
export function ReadNotificationsOnVisit({ unread }: { unread: number }) {
  const started = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (unread === 0) {
      started.current = false;
      return;
    }
    // 개발 모드의 이중 effect 와 같은 화면의 재렌더가 RPC 를 거듭 부르지 않게 한다.
    if (started.current) return;
    started.current = true;

    void (async () => {
      const result = await actionAnswer(markNotificationsRead());
      if (result.ok) {
        // 머리글의 종은 주소가 안 바뀌면 다시 안 센다 — 읽은 것을 바로 알린다
        announceNotificationsUnreadMoved();
      } else setFailure(result.message);
    })();
  }, [unread]);

  if (failure === null) return null;
  return <FailureLine retry>소식을 읽은 것으로 표시하지 못했어요.</FailureLine>;
}
