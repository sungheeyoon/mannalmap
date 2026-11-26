import type { Query } from '../input/query';
import { birthSectionErrors, prefixed, type BirthSection, type SectionError } from '../input/section-errors';

/**
 * 저장한 사람을 **이름으로 찾아 고르는** 판단 — 궁합의 두 칸과 사람 목록 위의 찾는 칸이 쓴다.
 *
 * ## 왜 `select` 가 아닌가
 *
 * 고르는 칸이 `select` 둘이던 동안 저장 한도 10 은 **목록이 읽히는 동안의 수**였다
 * (ADR 0032). 공개 출시에서 그 10 을 걷으므로(ADR 0102) 스물 · 백이 들어와도 읽히는
 * 칸이어야 한다 — 쳐서 좁히고 키보드로 오르내린다. 그 판단을 여기 두어 vitest 가 닿게
 * 하고, 화면(`app/person-combobox.tsx`)은 그리기만 한다.
 *
 * ## 무엇을 맞다고 보는가
 *
 * 이름의 어느 자리든 **이어진 글자**가 맞으면 선다. 띄어쓰기 · 영문 대소문자는 안 가른다.
 * 한글은 **초성만 쳐도** 맞는다(`ㅇㅁㄴ` → 어머니) — 휴대폰 자판에서 한 글자를 다 짓기
 * 전에도 좁혀지고, 치다 만 음절이 섞여도(`어ㅁ`) 같은 규칙으로 읽는다. 차례는 들어온
 * 그대로다 — 맞는 정도로 다시 세우면 칠 때마다 줄이 뛴다.
 */

type Pickable = { readonly personId: string; readonly label: string };

/** 한글 음절의 첫소리 열아홉 — 유니코드 음절 표의 차례 그대로 */
const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const SYLLABLE_FIRST = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
/** 첫소리 하나가 거느리는 음절 수 — 가운뎃소리 21 × 끝소리 28 */
const PER_CHOSEONG = 21 * 28;

const fold = (text: string): string => text.normalize('NFC').toLowerCase().replace(/\s+/g, '');

const choseongOf = (letter: string): string | null => {
  const code = letter.codePointAt(0) ?? 0;
  if (code < SYLLABLE_FIRST || code > SYLLABLE_LAST) return null;
  return CHOSEONG[Math.floor((code - SYLLABLE_FIRST) / PER_CHOSEONG)];
};

/** 친 글자 하나가 이름의 글자 하나에 맞는가 — 같은 글자이거나, 친 것이 그 음절의 첫소리다 */
const letterMatches = (typed: string, have: string): boolean =>
  typed === have || (CHOSEONG.includes(typed) && choseongOf(have) === typed);

export const matchesName = (label: string, typed: string): boolean => {
  const want = [...fold(typed)];
  if (want.length === 0) return true;

  const have = [...fold(label)];
  for (let start = 0; start + want.length <= have.length; start += 1) {
    if (want.every((letter, offset) => letterMatches(letter, have[start + offset]))) return true;
  }
  return false;
};

/** 칸에 설 사람 — 다른 칸에서 고른 사람(`taken`)은 빼고, 친 이름으로 좁힌다 */
export const pickable = <T extends Pickable>(
  people: readonly T[],
  typed: string,
  taken: string | null,
): T[] => people.filter((one) => one.personId !== taken && matchesName(one.label, typed));

export type Step = 'next' | 'previous' | 'first' | 'last';

/**
 * 키보드로 옮긴 뒤 설 자리. `-1` 은 아무 데도 안 선 것이다.
 *
 * 끝에서 한 번 더 누르면 반대 끝으로 돈다. 치는 동안 목록이 줄어 자리가 밖으로 밀려
 * 있으면 처음(아래로) · 끝(위로)부터 다시 센다.
 */
