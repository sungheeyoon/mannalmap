/**
 * `app.json` 위에 환경마다 다른 값만 얹는다. iOS 의 URL 스킴은 Google iOS 클라이언트가 생긴 뒤에 넣는다 — 값이 없으면 안드로이드만 빌드한다.
 *
 * 카카오 로그인(ADR 0224)은 네이티브 앱 키가 있을 때만 플러그인이 선다 — 키로 짓는 URL 스킴(`kakao<키>`)이 빌드에 박히므로 키가 없는
 * 빌드에는 넣지 않는다. 키는 EAS 환경값 `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` 이고, 바꾸면 새 빌드가 든다(OTA 로는 안 바뀐다).
 *
 * 출시 빌드는 웹의 주소(`EXPO_PUBLIC_SITE_URL`, 앱에서 읽는 자리는 `src/site.ts` 하나)가 없으면 여기서 선다 — 없이 나가면 풀이가
 * 「닿지 못했다」로 서고 약관이 빈다. `EAS_BUILD_PROFILE` 은 EAS 의 빌드 기계에만 서므로 로컬 개발 · 가짜 서버로 재기는 안 막는다(ADR 0233).
 */
module.exports = ({ config }) => {
  const refusal = siteUrlRefusal(process.env);
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

/** 출시 빌드(`production` 판)에 웹의 주소가 없거나 https 주소가 아니면 까닭 한 줄, 아니면 `null` */
function siteUrlRefusal(env) {
  if (env.EAS_BUILD_PROFILE !== 'production') return null;
  const value = env.EXPO_PUBLIC_SITE_URL;
  if (!value) return 'EXPO_PUBLIC_SITE_URL 이 없다 — 출시 빌드는 웹의 주소가 든다(EAS 환경 production 에 넣는다)';
  let url;
  try {
    url = new URL(value);
  } catch {
    return `EXPO_PUBLIC_SITE_URL 이 주소가 아니다: ${value}`;
  }
  if (url.protocol !== 'https:') return `EXPO_PUBLIC_SITE_URL 이 https 주소가 아니다: ${value}`;
  return null;
}

module.exports.siteUrlRefusal = siteUrlRefusal;
