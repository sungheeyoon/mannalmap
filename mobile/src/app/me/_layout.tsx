import { Redirect, Stack, router, useGlobalSearchParams, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SERVICE_NAME } from '@brand';
import { gateFor } from '@consent/gate';
import { withReturnPath } from '@consent/return-path';

import { currentPath } from '@consent/app-destination';
import { LiveChannel } from '@/chat/live';
import { useCounts } from '@/home/counts';
import { useGate } from '@/home/gate';
import { useAdultCheckGuard } from '@/matching/adult-check';
import { useMatchClosedGuard, useMatchOpen } from '@/matching/opening';
import { tabsWhileShut } from '@matching/opening';
import { appHeadStands, dockStands } from '@app-shell';
import { WarningNotice } from '@/home/warning-notice';
import { goTab } from '@/ui/go-tab';
import { Icon } from '@/ui/icons';
import { Logo } from '@/ui/logo';
import { SecondaryButton } from '@/ui/parts';
import { COLOR, ELEMENT_TONE, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { KEEP_VIEW } from '@/ui/keep-view';

/** 웹 머리글의 `MEMBER_TABS` 와 같은 넷 · 같은 글자다. 궁합의 첫 화면은 앱에서 `/me/compat` 다. 인연이 닫힌 동안은 홈 · 궁합 둘이다(ADR 0222) */
const TABS = [
  { href: '/me', label: '홈', icon: 'home' },
  { href: '/me/compat', label: '궁합', icon: 'taiji' },
  { href: '/me/matching', label: '인연', icon: 'people' },
  { href: '/me/chat', label: '채팅', icon: 'chat' },
] as const;

/** 탭의 첫 화면은 밀려 들어오지 않고 그 자리에서 바뀐다. 라우트 이름은 그 폴더에 `_layout` 이 있는가에 따라 둘 중 하나다 */
const TAB_ROUTES = new Set(['index', 'compat', 'compat/index', 'matching', 'matching/index', 'chat', 'chat/index']);

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** 웹의 `isNavigationActive` — 저장한 사람과 보관함 목록은 홈 탭의 길이다 */
function isActive(pathname: string, href: string): boolean {
  if (href === '/me') return pathname === '/me' || within(pathname, '/me/people') || pathname === '/me/readings';
  if (href === '/me/compat') return pathname === '/me/compat';
  return within(pathname, href);
}

/**
 * 앱 안의 껍데기 — 머리 · 네 탭 · 관문. **탭 아래는 스택 하나다** — 다른 화면이 여기 이름을 올리지 않아도 뒤로 가기가 돌고,
 * 탭 막대는 웹의 하단 독처럼 주소를 보고 불을 켠다.
 */
export default function MeLayout() {
  const { gate, retry, held } = useGate();
  const pathname = usePathname();
  const search = useGlobalSearchParams<{ a?: string; b?: string }>();
  const insets = useSafeAreaInsets();
  const counts = useCounts(pathname, gate.kind === 'in');
  const matchOpen = useMatchOpen();
  useMatchClosedGuard(pathname, matchOpen);
  useAdultCheckGuard(pathname, currentPath(pathname, search), gate.kind === 'in' && matchOpen !== false);
  const tabs = tabsWhileShut(TABS, matchOpen);

  if (gate.kind === 'checking') return <View style={styles.screen} />;
  /* 이 주소로 바로 들어온 사람은 로그인 · 가입 뒤 여기로 돌아온다(ADR 0213). 로그아웃한 사람은 돌아올 뜻이 없다 */
  if (gate.kind === 'out') return <Redirect href={(gate.left ? '/' : withReturnPath('/auth', currentPath(pathname, search))) as never} />;
  if (gate.kind === 'signup') return <Redirect href={withReturnPath('/signup', currentPath(pathname, search)) as never} />;
  if (gate.kind === 'closed') {
    /* 끝난 뒤 지나가는 곳은 설정뿐이라 탭도 머리도 안 선다 — 눌러 봐야 안내로 되돌아온다 */
    if (gateFor(pathname, gate.account, gate.notice, new Date()) !== null) return <Redirect href={'/closed' as never} />;
    return (
      <View style={styles.screen}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLOR.background } }} />
      </View>
    );
  }
  const failure =
    gate.kind === 'failed' ? (
      <SafeAreaView style={[styles.screen, styles.failed, held && styles.over]}>
        <Text style={styles.failure}>{gate.message}</Text>
        <SecondaryButton label="다시 시도하기" onPress={retry} />
      </SafeAreaView>
    ) : null;
  /* 한 번도 못 들어온 사람은 안내만 본다. 들어와 있던 사람은 안내가 화면을 가릴 뿐 아래 스택은 살아 있다 — 다시 시도하면 쓰던 글과 스크롤이 그대로다 */
  if (gate.kind === 'failed' && !held) return failure;

  const badges: Record<string, number> = { '/me/chat': counts.chat };

  return (
    <View style={styles.screen}>
      <LiveChannel />
      {appHeadStands(pathname, search) && (
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable accessibilityRole="link" accessibilityLabel={`${SERVICE_NAME} 홈`} onPress={() => goTab('/me')} style={styles.logo}>
          <Logo size={32} />
        </Pressable>
        <View style={styles.tools}>
          {counts.credits !== null && (
            <Pressable accessibilityRole="button" accessibilityLabel={counts.credits} onPress={() => router.push('/me/credits' as never)} style={styles.tool}>
              <Icon name="ticket" size={20} />
            </Pressable>
          )}
          <Pressable accessibilityRole="link" accessibilityLabel="소식" onPress={() => router.push('/me/requests' as never)} style={styles.tool}>
            <Icon name="bell" size={20} />
            {counts.news > 0 && (
              <View style={[styles.badge, styles.toolBadge]}>
                <Text style={styles.badgeText}>{counts.news}</Text>
              </View>
            )}
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel="설정" onPress={() => router.push('/me/settings' as never)} style={styles.tool}>
            <Icon name="gear" size={20} />
          </Pressable>
        </View>
      </View>
      )}

      {/* 머리가 선 탭 첫 화면 아래에만 선다 — 하위 화면은 맨 위 줄(`ui/top-bar.tsx`)이 안전 영역을 내서, 그 위에 얹으면 상태 표시줄 밑으로 들어간다 */}
      {appHeadStands(pathname, search) && <WarningNotice />}

      <View style={styles.body}>
        <Stack
          screenOptions={({ route }) => ({
            headerShown: false,
            contentStyle: { backgroundColor: COLOR.background },
            animation: TAB_ROUTES.has(route.name) ? 'none' : 'default',
          })}
        />
      </View>

      {dockStands(pathname) && (
        <View accessibilityRole="tablist" style={[styles.dock, { paddingBottom: insets.bottom + 6 }]}>
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            const count = badges[tab.href] ?? 0;
            return (
              <Pressable
                key={tab.href}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => goTab(tab.href)}
                style={styles.tab}
              >
                <View {...KEEP_VIEW} style={[styles.tabMark, active && styles.tabMarkOn]}>
                  <Icon name={tab.icon} color={active ? ELEMENT_TONE.木.ink : COLOR.secondary} />
                </View>
                <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{tab.label}</Text>
                {count > 0 && (
                  <View style={[styles.badge, styles.tabBadge]}>
                    <Text style={styles.badgeText}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {failure}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  over: StyleSheet.absoluteFill,
  failed: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  failure: { fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 4, backgroundColor: COLOR.background },
  logo: { minHeight: 44, justifyContent: 'center' },
  tools: { flexDirection: 'row', alignItems: 'center' },
  tool: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  dock: { flexDirection: 'row', paddingHorizontal: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: COLOR.border, backgroundColor: COLOR.surface },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabMark: { width: 56, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  tabMarkOn: { backgroundColor: ELEMENT_TONE.木.soft },
  tabLabel: { fontFamily: FONT.bold, fontSize: TYPE.fine, color: COLOR.secondary },
  tabLabelOn: { color: COLOR.foreground },
  badge: { position: 'absolute', minWidth: 18, height: 18, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.danger },
  badgeText: { fontFamily: FONT.bold, fontSize: 11, color: COLOR.onAccent },
  toolBadge: { top: 4, right: 4 },
  tabBadge: { top: 0, left: '56%' },
});
