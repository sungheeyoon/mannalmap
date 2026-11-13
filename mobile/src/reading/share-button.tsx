import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

import { useClient } from '@/auth/connected';
import { FailureLine } from '@/ui/failure-line';
import { Icon } from '@/ui/icons';
import { SecondaryButton } from '@/ui/parts';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';

import type { ReadingTarget } from './api';
import { shareMyReading } from './share';

const IDLE = '공유하기';
const WORKING = '만드는 중…';
/** 공유창이 안 열렸다 — 주소는 이미 났으니 할 일만 말한다. 웹의 복사 실패 줄의 뒤 문장 그대로다(`app/me/reading/share-button.tsx`) */
const NOT_OPENED = '아래 주소를 직접 선택해 복사해 주세요.';

type Phase = 'idle' | 'working' | 'failed';

/**
 * 풀이를 **시스템 공유창으로 보낸다** — 누르면 공유본 주소를 만들어 공유창에 넘긴다. 넘기는 것은 **주소 한 줄뿐**이다: 제목 · 설명 글을
 * 같이 넘기면 받는 앱이 주소와 이어 붙여 링크가 깨진다(ADR 0248). 웹은 그래서 공유창 대신 복사다(`app/me/reading/share-button.tsx`).
 * 복사는 공유창의 「복사」가 하고, 안드로이드가 복사를 스스로 알린다 — 이 단추는 「복사했어요」를 따로 세우지 않는다.
 * 링크를 못 만들었거나 공유창이 안 열리면 주소를 세워 손으로 긁게 한다. 공유창을 그냥 닫은 것은 실패가 아니다.
 *
 * 표지의 아이콘과 글 끝의 단추가 저마다 하나씩 쓴다. 아이콘은 표지 위에 떠 있어 실패 줄을 곁에 못 세운다 — `trouble` 을 표지 아래에 둔다.
 */
export function useReadingShare(target: ReadingTarget) {
  const client = useClient();
  const [phase, setPhase] = useState<Phase>('idle');
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const start = async () => {
    setPhase('working');
    setNotice(null);
    setLink(null);
    const issued = await shareMyReading(client, target);
    if (!issued.ok) {
      setPhase('failed');
      setNotice(issued.message);
      return;
    }
    setLink(issued.url);
    try {
      /* 안드로이드는 `message` 하나, iOS 는 `url` 하나 — 어느 쪽도 글을 덧붙이지 않는다 */
      await Share.share(Platform.OS === 'ios' ? { url: issued.url } : { message: issued.url });
      setPhase('idle');
    } catch {
      setPhase('failed');
      setNotice(NOT_OPENED);
    }
  };

  const trouble =
    phase === 'failed' && notice !== null ? (
      <View style={styles.trouble}>
        <FailureLine>{notice}</FailureLine>
        {link !== null && <TextInput editable={false} selectTextOnFocus value={link} accessibilityLabel="공유 주소" style={styles.address} />}
      </View>
    ) : null;

  return { working: phase === 'working', start: () => void start(), trouble };
}

export type ReadingShare = ReturnType<typeof useReadingShare>;

/** 표지 첫 줄 끝의 둥근 아이콘 — 실패 줄은 부르는 쪽이 `share.trouble` 로 표지 밖에 세운다 */
export function ShareReadingIcon({ share }: { share: ReadingShare }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={share.working ? WORKING : IDLE}
      accessibilityLiveRegion="polite"
      disabled={share.working}
      onPress={share.start}
      style={styles.icon}
    >
      <Icon name="share" size={20} strokeWidth={2} />
    </Pressable>
  );
}

/** 글 끝의 보조 단추 — 실패 줄은 단추 바로 아래에 선다 */
export function ShareReadingButton({ target }: { target: ReadingTarget }) {
  const share = useReadingShare(target);
  return (
    <View style={styles.label}>
      <SecondaryButton label={share.working ? WORKING : IDLE} onPress={share.start} disabled={share.working} />
      {share.trouble}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { gap: 8 },
  icon: { width: CONTROL, height: CONTROL, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLOR.surface },
  trouble: { gap: 8 },
  address: { minHeight: CONTROL, paddingHorizontal: 12, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surfaceSunken, fontFamily: FONT.medium, fontSize: TYPE.field, color: COLOR.secondary },
});
