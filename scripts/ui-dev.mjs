/**
 * UI 를 보려고 띄우는 개발 서버 — **로컬 스택에 붙인다.**
 *
 * `npm run dev` 를 그냥 돌리면 `.env.development.local` 을 읽어 **프로덕션 DB** 를 보려 하고
 * (이름과 달리 그 파일은 Vercel 이 내려받은 운영 접속값이다), `next.config.ts` 가 그 시작을 거절한다
 * (`remoteDevRefusal`). 화면을 보려고 누른 것이 곧 운영 자료를 바꾸는 일이 되지 않게.
 *
 * 프로세스 환경이 `.env` 파일보다 세므로 여기서 덮어 쓴다. `playwright.config.ts` 가
 * 같은 일을 하는 자리이고, 이 파일은 사람이 볼 때를 위한 같은 장치다.
 *
 * **포트를 3000 에서 비켜 둔다.** 운영에 붙은 서버가 이미 떠 있어도 서로 안 밟게.
 */

import { spawn } from 'node:child_process';

import { UI_FAKE_KAKAO_KEY } from './next-server.mjs';
import { localStack } from './ui-seed.mjs';

const port = process.env.UI_PORT ?? '3100';
const local = localStack();

/**
 * 카카오 단추는 키가 있을 때만 선다 — 그림 전용 가짜 키를 얹는다(`UI_FAKE_KAKAO_KEY` 머리말). 운영 값(`.env.development.local`)을
 * 읽지 않도록 프로세스 환경으로 덮는다. 굳이 비우면(`KAKAO_REST_API_KEY=`) 비운 채 띄우고 경고를 찍는다.
 */
const kakaoKey = process.env.KAKAO_REST_API_KEY ?? UI_FAKE_KAKAO_KEY;
if (kakaoKey.trim() === '') {
  console.warn('! KAKAO_REST_API_KEY 가 비었습니다 — 로그인 그림에 카카오 단추가 안 섭니다(운영 웹에는 섭니다).');
}

const child = spawn('npx', ['next', 'dev', '--hostname', 'localhost', '--port', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: local.api,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
    SUPABASE_SECRET_KEY: local.secretKey,
    SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
    /**
     * **모델은 안 부른다.** 화면을 보다가 누른 버튼 하나가 실호출이면 훑을 때마다
     * 돈이 나간다. 열쇠를 비우면 그 자리가 실패 화면으로 서고 — 그것도 볼 값이 있는
     * 화면이다.
     */
    OPENAI_API_KEY: '',
    /**
     * **운영이라고 믿지 않게.** `.env.development.local` 은 Vercel 이 내려 준 운영 값이라 `VERCEL_ENV="production"`
     * 을 든다 — 그대로 두면 로컬에서만 여는 자리(해석 내부 보기, `inspectOpen`)가 404 로 찍힌다.
     */
    VERCEL_ENV: 'development',
    KAKAO_REST_API_KEY: kakaoKey,
    KAKAO_CLIENT_SECRET: '',
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
