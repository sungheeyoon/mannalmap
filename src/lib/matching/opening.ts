/**
 * **인연이 열려 있는가 — 화면이 가는 길**(ADR 0222). 판정은 DB 가 한다(`match_is_open` · 문마다 `match_open_to`).
 * 여기는 닫힌 동안 어느 탭 · 주소를 걷을지만 고른다. 이 갈래가 통째로 틀려도 열리는 문은 없다.
 */

/** 닫힌 동안 들어오면 보내는 곳 — 홈이다. 사주가 운영의 첫 화면이다 */
export const MATCH_CLOSED_HOME = '/me';

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * 닫힌 동안 안 열리는 주소 — 카드 · 지난 인연 · 성인 확인 안내(`/me/matching/**`), 인연 궁합(`/me/match/*` · 보관함의 `/me/readings/match/*`),
 * 채팅(`/me/chat/**`), 옛 인연 찾기 설정(`/me/discovery`), 앱의 인연 소개(`/matching-intro`). 소식(`/me/requests`)은 풀이 · 풀이권 소식이 있어 남는다.
 */
const CLOSED_WHILE_SHUT = ['/me/matching', '/me/match', '/me/readings/match', '/me/chat', '/me/discovery', '/matching-intro'];
export const matchClosedGuards = (pathname: string): boolean => CLOSED_WHILE_SHUT.some((base) => within(pathname, base));

/**
 * 관문(웹 `proxy.ts`) · 앱 껍데기가 홈으로 돌릴 화면 요청인가 — 닫혔다고 **읽었을 때만** 돌린다. 못 읽었으면(`null`) 안 돌리고 문의 거절이 말한다
 * (성인 확인의 `adultCheckDetours` 와 같은 갈래).
 */
export const matchClosedDetours = (pathname: string, open: boolean | null): boolean => open === false && matchClosedGuards(pathname);

/**
 * 메뉴에 설 탭 — 닫혔거나 **아직 모르면**(`null`) 인연 · 채팅이 안 선다. 메뉴는 실패 때 닫힌다 — 못 읽은 한 번에 탭이 빠지는 것이,
 * 닫힌 동안 누르면 홈으로 돌아오는 탭을 세우는 것보다 낫다.
 */
export function tabsWhileShut<T extends { href: string }>(tabs: readonly T[], open: boolean | null): readonly T[] {
  return open === true ? tabs : tabs.filter((tab) => !matchClosedGuards(tab.href));
}

/**
 * 인연의 입구(설정의 소개받을 성별 · 새 메시지 알림 · 앱 첫 화면의 인연 소개 · 보관함의 「오늘의 인연」)를 세우는가 — 열렸다고 읽었을 때만.
 * 설정의 「인연 찾기 참여」 스위치는 입구가 아니라 참여를 끄는 약속의 자리라 닫혀도 선다(아래 `participationHelp`, 2026-11-08)
 */
export const matchEntriesStand = (open: boolean | null): boolean => open === true;

/**
 * 보관함의 「인연 궁합」 칩을 세우는가 — 열렸다고 읽었거나, 닫혀도 그 칸에 든 것(받은 인연 궁합 · 만드는 중인 인연 궁합)이 있을 때.
 * 닫힌 동안 빈 칸의 칩은 눌러도 빈 화면이라 안 세운다. 한 권이라도 있으면 제 글을 찾는 길이라 선다(웹 · 앱 보관함, 2026-11-08)
 */
export const matchShelfStands = (open: boolean | null, holdsAny: boolean): boolean => matchEntriesStand(open) || holdsAny;

/**
 * 홈의 「열리면 알려 주세요」 줄(ADR 0223)의 단추 글자 — 앱의 단추가 프롭으로 받아 문구 파일(`copy.ts`)에 못 둔다(ADR 0159).
 * 신청 전 · 신청 뒤 · 저장하는 동안. 제목과 설명 줄은 `copy.ts` 의 `MATCH_OPEN_ALERT_*` 다(대장 home-11).
 */
