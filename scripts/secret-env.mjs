/**
 * **비밀은 서버에만 있다** — 이름의 갈래와 빌드 산출물 검사 (G-23 ⑧).
 *
 * 2026-09-24 에 쟀다. 앱(`app/` · `src/` · `proxy.ts` · `next.config.ts`)이 `process.env` 로 읽는
 * 이름은 열둘이고, 그중 비밀은 셋(`SUPABASE_SECRET_KEY` · 로컬 갈래 `SUPABASE_SERVICE_ROLE_KEY` ·
 * `CRON_SECRET`)이며 둘은 SDK 가 제 안에서 읽는다(`OPENAI_API_KEY` · `OPENAI_WEBHOOK_SECRET`).
 * 운영(Vercel)에는 일곱 줄 — 비밀 넷과 공개 둘이 Production, `OPENAI_API_KEY` 하나가 Preview 에도 있다.
 * 그날 브라우저로 가는 파일(`static/**` 와 미리 그린 화면 `server/app/**` 의 html · rsc · body · meta)에
 * 비밀 이름도 가짜 값도 없었다 — 비밀을 읽는 모듈이 서버 층에만 있고, `NEXT_PUBLIC_` 이 아닌 이름은
 * Next 가 브라우저 쪽에 싣지 않기 때문이다.
 *
 * 그것이 우연히 참인 것이 아니라 **늘 참이게** 둘이 든다.
 *
 * - `secret-env.test.ts` — 앱이 읽는 이름은 전부 아래 갈래에 있고, 비밀은 `NEXT_PUBLIC_` 이 아니며,
 *   비밀을 읽는 모듈은 `import 'server-only'` 로 잠겨 있다. 새 비밀(무료 지급 HMAC · 스토어 결제 · 본인확인)이
 *   들어오면 이 목록에 먼저 서야 시험이 초록이다.
 * - 이 파일의 실행 — `npm run build` 끝에 돈다. 브라우저로 가는 파일에서 **비밀 이름**과, 그 빌드의
 *   환경에 있는 **비밀 값**을 찾는다. 값은 찍지 않고 이름과 파일만 말한다. Vercel 의 운영 빌드는
 *   진짜 값을 들고 돌므로 그 빌드에서 새면 배포가 선다. 값이 빌드 환경에 없으면 브라우저 파일에
 *   실릴 길도 없다 — 값이 실리는 것은 빌드 때 인라인뿐이다(`NEXT_PUBLIC_` · `next.config` 의 `env`).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 비밀 — 새면 교체한다. 절차는 `docs/ops/runbook/secret-leak.md` 「비밀이 새면」이 이름마다 든다.
 * Vault 에만 있는 비밀(`reading_recovery_secret` · `ops_alert_url` · `ops_alert_secret`)은 앱이 안 읽으므로
 * 여기 없고, 시험이 마이그레이션에서 이름을 모아 runbook 과 견준다.
 */
