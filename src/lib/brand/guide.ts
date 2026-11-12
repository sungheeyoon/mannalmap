import { SERVICE_NAME, SUPPORT_EMAIL } from '.';

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

/**
 * **「무료로 풀이 받기」를 누른 사람이 다음에 읽는 한 줄** — 운영자가 준 글자다(2026-11-12, 대장 first-07). 한 자도 바꾸지 않는다.
 * 앱 로그인 화면의 풀이 까닭(`CHART_SIGN_IN.reading.note`)과 웹 잠긴 목차의 주 단추 아래 줄(`CHART_READING_OFFER.outlineNote`)이 이 상수 하나를 읽는다.
 */
export const READING_SIGN_IN_NOTE = '입력한 정보는 로그인 후에도 유지돼요. 가입하면 받는 풀이권으로 전체 사주풀이를 볼 수 있어요.';

/**
 * 앱의 결과 화면에서 풀이를 누르고 온 사람의 로그인 까닭(ADR 0213 추기). 저장의 까닭(`save`)은 로그인 전 카드의 「저장하기」와 함께 걷었다(운영자 정정 2026-11-12).
 * 풀이의 한 줄은 「무료로」를 누르고 온 사람이 읽는다 — 「풀이권 1장을 써요」가 아니라 가입하면 받는 풀이권으로 풀어 준다고 말한다(운영자 결정 2026-11-12, 대장 first-07)
 */
export const CHART_SIGN_IN = {
  reading: { title: '사주풀이는 로그인하면 볼 수 있어요', note: READING_SIGN_IN_NOTE },
} as const;

/**
 * **로그인 전 사주 결과의 풀이 카드** — 「결과 A안 — 무료를 앞에」(운영자 채택 2026-11-12, 대장 first-07 「확인 전」). 앱 결과 화면
 * (`mobile/src/reading/save-self.tsx`) · 웹의 같은 자리(`app/save-for-reading.tsx`) · 웹에서 로그인 안 한 사람이 실제로 보는 잠긴 목차
 * (`app/taste/taste.tsx` — 딱지 · 주 단추 · 아래 한 줄)가 같은 글자를 읽는다. 단추는 하나다 — 「저장하기」는 로그인 전 카드에 없다(운영자 정정 2026-11-12).
 *
 * - **「첫 풀이 무료」는 적어도 된다**(운영자 결정 2026-11-12) — 새 회원에게 풀이권 한 장을 주는 것이 사실이다(ADR 0227). 장수(「1장」)는 여전히 안 적는다.
 *   **무료 몫(`reading_credit_limit()`)을 바꾸는 날 이 문구도 같이 본다** — 몫이 0 이 되면 이 딱지와 단추의 「무료로」는 거짓이다.
 * - 체크 줄은 풀이의 절 이름 그대로다(`src/lib/reading/prompt-self.ts` 의 `title`, 스토어 설명 `docs/ops/play-listing.md` 와 같은 넷) — 절 이름을 바꾸면
 *   `scripts/mobile-entry-save-copy.test.ts` 가 붉다. 풀이에 없는 절을 약속하지 않는다.
 * - 제목은 화면에 선 글자 수를 말한다 — 시각을 모르면 시주가 없어 여섯 글자다.
 * - 로그인 줄의 차례는 「카카오 · 구글」이다(`ABOUT_STEPS` 와 한 표기).
 */
export const CHART_READING_OFFER = {
  badge: '첫 풀이 무료',
  title: { eight: '이 여덟 글자, 글로 풀어 드릴게요', six: '이 여섯 글자, 글로 풀어 드릴게요' },
  points: ['성격과 속마음', '일과 돈, 연애와 인간관계', '앞으로의 흐름'],
  action: '로그인하고 무료로 풀이 받기',
  providers: '카카오 · 구글로 바로 시작해요',
  /** 웹 잠긴 목차(`app/taste/taste.tsx`)의 단추 아래 한 줄 — 앱 로그인 화면의 풀이 까닭과 같은 글자다(`READING_SIGN_IN_NOTE`) */
  outlineNote: READING_SIGN_IN_NOTE,
} as const;
export const chartReadingOfferTitle = (hourKnown: boolean) => (hourKnown ? CHART_READING_OFFER.title.eight : CHART_READING_OFFER.title.six);

