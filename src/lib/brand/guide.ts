import { SUPPORT_EMAIL } from '.';

/**
 * **안내 화면이 하는 말 — 웹과 앱이 같은 글자를 읽는다**(G-123). 서비스 소개 · 자주 묻는 질문 · 로그인의 긴 글이 여기 있고, 화면은
 * 그리기만 한다. 짧은 말은 화면에 서고 `scripts/mobile-info-copy.test.ts` 가 두 화면을 견준다.
 */

/**
 * **로그인 없이 되는 것** — 한 사실 한 표기(2026-10-09 화면 점검 A6). 첫 화면은 로그인 없이 한 사람의 사주와 두 사람의
 * 궁합 첫 신호(엔진 계산의 한 줄 · 가린 점수)를 연다. 궁합풀이 · 사주풀이 · 저장 · 인연은 로그인한 뒤다.
 *
 * 로그인 화면(`auth/page.tsx`)과 로그인 실패(`auth/denied/page.tsx`)가 출구 단추(`SIGNED_OUT_EXIT`) 위에 이 한 줄을 함께
 * 쓴다 — 전에는 한쪽이 「궁합 첫 신호는 지금」, 다른 쪽이 「궁합은 로그인한 뒤」라고 적어 같은 사실을 반대로 말했다.
 * 위 넷의 궁합 `note` 와 자주 묻는 질문(`help/page.tsx`)도 같은 갈래(첫 신호 = 로그인 없이, 궁합풀이 = 로그인 + 풀이권)다.
 */
export const SIGNED_OUT_REACH = '로그인 없이도 내 사주와 궁합 첫 신호는 볼 수 있어요.';

/** 로그인하지 않고 첫 화면으로 가는 출구의 이름 — 로그인 화면 · 로그인 실패가 같이 쓴다(`e2e/auth.spec.ts` 가 잰다) */
export const SIGNED_OUT_EXIT = '사주로 돌아가기';

/**
 * **이미 쓰는 사람의 로그인 줄**(ADR 0226) — 로그인 전 첫 화면의 주 단추 바로 아래, 물음 하나와 「로그인」 링크. 웹 `/` 와 앱 입구가
 * 같은 글자를 읽는다. 대장 first-04 「확인 전」(실사례: velog · TVING · 점신)
 */
export const MEMBER_SIGN_IN_ASK = '이미 계정이 있으신가요?';

/** 앱의 결과 화면에서 누른 일마다 다른 로그인 까닭 — 저장은 풀이권을 안 쓰니 풀이권을 말하지 않는다(ADR 0213 추기) */
export const CHART_SIGN_IN = {
  save: { title: '저장은 로그인하면 할 수 있어요', note: '로그인하면 이 입력으로 돌아와요.' },
  reading: { title: '사주풀이는 로그인하면 볼 수 있어요', note: '로그인하면 이 입력으로 돌아와요. 사주풀이는 저장한 뒤에 받을 수 있고, 풀이권 1장을 써요.' },
} as const;

/** 서비스 소개 머리의 두 문장 — 운영자가 고른 글자다(2026-10-09). 넓은 화면은 문장마다 줄을 나눈다 */
export const ABOUT_LEAD = [
  '내 사주를 읽고, 궁금한 사람과의 궁합을 살펴보세요.',
  '새로운 인연에게 궁합을 요청하고, 서로 동의하면 대화를 시작할 수 있어요.',
] as const;

/** 서비스 소개 「시작하는 차례」 */
export const ABOUT_STEPS: readonly { title: string; body: string }[] = [
  { title: '사주 보기', body: '첫 화면에서 생년월일시를 넣고 내 사주를 봐요.' },
  { title: '로그인 · 가입', body: '카카오 · 구글로 로그인하고, 닉네임으로 가입해요.' },
  { title: '내 사주 저장', body: '내 출생 정보를 저장하면 홈에 내 사주 카드가 서요.' },
  { title: '풀이 받기', body: '사주풀이 · 궁합 · 인연 중 마음 가는 것부터 시작해요.' },
];

