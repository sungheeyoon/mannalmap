import { describe, expect, it } from 'vitest';

import { SIGNUP_AGE_LABEL, refusedField, signupRequest, signupSectionErrors } from './signup';

/** `complete_signup` 의 거절 문장(`20270111090000`) 그대로 — 칸을 고르는 말이 문장 안에 있는지 잰다 */
describe('가입 거절은 그 칸 곁에 선다', () => {
  it('닉네임 중복 · 길이는 닉네임 칸', () => {
    expect(refusedField('23505', '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.')).toBe('nickname');
    expect(refusedField('22023', '닉네임을 2~8자로 입력해 주세요.')).toBe('nickname');
  });

  it('가입 멈춤 · 정지 · 안내가 바뀜 · 알 수 없는 오류는 칸이 없다', () => {
    expect(refusedField('42501', '지금은 신규 가입을 잠시 멈췄어요. 나중에 다시 시도해 주세요.')).toBeNull();
    expect(refusedField('42501', '이용이 정지된 계정입니다.')).toBeNull();
    expect(refusedField('23514', '안내가 바뀌었어요. 새로고침한 뒤 다시 확인해 주세요.')).toBeNull();
    expect(refusedField(undefined, '요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.')).toBeNull();
  });

  it('옛 DB 가 코드를 묻는 거절도 칸이 없다 — 코드 칸은 걷었다(ADR 0225)', () => {
    expect(refusedField('22023', '테스트 코드를 넣어 주세요.')).toBeNull();
    expect(refusedField('42501', '사용할 수 없는 코드예요. 코드를 다시 확인해 주세요.')).toBeNull();
  });
});

describe('가입 폼은 걸린 문단을 다 말한다(ADR 0252)', () => {
  const filled = { nicknameGap: null, fourteen: true, acknowledged: true };
  const sections = (form: typeof filled | { nicknameGap: string; fourteen: boolean; acknowledged: boolean }) =>
    signupSectionErrors(form).map((one) => one.section);

  it('닉네임 → 만 14세 → 안내 확인 차례로 다 든다', () => {
    expect(sections({ nicknameGap: '닉네임', fourteen: false, acknowledged: false })).toEqual(['nickname', 'age', 'ack']);
    expect(sections({ ...filled, fourteen: false, acknowledged: false })).toEqual(['age', 'ack']);
    expect(signupSectionErrors({ ...filled, fourteen: false })[0].message).toBe(`‘${SIGNUP_AGE_LABEL}’에 표시해 주세요.`);
    expect(sections({ ...filled, acknowledged: false })).toEqual(['ack']);
    expect(signupSectionErrors(filled)).toEqual([]);
  });

  /* 「인터뷰 요청 받기」는 걷었다 — DB 는 그 인자를 받기만 하므로 안 보낸다(ADR 0245 추기, G-160) */
  it('코드 없이 나가고, 안 물은 칸은 null 로, 걷은 연락 동의는 안 나간다', () => {
    const args = signupRequest({ nickname: '', version: 'v', scheduleId: 1, improvement: false });
    expect(args).toEqual({ p_code: null, p_nickname: null, p_version: 'v', p_schedule_id: 1, p_improvement: false });
  });
});
