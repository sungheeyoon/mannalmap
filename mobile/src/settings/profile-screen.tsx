import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { isBlocked, type AccountState } from '@account/index';
import { INTRO_MAX, NICKNAME_AVAILABLE_NOTE, NICKNAME_MAX, NICKNAME_MIN, NICKNAME_TAKEN_NOTE, missingInProfile, missingNickname, nicknameKey, profileEdited, type PhotoUploadMode, type ProfileInput } from '@profile';

import type { Client } from '@/auth/client';
import { readAccount } from '@/auth/account';
import { useClient } from '@/auth/connected';
import { checkNickname } from '@/auth/signup';
import { FailureLine } from '@/ui/failure-line';
import { LoadingDots } from '@/ui/loading';
import { Field, PrimaryButton } from '@/ui/parts';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';
import { TopBar } from '@/ui/top-bar';
import { CardFrame } from '@/ui/surfaces';
import { useLeaveGuard } from '@/ui/leave-guard';

import { AccountNotice, settingsText, useDoneNote } from './parts';
import { PhotoGrid, PhotoGridFailed } from './photo-grid';
import { BirthSection } from './birth-section';
import { myPhotos, photoUploadMode, type MyPhoto } from './photos';
import { saveProfile } from './profile';
import { WordText } from '@/ui/word-text';

const NICKNAME_CHECK_AFTER_MS = 500;

type Loaded = {
  state: AccountState;
  current: ProfileInput | null;
  /** `null` 이면 사진 목록만 못 읽었다 — 그 칸만 실패 줄이다(대장 all-18) */
  photos: readonly MyPhoto[] | null;
  uploads: PhotoUploadMode;
  userId: string | null;
};

async function load(client: Client): Promise<Loaded> {
  const { state, row } = await readAccount(client);
  if (isBlocked(state) || row === null) return { state, current: null, photos: [], uploads: 'paused', userId: null };
  /*
    사진을 못 읽어도 닉네임 · 소개 · 출생 정보는 선다 — 실패는 사진 칸 하나에만 선다(대장 all-18). 화면째 실패는 계정을 못 읽었을
    때뿐이고 그것은 `readAccount` 가 `AccountNotice` 의 갈래(`unreachable`)로 낸다. `photoUploadMode` 는 못 읽으면 스스로 `paused` 다
  */
  const [photos, uploads, userId] = await Promise.all([myPhotos(client).catch(() => null), photoUploadMode(client), sessionUserId(client)]);
  return { state, current: { nickname: row.nickname ?? '', intro: row.intro ?? '' }, photos, uploads, userId };
}