export const stepTo = (active: number, count: number, step: Step): number => {
  if (count === 0) return -1;
  const inside = active >= 0 && active < count;

  switch (step) {
    case 'first':
      return 0;
    case 'last':
      return count - 1;
    case 'next':
      return inside && active < count - 1 ? active + 1 : 0;
    case 'previous':
      return inside && active > 0 ? active - 1 : count - 1;
  }
};

/**
 * 사람 목록(`/me/people`) 위에 **찾는 칸이 서는 수** — 여섯부터다(ADR 0102, G-21).
 *
 * 2026-09-24 에 재 보니 카드 하나가 데스크톱 254px · 휴대폰 334px 이라 첫 화면에 온전히 서는
 * 카드는 수와 상관없이 **하나**였다. 끝의 사람까지 휴대폰에서 스물여섯이면 13화면, 백이면
 * 48화면을 내려야 닿았다. 다섯까지는 두세 화면이라 눈으로 찾고, 칸이 서면 그만큼 첫 카드가
 * 밀린다 — 그래서 궁합 칸이 한 번에 보이는 다섯 줄 반을 넘는 수에서 선다.
 */
export const FIND_FROM = 6;

export const findsInList = (count: number): boolean => count >= FIND_FROM;

/**
 * 찾는 칸이 결과를 말하는 모양 — 문구는 화면이 든다.
 *
 * 안 쳤으면 말하지 않는다(`idle`) — 치지도 않았는데 수를 말하면 화면낭독기가 목록을 열 때마다
 * 그 수를 읽는다. 쳤는데 없으면 없다고(`none`), 있으면 몇 명인지(`some`) 말한다.
 */
type FindStatus = { kind: 'idle' } | { kind: 'none' } | { kind: 'some'; count: number };

export const findStatus = (typed: string, shown: number): FindStatus => {
  if (typed.trim() === '') return { kind: 'idle' };
  return shown === 0 ? { kind: 'none' } : { kind: 'some', count: shown };
};

/** 고른 사람이 **지금 목록에 있나** — 빈 값(`''`)과 목록에서 빠진 사람(지웠거나 숨긴 사람)은 아니다 */
export const stillListed = (people: readonly Pickable[], personId: string): boolean =>
  personId !== '' && people.some((one) => one.personId === personId);

/** 궁합의 한 칸 — 저장한 사람을 고른 칸이거나 그 밖의 칸(직접 입력)이다. 칸의 나머지 모양은 화면이 든다 */
type Seat = { readonly from: 'saved'; readonly personId: string } | { readonly from: 'typed' };

/**
 * 목록에서 빠진 사람을 든 칸을 **비운다**(`personId: ''`) — 고른 뒤 그 사람을 지우고 돌아오면 칸은 「골라 주세요」인데 누름은
 * 지운 번호로 나가던 것(2026-11-08). 화면의 안내와 실제 검사가 같은 값을 보게 칸은 늘 이 값을 거쳐 읽는다. 바뀐 칸이 없으면
 * 받은 값을 그대로(같은 참조) 돌려준다.
 */
export function dropUnlisted<S extends Seat, K extends string>(
  slots: Readonly<Record<K, S>>,
  people: readonly Pickable[],
): Readonly<Record<K, S>> {
  let changed = false;
  const next = { ...slots } as Record<K, S>;
  for (const key of Object.keys(slots) as K[]) {
    const slot = slots[key];
    if (!('personId' in slot) || slot.personId === '' || stillListed(people, slot.personId)) continue;
    next[key] = { ...slot, personId: '' } as S;
    changed = true;
  }
  return changed ? next : slots;
}

/** 같은 사람을 두 칸에 다 골랐을 때 — 둘째 칸 아래에 선다(웹 · 앱 같은 글자) */
export const SAME_PERSON_TWICE = '같은 사람은 한 번만 고를 수 있어요. 서로 다른 두 사람을 골라 주세요.';

/** 궁합 한 칸의 문단 — 저장한 사람을 고르는 칸(`pick`)이거나 직접 적는 출생 정보의 문단이다 */
export type SeatSection = 'pick' | BirthSection;