export const SECRET_ENV = [
  'SUPABASE_SECRET_KEY',
  /** 로컬 스택의 옛 이름 갈래(`keyed-client.ts`). 운영에는 없다 */
  'SUPABASE_SERVICE_ROLE_KEY',
  /** `@ai-sdk/openai` 와 `openai` 가 제 안에서 읽는다 — 앱 코드에 `process.env` 로는 안 나온다 */
  'OPENAI_API_KEY',
  /** `openai` 의 `webhooks.unwrap` 이 제 안에서 읽는다 */
  'OPENAI_WEBHOOK_SECRET',
  'CRON_SECRET',
  /** 접속기록 반출(S3) 의 IAM 키 둘 — 그 버킷에 `s3:PutObject` 만 할 수 있다 (G-23 ⑩, ADR 0105) */
  'AUDIT_EXPORT_ACCESS_KEY_ID',
  'AUDIT_EXPORT_SECRET_ACCESS_KEY',
  /** 사진 저장소(S3)의 IAM 키 둘 — 역할을 못 세운 날의 대안. 그 버킷의 `photos/*` 에 쓰기 · 읽기 · 지우기만 (G-120) */
  'PHOTO_STORE_ACCESS_KEY_ID',
  'PHOTO_STORE_SECRET_ACCESS_KEY',
  /**
   * Vercel 이 함수마다 주는 OIDC 토큰 — 반출이 AWS 역할을 받는 데 쓴다(`@vercel/oidc` 가 제 안에서 읽는다,
   * `20261014090000`). 짧게 살지만 그동안은 역할의 자격이다
   */
  'VERCEL_OIDC_TOKEN',
  /**
   * 로그인 전 사주 문단의 HMAC 비밀 둘(ADR 0143, `app/taste/taste-visitor.ts`) — 브라우저 묶음 쿠키의 안정 비밀과 IP 날짜별 키의
   * 뿌리. 없으면 그 문단이 닫힌다
   */
  'TASTE_BROWSER_SECRET',
  'TASTE_IP_SECRET',
  /**
   * 웹 푸시(ADR 0156) — VAPID 비밀 열쇠(공개 열쇠와 한 쌍)와, DB 가 배달 문을 깨울 때 싣는 비밀(Vault
   * `push_dispatch_secret` 과 같은 값). 앞의 것이 없으면 배달 줄은 「설정 안 됨」으로 남고, 뒤의 것이 없으면 배달 문이 닫힌다
   */
  'WEB_PUSH_VAPID_PRIVATE_KEY',
  'PUSH_DISPATCH_SECRET',
  /**
   * 애플 로그인 키(`.p8`, ADR 0219) — 탈퇴 때 애플 연결을 끊는 클라이언트 비밀을 서명한다(`app/api/mobile/me/apple-revoke/apple-tokens.ts`).
   * 없으면 끊기가 503 이고 탈퇴는 그대로 간다. 팀 ID · 키 ID 는 비밀이 아니다(아래 설정)
   */
  'APPLE_SIGN_IN_PRIVATE_KEY',
  /**
   * 카카오 REST API 키의 클라이언트 시크릿(ADR 0224) — 웹의 카카오 로그인이 인가 코드를 토큰으로 바꿀 때 싣는다(`app/auth/kakao/`).
   * 카카오 콘솔에서 시크릿을 켰을 때만 든다
   */
  'KAKAO_CLIENT_SECRET',
  /**
   * 카카오 앱 어드민 키(ADR 0224 「덧붙임 2026-11-05」) — 웹 탈퇴 뒤 그 사람의 카카오 연결을 회원번호로 끊는다(`app/auth/kakao/unlink.ts`).
   * 이 키 하나로 앱의 어느 회원이든 끊을 수 있다. 없으면 끊기가 기록 한 줄로 남고 탈퇴는 그대로 간다
   */
  'KAKAO_ADMIN_KEY',
  /**
   * Google Play 결제 검증용 서비스 계정 키(JSON 한 덩이, ADR 0230) — 구매 확인 · 소비 · 환불 · 무효 목록을 부른다
   * (`app/api/store/google-play/play-api.ts`). EAS 제출용 키와 따로다. 없으면 구매 문 · 통지 문이 503, 무효 대조 크론은 「설정 안 됨」.
   * **운영자가 Play 개발자 계정 뒤에 넣는다**
   */
  'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
  /**
   * 앱 푸시(FCM HTTP v1)용 Firebase 서비스 계정 키(JSON 한 덩이, ADR 0236) — 풀이 완성 알림을 보낸다(`app/me/reading/ready-push.ts`).
   * Play 결제 키와 따로다. 없으면 앱 푸시는 조용히 꺼지고 풀이는 그대로다. **운영자가 Firebase 프로젝트를 만든 뒤 넣는다**
   */
  'FCM_SERVICE_ACCOUNT_JSON',
];

