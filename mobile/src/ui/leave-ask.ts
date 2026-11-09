/**
 * **떠나려는 몸짓에 한 번 묻는가** — 고친 것이 있고 저장 중이 아닐 때만 묻는다. 바뀐 것이 없으면 묻지 않고 곧바로 나간다.
 * 저장 중에는 묻지 않는다 — 보낸 값은 이미 서버로 가는 중이고, 창이 저장 끝과 겹쳐 서면 무엇을 버리는지 흐려진다.
 * 무엇이 「고친 것」인지는 칸마다 저장 단추를 여는 판정 그대로다(`profileEdited` · `noteEdited`).
 */
export function asksBeforeLeaving({ edited, saving }: { edited: boolean; saving: boolean }): boolean {
  return edited && !saving;
}

/**
 * **떠나는 몸짓을 붙든 채 저장을 기다리는 끝** — 넘으면 못 넣은 것으로 보고 확인창을 세운다(서비스 설문, 2026-11-09). 응답이 끝내 안 오면
 * 뒤로가기가 영영 막혔다. 5초는 앱이 바깥 문(푸시 보내기)을 기다리는 끝(`APP_PUSH_SEND_TIMEOUT_MS`)과 같다. 늦게 닿는 요청은 그대로 두고
 * 기다리기만 그만둔다 — 순서는 보내는 쪽의 줄(`draftSaver`)이 지킨다.
 */
export const LEAVE_SETTLE_MS = 5_000;

/** `settle` 을 끝까지 기다리되 `ms` 를 넘거나 던지면 거짓 — 거짓이면 화면은 묻는다 */
export function settleWithin(settle: () => Promise<boolean>, ms: number = LEAVE_SETTLE_MS): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([settle().catch(() => false), late]).finally(() => clearTimeout(timer));
}