export const MATCH_OPEN_ALERT_BUTTON = { on: '알림 받기', off: '알림 끄기', saving: '저장하는 중…' } as const;

/** 홈에 그 줄을 세우는가 — **닫혔다고 읽었을 때만**이다. 열렸거나 모르면 안 선다(열렸는데 「준비 중」을 세우지 않는다) */
export const matchOpenAlertStands = (open: boolean | null): boolean => open === false;

/**
 * 설정의 참여 스위치 — **닫힌 동안에도 선다**(운영자 결정 2026-11-08, G-153 의 6). 가입 고지와 처리방침이 「참여는 설정에서 언제든 끌 수
 * 있다」고 약속했고, 켜고 끄는 문(`set_discovery_participation`)은 닫혀 있어도 그대로 된다. 스위치는 실제 참여 상태를 그대로 보인다.
 * 이름 · 설명은 웹 `ParticipationToggle` · 앱 `ParticipationRow` 가 프롭으로 넘기는 글자라 `copy.ts` 에 못 둔다(ADR 0159). 대장 settings-20.
 */
export const PARTICIPATION_LABEL = '인연 찾기 참여';

/**
 * 스위치 아래 한 줄(운영자 결정 · 승인 2026-11-08). **「지금 소개되고 있다」고 단정하는 문장은 없다** — 공개는 인연이 열려 있고
 * 양쪽이 성인 확인을 지났을 때만이라(`match_open_to`) 내 쪽만 보고는 「될 수 있어요」까지다.
 */
export const PARTICIPATION_HELP = {
  closedOn: '인연 기능이 열리고 성인 확인을 마치면 다른 참여자에게 내 프로필이 소개될 수 있어요.',
  closedOff: '인연 기능이 열려도 참여하지 않아요. 설정에서 직접 켤 수 있어요.',
  openBeforeAdult: '성인 확인을 마치면 다른 참여자에게 내 프로필이 소개될 수 있어요.',
  openOn: '다른 참여자에게 내 프로필이 소개될 수 있어요.',
  openOff: '켜면 다른 참여자에게 내 프로필이 소개될 수 있어요.',
  openOffBeforeAdult: '켜고 성인 확인을 마치면 다른 참여자에게 내 프로필이 소개될 수 있어요.',
  /** 성인 확인 상태를 못 읽었을 때 — 인증을 말하지 않는다. 이미 확인한 사람이 다시 인증해야 한다고 읽지 않게(조율자 2026-11-08) */
  neutral: '인연 찾기 참여 설정이에요. 참여는 언제든 끌 수 있어요.',
} as const;

/**
 * 설명 줄을 고른다. `adultCleared` 는 성인 확인을 지났는가 — 스위치가 꺼져 있으면 확인이 필요 없으니 참이다(`adultCheckCleared`).
 *
 * - 열렸는지 못 읽었으면(`open === null`) 줄을 안 세운다 — 준비 중인지 열렸는지 어느 쪽도 단정할 수 없다. 스위치만 선다.
 * - 닫힌 동안은 성인 확인 상태와 무관하게 준비 중 두 줄이다.
 * - 열렸는데 성인 확인 상태를 못 읽었으면(`adultCleared === null`) **중립 줄** — 「성인 확인을 마치면 …」은 이미 확인한 사람에게 다시
 *   인증하라는 말로 읽히고, 「참여 중」 줄은 확인 전인 사람에게 공개를 단정한다.
 */
export function participationHelp(open: boolean | null, on: boolean, adultCleared: boolean | null): string | undefined {
  if (open === null) return undefined;
  if (!open) return on ? PARTICIPATION_HELP.closedOn : PARTICIPATION_HELP.closedOff;
  if (adultCleared === null) return PARTICIPATION_HELP.neutral;
  if (on) return adultCleared ? PARTICIPATION_HELP.openOn : PARTICIPATION_HELP.openBeforeAdult;
  return adultCleared ? PARTICIPATION_HELP.openOff : PARTICIPATION_HELP.openOffBeforeAdult;
}