/** 브라우저가 본다 — 빌드 때 번들에 박힌다. 비밀을 여기 두는 순간 공개된다 */
export const PUBLIC_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  /** 웹 푸시의 VAPID 공개 열쇠 — 브라우저가 구독을 맺을 때 든다(ADR 0156). 비밀 열쇠는 위 `WEB_PUSH_VAPID_PRIVATE_KEY` */
  'NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY',
];

/** 비밀도 공개 열쇠도 아닌 설정 — 주소 · 포트 · 단계 */
export const CONFIG_ENV = [
  'NODE_ENV',
  'NEXT_DIST_DIR',
  /** 개발 서버를 일부러 운영 Supabase 에 붙일 때만 `1` — 없으면 `next dev` 는 로컬 스택만 받는다(`remoteDevRefusal`) */
  'DEV_ALLOW_REMOTE',
  /** CI 러너가 주는 표시 — 개발 서버의 운영 거절은 CI 에서 안 본다(운영 접속값 파일이 없다) */
  'CI',
  'SITE_URL',
  'PORT',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  /** 접속기록 반출의 버킷 이름과 지역 — 비밀이 아니다. 넷 중 하나라도 없으면 반출은 「설정 안 됨」이다 */
  'AUDIT_EXPORT_BUCKET',
  'AUDIT_EXPORT_REGION',
  /** 반출이 받는 AWS 역할의 ARN — 비밀이 아니다. 믿는 쪽은 AWS 의 신뢰 정책이다(Vercel OIDC 의 이 프로젝트만) */
  'AUDIT_EXPORT_ROLE_ARN',
  /**
   * 사진 저장소의 버킷 · 지역 · 역할 ARN — 비밀이 아니다(G-120). 다섯(`PHOTO_STORE_*`)이 모두 비면 사진은 지금처럼 DB 에 산다
   * (`app/me/photo/store.ts`)
   */
  'PHOTO_STORE_BUCKET',
  'PHOTO_STORE_REGION',
  'PHOTO_STORE_ROLE_ARN',
  /** VAPID 의 주체(`mailto:` · `https:`) — 없으면 배포의 https 주소를 쓴다(`app/api/push/dispatch/send.ts`) */
  'WEB_PUSH_SUBJECT',
  /**
   * 시험용으로 더 받는 푸시 호스트(쉼표 목록) — 로컬의 가짜 푸시 서비스(`localhost`)만. **운영에는 넣지 않는다** — 없으면
   * 알려진 푸시 서비스 넷만 받는다(`app/me/push/hosts.ts`, ADR 0156)
   */
  'WEB_PUSH_EXTRA_HOSTS',
  /** 애플 로그인 키의 팀 ID · 키 ID — 비밀이 아니다(클라이언트 비밀의 머리 · 몸에 그대로 실린다, ADR 0219) */
  'APPLE_TEAM_ID',
  'APPLE_SIGN_IN_KEY_ID',
  /**
   * 카카오 REST API 키 — 비밀이 아니다(인가 주소에 실려 브라우저가 본다, ADR 0224). 없으면 웹의 카카오 로그인 단추가 안 선다.
   * Production 에만 둔다 — 미리보기 주소는 카카오에 등록할 수 없다
   */
  'KAKAO_REST_API_KEY',
  /**
   * Google Play 통지(RTDN)의 Pub/Sub 푸시 구독이 싣는 OIDC 토큰의 audience 와 서비스 계정 이메일(ADR 0230) — 비밀이 아니다. 믿는 쪽은
   * Google 의 서명이고, 이 둘은 그 토큰이 우리 구독의 것인지만 가른다(`app/api/store/google-play/push-auth.ts`). 둘 중 하나라도 비면
   * 통지 문이 503 이다. **운영자가 Play 개발자 계정 뒤에 넣는다**
   */
  'GOOGLE_PLAY_PUBSUB_AUDIENCE',
  'GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT',
];

