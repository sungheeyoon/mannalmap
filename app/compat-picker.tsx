'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useId, useRef, useState, useTransition } from 'react';

import type { Relation } from '@/src/lib/people';
import { dropUnlisted, seatSectionErrors, type SeatSection } from '@/src/lib/people/pick';
import { prefixed, sideOf as sectionsOf } from '@/src/lib/input/section-errors';
import {
  DEFAULT_QUERY,
  mergeSearchParams,
  PREFIX,
  queryFromSearchParams,
  toSearchParams,
  type Query,
} from '@/src/lib/input/query';
import type { CompatSide } from '@/src/lib/saju';

import { BirthFields } from './birth-form';
import { SIDE_LABEL, SIDE_PERSON, SIDES } from './compat-view';
import { useHashParams, writeParams } from './hash-query';
import { openPairScreen, pairRelationFor, type PairAnswers, type PairSide } from './me/compat/actions';
import { PersonCombobox, type Choosable } from './person-combobox';
import { RelationChoice } from './relation-choice';
import {
  SameChartAsk,
  settleSaveOutcome,
  type SaveOutcome,
  type SameChartQuestion,
} from './same-chart-ask';
import { actionAnswer } from './ui/action-answer';
import { BUTTON_PRIMARY, SEGMENT, SEGMENT_ON, SEGMENTS } from './ui/buttons';
import { Icon } from './ui/icons';
import { reducedMotion } from './ui/motion';
import { CARD_FRAME, TYPE_META, TYPE_NAME } from './ui/surfaces';
import { FailureLine } from './ui/failure-line';
import { SectionErrorLine, useSectionErrors } from './ui/section-error';

/**
 * 궁합의 **첫 걸음** — 두 사람을 정하고 사이를 답하는 자리.
 *
 * ## 탭 둘을 없앴다
 *
 * 「두 사람 직접 입력」과 「저장한 사람 선택」이 화면 둘로 갈려 있었다. 나뉜 것은 **사람이
 * 아니라 입력 방법**인데 화면이 갈리니, 「내 사주 × 방금 들은 그 사람의 생일」처럼 섞인
 * 조합은 갈 곳이 없었다. 한 화면으로 두고 **칸마다** 어디서 올지를 고른다.
 *
 * ## 여기서 사이를 묻는다
 *
 * 두 명식을 보고 나서가 아니라 **보기 전에** 묻는다(ADR 0019). 다음 화면은 이 답이
 * 정해진 채로 서고 거기서는 다시 안 묻는다 — 한 흐름에서 같은 것을 두 번 물으면
 * 사용자는 그것을 서로 다른 두 물음으로 읽는다.
 *
 * ## 누르면 두 사람이 굳는다
 *
 * 직접 적은 쪽은 이 누름에서 사람이 된다. **사람 목록에는 안 서고 열 자리도 안 쓴다**
 * (ADR 0053) — 다음 화면이 두 사람의 대상을 들고 있어야 거기서 풀이를 만들 수 있기
 * 때문이고, 사용자가 저장한 적 없는 것이 목록에 설 이유는 없기 때문이다.
 *
 * 글은 여기서 안 만든다. 이 누름이 여는 것은 두 명식이 나란히 선 화면이고, 풀이권을
 * 쓰는 누름은 거기 있다(ADR 0028).
 */
/** 한 칸이 들고 있는 것 — 고른 사람이거나 적어 넣은 입력이다 */
type Slot = { from: 'saved'; personId: string } | { from: 'typed'; query: Query };

/** 주소에 담긴 한 칸을 읽는다 — `a.person` 이 있으면 고른 사람이다 */
function slotFrom(params: URLSearchParams, side: CompatSide, people: Choosable[]): Slot | null {
  const chosen = params.get(`${PREFIX[side]}person`);
  if (chosen !== null && people.some((one) => one.personId === chosen)) {
    return { from: 'saved', personId: chosen };
  }

  const typed = queryFromSearchParams(params, PREFIX[side]);
  if (typed !== null) return { from: 'typed', query: typed };
  /* 사람 화면의 「직접 입력」(`#a.person=…&b.typed=1`, ADR 0249) — 그 칸을 빈 적는 칸으로 연다 */
  return params.has(`${PREFIX[side]}typed`) ? { from: 'typed', query: DEFAULT_QUERY } : null;
}

