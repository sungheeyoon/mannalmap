/**
 * **설문 초안 저장의 차례 — 웹(`app/me/survey/form.tsx`) · 앱(`mobile/src/settings/survey-screen.tsx`)이 같은 한 벌을 쓴다.**
 *
 * 손이 멈춘 뒤(`SURVEY_DRAFT_DELAY_MS`) 보낸다. 그것만으로는 두 구멍이 있었다(2026-11-09).
 *
 * - **멈춘 뒤 그 사이에 떠나면 마지막 고침이 안 갔다** — 화면을 닫을 때 타이머만 지웠다. 이제 화면이 닫히거나 숨을 때
 *   `flush()` 가 기다리던 것을 곧바로 보낸다.
 * - **제출과 초안이 엇갈려 닿을 수 있었다** — 초안 저장은 제출한 줄의 답도 덮는다(`save_service_survey`). 제출 직전에 떠난
 *   초안이 제출보다 늦게 닿으면 제출한 답이 옛 답으로 돌아간다. 그래서 보내기는 **한 줄로 선다** — 앞의 저장이 끝나야 다음이
 *   떠난다 — 그리고 제출은 `beforeSubmit()` 으로 기다리던 초안을 걷고 떠난 것이 닿기를 기다린 뒤에 보낸다.
 *
 * 리액트를 모르는 상자라 vitest 가 잰다(`draft.test.ts`). 화면은 고칠 때마다 `edit`, 떠날 때 `flush`, 제출 앞뒤로
 * `beforeSubmit` · `markSaved` 를 부른다.
 */

/** 손이 멈춘 뒤 이만큼 기다려 보낸다 — 글자마다 보내면 저장이 타자를 따라다닌다 */
export const SURVEY_DRAFT_DELAY_MS = 1200;

export type DraftState = 'idle' | 'saving' | 'saved' | 'failed';

export type DraftSaver<T> = {
  /** 화면의 값이 바뀌었다 — 마지막으로 넣은 것과 같으면 기다리던 것도 걷는다 */
  edit: (value: T) => void;
  /** 안 간 고침을 지금 보낸다(못 넣은 것도 다시) — 화면이 닫히거나 숨을 때 */
  flush: () => Promise<void>;
  /** 제출 앞 — 기다리던 초안은 걷고(제출이 같은 값을 싣는다) 떠난 저장이 끝나기를 기다린다 */
  beforeSubmit: () => Promise<void>;
  /** 제출이 이 값을 넣었다 */
  markSaved: (value: T) => void;
  /** 서버에 아직 안 간 고침이 있나 — 기다리는 중 · 보내는 중 · 못 넣은 것 */
  unsaved: () => boolean;
};

export function draftSaver<T>({
  initial,
  save,
  onState,
  delay = SURVEY_DRAFT_DELAY_MS,
}: {
  /** 서버에 이미 있는 값 */
  initial: T;
  /** 초안 한 번 — 넣었으면 참. 던져도 실패로 센다 */
  save: (value: T) => Promise<boolean>;
  /** 저장 표지 · 「안 간 고침」이 바뀔 때마다 */
  onState: (state: DraftState, unsaved: boolean) => void;
  delay?: number;
}): DraftSaver<T> {
  const key = (value: T) => JSON.stringify(value);
  let saved = key(initial);
  let latest: { value: T; key: string } = { value: initial, key: saved };
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** 앞의 저장 — 다음 저장은 이것이 끝난 뒤에 떠난다 */
  let line: Promise<void> = Promise.resolve();
  let flying = 0;
  /** 마지막으로 떠나보낸 값 — 같은 것을 두 번 띄우지 않는다 */
  let sentKey: string | null = null;
  let state: DraftState = 'idle';

  const unsaved = () => timer !== null || flying > 0 || latest.key !== saved;
  const tell = (next: DraftState = state) => {
    state = next;
    onState(state, unsaved());
  };

  const stop = () => {
    if (timer === null) return false;
    clearTimeout(timer);
    timer = null;
    return true;
  };

  const send = () => {
    const { value, key: sent } = latest;
    sentKey = sent;
    flying += 1;
    tell('saving');
    line = line.then(async () => {
      const ok = await Promise.resolve()
        .then(() => save(value))
        .catch(() => false);
      flying -= 1;
      if (ok) saved = sent;
      /* 뒤에 더 떠난 것이 있으면 표지는 그것이 끝날 때 말한다 */
      tell(flying > 0 ? 'saving' : ok ? 'saved' : 'failed');
    });
    return line;
  };

  return {
    edit(value) {
      latest = { value, key: key(value) };
      stop();
      if (latest.key !== saved) {
        timer = setTimeout(() => {
          timer = null;
          void send();
        }, delay);
      }
      tell();
    },
    flush() {
      stop();
      /* 못 넣은 것도 한 번 더 — 같은 값이 이미 떠나 있으면 그것을 기다린다 */
      if (latest.key === saved || (flying > 0 && latest.key === sentKey)) return line;
      return send();
    },
    beforeSubmit() {
      stop();
      return line;
    },
    markSaved(value) {
      stop();
      saved = key(value);
      latest = { value, key: saved };
      tell('idle');
    },
    unsaved,
  };
}
