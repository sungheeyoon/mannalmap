import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { erasesProfileOnly, isBlocked, mayRequestDeletion } from '@account/index';
import { SIGN_OUT_PENDING } from '@account/copy';
import { GUIDE_LINKS } from '@brand/links';
import { OPTIONAL_CONSENT_NOTE } from '@consent/notice';
import { asKoreanDay } from '@consent/index';
import { adultCheckCleared } from '@matching/adult-check';
import { matchEntriesStand } from '@matching/opening';
import { PROFILE_ERASE_TITLE, initialOf } from '@profile';

import { useClient } from '@/auth/connected';
import { signOut } from '@/auth/sign-in';
import { readGate } from '@/home/gate';
import { readAdultCheck } from '@/matching/adult-check';
import { useMatchOpen } from '@/matching/opening';
import { CONTACT_LABEL, POLICY_TITLE, SUPPORT_TITLE, SURVEY_LABEL } from '@/info/copy';
import { legalPagesOpen, openLegalPage } from '@/info/legal-web';
import { openWebAccount, webAccountOpen } from '@/release/floor';
import { FailureLine } from '@/ui/failure-line';
import { LoadingDots } from '@/ui/loading';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { settled } from '@/ui/settled';
import { TopBar } from '@/ui/top-bar';

import { ConsentControls } from './consent-controls';
import { ParticipationRow, PreferenceRow } from './discovery-rows';
import { PushRow } from './push-row';
import { RequestDeletion } from './leaving';
import { AccountNotice, LinkRow, SettingsGroup, TextRow, FAILURE_INSET } from './parts';
import { myPhotos, photoSource } from './photos';
import { readSettings, settingsUnreachable, type SettingsData } from './settings';

const SIGN_OUT_FAILED = '로그아웃하지 못했어요. 다시 시도해 주세요.';

/**
 * 설정 — 나 → 인연 → 동의 → 고객센터 → 약관 및 정책 · 소개 → 계정 → 탈퇴하기. 자주 바꾸는 것이 위, 되돌리기 어려운 것이 맨 아래.
 * 고객센터와 약관은 계정 상태와 무관하게 선다 — 정지되었거나 못 읽었을 때도 닿아야 하는 고지다.
 * 알림 무리는 풀이 완성 알림 하나다(안드로이드, ADR 0236 — `./push-row.tsx`). 새 메시지 알림은 옮기지 않는다. 프로필에서 돌아오면 이름 · 사진이 바뀌었을 수 있어 화면에 설 때마다 다시 읽는다.
 */
