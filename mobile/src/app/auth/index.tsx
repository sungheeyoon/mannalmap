import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { KAKAO_SIGN_IN_GOING } from '@account/sign-in-line';
import { SERVICE_NAME } from '@brand';
import { CHART_SIGN_IN, SIGN_IN_UNLOCKS, SIGNED_OUT_EXIT, COMPAT_SIGN_IN_TITLE } from '@brand/guide';
import { chartWantOf, isChartPath } from '@consent/app-destination';
import { safeReturnPath, withReturnPath } from '@consent/return-path';
import { matchEntriesStand } from '@matching/opening';

import { arriveAt } from '@/auth/arrive';
import { AppleSignInButton } from '@/auth/apple-button';
import { GoogleSignInButton } from '@/auth/google-button';
import { signInWithApple } from '@/auth/apple';
import { KakaoSignInButton } from '@/auth/kakao-button';
import { signInWithKakao } from '@/auth/kakao';
import { MatchingSteps } from '@/auth/matching-steps';
import { signInWithGoogle, type SignInAnswer } from '@/auth/sign-in';
import { readGate } from '@/home/gate';
import { goHome } from '@/info/go-home';
import { useMatchOpen } from '@/matching/opening';
import { Icon } from '@/ui/icons';
import { NoticeLine, NoticeScreen } from '@/ui/notice-screen';
import { SecondaryButton, TextButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { goBack } from '@/ui/top-bar';
import { WordText } from '@/ui/word-text';

/**
 * 로그인 — 웹의 `/auth` 와 같은 글자이고 로그인은 네이티브 구글, 키가 든 빌드에서는 그 밑에 카카오(ADR 0224), iOS 에서는 애플이 나란히 선다(ADR 0219). 돌아갈 곳은 앱에 있는 `/me` 아래와 결과 화면이다 —
 * 웹의 두 갈래 제목(`/compat` · `/saju` 이어 보기)은 앱에 없는 주소에서 오는 말이라 세우지 않는다. 「로그인 없이도…」 줄은 궁합 첫 신호까지 약속하는데 앱에는 그 화면이 없어 뺀다. 실패와 취소는 로그인 실패 화면으로 간다.
 * 결과 화면에서 왔으면 누른 일의 까닭을 말하고, 취소는 그 결과로 돌아간다 — 구글 · 애플 창을 닫아도 제자리다.
 */
export default function SignInScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const returnTo = safeReturnPath(next);
  const destination = returnTo.startsWith('/me') || isChartPath(returnTo) ? returnTo : '/me';
  const want = chartWantOf(destination);
  const fromChart = isChartPath(destination);
  const [going, setGoing] = useState<'google' | 'apple' | 'kakao' | null>(null);
  /* 인연이 닫힌 동안(ADR 0222) 「인연 만나기」를 약속하지 않는다 — 웹 `/auth` 와 같다 */
  const matchOpen = useMatchOpen();

  useEffect(() => {
    let live = true;
    void readGate().then((gate) => {
      if (!live) return;
      if (gate.kind === 'in') arriveAt(destination);
      else if (gate.kind === 'signup') router.replace(withReturnPath('/signup', destination) as never);
    });
    return () => {
      live = false;
    };
  }, [destination]);

  const signIn = async (provider: 'google' | 'apple' | 'kakao', start: () => Promise<SignInAnswer>) => {
    setGoing(provider);
    const answer = await start();
    setGoing(null);
    if (answer.kind === 'signed-in') arriveAt(destination);
    else if (answer.kind === 'needs-signup') router.replace(withReturnPath('/signup', destination) as never);
    else if (answer.kind !== 'cancelled' || !fromChart) router.replace(withReturnPath('/auth/denied', destination) as never);
  };

  return (
    <NoticeScreen
      title={want !== null ? CHART_SIGN_IN[want].title : destination === '/me/compat' ? COMPAT_SIGN_IN_TITLE : `${SERVICE_NAME} 시작하기`}
      description={
        <NoticeLine>
          {want !== null ? CHART_SIGN_IN[want].note : '로그인하면 저장한 사람과 사주풀이를 다음에도 이어서 볼 수 있어요.'}{' '}
          지금은 비공개 베타라, 처음 오셨다면 로그인 뒤에 <WordText style={styles.strong}>테스트 코드</WordText>가 필요해요.
        </NoticeLine>
      }
      actions={
        <>
          {/* 카카오 → 구글 → 애플(운영자 결정 2026-11-05, ADR 0228) */}
          <KakaoSignInButton
            label={going === 'kakao' ? KAKAO_SIGN_IN_GOING : undefined}
            onPress={() => void signIn('kakao', signInWithKakao)}
            busy={going !== null}
          />
          <GoogleSignInButton
            going={going === 'google'}
            onPress={() => void signIn('google', signInWithGoogle)}
            disabled={going !== null}
          />
          <AppleSignInButton onPress={() => void signIn('apple', signInWithApple)} busy={going !== null} />
          {fromChart && <SecondaryButton label="취소" onPress={() => goBack('/')} disabled={going !== null} />}
        </>
      }
      note={
        fromChart ? undefined : (
          <View style={styles.exit}>
            <TextButton label={SIGNED_OUT_EXIT} onPress={() => void goHome()} />
          </View>
        )
      }
    >
      {destination.startsWith('/me/matching') && <MatchingSteps done={[]} />}
      {!fromChart && (
        <View style={styles.unlocks}>
          {SIGN_IN_UNLOCKS.filter((one) => !one.match || matchEntriesStand(matchOpen)).map(({ icon, text }) => (
            <View key={text} style={styles.unlock}>
              <View style={styles.unlockIcon}>
                <Icon name={icon} size={18} color={COLOR.creamInk} />
              </View>
              <Text style={styles.unlockText}>{text}</Text>
            </View>
          ))}
        </View>
      )}
    </NoticeScreen>
  );
}

const styles = StyleSheet.create({
  strong: { fontFamily: FONT.bold },
  unlocks: { gap: 10 },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unlockIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
  unlockText: { flex: 1, fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.foreground },
  exit: { alignSelf: 'flex-start' },
});