/** 서비스 소개 머리의 두 문장 — 운영자가 고른 글자다(2026-10-09). 넓은 화면은 문장마다 줄을 나눈다 */
export const ABOUT_LEAD = [
  '내 사주를 읽고, 궁금한 사람과의 궁합을 살펴보세요.',
  '새로운 인연에게 궁합을 요청하고, 서로 동의하면 대화를 시작할 수 있어요.',
] as const;

/**
 * 인연이 닫힌 동안(ADR 0222) 서비스 소개(웹 · 앱)가 `ABOUT_LEAD[1]` 대신 세우는 둘째 문장(운영자 확정 2026-11-08, 대장 all-11).
 * 웹은 그리는 서버가(`app/signed-out-match-open.ts`), 앱은 화면이(`useMatchOpen`) 열림을 묻는다
 */
export const ABOUT_LEAD_WHILE_SHUT = '인연 기능은 준비 중이에요.';

/** 서비스 소개 「시작하는 차례」 — `whileShut` 은 인연이 닫힌 동안 웹 · 앱이 `body` 대신 세우는 글(운영자 확정 2026-11-08, 대장 all-11) */
export const ABOUT_STEPS: readonly { title: string; body: string; whileShut?: string }[] = [
  { title: '사주 보기', body: '첫 화면에서 생년월일시를 넣고 내 사주를 봐요.' },
  { title: '로그인 · 가입', body: '카카오 · 구글로 로그인하고, 닉네임으로 가입해요.' },
  { title: '내 사주 저장', body: '내 출생 정보를 저장하면 홈에 내 사주 카드가 서요.' },
  { title: '풀이 받기', body: '사주풀이 · 궁합 · 인연 중 마음 가는 것부터 시작해요.', whileShut: '사주풀이 · 궁합 중 마음 가는 것부터 시작해요.' },
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
        /*
          **Play 의 계정 삭제 웹 링크가 이 물음이다**(`docs/ops/play-listing.md` 「데이터 보안」). Google 은 그 쪽이 앱 이름 · 삭제를
          요청하는 걸음 · 지우는 것과 남는 것 · 그 기간을 들기를 요구한다 — 지우고 남기는 것과 기간은 처리방침 「언제까지 두나요」 ·
          「파기 절차와 방법」 · 「… 기록은 따로 둡니다」 셋(`src/lib/consent/notice.ts`)을 해요체로 줄였다. 처리방침이 바뀌면 여기도. 대장 public-16
        */
        a: [
          '설정 맨 아래 「탈퇴하기」를 누르면 신청하기 전에 자세한 내용을 먼저 보여 드려요.',
          `${SERVICE_NAME} 앱을 지웠어도 웹에서 같은 계정으로 로그인해 설정에서 신청할 수 있어요.`,
          '신청하면 3일 안에 계정과 저장된 정보(내 사주 · 저장한 사람 · 풀이 · 프로필 사진 등)를 지워요.',
          '결제 기록은 전자상거래법에 따라 결제일 또는 마지막 환불일부터 5년 동안 따로 보관해요.',
          '신고하거나 신고된 일이 있으면 그 신고 기록을 6개월, 이용이나 구매가 제한된 채 탈퇴하면 그 제한 기록을 1년 따로 보관해요.',
        ],
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
 * 「궁합 보기」 탭이 같은 글자를 쓴다(ADR 0226). 풀이권의 수는 적지 않는다 — 무료 몫이 바뀔 수 있다(#1012).
 * 「첫 풀이 무료」는 적어도 된다(운영자 결정 2026-11-12, `CHART_READING_OFFER`) — 장수는 그대로 안 적고, 무료 몫을 바꾸는 날 그 문구도 같이 본다
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
