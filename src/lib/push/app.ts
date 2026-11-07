/**
 * 앱 푸시(Android · FCM)의 정책 — **무엇을 싣고, 얼마나 살리고, 답을 어떻게 읽나** (ADR 0236, #936).
 *
 * 보내는 일(서비스 계정의 서명 · 요청)은 앱 층(`app/me/reading/ready-push.ts`)이 하고, 여기는 그 문이 묻는 값만
 * 낸다 — 이 층은 실행 환경을 모른다(`docs/architecture.md` 「층 넷」).
 *
 * ## 싣지 않는 것
 *
 * 알림에는 서비스명과 「풀이가 완성됐어요」 한 줄, 누르면 갈 앱 안의 주소뿐이다. **풀이의 글 · 점수 · 출생 정보 · 이름 · 닉네임은 없다** —
 * 잠금 화면에도, FCM 이 나르는 값에도. 주소에 든 것은 우리 DB 의 id(저장한 사람 · Match)뿐이다.
 */

/**
 * FCM 이 기기에 못 닿은 채로 들고 있을 시간 — **1시간**(웹 푸시의 `PUSH_TTL_SECONDS` 와 같은 값 · 같은 까닭, ADR 0156).
 * FCM 의 기본은 4주다 — 반나절 뒤에 켜진 전화에 선 「완성됐어요」는 이미 앱에서 본 소식일 가능성이 크다.
 */
export const APP_PUSH_TTL_SECONDS = 3600;

/** 송신 하나의 전체 시한(ms) — 넘으면 끊고 그 기기는 이번에 안 받는다. 저장은 이미 끝났다 */
export const APP_PUSH_SEND_TIMEOUT_MS = 5_000;

/** 풀이 하나에 보내는 기기의 상한 — DB 의 계정마다 상한(`app_push_token_limit()`)과 같다 */
export const APP_PUSH_DEVICE_LIMIT = 10;

/**
 * 안드로이드 알림 채널 — 앱이 만들고(`mobile/src/push/device.ts`) 보내는 쪽이 이름으로 가리킨다. 사람은 기기 설정에서 이 채널만 끌 수 있다.
 * 바꾸면 이미 설치된 앱의 채널과 어긋난다 — 새 채널은 새 이름이다.
 */
export const READING_READY_CHANNEL = 'reading-ready';

/** 알림의 본문 — 문구 대장 settings-16(확인 전). 제목은 서비스명이다 */
export const READING_READY_PUSH_BODY = '풀이가 완성됐어요';

/**
 * 앱 설정의 「풀이 완성 알림」 줄의 글자 — 문구 대장 settings-16(확인 전). 웹에는 이 줄이 없다(앱 푸시는 안드로이드만) — 웹 새 메시지 알림
 * 카드(대장 33, 확정)의 꼴을 풀이 완성에 맞췄다. 안드로이드 알림 채널의 이름도 줄 이름과 같다(한 사실 한 표기).
 */
export const READING_PUSH_COPY = {
  group: '알림',
  label: '풀이 완성 알림',
  offHelp: '켜면 풀이가 완성됐을 때 이 기기로 알림을 받아요.',
  onHelp: '이 기기의 알림이 켜져 있어요.',
  hiddenNote: '알림에는 풀이 내용과 이름을 표시하지 않아요.',
  blockedHelp: '이 기기에서 알림이 차단되어 있어요. 기기 설정에서 알림을 허용해 주세요.',
  openSettings: '기기 설정 열기',
  notAllowed: '알림 권한이 허용되지 않아 알림을 켜지 못했어요.',
  onFailed: '알림을 켜지 못했어요. 다시 시도해 주세요.',
  offFailed: '알림을 끄지 못했어요. 다시 시도해 주세요.',
} as const;

/** 앱이 누름에서 읽는 값 — 주소 하나뿐 */
export type AppPushData = { path: string };

/**
 * 앱 안의 주소인가 — `/me/` 로 시작하고 다른 출처 · 상위 경로로 못 나간다. 보내는 쪽과 누름을 받는 앱이 같은 판단을 쓴다.
 * 주소는 우리가 지었지만 FCM 을 지나 돌아오는 값이라 앱은 다시 본다.
 */
export function isAppPushPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.length <= 300 &&
    path.startsWith('/me/') &&
    !path.includes('//') &&
    !path.includes('..') &&
    !path.includes('\\') &&
    /^[A-Za-z0-9/_?=&.-]+$/.test(path)
  );
}

