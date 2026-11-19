/**
 * 서울의 벽시계 — UTC 에 아홉 시간을 더한 시각. 한국은 1988 년 뒤로 일광 절약 시간이 없어 이 더하기가 `Asia/Seoul` 과 같다
 * (옆 시험이 Intl 과 견준다). 이 값의 `getUTC*` 가 서울의 연 · 월 · 일이다.
 */
export const seoulWallClock = (at: Date): Date => new Date(at.getTime() + 9 * 60 * 60 * 1000);

/** 서울 날짜(`YYYY-MM-DD`) — 서버는 UTC 라 그냥 자르면 자정 앞뒤 아홉 시간이 전날로 간다 */
export const seoulDateOf = (at: Date): string => seoulWallClock(at).toISOString().slice(0, 10);

/**
 * 풀이 목록의 날짜 — 날짜만, 「2026년 9월 26일」 꼴이다. 웹의 보관함 · 운영 설문과 앱의 홈이 같은 표기를 쓴다(G-168).
 *
 * **한 사실에는 한 표기**(docs/context/copy.md). 「본 궁합」과 이 목록이 같은 날짜를 다르게 적으면
 * 사용자는 같은 글인지 확인하는 데 눈을 쓴다.
 *
 * **시간대는 한국이다.** 책장과 운영 설문 화면은 서버(UTC)가 그리므로, 적지 않으면 한국 시각 0~9시에 만든
 * 글이 전날 날짜로 섰다. 채팅 목록의 시각(`src/lib/chat` 의 `messageTimeLabel`)과 같은 규율이다.
 */
export const readingDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