export function SettingsScreen() {
  const client = useClient();
  const [data, setData] = useState<SettingsData | null>(null);
  const [face, setFace] = useState<string | null>(null);
  /* 테스트가 끝나면 관문이 설정만 연다 — 눌러도 종료 안내로 되돌아올 줄(프로필 · 설문)은 세우지 않는다 */
  const [ended, setEnded] = useState(false);
  /** 소개받을 성별은 인연의 입구다 — 닫혔거나 못 읽었으면 안 선다(ADR 0222). 「인연 찾기 참여」 스위치는 닫혀도 선다 */
  const matchOpen = useMatchOpen();
  /** 성인 확인을 지났는가 — 참여 스위치 아래 줄만 쓴다. 못 읽으면 `null` 이고 줄은 단정하지 않는 쪽이다(웹 `page.tsx`) */
  const [adultCleared, setAdultCleared] = useState<boolean | null>(null);

  const load = useCallback(() => {
    void settled(readSettings(client), 'readSettings', settingsUnreachable).then(setData);
    void settled(readAdultCheck(client), 'my_adult_check', () => null).then((state) => setAdultCleared(adultCheckCleared(state)));
    void readGate().then((gate) => setEnded(gate.kind === 'closed'));
    /* 사진이 없거나 못 읽었으면 첫 글자가 선다 — 첫 글자는 사진이 있는 사람에게 거짓말이 아니라 자리다(웹 `Avatar`) */
    void settled(
      myPhotos(client).then((photos) => (photos[0] === undefined ? null : photoSource(client, photos[0]))),
      'myPhotos',
      () => null,
    ).then(setFace);
  }, [client]);
  useFocusEffect(load);

  if (data === null) {
    return (
      <View style={styles.screen}>
        <TopBar title="설정" fallback="/me" />
        <LoadingDots />
      </View>
    );
  }

  const { state, account, discovery, accountLine } = data;
  const active = state.kind === 'active';

  return (
    <View style={styles.screen}>
      <TopBar title="설정" fallback="/me" />
      <ScrollView contentContainerStyle={styles.content}>
        {isBlocked(state) && (
          <View style={styles.notice}>
            <AccountNotice state={state} onRetry={load} />
          </View>
        )}

        {/*
          정지된 사람은 사진 · 소개를 웹에서 지운다(ADR 0244) — 앱에 지우는 화면을 다시 짓지 않고, 업데이트 화면이 쓰는 웹 계정 관리의 길을
          그대로 탄다. 웹 설정에 같은 이름의 줄이 있고 그 줄이 지우는 화면을 연다. 앱 안 브라우저는 앱의 로그인을 안 들고 가 웹이 로그인을 먼저 묻는다
        */}
        {erasesProfileOnly(state) && webAccountOpen && (
          <SettingsGroup>
            <LinkRow label={PROFILE_ERASE_TITLE} onPress={openWebAccount} />
          </SettingsGroup>
        )}

        {active && account !== null && !ended && (
          <SettingsGroup>
            <LinkRow
              big
              label={account.nickname ?? '내 프로필'}
              help={accountLine}
              onPress={() => router.push('/me/profile' as never)}
              leading={
                face !== null ? (
                  <Image source={{ uri: face }} style={styles.face} contentFit="cover" />
                ) : (
                  <View style={styles.face}>
                    <Text style={styles.initial}>{initialOf(account.nickname ?? '')}</Text>
                  </View>
                )
              }
            />
          </SettingsGroup>
        )}

        {/* 닫힌 동안에도 「인연 찾기 참여」 스위치 하나로 선다 — 고지가 「설정에서 언제든 끌 수 있다」고 약속한 자리다(운영자 결정 2026-11-08, 웹 `view.tsx`) */}
        {active && (
          <SettingsGroup title="인연">
            {discovery.ok ? (
              <>
                <ParticipationRow resting={discovery.optedOut} open={matchOpen} adultCleared={adultCleared} />
                {matchEntriesStand(matchOpen) && <PreferenceRow key={discovery.preferGender} current={discovery.preferGender} />}
              </>
            ) : (
              <FailureLine style={FAILURE_INSET} onRetry={load}>{`인연 찾기 설정을 불러오지 못했어요. ${discovery.reason}`}</FailureLine>
            )}
          </SettingsGroup>
        )}

        {active && <PushRow />}

        {active && account !== null && (
          <SettingsGroup title="선택 동의" description={OPTIONAL_CONSENT_NOTE}>
            <ConsentControls key={`${account.improvement_consent}`} improvement={account.improvement_consent === true} />
            <PrivacyRow ackAt={account.notice_ack_at} />
          </SettingsGroup>
        )}

        <SettingsGroup title={SUPPORT_TITLE}>
          {goRow(guide('/help'))}
          {goRow({ href: '/support', label: CONTACT_LABEL })}
          {!ended && goRow({ href: '/me/survey', label: SURVEY_LABEL })}
        </SettingsGroup>

        <SettingsGroup>
          {goRow({ href: '/policies', label: POLICY_TITLE })}
          {goRow(guide('/about'))}
        </SettingsGroup>

        <SettingsGroup title="계정">
          {!active && accountLine !== undefined && <Text style={styles.email}>{accountLine}</Text>}
          <SignOutRow />
        </SettingsGroup>

        {/* 정지된 사람에게도 선다 — 스토어의 계정 삭제 요건(ADR 0218) */}
        {mayRequestDeletion(state) && <RequestDeletion onDone={load} />}
      </ScrollView>
    </View>
  );
}

const guide = (href: string) => GUIDE_LINKS.find((link) => link.href === href)!;

function goRow(link: { href: string; label: string }) {
  return <LinkRow key={link.href} label={link.label} onPress={() => router.push(link.href as never)} />;
}

/** 처리 안내 — 전문은 웹의 `/privacy` 현행 판이다(ADR 0172 추기 2026-11-07). 웹 주소가 없는 빌드에는 안 선다 */
function PrivacyRow({ ackAt }: { ackAt: string | null }) {
  if (!legalPagesOpen) return null;
  const label = '개인정보 처리 안내';
  const help = ackAt === null ? '아직 확인하지 않았어요.' : `${asKoreanDay(ackAt.slice(0, 10))}에 확인했어요.`;
  return <LinkRow label={label} help={help} onPress={() => openLegalPage('/privacy')} />;
}

function SignOutRow() {
  const client = useClient();
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const leave = async () => {
    setLeaving(true);
    setFailed(false);
    const left = await signOut(client);
    setLeaving(false);
    if (left) router.replace('/');
    else setFailed(true);
  };
  return (
    <>
      <TextRow label={leaving ? SIGN_OUT_PENDING : '로그아웃'} onPress={() => void leave()} disabled={leaving} />
      {failed && <FailureLine style={FAILURE_INSET}>{SIGN_OUT_FAILED}</FailureLine>}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.surfaceSunken },
  content: { gap: 16, paddingTop: 12, paddingBottom: 40 },
  notice: { paddingHorizontal: 16 },
  face: { width: 56, height: 56, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.cream },
  initial: { fontSize: TYPE.heading, fontFamily: FONT.bold, color: COLOR.creamInk },
  email: { paddingHorizontal: 24, paddingVertical: 12, fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
});