/** 사진 주소를 지을 내 id — 못 읽으면 `null` 이고 사진 칸이 그림을 안 받는다. 닉네임 · 소개는 그대로 선다 */
async function sessionUserId(client: Client): Promise<string | null> {
  try {
    const { data } = await client.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * 프로필 — 웹 `app/me/profile/page.tsx`. 사진은 고르는 순간 저장되고, 닉네임 · 소개는 단추로 저장한다. 사진이 맨 위이고 출생 정보가 맨 아래다.
 */
export function ProfileScreen() {
  const client = useClient();
  const [data, setData] = useState<Loaded | null>(null);
  const [lifting, setLifting] = useState(false);
  const startBirthEdit = useLocalSearchParams<{ edit?: string }>().edit === 'birth';
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrolled = useRef(false);
  const reloadAll = useCallback(async () => setData(await load(client)), [client]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 여는 때 읽는다 - setState 는 await 뒤라 렌더와 겹치지 않는다
    void reloadAll();
  }, [reloadAll]);

  const reloadPhotos = useCallback(async () => {
    try {
      const [photos, uploads] = await Promise.all([myPhotos(client), photoUploadMode(client)]);
      setData((was) => (was !== null ? { ...was, photos, uploads } : was));
    } catch {
      /* 못 읽었으면 앞 목록이 그대로 선다 — 다음 쓰기는 DB 가 판본으로 다시 본다 */
    }
  }, [client]);

  if (data === null) {
    return (
      <View style={styles.screen}>
        <TopBar title="프로필" fallback="/me/settings" />
        <LoadingDots />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TopBar title="프로필" fallback="/me/settings" />
      <KeyboardAvoidingView style={styles.screen} behavior="padding">
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" scrollEnabled={!lifting}>
          <WordText style={settingsText.meta}>앱에서 쓸 닉네임과 프로필을 정해요.</WordText>

          {data.current === null ? (
            <AccountNotice state={data.state} onRetry={() => void reloadAll()} />
          ) : (
            <>
              {data.photos === null ? (
                <PhotoGridFailed onRetry={() => void reloadPhotos()} />
              ) : (
                <PhotoGrid userId={data.userId} photos={data.photos} uploads={data.uploads} reload={reloadPhotos} onLifting={setLifting} />
              )}
              <ProfileForm current={data.current} onSaved={(saved) => setData((was) => (was !== null ? { ...was, current: saved } : was))} />
              {/* 홈 사주 카드의 「수정」으로 왔으면(`?edit=birth`) 폼을 펴서 열고 그 자리까지 내린다 */}
              <View
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  if (startBirthEdit && !scrolled.current && height > 0) {
                    scrolled.current = true;
                    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: false });
                  }
                }}
              >
                <BirthSection startOpen={startBirthEdit} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** 닉네임 · 소개 — 웹 `form.tsx` 와 같다: 멈추면 스스로 확인하고, 저장도 그 답을 기다린다. 단추를 잠그지 않고 누르면 빠진 것을 말한다 */
function ProfileForm({ current, onSaved }: { current: ProfileInput; onSaved: (saved: ProfileInput) => void }) {
  const client = useClient();
  const [profile, setProfile] = useState(current);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<{ key: string; available: boolean } | null>(null);
  const done = useDoneNote();
  const nicknameRef = useRef<ComponentRef<typeof TextInput>>(null);

  const missing = missingInProfile(profile);
  const nicknameChanged = nicknameKey(profile.nickname) !== nicknameKey(current.nickname);
  const changed = profileEdited(current, profile);
  /* 바뀐 채 ← · 뒤로 · 밀어 닫기로 나가면 한 번 묻는다 — 저장하는 동안은 묻지 않는다(대장 all-18) */
  const { dialog: leaveDialog } = useLeaveGuard({ edited: changed, saving });
  const answer = nicknameChanged && checked?.key === nicknameKey(profile.nickname) ? checked : null;

  useEffect(() => {
    if (!nicknameChanged || missingNickname(profile.nickname) !== null) return;
    const name = profile.nickname;
    const timer = setTimeout(async () => {
      setChecking(true);
      const result = await checkNickname(client, name);
      setChecking(false);
      if (result.ok) setChecked({ key: nicknameKey(name), available: result.available });
      else setFailure(result.message);
    }, NICKNAME_CHECK_AFTER_MS);
    return () => clearTimeout(timer);
  }, [client, profile.nickname, nicknameChanged]);

  const save = async () => {
    if (saving) return;
    if (missing !== null) {
      setTried(true);
      nicknameRef.current?.focus();
      return;
    }
    if (!changed) return;
    if (answer?.available === false) {
      nicknameRef.current?.focus();
      return;
    }
    setFailure(null);
    done.clear();
    setSaving(true);
    if (nicknameChanged && answer === null) {
      const asked = await checkNickname(client, profile.nickname);
      if (!asked.ok) {
        setSaving(false);
        setFailure(`저장하지 못했어요. ${asked.message}`);
        return;
      }
      setChecked({ key: nicknameKey(profile.nickname), available: asked.available });
      if (!asked.available) {
        setSaving(false);
        nicknameRef.current?.focus();
        return;
      }
    }
    const result = await saveProfile(client, profile);
    setSaving(false);
    if (!result.ok) {
      setFailure(`저장하지 못했어요. ${result.message}`);
      return;
    }
    setTried(false);
    onSaved({ nickname: profile.nickname.trim(), intro: profile.intro.trim() });
    done.say('저장했어요');
  };

  const nicknameWrong = (tried && missing !== null) || answer?.available === false;
  const nicknameNote =
    tried && missing !== null ? missing : answer !== null ? (answer.available ? NICKNAME_AVAILABLE_NOTE : NICKNAME_TAKEN_NOTE) : checking && nicknameChanged ? '확인하는 중…' : '';

  return (
    <CardFrame style={styles.form}>
      <View style={styles.group}>
        <WordText style={settingsText.fieldLabel}>닉네임</WordText>
        <Field
          inputRef={nicknameRef}
          label="닉네임"
          value={profile.nickname}
          maxLength={NICKNAME_MAX}
          autoCapitalize="none"
          placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
          refused={nicknameWrong}
          onChange={(nickname) => setProfile({ ...profile, nickname })}
        />
        <WordText accessibilityLiveRegion="polite" style={[styles.note, nicknameWrong && styles.wrong]}>
          {nicknameNote}
        </WordText>
      </View>
      <View style={styles.group}>
        <WordText style={settingsText.fieldLabel}>소개 (선택)</WordText>
        <TextInput
          accessibilityLabel="소개 (선택)"
          multiline
          value={profile.intro}
          maxLength={INTRO_MAX}
          placeholder="간단한 소개를 입력해 주세요"
          placeholderTextColor={COLOR.muted}
          onChangeText={(intro) => setProfile({ ...profile, intro })}
          style={styles.area}
        />
        <WordText style={styles.count}>
          {profile.intro.length}/{INTRO_MAX}
        </WordText>
      </View>
      <View style={styles.action}>
        <View style={missing !== null || !changed ? styles.quiet : undefined}>
          <PrimaryButton label={saving ? '저장하는 중…' : '닉네임 · 소개 저장'} onPress={() => void save()} />
        </View>
        <WordText accessibilityLiveRegion="polite" style={styles.note}>
          {changed ? '' : done.note}
        </WordText>
        {failure !== null && <FailureLine>{failure}</FailureLine>}
      </View>
      {leaveDialog}
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLOR.background },
  content: { flexGrow: 1, gap: 20, padding: 16, paddingBottom: 40 },
  form: { gap: 20, padding: 20 },
  group: { gap: 6 },
  note: { minHeight: 20, fontSize: TYPE.note, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  wrong: { color: COLOR.danger },
  area: { minHeight: 96, paddingHorizontal: 14, paddingVertical: 12, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.borderStrong, backgroundColor: COLOR.surface, fontFamily: FONT.medium, fontSize: TYPE.field, lineHeight: 24, color: COLOR.foreground, textAlignVertical: 'top' },
  count: { alignSelf: 'flex-end', fontSize: TYPE.small, lineHeight: 20, fontFamily: FONT.medium, color: COLOR.secondary },
  action: { gap: 8, paddingTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border },
  quiet: { opacity: 0.55 },
});