/** 자주 묻는 질문 — 물음마다 `id` 를 들어 다른 화면이 바로 가리킬 수 있다(`/help#credits` 처럼). 묶음의 차례가 화면의 차례다 */
export const HELP_GROUPS: readonly {
  title: string;
  items: readonly { id: string; q: string; a: readonly string[]; link?: { href: string; label: string } }[];
}[] = [
  {
    title: '시작하기',
    items: [
      {
        id: 'without-sign-in',
        q: '로그인하지 않고 무엇을 볼 수 있나요?',
        a: [
          '첫 화면에서 한 사람의 사주(여덟 글자와 오행)와 두 사람의 궁합 첫 신호를 볼 수 있어요.',
          '사주풀이 · 궁합풀이 · 저장 · 인연은 로그인한 뒤에 이용할 수 있어요.',
        ],
        link: { href: '/about', label: '서비스 소개' },
      },
    ],
  },
  {
    title: '풀이권',
    items: [
      {
        id: 'credits',
        q: '풀이권은 무엇인가요?',
        a: [
          '사주풀이나 궁합풀이를 새로 받을 때 1장씩 써요. 누르기 전에 확인 창이 먼저 열려요.',
          '이미 받은 풀이를 다시 여는 것은 풀이권을 쓰지 않아요. 만드는 도중에 실패해도 쓰지 않은 것으로 남아요.',
          '남은 수는 화면 위의 풀이권 칸(표 그림)에서 볼 수 있어요.',
        ],
      },
      {
        id: 'credits-match',
        q: '상세 궁합에도 풀이권이 드나요?',
        a: [
          '대화는 풀이권을 쓰지 않아요. 상세 궁합을 청할 때 풀이권 1장이 예약되고, 상대가 72시간 안에 동의하면 그것으로 만들어져요. 취소하거나 답이 없으면 돌아와요.',
          '요청을 받은 쪽은 풀이권을 쓰지 않아요.',
        ],
      },
    ],
  },
  {
    title: '궁합',
    items: [
      {
        id: 'compat-without-saving',
        q: '궁합을 보려면 꼭 사람을 저장해야 하나요?',
        a: [
          '아니요. 궁합 화면에서 「직접 입력」을 고르면 저장하지 않고 볼 수 있어요.',
          '직접 입력한 사람은 저장한 사람에 추가되지 않아요.',
        ],
      },
    ],
  },
  {
    title: '공유와 인연',
    items: [
      {
        id: 'share',
        q: '사주풀이를 다른 사람에게 보낼 수 있나요?',
        a: [
          '다 만들어진 풀이의 「공유 링크 복사」를 누르면 로그인 없이 열리는 주소가 복사돼요.',
          '링크를 아는 사람은 누구나 이 풀이를 볼 수 있어요. 상세 궁합은 보낼 수 없어요.',
        ],
      },
      {
        id: 'matching-off',
        q: '인연 찾기에서 내 프로필을 숨기려면요?',
        a: ['설정의 「인연 찾기」에서 쉴 수 있어요. 쉬는 동안에는 다른 사람에게 소개되지 않아요.'],
        link: { href: '/me/settings', label: '설정' },
      },
    ],
  },
  {
    title: '계정',
    items: [
      {
        id: 'leave',
        q: '탈퇴는 어떻게 하나요?',
        a: ['설정 맨 아래 「탈퇴하기」를 누르면 신청하기 전에 자세한 내용을 먼저 보여 드려요.'],
        link: { href: '/me/settings', label: '설정' },
      },
      {
        id: 'contact',
        q: '더 묻고 싶은 것이 있어요.',
        a: [`궁금한 점은 ${SUPPORT_EMAIL}으로 보내 주세요.`],
      },
    ],
  },
];

