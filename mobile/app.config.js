/**
 * `app.json` 위에 환경마다 다른 값만 얹는다. iOS 의 URL 스킴은 Google iOS 클라이언트가 생긴 뒤에 넣는다 — 값이 없으면 안드로이드만 빌드한다.
 *
 * 카카오 로그인(ADR 0224)은 네이티브 앱 키가 있을 때만 플러그인이 선다 — 키로 짓는 URL 스킴(`kakao<키>`)이 빌드에 박히므로 키가 없는
 * 빌드에는 넣지 않는다. 키는 EAS 환경값 `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` 이고, 바꾸면 새 빌드가 든다(OTA 로는 안 바뀐다).
 */
module.exports = ({ config }) => {
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
