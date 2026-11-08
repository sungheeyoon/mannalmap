/**
 * **떠나려는 몸짓에 한 번 묻는가** — 고친 것이 있고 저장 중이 아닐 때만 묻는다. 바뀐 것이 없으면 묻지 않고 곧바로 나간다.
 * 저장 중에는 묻지 않는다 — 보낸 값은 이미 서버로 가는 중이고, 창이 저장 끝과 겹쳐 서면 무엇을 버리는지 흐려진다.
 * 무엇이 「고친 것」인지는 칸마다 저장 단추를 여는 판정 그대로다(`profileEdited` · `noteEdited`).
 */
export function asksBeforeLeaving({ edited, saving }: { edited: boolean; saving: boolean }): boolean {
  return edited && !saving;
}
