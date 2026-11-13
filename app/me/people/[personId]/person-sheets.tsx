'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactNode } from 'react';

import { RELATIONS, RELATION_LABEL, RELATION_NONE_LABEL, type Relation } from '@/src/lib/people';
import type { ReadingCredits } from '@/src/lib/reading/credits';
import { outOfCredits } from '@/src/lib/reading/panel-chrome';
import {
  COMPAT_ASK_CONFIRM,
  PARTNER_SELF_LABEL,
  PARTNER_TYPED_LABEL,
  READING_ASK_CONFIRM,
  READING_COST_LABEL,
  READING_INVITE_TOPICS,
  partnerAskTitle,
  readingAskTitle,
  readingCostLine,
  readingInviteTitle,
  relationAskTitle,
} from '@/src/lib/reading/person-screen';
import type { Element } from '@/src/lib/saju';

import { actionAnswer } from '../../../ui/action-answer';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_SECONDARY_SMALL } from '../../../ui/buttons';
import { elementScope } from '../../../ui/element-tone';
import { ElementSymbol } from '../../../ui/element-symbol';
import { FailureLine } from '../../../ui/failure-line';
import { Icon } from '../../../ui/icons';
import { closeSheet, DetailSheet, openSheet } from '../../../ui/sheet';
import { StemSymbol } from '../../../ui/stem-symbol';
import { openPairScreen, pairRelationFor } from '../../compat/actions';
import { useBuyCredits } from '../../credits/buy-credits';
import { generateReading } from '../../reading/actions';
import type { ReadingTarget } from '../../reading/target';

/*
  **저장한 사람 화면의 누름 둘 — 그 자리의 시트에서 끝난다**(운영자 승인 2026-11-13, ADR 0249). 「사주풀이 받기」는 같은 단추가 있는
  풀이 화면을 거치지 않고, 「궁합 보기」는 궁합 탭으로 넘어가 빈 폼을 채우게 하지 않는다. 판정은 지금 것 그대로다 — 풀이권 0개면
  확인 대신 풀이권 창(`outOfCredits` · `useBuyCredits`), 만들기는 같은 액션(`generateReading`), 두 사람 열기도 같은 액션(`openPairScreen`).
*/

type Answer = Awaited<ReturnType<typeof generateReading>>;
const unreachedStart = (message: string): Answer => ({ ok: false, message });

