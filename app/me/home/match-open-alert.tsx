'use client';

import { useState, useTransition } from 'react';

import { MATCH_OPEN_ALERT_ASK, MATCH_OPEN_ALERT_ASKED, MATCH_OPEN_ALERT_TITLE } from '@/src/lib/matching/copy';
import { MATCH_OPEN_ALERT_BUTTON } from '@/src/lib/matching/opening';

import { actionAnswer } from '../../ui/action-answer';
import { BUTTON_SECONDARY_SMALL } from '../../ui/buttons';
import { FailureLine } from '../../ui/failure-line';
import { Icon } from '../../ui/icons';
import { CARD_FRAME, TYPE_META } from '../../ui/surfaces';
import { setMatchOpenAlert } from './actions';
import { HOME_ROW_INNER } from './home-list';

/**
 * **인연이 닫힌 동안 홈의 한 줄 — 「열리면 알려 주세요」**(ADR 0223, G-135 의 수요 측정).
 *
 * 인연이 열려 있다는 인상을 주지 않는다 — 제목이 닫혀 있다는 사실(「준비 중」)이고, 누르면 신청 · 취소만 한다. 인연으로 가는 링크는 없다.
 * 무엇으로 알리는지(서비스 안의 소식)를 누르기 전에 말한다. 세울지는 홈이 정한다(닫혔다고 읽었고 신청 여부를 읽었을 때만).
 * 모양은 바로 위 「다른 사람 사주 보기」 줄과 같은 흰 판의 줄 하나다(`home-list.tsx`). 단추는 흰 작은 단추 하나다 — 홈의 먹색 주 단추는 카드의
 * 사주풀이 단추 하나뿐이다(`docs/product/prd/screens/home.md`).
 */
export function MatchOpenAlert({ asked: initial }: { asked: boolean }) {
  const [asked, setAsked] = useState(initial);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const flip = () => {
    const next = !asked;
    setFailure(null);
    startSaving(async () => {
      const result = await actionAnswer(setMatchOpenAlert(next));
      if (result.ok) setAsked(next);
      else setFailure(result.message);
    });
  };

  return (
    <div className={`${CARD_FRAME} shrink-0`}>
      <div className={HOME_ROW_INNER}>
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-sunken text-foreground">
          <Icon name="bell" className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body font-semibold">{MATCH_OPEN_ALERT_TITLE}</span>
          <span className={TYPE_META}>{asked ? MATCH_OPEN_ALERT_ASKED : MATCH_OPEN_ALERT_ASK}</span>
        </span>
        <button
          type="button"
          onClick={flip}
          disabled={saving}
          className={`${BUTTON_SECONDARY_SMALL} shrink-0`}
        >
          {saving ? MATCH_OPEN_ALERT_BUTTON.saving : asked ? MATCH_OPEN_ALERT_BUTTON.off : MATCH_OPEN_ALERT_BUTTON.on}
        </button>
      </div>
      {failure !== null && <FailureLine className="px-4 pb-3">{failure}</FailureLine>}
    </div>
  );
}