/**
 * 처음 서는 모양 — **고를 사람이 있으면 고르는 칸에서 시작한다.**
 *
 * 첫 칸은 자기 사주로 채운다. 궁합을 보러 오는 사람은 대개 자기와 누군가를 견주려는
 * 것이고, 아니면 한 번 바꾸면 된다. 고를 사람이 없으면 그 칸은 있어 봐야 빈 목록이라
 * 적는 칸으로 선다.
 */
const firstSlot = (people: Choosable[]): Slot => {
  const self = people.find((one) => one.isSelfPerson) ?? people[0];
  return self === undefined ? { from: 'typed', query: DEFAULT_QUERY } : { from: 'saved', personId: self.personId };
};

const secondSlot = (people: Choosable[]): Slot =>
  people.length >= 2 ? { from: 'saved', personId: '' } : { from: 'typed', query: DEFAULT_QUERY };

export function CompatPicker({ people }: { people: Choosable[] }) {
  const router = useRouter();
  const params = useHashParams();

  const [held, setSlots] = useState<Record<CompatSide, Slot>>(() => ({
    a: slotFrom(params, 'a', people) ?? firstSlot(people),
    b: slotFrom(params, 'b', people) ?? secondSlot(people),
  }));
  /* 목록이 다시 읽혀 고른 사람이 빠졌으면 그 칸은 빈 칸으로 읽는다 — 칸은 「골라 주세요」인데 누름이 빠진 번호로 나가지 않게 */
  const slots = dropUnlisted(held, people);

  /**
   * **주소가 바뀌면 칸도 따라간다.**
   *
   * 첫 렌더는 `#` 뒤를 못 읽는다 — 이 화면은 빌드 때 미리 그려지고 조각은 서버에 오지
   * 않으므로, 처음 서는 값은 「아무것도 없음」이고 주소는 그 뒤에 온다. 그래서 사람
   * 상세의 「이 사람과 궁합 보기」(`#a.person=…`)로 열면 채워진 채로 서야 할 칸이 비어
   * 있었다.
   *
   * **본 것과 다를 때만** 갈아 끼운다(`shown`). 매번 세우면 사용자가 방금 적은 것을
   * 주소가 덮는다 — 원국 화면이 같은 자리를 같은 방식으로 지킨다.
   */
  const shown = useRef(params.toString());
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const now = params.toString();
    if (now === shown.current) return;
    shown.current = now;
    const a = slotFrom(params, 'a', people);
    const b = slotFrom(params, 'b', people);
    setSlots({ a: a ?? firstSlot(people), b: b ?? secondSlot(people) });
    /*
      **주소가 칸을 채웠으면 그 칸을 화면에 들인다**(ADR 0129 「2026-09-29 e+」). 같은 화면 아래의 관계 지도 · 사람
      타일의 「나와 궁합」이 이 칸을 채우는데, 칸은 맨 위라 누른 자리에서는 안 보인다 — 채워진 것을 보여 주고 초점을
      구역 제목에 옮긴다. 주소의 `#` 뒤는 id 가 아니라 Next 가 스스로 스크롤하지 않는다.
    */
    if (a === null && b === null) return;
    const section = root.current?.closest('section') ?? root.current;
    section?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'instant' : 'smooth' });
    section?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, [params, people]);

  const [relation, setRelation] = useState<Relation | null>(null);
  /**
   * **이 누름이 사이를 건드리는가.**
   *
   * 칸은 늘 「관계 선택 안 함」에서 시작한다. 안 건드린 것을 답으로 보내면, 지난번에
   * 「가족」이라 답해 둔 두 사람을 다시 고르기만 해도 그 답이 지워진다.
   */
  const answered = useRef<string | null>(null);
  const [question, setQuestion] = useState<SameChartQuestion | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();
  const sameTwice =
    slots.a.from === 'saved' && slots.b.from === 'saved' && slots.a.personId !== '' && slots.a.personId === slots.b.personId;
  /**
   * **비어 있다는 말은 누른 뒤에만, 그 칸의 문단 아래에 선다**(ADR 0252 — 전에는 단추 아래 한 줄이었다). 막 연 화면이 「두 번째 사람을
   * 골라 주세요」로 서면 아직 아무것도 안 한 사람을 나무란다. 두 칸의 걸린 문단이 다 함께 서고, 같은 사람 둘은 둘째 칸의 고르는 칸 아래다.
   */
  const errors = SIDES.flatMap((side) =>
    prefixed(side, seatSectionErrors(slots[side], { people, who: SIDE_PERSON[side], sameAsOther: side === 'b' && sameTwice })),
  );
  const sections = useSectionErrors(errors, root);
  const chosen = errors.length === 0;

  /** 차례를 안 타는 쌍 이름 — 첫째·둘째를 바꿔 골라도 같은 쌍이다(DB 와 같은 규율) */
  const pairKey =
    slots.a.from === 'saved' && slots.b.from === 'saved' && chosen && !sameTwice
      ? [slots.a.personId, slots.b.personId].sort().join('|')
      : '';

  /**
   * **적어 둔 답을 칸에 세운다.** 화면이 저장 상태를 그대로 보여 주면 그 화면을 눌러도
   * 아무것도 안 지워진다. 직접 적은 칸이 끼면 그 사람이 아직 없으므로 읽을 답도 없다.
   */
  useStoredRelation(pairKey, answered, setRelation);

  const setSlot = (side: CompatSide, next: Slot) => {
    setFailure(null);
    /* 방식을 바꾸거나 사람을 고르면 그 칸의 고르는 칸 줄이 걷힌다 — 출생 정보 칸의 줄은 폼이 제 문단마다 걷는다 */
    if (next.from === 'saved' || slots[side].from !== next.from) sections.edit(`${side}.pick`);
    setSlots((now) => ({ ...dropUnlisted(now, people), [side]: next }));
  };

  const open = async (answers: PairAnswers): Promise<SaveOutcome> => {
    const opened = await actionAnswer(
      openPairScreen(
        sideOf(slots.a),
        sideOf(slots.b),
        answered.current === pairKey || pairKey === '' ? relation : undefined,
        answers,
      ),
      (message) => ({ ok: false, kind: 'failed', message }) as const,
    );

    if (opened.ok) {
      /* 뒤로 왔을 때 고른 것이 그대로 서 있게 — 주소가 이 화면의 상태다 */
      shown.current = paramsOf(slots);
      writeParams(shown.current, 'replace');
      router.push(`/me/compat?a=${opened.personA}&b=${opened.personB}`);
      return { done: true };
    }

    if (opened.kind === 'failed') {
      /*
        **한 사람의 입력이 거절됐으면 그 칸으로 데려간다.** 화면이 누르기 전에 거의 다 잡지만 서버만 아는 거절(주소로 들어온
        모르는 출생지 등)이 남는다 — 알림은 단추 아래 서고, 폰에서 그 칸은 한 화면 위다.
      */
      if (opened.side !== undefined) bringTo(opened.side);
      return { failed: opened.message };
    }

    return {
      ask: {
        label: opened.same.label,
        answer: (sameperson) =>
          open({ ...answers, [opened.side]: sameperson ? opened.same.personId : null }),
      },
    };
  };

  const settle = (outcome: SaveOutcome) => settleSaveOutcome(outcome, setFailure, setQuestion);

  /**
   * **서버만 아는 거절이면 그 칸으로 데려간다** — 화면이 누르기 전에 거의 다 잡지만(문단 오류, 위 `errors`) 주소로 들어온 모르는
   * 출생지 같은 것이 남는다. 알림은 단추 아래 서고, 폰에서 그 칸은 한 화면 위다.
   */
  const bringTo = (side: CompatSide) => {
    const card = root.current?.querySelector<HTMLElement>(`[data-side="${side}"]`);
    if (card == null) return;
    card.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'instant' : 'smooth' });
    card.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')?.focus({ preventScroll: true });
  };

  /** 단추는 잠긴 모양이어도 누름을 받는다(`aria-disabled`) — 걸린 문단이 있으면 그 아래에서 말하고 맨 위 붉은 칸으로 데려간다 */
  const press = () => {
    if (!sections.press()) return;
    setFailure(null);
    startOpening(async () => settle(await open({})));
  };

  return (
    <div ref={root} className={CARD_FRAME}>
      <h3 className={`px-5 pt-6 sm:px-6 ${TYPE_NAME}`}>누구와 누구를 볼까요?</h3>
      <div className="grid items-start sm:grid-cols-[1fr_auto_1fr]">
        {SIDES.map((side) => (
          <Fragment key={side}>
            {/*
              두 칸을 잇는 표시 — 가는 줄 한가운데의 태극(궁합 탭의 그 그림)이다. 전에는 글자 「×」 하나가 빈 자리에 떠 있어 닫기 · 지우기
              단추로 읽혔다(운영자 2026-11-12). 폰에서는 가로줄, 두 칸이 나란한 넓은 화면에서는 세로줄이다. 꾸밈이라 낭독기에 안 읽힌다.
              이름 사이의 「×」(결과 · 목록)는 그대로다.
            */}
            {side === 'b' && (
              <span
                aria-hidden="true"
                className="flex items-center gap-2 px-5 text-secondary before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border sm:flex-col sm:self-stretch sm:px-0 sm:py-6 sm:before:h-auto sm:before:w-px sm:after:h-auto sm:after:w-px"
              >
                <span className="grid size-7 place-items-center rounded-full bg-surface-soft">
                  <Icon name="taiji" className="size-4" />
                </span>
              </span>
            )}
            <SlotCard
              side={side}
              slot={slots[side]}
              people={people}
              /* 다른 칸에서 고른 사람은 여기서 뺀다 — 같은 사람 둘은 애초에 못 고른다 */
              taken={otherSaved(slots, side)}
              onChange={(next) => setSlot(side, next)}
              shown={sectionsOf<SeatSection>(sections.shown, side)}
              onEdit={(section) => sections.edit(`${side}.${section}`)}
            />
          </Fragment>
        ))}
      </div>

      {/*
        **「궁합 보기」는 사이를 묻는 칩 아래 한 줄 전체 너비다**(운영자 확정 2026-11-08, 대장 all-11 — 2026-09-29 의 「칩 줄 오른쪽
        끝」을 바꿨다). 같은 이름의 확인(`SameChartAsk`)이 서는 동안에는 단추가 비키고 확인이 칩 줄 아래, 이 띠
        안에 선다 — 실패 알림도 같은 자리다. 판 바로 아래(띠 밖)에 두면 제 테두리가 판의 테에 붙어 두 줄로 겹쳤다(2026-10-08).
      */}
      <div className="border-t border-border bg-surface-soft/60 p-5 sm:p-6">
        <RelationChoice
          value={relation}
          onChange={(next) => {
            answered.current = pairKey;
            setRelation(next);
          }}
          idPrefix="pair"
          action={
            question === null ? (
              <button
                type="button"
                onClick={press}
                disabled={opening}
                aria-disabled={!chosen || undefined}
                className={`${BUTTON_PRIMARY} w-full`}
              >
                <Icon name="taiji" className="size-[18px]" />
                {opening ? '여는 중…' : '궁합 보기'}
              </button>
            ) : undefined
          }
        />

        {question !== null && (
          <div className="mt-4">
            <SameChartAsk
              question={question}
              busy={opening}
              onAnswer={(sameperson) => {
                setFailure(null);
                startOpening(async () => settle(await question.answer(sameperson)));
              }}
            />
          </div>
        )}

        {failure !== null && (
          <FailureLine className="mt-4">{failure}</FailureLine>
        )}
      </div>
    </div>
  );
}