/**
 * FCM HTTP v1 의 `message` 하나 — **데이터 메시지**다.
 *
 * `notification` 칸 대신 `data` 의 `title` · `message` 를 싣는 것은 `expo-notifications` 의 안드로이드 수신기가 그 꼴을 받아 알림을
 * 세우고, 누름을 앱에 `content.data` 로 돌려주기 때문이다(https://docs.expo.dev/push-notifications/sending-notifications-custom/ ,
 * 2026-11-07 확인 — `data.body` 는 JSON 글자). `collapse_key` 가 같아 아직 안 간 「완성됐어요」 여럿은 하나로 접힌다.
 *
 * @throws {Error} 주소가 앱 안의 주소가 아닐 때 — DB 가 낸 값으로 지은 주소가 아니면 싣지 않는다.
 */
export function readingReadyMessage(token: string, title: string, path: string) {
  if (!isAppPushPath(path)) throw new Error(`앱 안의 주소가 아니다: ${path}`);
  const data: AppPushData = { path };
  return {
    token,
    data: {
      channelId: READING_READY_CHANNEL,
      title,
      message: READING_READY_PUSH_BODY,
      body: JSON.stringify(data),
    },
    android: {
      priority: 'HIGH' as const,
      ttl: `${APP_PUSH_TTL_SECONDS}s`,
      collapse_key: 'reading-ready',
    },
  };
}

/** 송신 하나의 말 — 보냈다 · 그 토큰은 등록이 없다(지운다) · 그 밖(이번엔 못 보냈다, 토큰은 둔다) */
export type AppPushResult = 'sent' | 'gone' | 'failed';

/**
 * FCM 의 답 → 말. **「등록 없음」만 토큰을 지운다** — 응답 본문의 `FcmError.errorCode` 가 `UNREGISTERED` 일 때다
 * (https://firebase.google.com/docs/reference/fcm/rest/v1/ErrorCode , 2026-11-07 확인). `INVALID_ARGUMENT` · `SENDER_ID_MISMATCH` ·
 * 401/403 은 대개 우리 쪽 설정(프로젝트 · 서비스 계정)이라 토큰을 지우지 않는다 — 설정 실수 하나가 모든 기기를 지우지 않게(ADR 0156 과 같은 결).
 */
export function appPushResultOf(status: number, body: unknown): AppPushResult {
  if (status >= 200 && status < 300) return 'sent';
  return fcmErrorCodesOf(body).includes('UNREGISTERED') ? 'gone' : 'failed';
}

function fcmErrorCodesOf(body: unknown): string[] {
  const details = (body as { error?: { details?: unknown } } | null)?.error?.details;
  if (!Array.isArray(details)) return [];
  return details.flatMap((one) => {
    const code = (one as { errorCode?: unknown } | null)?.errorCode;
    return typeof code === 'string' ? [code] : [];
  });
}

/** 서비스 계정에서 쓰는 셋 — 나머지 칸은 안 읽는다 */
export type FcmServiceAccount = { projectId: string; clientEmail: string; privateKey: string };

/**
 * 환경값(서비스 계정 JSON 한 덩어리)을 읽는다 — 비었거나 모양이 아니면 `null` 이고, 그때 앱 푸시는 **조용히 꺼진다**(보내지 않고 풀이는
 * 그대로). 값은 로그에 싣지 않는다.
 */
export function fcmServiceAccountOf(raw: string | undefined): FcmServiceAccount | null {
  if (raw === undefined || raw.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const one = parsed as { project_id?: unknown; client_email?: unknown; private_key?: unknown } | null;
  if (
    typeof one?.project_id !== 'string' ||
    !/^[a-z0-9-]+$/.test(one.project_id) ||
    typeof one.client_email !== 'string' ||
    one.client_email === '' ||
    typeof one.private_key !== 'string' ||
    !one.private_key.includes('PRIVATE KEY')
  ) {
    return null;
  }
  /* 환경값에 줄바꿈이 `\\n` 글자로 들어온 키도 받는다 — Play 결제 키(`play-api.ts`)와 같은 꼴 */
  return { projectId: one.project_id, clientEmail: one.client_email, privateKey: one.private_key.replace(/\\n/g, '\n') };
}