/** 확인 시트의 몸 — 「풀이권 1장을 사용해요. (남은 풀이권 N장)」 한 줄 · 실패 한 줄 · 단추 둘. 예약 줄 · 돌려준다는 줄은 두지 않는다(운영자 2026-11-13) */
function AskBody({
  credits,
  failure,
  busy,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  credits: ReadingCredits | null;
  failure: string | null;
  busy: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {children}
      <div className="flex flex-col gap-1">
        <p className="text-body font-semibold">{readingCostLine(credits?.available ?? null)}</p>
      </div>
      {failure !== null && <FailureLine>{failure}</FailureLine>}
      <div className="flex flex-col gap-2">
        <button type="button" className={BUTTON_PRIMARY} onClick={onConfirm} disabled={busy} aria-busy={busy}>
          {confirmLabel}
        </button>
        <button type="button" className={BUTTON_SECONDARY} onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}

/**
 * **아직 안 받았을 때의 사주풀이 칸** — 진한 카드 하나가 받으면 무엇을 알게 되는지 말하고, 그 단추가 확인 시트를 연다. [받기]는
 * 곧장 기다리는 화면(그 사람의 풀이 화면, 도는 시도를 보고 목차를 세운다)으로 간다.
 */
export function ReadingInvite({
  name,
  target,
  readingHref,
  credits,
}: {
  name: string;
  target: ReadingTarget;
  readingHref: string;
  credits: ReadingCredits | null;
}) {
  const router = useRouter();
  const sheet = useRef<HTMLDialogElement>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const buy = useBuyCredits();

  const press = () => {
    /* 풀이권이 0개면 확인 대신 풀이권 창이다 — 풀이 화면의 누름과 같은 판정(`panelChrome.buysCredits`) */
    if (outOfCredits(credits)) {
      buy.offer(credits?.available ?? 0);
      return;
    }
    setFailure(null);
    openSheet(sheet.current);
  };

  const confirm = () =>
    start(async () => {
      const answer = await actionAnswer(generateReading(target, crypto.randomUUID()), unreachedStart);
      if (answer.ok) {
        router.push(readingHref);
        return;
      }
      if ('outOfCredits' in answer) {
        closeSheet(sheet.current);
        buy.offer(0);
        return;
      }
      setFailure(answer.message);
    });

  return (
    <>
      <div className="relative flex flex-col gap-1.5 overflow-hidden rounded-card bg-accent p-5 text-on-accent">
        <Icon name="spark" className="pointer-events-none absolute -bottom-6 -right-4 size-28 opacity-15" />
        <p className="relative text-lead font-bold leading-snug">{readingInviteTitle(name)}</p>
        <p className="relative text-small text-on-accent/75">{READING_INVITE_TOPICS}</p>
        <div className="relative mt-3 flex items-center justify-between gap-3">
          <span className="text-fine text-on-accent/70">{READING_COST_LABEL}</span>
          <button type="button" onClick={press} disabled={buy.checking} className={BUTTON_SECONDARY_SMALL}>
            사주풀이 받기
          </button>
        </div>
      </div>
      <DetailSheet sheet={sheet} nickname={readingAskTitle(name)} label={readingAskTitle(name)}>
        <AskBody
          credits={credits}
          failure={failure}
          busy={busy}
          confirmLabel={READING_ASK_CONFIRM}
          onConfirm={confirm}
          onCancel={() => closeSheet(sheet.current)}
        />
      </DetailSheet>
      {buy.notice}
    </>
  );
}

/** 고를 수 있는 상대 — 궁합 화면의 고르는 칸과 같은 사람들(목록에 선 사람, 맨 위 「나」)이다 */
export type Partner = {
  readonly personId: string;
  readonly label: string;
  readonly isSelfPerson: boolean;
  readonly stem: string | null;
  readonly element: Element | null;
  /** 이 사람과 이미 본 궁합 — 있으면 고르는 즉시 그 궁합으로 간다(새로 받지 않는다 — 받으면 지금 글이 갈린다) */
  readonly seenHref: string | null;
};

function Face({ stem, element }: { stem: string | null; element: Element | null }) {
  return (
    <span aria-hidden="true" className={`${elementScope(element)} grid size-9 shrink-0 place-items-center rounded-full bg-[var(--tile)]`}>
      {stem !== null ? <StemSymbol stem={stem} className="size-6" /> : <ElementSymbol element={element} className="size-6" />}
    </span>
  );
}

const ROW = 'flex min-h-14 w-full items-center gap-3 rounded-cell px-2 text-left text-body font-semibold hover:bg-surface-sunken';

/**
 * **궁합 칸의 끝 줄 「+ 다른 사람과 궁합 보기」** — 시트 「누구를 볼까요?」(나 · 저장한 사람 · 직접 입력) → 시트 「어떤 사이예요?」 →
 * [궁합 보기] → 기다림 → 궁합 결과. 결과는 이 화면 위에 쌓이고 ← 가 이 사람 화면이다(`from=person`). 직접 입력은 궁합 화면의 직접
 * 입력 칸으로 간다 — 이 사람이 첫 칸에 앉은 채(`#a.person=…&b.typed`).
 */
export function CompatAdd({
  person,
  partners,
  credits,
  label,
}: {
  person: { personId: string; name: string };
  partners: readonly Partner[];
  credits: ReadingCredits | null;
  /** 줄 글자 — 궁합이 있으면 「다른 사람과 궁합 보기」, 없으면 「{이름}과 궁합 보기」 */
  label: string;
}) {
  const router = useRouter();
  const pickSheet = useRef<HTMLDialogElement>(null);
  const askSheet = useRef<HTMLDialogElement>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [relation, setRelation] = useState<Relation | null>(null);
  /** 사이를 건드렸나 — 안 건드린 「선택 안 함」을 답으로 보내면 적어 둔 답이 지워진다(`openPairScreen`) */
  const touched = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const buy = useBuyCredits();

  const choose = (next: Partner) => {
    if (next.seenHref !== null) {
      closeSheet(pickSheet.current);
      router.push(next.seenHref);
      return;
    }
    setPartner(next);
    setRelation(null);
    touched.current = false;
    setFailure(null);
    closeSheet(pickSheet.current);
    openSheet(askSheet.current);
    /* 적어 둔 사이를 칸에 세운다 — 못 읽었으면 칸을 안 건드린다(`pairRelationFor`) */
    void actionAnswer(pairRelationFor(person.personId, next.personId), () => ({ ok: false }) as const).then((stored) => {
      if (stored.ok && !touched.current) setRelation(stored.relation);
    });
  };

  const confirm = () => {
    if (partner === null) return;
    if (outOfCredits(credits)) {
      closeSheet(askSheet.current);
      buy.offer(credits?.available ?? 0);
      return;
    }
    start(async () => {
      const opened = await actionAnswer(
        openPairScreen({ from: 'saved', personId: person.personId }, { from: 'saved', personId: partner.personId }, touched.current ? relation : undefined),
        (message) => ({ ok: false, kind: 'failed', message }) as const,
      );
      if (!opened.ok) {
        setFailure(opened.kind === 'failed' ? opened.message : null);
        return;
      }
      const target = { kind: 'private', personA: opened.personA, personB: opened.personB } as const;
      const answer = await actionAnswer(generateReading(target, crypto.randomUUID()), unreachedStart);
      if (answer.ok) {
        router.push(`/me/compat?a=${opened.personA}&b=${opened.personB}&from=person&p=${person.personId}`);
        return;
      }
      if ('outOfCredits' in answer) {
        closeSheet(askSheet.current);
        buy.offer(0);
        return;
      }
      setFailure(answer.message);
    });
  };

  return (
    <>
      <button type="button" onClick={() => openSheet(pickSheet.current)} className={`${ROW} min-h-13 px-4 text-secondary`}>
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-border-strong text-secondary">
          <Icon name="plus" className="size-4" />
        </span>
        {label}
      </button>

      <DetailSheet sheet={pickSheet} nickname={partnerAskTitle(person.name)} label={partnerAskTitle(person.name)}>
        <ul className="-mx-2 flex flex-col">
          {partners.map((one) => (
            <li key={one.personId}>
              <button type="button" onClick={() => choose(one)} className={ROW}>
                <Face stem={one.stem} element={one.element} />
                <span className="min-w-0 flex-1 truncate">{one.isSelfPerson ? PARTNER_SELF_LABEL : one.label}</span>
                <Icon name="chevron" className="size-4 shrink-0 text-muted" />
              </button>
            </li>
          ))}
          <li>
            <Link href={`/compat#a.person=${person.personId}&b.typed=1`} className={ROW}>
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-sunken text-secondary">
                <Icon name="plus" className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate">{PARTNER_TYPED_LABEL}</span>
              <Icon name="chevron" className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        </ul>
      </DetailSheet>

      <DetailSheet
        sheet={askSheet}
        nickname={relationAskTitle(person.name, partner === null ? '' : partner.isSelfPerson ? PARTNER_SELF_LABEL : partner.label)}
        label={relationAskTitle(person.name, partner === null ? '' : partner.isSelfPerson ? PARTNER_SELF_LABEL : partner.label)}
      >
        <AskBody
          credits={credits}
          failure={failure}
          busy={busy}
          confirmLabel={COMPAT_ASK_CONFIRM}
          onConfirm={confirm}
          onCancel={() => closeSheet(askSheet.current)}
        >
          <div role="radiogroup" className="grid grid-cols-2 gap-1.5">
            {[...RELATIONS, null].map((choice) => {
              const picked = relation === choice;
              return (
                <button
                  key={choice ?? 'none'}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  onClick={() => {
                    touched.current = true;
                    setRelation(choice);
                  }}
                  className={`min-h-11 rounded-full border px-3.5 text-note ${
                    picked ? 'border-border-strong bg-accent-wash font-semibold text-foreground' : 'border-border bg-surface font-medium text-secondary'
                  }`}
                >
                  {choice === null ? RELATION_NONE_LABEL : RELATION_LABEL[choice]}
                </button>
              );
            })}
          </div>
        </AskBody>
      </DetailSheet>
      {buy.notice}
    </>
  );
}