/**
 * 한 칸 — 저장한 사람 · 직접 입력을 먼저 고르고, 그 아래에서 사람을 고르거나 적는다.
 *
 * 두 갈래가 한 카드 안에 서는 것이 요점이다. 화면을 갈라 두면 「이 사람은 저장돼 있고
 * 저 사람은 아니다」가 갈 곳이 없어진다.
 */
function SlotCard({
  side,
  slot,
  people,
  taken,
  onChange,
  shown,
  onEdit,
}: {
  side: CompatSide;
  slot: Slot;
  people: Choosable[];
  taken: string | null;
  onChange: (next: Slot) => void;
  /** 누른 뒤 이 칸에서 걸린 문단의 줄(ADR 0252) */
  shown: Partial<Record<SeatSection, string>>;
  onEdit: (section: SeatSection) => void;
}) {
  const pickLine = useId();
  return (
    <fieldset
      data-side={side}
      /* 폰에서 두 칸 사이는 칸 안의 묶음 사이(`gap-3`)와 같다 — 12 + 동그라미 28 + 12. 넓은 화면은 나란히 서니 그대로다 */
      className={`flex min-w-0 flex-col gap-3 p-5 sm:p-6 ${side === 'a' ? 'pb-3' : 'pt-3'}`}
    >
      {/*
        **두 칸의 머리 표지**(B10) — 둘 다 직접 입력이면 같은 폼 두 벌이 위아래로 서서 어느 쪽을 적는지 칸만 보고는 몰랐다.
        결과 판이 쓰는 글자와 같은 상수다.
      */}
      <legend className="contents">
        <span className={`block ${TYPE_META}`}>{SIDE_PERSON[side]}</span>
      </legend>

      {/* 방식 단추가 먼저 서고 그 아래에 사람 목록이나 입력칸이 선다 — 두 방식의 차례가 같다(운영자 확정 2026-11-08, 대장 all-11) */}
      <div className={`${SEGMENTS} grid-cols-2`}>
        {(
          [
            ['saved', '저장한 사람'],
            ['typed', '직접 입력'],
          ] as const
        ).map(([from, label]) => (
          <button
            key={from}
            type="button"
            aria-pressed={slot.from === from}
            disabled={from === 'saved' && people.length === 0}
            /*
              **누르는 동안 이름 칸이 초점을 잃지 않게**(목록의 옵션과 같은 까닭). 이 단추가 펼친 목록 아래에 서던 때(#543)
              누르는 순간 칸이 초점을 잃으면 목록이 닫히며 단추가 위로 올라가 누름이 사라졌다(2026-10-09 운영자 재현). 지금은
              단추가 위라 그 일은 없지만 초점을 뺏지 않는 편이 펼친 목록을 덜 흔든다. 초점은 누른 뒤 이 단추에 준다 — 직접 입력으로
              바뀌면 이름 칸이 사라져 초점이 갈 곳을 잃는다.
            */
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.currentTarget.focus();
              onChange(from === 'saved' ? { from, personId: '' } : { from, query: DEFAULT_QUERY });
            }}
            className={slot.from === from ? SEGMENT_ON : SEGMENT}
          >
            {label}
          </button>
        ))}
      </div>

      {slot.from === 'saved' && (
        <div className="min-w-0">
          {/* 찾아 고르는 칸 — 저장한 사람이 스물 · 백이어도 읽히게(ADR 0102) */}
          <PersonCombobox
            label={SIDE_LABEL[side]}
            hideLabel
            placeholder="상대를 골라 주세요"
            people={people}
            taken={taken}
            chosenId={slot.personId}
            onChoose={(personId) => onChange({ from: 'saved', personId })}
            invalid={shown.pick === undefined ? undefined : pickLine}
          />
          <SectionErrorLine id={pickLine} message={shown.pick} />
          {people.length === 0 && <span className={TYPE_META}>아직 저장한 사람이 없어요.</span>}
        </div>
      )}

      {slot.from === 'typed' && (
        <div className="min-w-0">
          <BirthFields
            value={slot.query}
            onChange={(next) => onChange({ from: 'typed', query: next })}
            namePlaceholder="이름"
            surface="flat"
            errors={{ shown, edit: onEdit }}
          />
        </div>
      )}
    </fieldset>
  );
}

