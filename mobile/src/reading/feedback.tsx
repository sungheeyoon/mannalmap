import { BUTTON_OFF_OPACITY } from '@design';
import {
  FEEDBACK_COMMENT,
  FEEDBACK_FOLDED_NOTE,
  FEEDBACK_SCALE,
  FEEDBACK_SCOPE_NOTE,
  FEEDBACK_THANKS,
  FELT_LENGTHS,
  FELT_LENGTH_LABEL,
  ISSUE_TAGS,
  ISSUE_TAG_LABEL,
  feedbackQuestions,
  type FeedbackQuestion,
  type FeedbackScore,
  type FeltLength,
  type IssueTag,
  type ReadingAnswer,
} from '@reading/feedback';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useClient } from '@/auth/connected';
import { FoldIcon } from '@/ui/icons';
import { Card, Paper, Tile } from '@/ui/surfaces';
import { PrimaryButton, TextButton } from '@/ui/parts';
import { COLOR, CONTROL, FONT, RADIUS, TYPE } from '@/ui/tokens';

import type { ReadingTarget } from './api';
import { leaveFeedback } from './feedback-writes';
import { WordText } from '@/ui/word-text';

/**
 * 읽고 나서 답하는 자리 — **글 바로 아래**다. 물음 · 글자는 웹과 같은 `@reading/feedback` 이고 차례도 `app/me/reading/feedback.tsx` 와 같다.
 * 처음에는 한 줄로 접혀 서고, 이미 답한 사람의 「답 고치기」는 펼친 채 지금 답으로 열린다 — 빈 칸으로 다시 보내면 적어 둔 글이 지워진다.
 * 셋을 다 골라야 보내지고, 단추를 잠그지 않아 덜 고르고 누르면 곁의 말이 경고가 된다(ADR 0160).
 */
export function ReadingFeedback({ target, runId, given }: { target: ReadingTarget; runId: string; given: ReadingAnswer | null }) {
  const client = useClient();
  const [answer, setAnswer] = useState(given);
  const [open, setOpen] = useState(given === null);
  const [unfolded, setUnfolded] = useState(false);
  const [usefulness, setUsefulness] = useState<FeedbackScore | null>(given?.usefulness ?? null);
  const [fit, setFit] = useState<FeedbackScore | null>(given?.perceivedFit ?? null);
  const [feltLength, setFeltLength] = useState<FeltLength | null>(given?.feltLength ?? null);
  const [tags, setTags] = useState<IssueTag[]>([...(given?.issueTags ?? [])]);
  const [comment, setComment] = useState(given?.comment ?? '');
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const questions = feedbackQuestions(target.kind);

  if (answer !== null && !open) {
    return (
      <Paper style={styles.thanks}>
        <WordText style={styles.thanksText}>{FEEDBACK_THANKS}</WordText>
        <TextButton label="답 고치기" onPress={() => setOpen(true)} />
      </Paper>
    );
  }

  const ready = usefulness !== null && fit !== null && feltLength !== null;

  const send = async () => {
    if (!ready) {
      setTried(true);
      return;
    }
    setFailure(null);
    setSaving(true);
    const sent: ReadingAnswer = {
      usefulness,
      perceivedFit: fit,
      feltLength,
      issueTags: tags,
      comment: comment.trim() === '' ? null : comment.trim(),
    };
    const result = await leaveFeedback(client, runId, sent);
    setSaving(false);
    if (result.ok) {
      setAnswer(sent);
      setOpen(false);
    } else {
      setFailure(result.message);
    }
  };

  const foldable = given === null && answer === null;
  const shown = foldable ? unfolded : true;
  const head = (
    <View style={styles.headWords}>
      <WordText style={styles.headTitle}>이 풀이는 어떠셨어요?</WordText>
      <WordText style={styles.small}>{foldable ? FEEDBACK_FOLDED_NOTE : FEEDBACK_SCOPE_NOTE}</WordText>
    </View>
  );

  return (
    <Card style={styles.frame}>
      {foldable ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: shown, disabled: saving }} disabled={saving} onPress={() => setUnfolded(!shown)} style={styles.head}>
          {head}
          <FoldIcon open={shown} size={20} color={COLOR.secondary} strokeWidth={1.8} />
        </Pressable>
      ) : (
        <View style={styles.head}>{head}</View>
      )}

      {shown && (
        <View style={styles.body}>
          {foldable && <WordText style={styles.small}>{FEEDBACK_SCOPE_NOTE}</WordText>}
          <Scale question={questions.usefulness} value={usefulness} onChange={setUsefulness} disabled={saving} />
          <Scale question={questions.perceivedFit} value={fit} onChange={setFit} disabled={saving} />

          <View style={styles.part}>
            <WordText style={styles.legend}>분량은 어땠나요?</WordText>
            <View style={styles.chips}>
              {FELT_LENGTHS.map((choice) => (
                <Chip key={choice} role="radio" grow disabled={saving} picked={feltLength === choice} onPick={() => setFeltLength(choice)}>
                  {FELT_LENGTH_LABEL[choice]}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.part}>
            <WordText style={styles.legend}>
              아쉬운 점이 있다면요? <WordText style={styles.small}>중복 선택 가능</WordText>
            </WordText>
            <View style={styles.chipsWrap}>
              {ISSUE_TAGS.map((tag) => (
                <Chip
                  key={tag}
                  role="checkbox"
                  disabled={saving}
                  picked={tags.includes(tag)}
                  onPick={() => setTags((now) => (now.includes(tag) ? now.filter((one) => one !== tag) : [...now, tag]))}
                >
                  {ISSUE_TAG_LABEL[tag]}
                </Chip>
              ))}
            </View>
          </View>

          <View style={styles.part}>
            <WordText style={styles.legend}>{FEEDBACK_COMMENT.label}</WordText>
            <WordText style={styles.small}>{FEEDBACK_COMMENT.hint}</WordText>
            <TextInput
              multiline
              numberOfLines={3}
              value={comment}
              maxLength={FEEDBACK_COMMENT.limit}
              onChangeText={(next) => setComment(next.slice(0, FEEDBACK_COMMENT.limit))}
              accessibilityLabel={FEEDBACK_COMMENT.label}
              editable={!saving}
              accessibilityState={{ disabled: saving }}
              style={[styles.comment, saving && styles.off]}
            />
            <WordText style={styles.count}>
              {comment.length} / {FEEDBACK_COMMENT.limit}자
            </WordText>
          </View>

          {failure !== null && <WordText accessibilityRole="alert" style={styles.warn}>답을 남기지 못했어요. {failure}</WordText>}

          {!ready && <WordText accessibilityRole={tried ? 'alert' : undefined} style={tried ? styles.warn : styles.small}>필수 질문 3개에 답하면 보낼 수 있어요.</WordText>}
          <PrimaryButton label={saving ? '보내는 중…' : '의견 보내기'} onPress={() => void send()} disabled={saving} />
        </View>
      )}
    </Card>
  );
}