/**
 * 궁합 한 칸의 **문단별 오류**(ADR 0252) — 저장한 사람 칸이면 고른 사람이 지금 목록에 있나 · 다른 칸과 같은 사람인가(`sameAsOther`,
 * 둘째 칸만 넘긴다), 직접 입력 칸이면 출생 정보의 문단(`birthSectionErrors`). 줄은 그 칸 안 문단 아래에 서므로 「첫 번째 사람의」를
 * 앞에 붙이지 않는다 — 고르는 칸의 말만 누구인지(`who`)를 든다(「두 번째 사람을 골라 주세요.」).
 */
export function seatSectionErrors(
  seat: { readonly from: 'saved'; readonly personId: string } | { readonly from: 'typed'; readonly query: Query },
  { people, who, sameAsOther = false }: { people: readonly Pickable[]; who: string; sameAsOther?: boolean },
): SectionError<SeatSection>[] {
  if (seat.from === 'typed') return birthSectionErrors(seat.query);
  if (!stillListed(people, seat.personId)) return [{ section: 'pick', message: `${who}을 골라 주세요.` }];
  return sameAsOther ? [{ section: 'pick', message: SAME_PERSON_TWICE }] : [];
}

/*
 * # 궁합 고르기 판의 판단(G-182)
 *
 * 웹 `app/compat-picker.tsx` 와 앱 `mobile/src/compat/picker.tsx` 가 같은 갈래(같은 사람 둘 · 걸린 문단 · 쌍 이름 · 사이를 보낼지 ·
 * 고르는 칸의 줄이 걷히는 때 · 연 뒤의 갈래)를 저마다 적던 것을 여기로 내렸다. 처음 서는 칸(`firstSlot` · `secondSlot`)은 웹은 주소의 `#`,
 * 앱은 경로 인자에서 읽어 두 벌로 둔다(G-172 기록). 그리기 · 스크롤 · 초점과 여는 부름은 화면이 한다.
 */

/** 판의 두 칸 — 이름은 `CompatSide` 와 같다(`src/lib/saju`) */
type PairSeatSide = 'a' | 'b';
const PAIR_SEAT_SIDES: readonly PairSeatSide[] = ['a', 'b'];

/** 판의 한 칸 — 고른 사람이거나 적어 넣은 입력이다. 여는 문의 `PairSide` 와 같은 모양이다 */
export type PairSeat = { readonly from: 'saved'; readonly personId: string } | { readonly from: 'typed'; readonly query: Query };
export type PairSeats = Readonly<Record<PairSeatSide, PairSeat>>;

/** 두 칸에 같은 사람을 골랐다 — 말은 둘째 칸의 고르는 칸 아래다 */
export const sameSeatTwice = ({ a, b }: PairSeats): boolean =>
  a.from === 'saved' && b.from === 'saved' && a.personId !== '' && a.personId === b.personId;

/**
 * 판의 **걸린 문단 전부**(ADR 0252) — 두 칸의 것이 다 함께 서고, 이름 앞에 칸(`a.` · `b.`)이 붙는다. 비어 있다는 말은 누른 뒤에만 선다.
 *
 * `typed` 는 직접 입력 칸이 제 폼에서 올린 오류다 — 앱의 칸은 시 · 분 숫자까지 알아 「25시」 같은 것도 잡는다. 없으면 입력에서 센다.
 */
export function pairSeatErrors(
  seats: PairSeats,
  {
    people,
    who,
    typed = {},
  }: {
    people: readonly Pickable[];
    who: Readonly<Record<PairSeatSide, string>>;
    typed?: Partial<Record<PairSeatSide, readonly SectionError<BirthSection>[]>>;
  },
): SectionError<`${PairSeatSide}.${SeatSection}`>[] {
  const twice = sameSeatTwice(seats);
  return PAIR_SEAT_SIDES.flatMap((side) => {
    const seat = seats[side];
    const fromForm = seat.from === 'typed' ? typed[side] : undefined;
    return prefixed(side, fromForm ?? seatSectionErrors(seat, { people, who: who[side], sameAsOther: side === 'b' && twice }));
  });
}

