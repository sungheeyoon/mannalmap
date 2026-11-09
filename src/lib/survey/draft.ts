/**
 * **설문 초안 저장의 차례 — 웹(`app/me/survey/form.tsx`) · 앱(`mobile/src/settings/survey-screen.tsx`)이 같은 한 벌을 쓴다.**
 *
 * 손이 멈춘 뒤(`SURVEY_DRAFT_DELAY_MS`) 보낸다. 그것만으로는 구멍이 있었다(2026-11-09).
 *
 * - **멈춘 뒤 그 사이에 떠나면 마지막 고침이 안 갔다** — 화면을 닫을 때 타이머만 지웠다. 이제 화면이 닫히거나 숨을 때
 *   `flush()` 가 안 간 것을 곧바로 보내고, 서버가 마지막 값을 받았는지를 참거짓으로 돌려준다 — 거짓이면 화면이 떠나기를 멈추거나
 *   (앱) 값을 들고 있는다(웹, `keepUnsent` · `peekUnsent`).
 * - **제출과 초안이 엇갈려 닿을 수 있었다** — 초안 저장은 제출한 줄의 답도 덮는다(`save_service_survey`). 그래서 초안과 제출이
 *   **한 줄로 선다** — 앞의 쓰기가 끝나야 다음이 떠난다. 제출(`submit`)도 그 줄에 서고, 그 사이 떠나며 부른 `flush` 는 제출을 기다린다.
 * - **보낼지는 「서버가 끝내 가질 값」과 견준다** — 마지막으로 넣은 값이 아니라 떠나 있는 쓰기가 끝난 뒤의 값이다. A 가 서버에 있고
 *   B 가 떠나 있는 사이 A 로 되돌리면 A 도 B 뒤에 보내야 한다.
 *
 * 리액트를 모르는 상자라 vitest 가 잰다(`draft.test.ts`).
 */

/** 손이 멈춘 뒤 이만큼 기다려 보낸다 — 글자마다 보내면 저장이 타자를 따라다닌다 */
export const SURVEY_DRAFT_DELAY_MS = 1200;

export type DraftState = 'idle' | 'saving' | 'saved' | 'failed';

export type DraftSaver<T> = {
  /** 화면의 값이 바뀌었다 — 서버가 끝내 가질 값과 같으면 기다리던 것도 걷는다 */
  edit: (value: T) => void;
  /** 안 간 고침을 지금 보내고(못 넣은 것도 다시) 줄이 빌 때까지 기다린다 — 서버가 마지막 값을 가졌으면 참 */
  flush: () => Promise<boolean>;
  /** 제출 — 기다리던 초안을 걷고 줄 뒤에 선다. 답이 `ok` 면 그 값이 넣은 값이 된다 */
  submit: <R extends { ok: boolean }>(value: T, run: (value: T) => Promise<R>) => Promise<R>;
  /** 서버에 아직 안 간 고침이 있나 — 기다리는 중 · 보내는 중 · 못 넣은 것 */
  unsaved: () => boolean;
  /** 못 넣은 마지막 값과 그때 서버에 있던 값의 열쇠 — 화면이 사라진 뒤 되살릴 때(`keepUnsent`) */
  unsent: () => { base: string; value: T } | null;
};

