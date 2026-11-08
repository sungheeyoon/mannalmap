import type { ReactNode } from 'react';

import { RELATIONS, RELATION_LABEL, RELATION_NONE_LABEL, RELATION_QUESTION, RELATION_WHY, type Relation } from '@/src/lib/people';

import { Icon } from './ui/icons';
import { TYPE_NAME } from './ui/surfaces';

/**
 * **두 사람은 어떤 사이인가요** — 궁합을 읽기 **전에** 묻는 자리(글자는 `src/lib/people` 의 `RELATION_*`, 앱과 같다).
 *
 * 묻는 까닭은 「무슨 사이인지에 따라 해석의 방향을 달리 잡아 드리겠다」는 것이다.
 * 그러니 읽고 난 뒤에 묻는 것은 아무 뜻이 없다 — 이미 나온 글은 그 답을 못 쓴다.
 *
 * **묻는 자리는 하나다** — 두 사람을 고르는 칸 아래(`compat-picker.tsx`). 결과 화면(`/me/compat`)은 다시 묻지
 * 않고 무엇으로 읽는지만 한 줄로 적는다(ADR 0054).
 *
 * 답은 글의 방향만이 아니라 **점수의 눈금도 고른다**(ADR 0113) — 연인 · 배우자는 연인용, 그 밖과 모름은 일반.
 * 그래서 안내가 「점수에는 쓰지 않습니다」를 더는 말하지 않는다(2026-09-26).
 *
 * **칩은 조용하다**(운영자 2026-09-29 — 「스타일 좀 죽이고」). 먹색 채움 · 굵은 15px · 44px 알약 다섯이 주 단추와 같은
 * 무게로 서서, 누를 것(「궁합 보기」)보다 고를 것이 먼저 보였다. 이제 칩은 보관함의 필터 칩과 같은 몸 — 14px 보통 굵기 ·
 * 흰 면 · 가는 테 · 보이는 높이 36px 이고, 고른 것은 옅은 크림 면 · 한 단계 짙은 테 · 먹색 글자에 **체크 표시**를 단다 — 색만으로
 * 「골랐다」를 말하지 않는다. 눌리는 자리는 그대로 44px 다(보이는 알약 밖의 투명한 위아래 4px).
 *
 * **칩은 같은 너비의 2열이고, 누를 것(`action`)은 그 아래 한 줄 전체 너비다**(운영자 확정 2026-11-08, 대장 all-11). 전에는
 * 단추가 칩 줄의 오른쪽 끝에 섰는데(2026-09-29), 칩이 줄을 바꾸는 폭마다 단추 자리가 달라졌다.
 *
 * **안 고르는 것도 답이다.** 필수로 두면 사람들은 아무거나 고르고, 그러면 틀린 값이
 * 「모른다」보다 나쁜 자리에 앉는다.
 */
export function RelationChoice({
  value,
  onChange,
  idPrefix,
  action,
}: {
  value: Relation | null;
  onChange: (next: Relation | null) => void;
  idPrefix: string;
  /** 칩 아래 한 줄 전체 너비의 단추 — 궁합 고르는 자리의 「궁합 보기」 */
  action?: ReactNode;
}) {
  return (
    <fieldset>
      {/* `float-left w-full` — 안 두면 legend 가 테두리 선을 끊고 그 위에 걸터앉는다 */}
      <legend className={`float-left w-full ${TYPE_NAME}`}>{RELATION_QUESTION}</legend>
      <p className="mt-1.5 text-small leading-5 text-secondary">{RELATION_WHY}</p>

      <div className="mt-2">
        <div className="grid grid-cols-2 gap-x-1.5 gap-y-1">
          {[...RELATIONS, null].map((choice) => {
            const id = `${idPrefix}-relation-${choice ?? 'unknown'}`;
            const label = choice === null ? RELATION_NONE_LABEL : RELATION_LABEL[choice];
            const picked = value === choice;

            return (
              <label
                key={id}
                htmlFor={id}
                className="group relative flex min-h-11 min-w-0 cursor-pointer items-center active:scale-[0.97]"
              >
                {/*
                  칸 전체를 덮는 라디오 — 보이지는 않지만 **이것이 눌린다.** `sr-only` 로
                  숨기면 글자만 누를 수 있는 칸이 되고, 라벨을 못 짚는 손에는 누를 것이
                  없는 칸이 된다(`birth-form.tsx` 와 같은 규율). 위아래로 1px 씩 넘친다 — 꼭 44px 이면 칸의 위치가 반 픽셀에
                  걸릴 때 눌리는 높이가 43.5 로 재였다(2026-10-09 #549, `e2e/target.ts`). 보이는 모양과 줄 높이는 그대로다. 칩이 두 줄로 접히면 그 1px 이 윗줄 · 아랫줄 칩을 덮으므로 줄 사이를 4px 띄운다(`gap-y-1`).
                */}
                <input
                  type="radio"
                  id={id}
                  name={`${idPrefix}-relation`}
                  checked={picked}
                  onChange={() => onChange(choice)}
                  className="peer absolute inset-x-0 -inset-y-px cursor-pointer appearance-none opacity-0"
                />
                <span
                  className={`flex min-h-9 w-full items-center justify-center gap-1 rounded-full px-3.5 text-note ring-1 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)] ${
                    picked
                      ? 'bg-accent-wash font-semibold text-foreground ring-border-strong'
                      : 'bg-surface font-medium text-secondary ring-border group-hover:text-foreground'
                  }`}
                >
                  {picked && <Icon name="check" className="size-3 stroke-[3.6]" />}
                  {label}
                </span>
              </label>
            );
          })}
        </div>
        {action !== undefined && <div className="mt-3 flex min-w-0 flex-col">{action}</div>}
      </div>
    </fieldset>
  );
}
