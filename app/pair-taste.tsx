'use client';

import { useRef, useState } from 'react';

import { COMPAT_CREDIT_NOTE, COMPAT_SIGN_IN_ACTION } from '@/src/lib/brand/guide';
import { RESUME_PAIR_PATH } from '@/src/lib/consent';
import { calculateChart } from '@/src/lib/input/chart';
import { DEFAULT_QUERY, mergeSearchParams, toSearchParams, type Query } from '@/src/lib/input/query';
import { birthSectionErrors, prefixed, sideOf, type BirthSection } from '@/src/lib/input/section-errors';
import { pairTasteOf, type PairTaste as Taste } from '@/src/lib/matching/pair-taste';

import { BirthFields } from './birth-form';
import { PAIR_DRAFT_KEY } from './reading-draft';
import { SignInCarrying } from './sign-in-carrying';
import { BUTTON_PRIMARY } from './ui/buttons';
import { elementScope } from './ui/element-tone';
import { useSectionErrors } from './ui/section-error';
import { Icon } from './ui/icons';
import { STEM_PICTURE, StemSymbol } from './ui/stem-symbol';
import { CARD, PAPER, PAPER_BOTTOM, TYPE_META } from './ui/surfaces';
import { STEM_INFO } from '@/src/lib/saju';

/**
 * 첫 화면의 **로그인 전 궁합 결과** — 로그인 없이 두 사람을 넣어 본다(흐름 시안 g, ADR 0131).
 *
 * `/compat` 은 로그인 관문 안이다(ADR 0128) — 두 사람을 정하는 순간 대상이 서버에 서기 때문이다. 그래서 로그인 전의
 * 궁합은 여기서 **브라우저 계산으로만** 선다: 두 사람의 일간 그림, 엔진이 낸 한 줄(`pairTasteOf`), 가린 점수, 궁합풀이가
 * 다루는 것. 아무것도 저장하지 않고 주소에도 안 싣는다.
 *
 * 「로그인하고 궁합풀이 받기」는 두 사람을 탭의 `sessionStorage` 에 두고 `/compat#resume-pair` 로 간다 — 궁합 화면의 두
 * 칸이 그 입력으로 채워진 채 선다(`app/hash-query.ts`). 출생 정보는 로그인 주소(`next`)에 안 실린다(ADR 0007).
 */