/** 저장된 답을 칸에 세우는 일 — 렌더 밖에서 한 번만 */
function useStoredRelation(
  pairKey: string,
  answered: React.RefObject<string | null>,
  setRelation: (next: Relation | null) => void,
) {
  useEffect(() => {
    if (pairKey === '') return;

    let alive = true;
    const [first, second] = pairKey.split('|');
    void actionAnswer(pairRelationFor(first, second), () => ({ ok: false }) as const).then((stored) => {
      // 못 읽었으면 칸을 안 건드린다 — 「못 읽었다」를 「모른다」로 세우지 않는다.
      // 방금 사용자가 이 쌍에서 고른 것이 있으면 그것이 저장된 값보다 뒤의 답이다.
      if (!alive || !stored.ok || answered.current === pairKey) return;
      setRelation(stored.relation);
    });

    return () => {
      alive = false;
    };
  }, [pairKey, answered, setRelation]);
}

const otherSaved = (slots: Record<CompatSide, Slot>, side: CompatSide): string | null => {
  const other = slots[side === 'a' ? 'b' : 'a'];
  return other.from === 'saved' && other.personId !== '' ? other.personId : null;
};

const sideOf = (slot: Slot): PairSide =>
  slot.from === 'saved'
    ? { from: 'saved', personId: slot.personId }
    : { from: 'typed', query: slot.query };

/** 고른 것을 주소에 적는다 — 새로고침하거나 뒤로 와도 같은 자리에서 다시 시작한다 */
const paramsOf = (slots: Record<CompatSide, Slot>): string => {
  const each = SIDES.map((side) => {
    const slot = slots[side];
    if (slot.from === 'typed') return toSearchParams(slot.query, PREFIX[side]);

    const one = new URLSearchParams();
    one.set(`${PREFIX[side]}person`, slot.personId);
    return one;
  });

  return mergeSearchParams(...each).toString();
};