/** 제 안에서 비밀을 읽는 패키지 — 이것을 부르는 모듈도 비밀을 읽는 모듈이다 */
export const SECRET_READING_PACKAGES = {
  openai: ['OPENAI_API_KEY', 'OPENAI_WEBHOOK_SECRET'],
  '@ai-sdk/openai': ['OPENAI_API_KEY'],
  '@vercel/oidc': ['VERCEL_OIDC_TOKEN'],
};

/** 이보다 짧은 값은 대조하지 않는다 — 우연히 겹치는 낱말이 걸린다. 진짜 비밀은 전부 이보다 길다 */
const MIN_VALUE_LENGTH = 12;

/** `vercel env pull` 이 Secret 자리에 내려 주는 자리표시자 — 값이 아니다 */
const PLACEHOLDERS = new Set(['[SENSITIVE]']);

/**
 * 대조할 값 — 그 빌드의 환경에 있는 비밀만. 없는 것과 자리표시자는 뺀다.
 *
 * @returns `{ name, value }` — `value` 는 찍지 않는다
 */
export function secretValuesOf(env) {
  return SECRET_ENV.flatMap((name) => {
    const value = env[name]?.trim();
    if (!value || value.length < MIN_VALUE_LENGTH || PLACEHOLDERS.has(value)) return [];
    return [{ name, value }];
  });
}

/**
 * 브라우저로 가는 파일에서 비밀 이름과 비밀 값을 찾는다.
 *
 * @param files `{ path, text }` 목록
 * @param values `secretValuesOf` 의 답
 * @returns 걸린 것 — `{ path, name, found: '이름' | '값' }`. 값은 싣지 않는다
 */
export function leaksIn(files, values) {
  const leaks = [];
  for (const { path, text } of files) {
    for (const name of SECRET_ENV) {
      if (text.includes(name)) leaks.push({ path, name, found: '이름' });
    }
    for (const { name, value } of values) {
      if (text.includes(value)) leaks.push({ path, name, found: '값' });
    }
  }
  return leaks;
}

/** 미리 그린 화면 중 브라우저가 받는 것 — 서버 청크(`server/chunks`)는 안 간다 */
const PRERENDERED = /\.(html|rsc|body|meta)$/;

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const exists = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/**
 * 빌드 산출물 중 **브라우저로 가는 파일**의 경로.
 *
 * `static/**` 는 전부, `server/app/**` 는 미리 그린 화면(html · rsc · body · meta)만이다.
 * `static` 이 없으면 빈 목록이 아니라 던진다 — 빌드가 없는데 「새는 것 0」으로 초록이 되면
 * 안 잰 것이다.
 */
export function clientFilesOf(distDir) {
  const staticDir = join(distDir, 'static');
  if (!exists(staticDir)) throw new Error(`빌드 산출물이 없다: ${staticDir} — next build 뒤에 돈다`);

  const appDir = join(distDir, 'server', 'app');
  const prerendered = exists(appDir) ? walk(appDir).filter((path) => PRERENDERED.test(path)) : [];
  return [...walk(staticDir), ...prerendered];
}

function main() {
  const distDir = process.env.NEXT_DIST_DIR ?? '.next';
  const paths = clientFilesOf(distDir);
  const files = paths.map((path) => ({ path: relative(process.cwd(), path), text: readFileSync(path, 'utf8') }));
  const values = secretValuesOf(process.env);
  const leaks = leaksIn(files, values);

  if (leaks.length > 0) {
    console.error('비밀이 브라우저로 가는 파일에 있다 (G-23 ⑧, docs/ops/runbook/secret-leak.md 「비밀이 새면」):');
    for (const { path, name, found } of leaks) console.error(`  ${path} — ${name} 의 ${found}`);
    process.exit(1);
  }

  console.log(
    `비밀 검사: 브라우저로 가는 파일 ${files.length}개에 비밀 이름 ${SECRET_ENV.length}개 · 이 빌드의 비밀 값 ${values.length}개 — 없다`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