/** 값의 열쇠 — 「같은 답인가」를 이것으로 가른다 */
export const draftKey = (value: unknown) => JSON.stringify(value);

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
  /** 서버가 받았다고 답한 마지막 값 */
  let saved = draftKey(initial);
  let latest: { value: T; key: string } = { value: initial, key: saved };
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** 앞의 쓰기 — 다음 쓰기는 이것이 끝난 뒤에 떠난다 */
  let line: Promise<void> = Promise.resolve();
  let flying = 0;
  /** 마지막으로 줄에 세운 값 — 떠나 있는 쓰기가 다 들면 서버가 가질 값 */
  let queued = saved;
  let state: DraftState = 'idle';

  /** 서버가 끝내 가질 값 — 떠나 있는 쓰기가 있으면 그 마지막 것 */
  const aimed = () => (flying > 0 ? queued : saved);
  const unsaved = () => timer !== null || flying > 0 || latest.key !== saved;
  const tell = (next: DraftState = state) => {
    state = next;
    onState(state, unsaved());
  };

  const stop = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  /** 줄 뒤에 쓰기 하나를 세운다 — 넣었는지는 `run` 이 답한다 */
  const enqueue = <R>(value: T, run: () => Promise<R>, ok: (result: R) => boolean, after: (result: R | null) => void) => {
    const sent = draftKey(value);
    queued = sent;
    flying += 1;
    const done = line.then(async () => {
      let result: R | null = null;
      try {
        result = await run();
      } catch {
        result = null;
      }
      flying -= 1;
      if (result !== null && ok(result)) saved = sent;
      after(result);
      return result;
    });
    line = done.then(() => undefined);
    return done;
  };

  const send = () => {
    tell('saving');
    /* 떠나는 때의 값을 붙든다 — 줄을 기다리는 사이 화면이 또 고쳐도 이 쓰기는 세운 값을 보낸다 */
    const { value } = latest;
    return enqueue(
      value,
      () => save(value),
      (ok) => ok,
      (ok) => tell(flying > 0 ? 'saving' : ok ? 'saved' : 'failed'),
    );
  };

  return {
    edit(value) {
      latest = { value, key: draftKey(value) };
      stop();
      if (latest.key !== aimed()) {
        timer = setTimeout(() => {
          timer = null;
          void send();
        }, delay);
      }
      tell();
    },
    async flush() {
      stop();
      if (latest.key !== aimed()) void send();
      await line;
      return latest.key === saved;
    },
    async submit(value, run) {
      stop();
      latest = { value, key: draftKey(value) };
      const result = await enqueue(
        value,
        () => run(value),
        (answer) => answer.ok,
        (answer) => tell(answer?.ok ? 'idle' : flying > 0 ? 'saving' : state),
      );
      if (result === null) throw new Error('survey submit threw');
      return result;
    },
    unsaved,
    unsent: () => (latest.key === saved ? null : { base: saved, value: latest.value }),
  };
}

/**
 * **화면이 사라진 뒤 못 넣은 초안을 들고 있는 자리** — 웹의 앱 안 이동(Next 의 클라이언트 이동)은 막을 공식 길이 없다(ADR 0166).
 * 떠나며 보낸 마지막 저장이 실패하면 그 값을 이 탭의 메모리에 두고, 다시 설문을 열 때 서버 값이 그때와 같으면 되살려 다시 보낸다.
 * 기기 저장소(`localStorage` 등)에는 안 쓴다 — 새로고침 · 탭 닫기에 사라지므로 그 둘은 웹이 브라우저 창으로 묻는다.
 * 주인(로그인 id)마다 하나 — 같은 탭에서 다른 계정으로 들어와도 남의 답이 서지 않는다.
 */
const unsentByOwner = new Map<string, { base: string; value: unknown }>();

export function keepUnsent(owner: string, unsent: { base: string; value: unknown }): void {
  unsentByOwner.set(owner, unsent);
}

/**
 * 들고 있던 것을 본다 — 서버 값이 그때와 달라졌으면 없는 것으로 본다(다른 곳에서 새로 저장했다). 지우지는 않는다 — 리액트의
 * 첫 상태 짓기는 두 번 불릴 수 있다. 화면이 받아 든 뒤 `dropUnsent` 로 지운다.
 */
export function peekUnsent<T>(owner: string, server: T): T | null {
  const kept = unsentByOwner.get(owner);
  if (kept === undefined || kept.base !== draftKey(server)) return null;
  return kept.value as T;
}

export function dropUnsent(owner: string): void {
  unsentByOwner.delete(owner);
}

/** 들고 있는 초안이 있나 — 웹은 있는 동안 탭 닫기 전에 묻는다 */
export const holdsUnsent = () => unsentByOwner.size > 0;