/**
 * 차례를 안 타는 **쌍 이름** — 첫째 · 둘째를 바꿔 골라도 같은 쌍이다(DB 와 같은 규율). 두 칸 다 고른 사람이고 걸린 문단이 없을 때만 있고,
 * 아니면 `''` 다 — 직접 적은 칸이 끼면 그 사람이 아직 없으므로 적어 둔 사이도 없다.
 */
export const pairKeyOf = (seats: PairSeats, chosen: boolean): string =>
  seats.a.from === 'saved' && seats.b.from === 'saved' && chosen && !sameSeatTwice(seats)
    ? [seats.a.personId, seats.b.personId].sort().join('|')
    : '';

/**
 * 여는 문에 보낼 사이 — **`undefined` 는 「안 건드렸다」다.** 칸은 늘 「관계 선택 안 함」에서 시작해서, 안 건드린 것을 답으로 보내면 지난번에
 * 「가족」이라 답해 둔 두 사람을 다시 고르기만 해도 그 답이 지워진다. `answered` 는 사용자가 사이를 고를 때의 쌍 이름이다.
 */
export const relationToSend = <R>(relation: R, answered: string | null, pairKey: string): R | undefined =>
  answered === pairKey || pairKey === '' ? relation : undefined;

/** 칸을 바꾸면 그 칸의 고르는 줄이 걷히는가 — 방식을 바꾸거나 사람을 골랐을 때. 출생 정보 칸의 줄은 폼이 제 문단마다 걷는다 */
export const seatChangeClearsPick = (before: PairSeat, next: PairSeat): boolean => next.from === 'saved' || before.from !== next.from;

/** 여는 문의 답 — 웹 · 앱의 문이 같은 모양을 낸다(거절된 칸 `side` 는 웹의 문만 안다) */
type PairOpenAnswer<S> =
  | { readonly ok: true; readonly personA: string; readonly personB: string }
  | { readonly ok: false; readonly kind: 'failed'; readonly message: string; readonly side?: PairSeatSide }
  | { readonly ok: false; readonly kind: 'same-chart'; readonly side: PairSeatSide; readonly same: S };

/** 「이미 저장된 그 사람인가요?」에 답한 쪽 — `null` 은 아직 안 물었거나 「아니다」다 */
type PairAnswered = { readonly a?: string | null; readonly b?: string | null };

/**
 * 연 뒤의 갈래 — 열렸으면 두 사람의 궁합 화면으로(`go`), 거절이면 그 말(`failed`, 한 사람의 입력이면 그 칸), 이미 저장된 사람과 같은
 * 입력이면 묻는다(`ask` — 답하면 `answer` 가 낸 답으로 다시 연다). 둘 다 이미 있을 수 있어 물음은 두 번 갈 수 있다.
 */
export type PairOpenNext =
  | { readonly kind: 'go'; readonly personA: string; readonly personB: string }
  | { readonly kind: 'failed'; readonly message: string; readonly side?: PairSeatSide }
  | { readonly kind: 'ask'; readonly label: string; readonly answer: (sameperson: boolean) => PairAnswered };

export function pairOpenNext<S extends { readonly label: string; readonly personId: string }>(
  opened: PairOpenAnswer<S>,
  answers: PairAnswered,
): PairOpenNext {
  if (opened.ok) return { kind: 'go', personA: opened.personA, personB: opened.personB };
  if (opened.kind === 'failed') return { kind: 'failed', message: opened.message, side: opened.side };
  const { side, same } = opened;
  return { kind: 'ask', label: same.label, answer: (sameperson) => ({ ...answers, [side]: sameperson ? same.personId : null }) };
}