/** 1~5 눈금 — 양 끝의 말이 함께 선다. 숫자만 읽어 주면 무엇을 매기는지 안 들려 양 끝은 이름으로 읽힌다 */
function Scale({ question, value, onChange, disabled }: { question: FeedbackQuestion; value: FeedbackScore | null; onChange: (next: FeedbackScore) => void; disabled: boolean }) {
  return (
    <Tile tone={COLOR.surfaceSoft} style={styles.scale}>
      <WordText style={styles.legend}>{question.label}</WordText>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {FEEDBACK_SCALE.map((score) => (
          <Chip
            key={score}
            role="radio"
            grow
            disabled={disabled}
            picked={value === score}
            onPick={() => onChange(score)}
            label={score === 1 ? `1 — ${question.low}` : score === 5 ? `5 — ${question.high}` : String(score)}
          >
            {score}
          </Chip>
        ))}
      </View>
      <View style={styles.ends}>
        <WordText style={styles.end}>{question.low}</WordText>
        <WordText style={styles.end}>{question.high}</WordText>
      </View>
    </Tile>
  );
}

function Chip({
  role,
  picked,
  onPick,
  label,
  grow = false,
  disabled = false,
  children,
}: {
  role: 'radio' | 'checkbox';
  picked: boolean;
  onPick: () => void;
  label?: string;
  grow?: boolean;
  /** 보내는 동안 잠근다 — 그 사이 바꾼 답은 이미 떠난 답에 안 실린다. 고른 것은 흐리지 않는다 — 무엇을 보냈는지 보이게(운영자 확정 2026-11-08) */
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: picked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPick}
      style={[styles.chip, grow && styles.grow, picked && styles.chipOn, disabled && !picked && styles.off]}
    >
      <WordText style={[styles.chipText, picked && styles.chipTextOn]}>{children}</WordText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thanks: { gap: 4, paddingHorizontal: 20, paddingVertical: 12 },
  thanksText: { fontFamily: FONT.medium, fontSize: TYPE.body, lineHeight: 24, color: COLOR.creamInk },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  headWords: { flex: 1, minWidth: 0, gap: 4 },
  headTitle: { fontFamily: FONT.bold, fontSize: TYPE.lead, color: COLOR.foreground },
  body: { gap: 20, paddingHorizontal: 20, paddingBottom: 20 },
  part: { gap: 10, paddingTop: 20, borderTopWidth: 1, borderTopColor: COLOR.border },
  /* 눈금 칸은 카드 안쪽 여백을 비집고 나와(카드 가장자리에서 8) 제 여백도 8 — 다섯 단추(44 × 5 + 간격 8 × 4 = 252)가 360 폭에서도 줄지 않는다 */
  scale: { gap: 10, marginHorizontal: -12, paddingHorizontal: 8 },
  legend: { fontFamily: FONT.bold, fontSize: TYPE.body, lineHeight: 22, color: COLOR.foreground },
  small: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.secondary },
  chips: { flexDirection: 'row', gap: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  /* 같은 너비로 나눈다. `minWidth: 0` 을 두면 칩의 최소 너비(44)를 덮어 눈금 단추가 360 에서 36 까지 줄었다.
     안쪽 여백은 4 — 글자가 가운데라 여백은 글자의 최소 틈일 뿐이고, 12 면 「적당해요」가 360 에서 두 줄로 접혔다 */
  grow: { flex: 1, paddingHorizontal: 4 },
  chip: { minHeight: CONTROL, minWidth: CONTROL, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface },
  chipOn: { borderColor: COLOR.accent, backgroundColor: COLOR.accent },
  chipText: { fontFamily: FONT.medium, fontSize: TYPE.note, color: COLOR.foreground },
  chipTextOn: { fontFamily: FONT.bold, color: COLOR.onAccent },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  comment: { minHeight: 88, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.cell, borderWidth: 1, borderColor: COLOR.border, backgroundColor: COLOR.surface, fontFamily: FONT.medium, fontSize: TYPE.field, lineHeight: 24, color: COLOR.foreground, textAlignVertical: 'top' },
  count: { textAlign: 'right', fontFamily: FONT.medium, fontSize: TYPE.fine, color: COLOR.secondary },
  warn: { fontFamily: FONT.medium, fontSize: TYPE.small, lineHeight: 20, color: COLOR.danger },
  frame: { padding: 0, overflow: 'hidden' },
  off: { opacity: BUTTON_OFF_OPACITY },
});
