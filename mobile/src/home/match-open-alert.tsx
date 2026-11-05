import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { userFacingDbMessage } from '@db-error';
import { MATCH_OPEN_ALERT_ASK, MATCH_OPEN_ALERT_ASKED, MATCH_OPEN_ALERT_TITLE } from '@matching/copy';
import { MATCH_OPEN_ALERT_BUTTON, matchOpenAlertStands } from '@matching/opening';

import { supabase } from '@/auth/client';
import { NOT_READY } from '@/auth/signup';
import { useMatchOpen } from '@/matching/opening';
import { Button } from '@/ui/buttons';
import { Icon } from '@/ui/icons';
import { settled } from '@/ui/settled';
import { CardFrame } from '@/ui/surfaces';
import { COLOR, FONT, RADIUS, TYPE } from '@/ui/tokens';

/** 내가 신청했는가 — 못 읽으면 `null` 이고 줄이 안 선다(웹의 `readMatchOpenAlert`) */
async function readMatchOpenAlert(): Promise<boolean | null> {
  if (supabase === null) return null;
  const { data, error } = await supabase.rpc('my_match_open_alert');
  return error === null ? data === true : null;
}

/** 신청 · 취소 — 판정은 DB 의 문이 한다(웹의 `setMatchOpenAlert`). 실패면 사람이 읽을 한 문장 */
async function setMatchOpenAlert(wanted: boolean): Promise<string | null> {
  if (supabase === null) return NOT_READY;
  const { error } = await supabase.rpc('set_match_open_alert', { p_wanted: wanted });
  return error === null ? null : userFacingDbMessage(error, 'set_match_open_alert');
}

/**
 * **인연이 닫힌 동안 홈의 한 줄 — 「열리면 알려 주세요」**(ADR 0223) — 웹의 `app/me/home/match-open-alert.tsx` 와 같은 글자 · 같은 갈래다.
 * 닫혔다고 읽었고 신청 여부를 읽었을 때만 선다. 인연으로 가는 길은 없다 — 신청 · 취소만 한다.
 */
export function MatchOpenAlert() {
  const open = useMatchOpen();
  const [asked, setAsked] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void settled(readMatchOpenAlert(), 'my_match_open_alert', () => null).then((answer) => {
      if (live) setAsked(answer);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!matchOpenAlertStands(open) || asked === null) return null;

  const flip = async () => {
    const next = !asked;
    setSaving(true);
    setFailure(null);
    const refused = await settled(setMatchOpenAlert(next), 'set_match_open_alert', () => NOT_READY);
    setSaving(false);
    if (refused === null) setAsked(next);
    else setFailure(refused);
  };

  const label = saving ? MATCH_OPEN_ALERT_BUTTON.saving : asked ? MATCH_OPEN_ALERT_BUTTON.off : MATCH_OPEN_ALERT_BUTTON.on;
  return (
    <CardFrame>
      <View style={styles.row}>
        <View style={styles.mark}>
          <Icon name="bell" size={20} />
        </View>
        <View style={styles.body}>
          <Text style={styles.name}>{MATCH_OPEN_ALERT_TITLE}</Text>
          <Text style={styles.second}>{asked ? MATCH_OPEN_ALERT_ASKED : MATCH_OPEN_ALERT_ASK}</Text>
        </View>
        <Button label={label} onPress={() => void flip()} disabled={saving} variant="secondary-small" />
      </View>
      {failure !== null && <Text accessibilityRole="alert" style={styles.failure}>{failure}</Text>}
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  mark: { width: 40, height: 40, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.surfaceSunken },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.bold, fontSize: TYPE.body, color: COLOR.foreground },
  second: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  failure: { paddingHorizontal: 16, paddingBottom: 12, fontFamily: FONT.medium, fontSize: TYPE.small, color: COLOR.danger },
});
