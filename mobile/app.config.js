/**
 * `app.json` 위에 환경마다 다른 값만 얹는다. iOS 의 URL 스킴은 Google iOS 클라이언트가 생긴 뒤에 넣는다 — 값이 없으면 안드로이드만 빌드한다.
 *
 * 카카오 로그인(ADR 0224)은 네이티브 앱 키가 있을 때만 플러그인이 선다 — 키로 짓는 URL 스킴(`kakao<키>`)이 빌드에 박히므로 키가 없는
 * 빌드에는 넣지 않는다. 키는 EAS 환경값 `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` 이고, 바꾸면 새 빌드가 든다(OTA 로는 안 바뀐다).
 *
 * 출시 빌드는 앱이 서는 데 드는 값 넷 — 웹의 주소(`EXPO_PUBLIC_SITE_URL`, 앱에서 읽는 자리는 `src/site.ts` 하나) · Supabase 주소와 공개 키 ·
 * 구글 웹 클라이언트 — 중 하나라도 비거나 주소 둘(웹 · Supabase)이 https 가 아니면 여기서 선다. 없이 나가면 풀이가 「닿지 못했다」로 서고 약관이 비며 로그인이 안 된다. 내부 판(`preview`)은
 * 웹의 주소가 https 인지만 본다 — 운영 DB 에 쓰는 판이라 토큰을 http 로 보내지 않는다. `EAS_BUILD_PROFILE` 은 EAS 의 빌드 기계에만 서므로
 * 로컬 개발 · 가짜 서버로 재기는 안 막는다(ADR 0233, 운영자 2026-11-06).
 */
module.exports = ({ config }) => {
  const refusal = buildEnvRefusal(process.env);
  if (refusal !== null) throw new Error(refusal);
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
  return {
    ...config,
    plugins: [
      ...config.plugins.filter(
        (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== '@react-native-google-signin/google-signin',
      ),
      iosUrlScheme
        ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
        : '@react-native-google-signin/google-signin',
      ...(kakaoNativeAppKey
        ? [
            [
              '@react-native-kakao/core',
              {
                nativeAppKey: kakaoNativeAppKey,
                /* 카카오계정(브라우저) 로그인이 돌아오는 자리 · 카카오톡 로그인이 돌아오는 자리 */
                android: { authCodeHandlerActivity: true },
                ios: { handleKakaoOpenUrl: true },
              },
            ],
          ]
        : []),
    ],
  };
};

/** 출시 빌드(`production` 판)에서 비면 안 되는 값 — 앱이 서는 데 든다 */
const RELEASE_ENV = [
  'EXPO_PUBLIC_SITE_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
];

/** 출시 빌드에서 https 주소여야 하는 값 — 로그인 토큰을 싣고 가는 바탕 주소다 */
const RELEASE_URLS = ['EXPO_PUBLIC_SITE_URL', 'EXPO_PUBLIC_SUPABASE_URL'];

/** https 주소가 아니면 까닭 한 줄, 맞으면 `null` — 값은 싣지 않는다(빌드 기록에 남는다) */
function httpsRefusal(env, name) {
  let url;
  try {
    url = new URL(env[name]);
  } catch {
    return `${name} 이 주소가 아니다`;
  }
  return url.protocol === 'https:' ? null : `${name} 이 https 주소가 아니다`;
}

/**
 * 이 판의 빌드를 멈출 까닭 한 줄, 아니면 `null`(ADR 0233 추기). `production` 은 `RELEASE_ENV` 가 다 있고 주소 둘(`RELEASE_URLS`)이 https 여야
 * 한다. `preview` 는 웹의 주소가 https 인지만 본다(없으면 https 가 아니다). 그 밖의 판과 로컬은 보지 않는다. 까닭에는 이름만 싣고 값은 싣지 않는다
 */
function buildEnvRefusal(env) {
  const profile = env.EAS_BUILD_PROFILE;
  if (profile === 'production') {
    const missing = RELEASE_ENV.filter((name) => !env[name]?.trim());
    if (missing.length > 0) return `${missing.join(' · ')} 이 없다 — 출시 빌드는 이 값이 든다(EAS 환경 production 에 넣는다)`;
    for (const name of RELEASE_URLS) {
      const refusal = httpsRefusal(env, name);
      if (refusal !== null) return refusal;
    }
    return null;
  }
  if (profile !== 'preview') return null;
  if (!env.EXPO_PUBLIC_SITE_URL?.trim()) return 'EXPO_PUBLIC_SITE_URL 이 없다 — preview 빌드는 웹의 https 주소가 든다(EAS 환경 preview 에 넣는다)';
  return httpsRefusal(env, 'EXPO_PUBLIC_SITE_URL');
}

module.exports.buildEnvRefusal = buildEnvRefusal;
module.exports.RELEASE_ENV = RELEASE_ENV;