/** 앱의 인연 입구 — 시작 전에 남은 단계를 미리 말한다(ADR 0213). 차례가 곧 걷는 차례이고, 끝낸 단계는 뺀다. 대장 public-03 · public-12 「확인 전」 */
export const MATCHING_START_HEAD = '인연을 시작하려면 이 단계가 필요해요';
export const MATCHING_START_LEAVE = '그만둬도 사주는 그대로 볼 수 있어요.';
export type MatchingStartStep = 'sign-in' | 'signup' | 'self';
const MATCHING_START_STEPS: readonly { key: MatchingStartStep; text: string }[] = [
  { key: 'sign-in', text: '카카오 · 구글 로그인' },
  { key: 'signup', text: '닉네임으로 가입' },
  { key: 'self', text: '내 사주 저장' },
];
export const matchingStartSteps = (done: readonly MatchingStartStep[]) => MATCHING_START_STEPS.filter((step) => !done.includes(step.key));

/**
 * 앱의 인연 소개(`mobile/src/app/matching-intro.tsx`) — 로그인 전에 인연이 어떻게 이어지는지 말한다. 서버를 안 부르고 실제 회원이 없다.
 * 예시 카드는 사람이 아니라 카드의 모양을 보이는 그림이다 — 사진 · 닉네임 · 활동 표시 · 요청 단추가 없다. 대장 matching 「확인 전」
 */
/** 앱에서 궁합으로 가려다 로그인에 선 사람의 제목(대장 public 17, 웹은 `app/auth/page.tsx` 의 글자) · 앱 입구의 궁합 입구 */
export const COMPAT_SIGN_IN_TITLE = '궁합풀이는 로그인하면 볼 수 있어요';
export const COMPAT_ENTRY = '궁합 보기';
/**
 * 로그인 전 궁합 결과의 로그인 단추와 풀이권 한 줄 — 웹 `app/pair-taste.tsx` 의 확정 글자(대장 06)이고, 로그인 전 궁합 결과가 없는 앱 첫 화면의
 * 「궁합 보기」 탭이 같은 글자를 쓴다(ADR 0226). 풀이권의 수는 적지 않는다 — 무료 몫이 바뀔 수 있다(#1012)
 */
export const COMPAT_SIGN_IN_ACTION = '로그인하고 궁합풀이 받기';
export const COMPAT_CREDIT_NOTE = '가입하면 풀이권으로 궁합풀이를 받을 수 있어요.';

export const MATCHING_INTRO_TITLE = '인연은 어떻게 찾나요?';
export const MATCHING_INTRO_EXAMPLE = {
  stamp: '예시',
  note: '실제 회원이 아니에요. 요청과 알림은 가지 않아요.',
  score: 80,
  verdict: '아주 좋은 궁합일 수 있어요.',
  supply: '이 사람이 채워 주는 기운',
} as const;
export const MATCHING_INTRO_AGE = '인연은 만 19세 이상만 이용할 수 있어요.';
export const MATCHING_INTRO_START = '인연 시작하기';

/**
 * 로그인 뒤에 실제로 있는 것 — 수 · 가격은 안 적는다(바뀔 수 있다).
 * `match` 줄은 인연의 입구다 — 인연이 닫힌 동안(ADR 0222)은 화면이 `matchEntriesStand` 로 걷는다. 없는 화면을 약속하지 않는다.
 */
export const SIGN_IN_UNLOCKS: readonly { icon: 'reading' | 'people' | 'taiji'; text: string; match?: true }[] = [
  { icon: 'reading', text: '내 사주를 읽고 쓴 사주풀이' },
  { icon: 'people', text: '가족 · 친구를 저장하고 그 사람의 풀이도' },
  { icon: 'taiji', text: '두 사람의 궁합풀이와 점수' },
  { icon: 'people', text: '사주로 어울리는 인연 만나기', match: true },
];
