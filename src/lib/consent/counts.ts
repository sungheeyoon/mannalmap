/**
 * 머리글 종의 딱지가 **무엇을 세는가** — 웹 머리글(`app/me/requests/unread.ts`) · 앱 머리(`mobile/src/home/counts.ts`) · 흐름 검사
 * (`scripts/check-match.mjs`)가 소식 목록 문의 줄을 그대로 넘기고 이 셈 하나를 부른다. 셈을 바꿀 자리는 여기 하나다.
 *
 * **안 읽은 소식을 다 센다** — 대화가 왔다는 소식(`request_received`)도 센다. 창 안의 새 요청은 앞 줄의 읽음이 풀려 딱지가
 * 오른다(ADR 0215). 받은 대화의 말은 채팅 탭의 수가 따로 센다 — 말 없이 열린 대화는 그 수에 안 서고 이 딱지에만 선다.
 */
export function bellCount(rows: readonly { read_at: string | null }[]): number {
  return rows.filter((row) => row.read_at === null).length;
}
