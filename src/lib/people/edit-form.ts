import { samePillarInput } from '../input/edit';
import type { Query } from '../input/query';

import { NAME_ONLY_CHANGED, NOTHING_CHANGED, SAVE_CHANGES } from './words';

/**
 * **출생 정보 수정 폼의 판단**(G-182) — 웹 `app/me/edit-input.tsx` 와 앱 `mobile/src/people/edit-input.tsx` 가 같은 것을 부른다.
 * 두 화면이 같은 갈래(빈 칸 · 안 바뀜 · 이름만 · 여덟 글자)를 저마다 적던 것을 여기로 내렸다. 그리기와 확인 창 · 저장 부름은 화면이 한다.
 *
 * **단추를 잠그지 않는다**(ADR 0160 의 3) — 저장할 것이 없으면 누른 그때 곁의 말이 경고로 선다. 빈 칸 · 틀린 칸은 그 문단 아래에서
 * 말한다(ADR 0252) — 그 갈래는 문단 오류(`sections.press()`)가 먼저 거르고, 여기는 그 뒤를 정한다.
 */
export type EditInputView = {
  /** 문단 오류가 있다 */
  readonly missing: boolean;
  /** 여덟 글자를 가르는 값이 그대로다 */
  readonly pillarsSame: boolean;
  readonly nameChanged: boolean;
  /** 여덟 글자도 이름도 그대로다 */
  readonly unchanged: boolean;
  /** 저장할 것이 없다 — 빈 칸이 있거나 아무것도 안 바뀌었다. 단추는 가라앉되 누름을 받는다 */
  readonly blocked: boolean;
  /** 곁의 말 — 없으면 `null`. `warns` 면 경고 색으로 선다 */
  readonly note: { readonly text: string; readonly warns: boolean } | null;
  /** 저장 단추의 글자 — 「이름 저장」은 이름만 바뀐 때뿐이다 */
  readonly saveLabel: string;
};

export function editInputView(
  current: Query,
  query: Query,
  { editableName, missing, tried, saving }: { editableName: boolean; missing: boolean; tried: boolean; saving: boolean },
): EditInputView {
  const nameChanged = editableName && query.name.trim() !== current.name.trim();
  const pillarsSame = samePillarInput(current, query);
  const unchanged = pillarsSame && !nameChanged;
  const blocked = missing || unchanged;
  const warn = tried && blocked;
  const note =
    pillarsSame && (nameChanged || warn)
      ? { text: nameChanged ? NAME_ONLY_CHANGED : NOTHING_CHANGED, warns: warn && unchanged && !missing }
      : null;
  return {
    missing,
    pillarsSame,
    nameChanged,
    unchanged,
    blocked,
    note,
    saveLabel: saving ? '저장하는 중…' : pillarsSame && nameChanged ? '이름 저장' : SAVE_CHANGES,
  };
}

/**
 * 「저장」을 누른 뒤 — 문단 오류를 통과한 다음의 갈래.
 *
 * - `warn` — 바뀐 것이 없다. 곁의 말을 경고로 세운다
 * - `confirm` — 내 출생 정보의 여덟 글자가 바뀐다. 기다리던 인연 요청이 취소되므로 먼저 묻는다(ADR 0028)
 * - `save` — 바로 저장한다. 이름만 고치는 것은 요청을 안 건드려 묻지 않는다
 */
export type EditInputPress = 'warn' | 'confirm' | 'save';

export function editInputPress(view: EditInputView, confirmsRequests: boolean): EditInputPress {
  if (view.unchanged) return 'warn';
  return confirmsRequests && !view.pillarsSame ? 'confirm' : 'save';
}
