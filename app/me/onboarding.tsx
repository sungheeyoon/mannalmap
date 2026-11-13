'use client';

import { useRef, useState, useTransition } from 'react';

import { BirthFields } from '../birth-form';
import { BUTTON_PRIMARY } from '../ui/buttons';
import { ElementSymbol } from '../ui/element-symbol';
import { PAPER, TYPE_TITLE } from '../ui/surfaces';
import { ELEMENTS } from '@/src/lib/saju';
import { birthFieldErrors } from '@/src/lib/input/field-errors';
import { DEFAULT_QUERY, type Query } from '@/src/lib/input/query';
import { saveSelfPerson } from './actions';
import { actionAnswer } from '../ui/action-answer';
import { FailureLine } from '../ui/failure-line';
import { useFieldErrors } from '../ui/field-error';

/**
 * 자기 사주를 한 번 등록하는 화면.
 *
 * 익명 화면과 **같은 폼**을 쓴다(`BirthFields`). 저장하는 화면이라고 다른 폼을 두면
 * 한쪽만 고쳐져서 「같은 값을 넣었는데 다른 사주가 나오는」 상태가 생긴다.
 *
 * 여기서는 계산해 보여주지 않는다. 저장하면 그 자리에서 저장된 것으로 다시 그리므로,
 * 미리 계산해 보여주면 **저장된 것이 아닌 사주**를 저장된 것처럼 보여주게 된다.
 *
 * 홈에서 할 일이 이것 하나인 때라 크림 종이 판 하나에 주 단추 하나만 선다(부드러움 5차). 다섯 상징은
 * 장식이다 — 저장하면 그 자리에 내 일간의 색이 선다.
 */
export function Onboarding({ nickname }: { nickname: string }) {
  const [query, setQuery] = useState<Query>({ ...DEFAULT_QUERY, name: nickname });
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  /* 단추를 잠그지 않는다 — 누르면 고칠 칸이 붉고 그 칸 아래에서 말한다(ADR 0252). 이름은 닉네임이라 안 묻는다 */
  const root = useRef<HTMLElement>(null);
  const checks = useFieldErrors(birthFieldErrors(query, { name: false }), root);

  const save = () => {
    if (!checks.press()) return;
    setFailure(null);
    startSaving(async () => {
      const result = await actionAnswer(saveSelfPerson(query));
      if (!result.ok) setFailure(result.message);
    });
  };

  return (
    /*
      **폰에서는 종이의 옆 여백을 12px 로 줄이고 글 · 단추만 제 자리(24px)에 둔다** — 폼의 흰 판이 첫 화면과 같은 폭으로 선다.
      종이 여백 24px 에 판 안쪽 16px 이 겹치면 320px 폭에서 숫자 칸의 자리표시(「1~12」)가 칸을 넘는다.
      넓은 화면에서 종이의 폭은 놓이는 기둥이 정한다(`COLUMN`, `(home)/page.tsx`).
    */
    <section ref={root} className={`${PAPER} flex w-full flex-col gap-6 max-sm:px-3`}>
      <span aria-hidden="true" className="flex gap-2 max-sm:px-3">
        {ELEMENTS.map((element) => (
          <ElementSymbol key={element} element={element} className="size-10 rounded-full bg-[var(--tile)] p-2 sm:size-12" />
        ))}
      </span>
      <header className="flex flex-col gap-2 max-sm:px-3">
        <h2 className={TYPE_TITLE}>내 사주 등록</h2>
        <p className="max-w-prose text-body leading-6 text-secondary">
          <strong className="font-semibold text-foreground">{nickname}</strong> 님의 출생 정보를 입력해 주세요.
        </p>
      </header>

      <BirthFields value={query} onChange={setQuery} showName={false} surface="panel" errors={checks.shown} />

      <div className="flex flex-wrap items-center gap-3 max-sm:px-3">
        <button type="button" onClick={save} disabled={saving} className={BUTTON_PRIMARY}>
          {saving ? '저장하는 중…' : '내 사주로 저장'}
        </button>
      </div>

      {failure !== null && <FailureLine className="max-sm:px-3">저장하지 못했어요. {failure}</FailureLine>}
    </section>
  );
}