export function PairTaste() {
  const [forms, setForms] = useState<{ a: Query; b: Query }>({ a: DEFAULT_QUERY, b: DEFAULT_QUERY });
  const [shown, setShown] = useState<{ taste: Taste; names: { a: string; b: string }; draft: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /* 두 사람의 문단이 한 목록이다 — 누르면 「나」 · 「상대」의 걸린 문단이 다 함께 서고 맨 위로 데려간다(ADR 0252) */
  const sections = useSectionErrors([...prefixed('a', birthSectionErrors(forms.a)), ...prefixed('b', birthSectionErrors(forms.b))], formRef);

  const submit = () => {
    if (!sections.press()) return;
    const a = calculateChart(forms.a);
    const b = calculateChart(forms.b);
    // 문단 판정이 계산의 거절까지 든다(`birthSectionErrors`) — 여기 오면 둘 다 선다
    if (!a.ok || !b.ok) return;
    const names = { a: forms.a.name.trim(), b: forms.b.name.trim() };
    setShown({
      taste: pairTasteOf({ a: a.saju, b: b.saju }, names),
      names,
      draft: mergeSearchParams(toSearchParams(forms.a, 'a.'), toSearchParams(forms.b, 'b.')).toString(),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        // 첫 화면 종이의 아래 토막 — 입구 「궁합 보기」 곧장 아래에 「나」 · 「상대」 판 두 장이 선다(ADR 0132)
        className={`${PAPER_BOTTOM} flex flex-col gap-4`}
      >
        {(['a', 'b'] as const).map((side) => (
          <fieldset key={side} aria-label={side === 'a' ? '나' : '상대'} className="flex min-w-0 flex-col">
            {/* 구역 머리 — 판 위 작은 회색 글자. 판 안 이름표와 같은 선 · 같은 굵기다 */}
            <legend className="mb-2 px-4 text-small font-semibold text-secondary sm:px-6">{side === 'a' ? '나' : '상대'}</legend>
            <BirthFields
              value={forms[side]}
              onChange={(next) => setForms((current) => ({ ...current, [side]: next }))}
              surface="panel"
              errors={{
                shown: sideOf<BirthSection>(sections.shown, side),
                edit: (section) => sections.edit(`${side}.${section}`),
              }}
            />
          </fieldset>
        ))}
        <button type="submit" className={`${BUTTON_PRIMARY} mt-1 w-full`}>
          무료로 두 사람 궁합 보기
        </button>
      </form>

      {shown !== null && <PairTasteResult {...shown} />}
    </div>
  );
}

/** 궁합풀이가 다루는 것 — 소제목은 모델이 두 사람에 맞춰 정하므로(`needs-v1`) 절 이름 대신 프롬프트가 묻는 것을 적는다 */
const PAIR_COVERS: readonly string[] = [
  '서로에게 어떤 사람인가',
  '어디가 맞고 어디서 부딪히는가',
  '함께 지내면 되풀이될 장면',
  '오래 가려면 무엇이 필요한가',
  '지금이 이 관계에 어떤 시기인가',
];

function PairTasteResult({ taste, names, draft }: { taste: Taste; names: { a: string; b: string }; draft: string }) {
  return (
    <>
      <section aria-labelledby="pair-taste-heading" className={`${PAPER} flex flex-col items-center gap-3 text-center`}>
        <h2 id="pair-taste-heading" className={TYPE_META}>
          {names.a} × {names.b} · 두 사람의 궁합
        </h2>
        <div className="flex items-center justify-center gap-3">
          {(['a', 'b'] as const).map((side, index) => {
            const stem = taste.dayMasters[side];
            return (
              <span key={side} className="flex items-center gap-3">
                {index === 1 && <span aria-hidden className="text-muted">×</span>}
                <span className={`${elementScope(STEM_INFO[stem].element)} flex flex-col items-center gap-1`}>
                  <span className="grid size-16 place-items-center rounded-full bg-[var(--tile)]">
                    <StemSymbol stem={stem} className="size-10" />
                  </span>
                  <span className="text-small text-secondary">
                    {names[side]} · {STEM_PICTURE[stem]}
                  </span>
                </span>
              </span>
            );
          })}
        </div>
        <p className="max-w-md text-body leading-7 text-foreground">{taste.line}</p>
        <p className="flex items-center gap-2 text-small text-secondary">
          <span aria-hidden className="rounded-full bg-surface-sunken px-3 py-1 font-rounded text-xl text-muted blur-[4px]">
            00
          </span>
          <Icon name="lock" className="size-4" />
          점수는 궁합풀이에서 볼 수 있어요
        </p>
      </section>

      <section aria-labelledby="pair-outline-heading" className={CARD}>
        <h2 id="pair-outline-heading" className={TYPE_META}>
          궁합풀이에서 다루는 것
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {PAIR_COVERS.map((title, index) => (
            <li key={title} className="flex items-center gap-2 text-body font-semibold text-foreground">
              <span className="tabular-nums text-secondary">{index + 1}.</span>
              <span className="min-w-0 flex-1">{title}</span>
              <Icon name="lock" className="size-4 shrink-0 text-muted" />
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-col gap-2">
          <SignInCarrying draftKey={PAIR_DRAFT_KEY} draft={draft} next={RESUME_PAIR_PATH} className={`${BUTTON_PRIMARY} w-full`}>
            {COMPAT_SIGN_IN_ACTION}
          </SignInCarrying>
          {/* 둘째 문장은 앱 첫 화면의 「궁합 보기」 탭과 같은 상수다(ADR 0226) */}
          <p className="text-center text-xs leading-5 text-secondary">
            로그인하면 입력한 두 사람으로 이어서 볼 수 있어요. {COMPAT_CREDIT_NOTE}
          </p>
        </div>
      </section>
    </>
  );
}
