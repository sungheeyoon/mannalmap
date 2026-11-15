'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

import {
  NOTICE_ACK_LABEL,
  NOTICE_ACK_NOTE,
  OPTIONAL_CONSENTS,
  OPTIONAL_CONSENT_NOTE,
  SIGNUP_AGE_LABEL,
  SIGNUP_LABEL,
  SIGNUP_NOTICE_DISCOVERY,
  SIGNUP_NOTICE_KEEP,
  SIGNUP_NOTICE_USE,
  signupSectionErrors,
  type SignupField,
} from '@/src/lib/consent';
import {
  NICKNAME_AVAILABLE_NOTE,
  NICKNAME_MAX,
  NICKNAME_MIN,
  NICKNAME_TAKEN_NOTE,
  missingNickname,
  nicknameKey,
} from '@/src/lib/profile';

import { checkNickname } from '../nickname';
import { BUTTON_PRIMARY, BUTTON_SECONDARY_SMALL_FACE } from '../ui/buttons';
import { completeSignup } from './actions';
import { actionAnswer } from '../ui/action-answer';
import { FIELD as FIELD_BASE } from '../ui/fields';
import { FAILURE_TEXT, FailureLine } from '../ui/failure-line';
import { INVALID_RING, SectionErrorLine, useSectionErrors } from '../ui/section-error';

/** 입력 칸 — 프로필 화면과 같은 칸(`app/ui/fields.ts`)에, 거절된 칸은 테가 붉다(2px, ADR 0252) */
const FIELD = `${FIELD_BASE} ${INVALID_RING}`;

/**
 * 확인 상자 한 줄 — 줄 전체가 누를 자리이고, 고르면 먹색 테와 크림 면이 선다(상자도 그대로 남는다). 초점 테는 전역 초점 테두리와
 * 같은 섞음(accent 55%, `globals.css`)이다 — `accent-soft` 는 크림 바탕에서 거의 안 보였다
 */
const BOX =
  'flex cursor-pointer gap-3 rounded-cell border border-border bg-surface p-4 hover:border-border-strong has-checked:border-foreground has-checked:bg-cream has-[[aria-invalid=true]]:border-danger has-[[aria-invalid=true]]:shadow-[0_0_0_1px_var(--danger)] has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color-mix(in_srgb,var(--accent)_55%,transparent)]';

const LABEL = 'text-body font-semibold';

/**
 * 가입 폼 — **한 번 눌러 셋을 적는다** (ADR 0042).
 *
 * 이름 · 안내 확인 · 선택 답이 한 요청으로 나간다. 갈라 보내면 그 사이에서 멈춘 계정이
 * 생기고, 관문이 그런 사람을 어디로 보낼지 다시 정해야 한다 — 그 자리를 없애려고 폼을
 * 합친 것이다.
 *
 * ## 이름 칸은 **없을 때만 선다**
 *
 * 안내가 새 판본이 되면 이미 가입한 사람도 이 화면으로 돌아온다. 그 사람에게 남는 것은 확인 하나다.
 * 테스트 코드 칸은 걷었다 — 가입은 코드를 묻지 않는다(ADR 0225).
 *
 * ## 사진과 소개는 여기 없다
 *
 * 필수가 아닌 것을 첫 화면에 세우면 사용자는 그것도 채워야 하는 줄 안다. 둘 다 프로필
 * 화면에 그대로 있고, 언제든 채울 수 있다(PRD 「이름과 얼굴」).
 */
export function SignupForm({
  returnTo,
  firstSignup,
  needsName,
  version,
  scheduleId,
}: {
  /** 가입을 마치고 갈 곳 — 관문이 `next` 로 들려 보낸 목적지(ADR 0128) */
  returnTo: string;
  /** 처음 가입하는가 — 아니면 바뀐 안내를 다시 확인하는 사람이다(단추의 글자가 갈린다) */
  firstSignup: boolean;
  needsName: boolean;
  version: string;
  scheduleId: number;
}) {
  const [nickname, setNickname] = useState('');
  const [fourteen, setFourteen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [chosen, setChosen] = useState<Record<string, boolean>>({ improvement: false });
  /** 서버의 거절 — 어느 칸의 것인지 알면 그 칸 곁에, 모르면 단추 곁에 선다(`refusedField`) */
  const [failure, setFailure] = useState<{ message: string; field: SignupField | null } | null>(null);
  const [working, startWorking] = useTransition();

  /** 마지막으로 확인한 이름과 그 답 — 칸이 바뀌면 답이 이 이름을 안 가리키므로 지운다 */
  const [checked, setChecked] = useState<{ key: string; available: boolean } | null>(null);
  const [checking, startChecking] = useTransition();

  const missing = needsName ? missingNickname(nickname) : null;
  const answer = checked?.key === nicknameKey(nickname) ? checked : null;

  /*
    **단추를 잠그지 않고, 누르면 거절한다** — 내 사주 등록(`app/saju-calculator.tsx`)과 같은 방식이다. 잠근 단추 옆에
    닉네임 규칙만 서 있어, 코드가 비었거나 확인을 안 한 사람은 왜 안 눌리는지 몰랐다(2026-10-09 화면 점검).
    눌렀을 때 **걸린 문단마다 그 아래 한 줄**을 세우고 맨 위 붉은 칸으로 초점을 옮긴다. 그 문단을 고치면 그 줄만 걷힌다(ADR 0252).
  */
  const form = useRef<HTMLFormElement>(null);
  const nicknameField = useRef<HTMLInputElement>(null);
  const sections = useSectionErrors(signupSectionErrors({ nicknameGap: missing, fourteen, acknowledged }), form);
  /** 「중복 확인」을 눌렀는데 닉네임이 규칙에 안 맞았나 — 그 말이 닉네임 문단 아래에 선다(누른 뒤의 줄과 같은 자리 · 같은 말) */
  const [checkTried, setCheckTried] = useState(false);
  const refusedHere = (field: SignupField) => failure !== null && failure.field === field;
  const nicknameLine = sections.shown.nickname ?? (checkTried ? missing : null);
  const invalid = (field: 'nickname' | 'age' | 'ack') =>
    sections.shown[field] !== undefined || (field === 'nickname' && nicknameLine !== null)
      ? { 'aria-invalid': true, 'aria-describedby': `signup-${field}-line` }
      : field === 'nickname' && refusedHere(field)
        ? { 'aria-invalid': true, 'aria-describedby': `signup-${field}-refused` }
        : {};

  /**
   * **「중복 확인」도 잠그지 않는다** — 닉네임이 규칙에 안 맞으면 누른 그때 그 칸 아래에 말하고 칸으로 초점을 옮긴다
   * (`docs/context/copy.md` §8 「거절은 누른 뒤에 말한다」, ADR 0160). 잠가 두면 왜 안 눌리는지를 묻게 된다.
   */
  const check = () => {
    if (missing !== null) {
      setCheckTried(true);
      nicknameField.current?.focus();
      return;
    }
    setCheckTried(false);
    setFailure(null);
    startChecking(async () => {
      const result = await actionAnswer(checkNickname(nickname));
      if (result.ok) setChecked({ key: nicknameKey(nickname), available: result.available });
      else setFailure({ message: result.message, field: 'nickname' });
    });
  };

  const send = () => {
    setFailure(null);
    if (!sections.press()) return;
    startWorking(async () => {
      /*
        **성공하면 이 줄 아래로 안 온다.** 서버 액션이 스스로 목적지로 보낸다 — 여기서
        보내면 관문이 한 번 더 튕기고, 그 두 번째 튕김이 화면을 비운다.
      */
      const failed = await actionAnswer(
        completeSignup({
          returnTo,
          nickname,
          version,
          /* 이 사람이 **본 안내의 줄**이다. 그 사이에 바뀌었으면 DB 가 거절한다 */
          scheduleId,
          improvement: chosen.improvement === true,
        }),
      );

      const field = 'field' in failed ? failed.field : null;
      setFailure({ message: failed.message, field });
      if (field !== null) nicknameField.current?.focus();
    });
  };

  return (
    /* 폼이다 — 칸에서 Enter · 자판의 「이동」이 곧 가입이다. 「중복 확인」은 제출이 아니다(`type="button"`) */
    <form
      ref={form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!working) send();
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      {needsName && (
        <div className="flex flex-col gap-1.5">
          {/*
            **버튼을 라벨 밖에 둔다.** 안에 넣으면 `<label>` 이 칸과 버튼 둘을 함께 물고,
            읽어 주는 도구가 「닉네임」을 어느 것의 이름으로 부를지 사람마다 달라진다.
          */}
          <label htmlFor="signup-nickname" className={LABEL}>
            {SIGNUP_LABEL.nickname}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="signup-nickname"
              ref={nicknameField}
              {...invalid('nickname')}
              type="text"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value.slice(0, NICKNAME_MAX));
                sections.edit('nickname');
                setCheckTried(false);
                if (failure?.field === 'nickname') setFailure(null);
              }}
              maxLength={NICKNAME_MAX}
              /* 닉네임은 낱말이 아니다 — 자판이 고치거나 첫 글자를 키우거나 밑줄을 긋지 않게 */
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
              className={`${FIELD} min-w-0 flex-1 sm:max-w-64`}
            />
            <button
              type="button"
              onClick={check}
              disabled={checking}
              aria-disabled={missing !== null || undefined}
              className={`${BUTTON_SECONDARY_SMALL_FACE} min-h-12 shrink-0 px-4`}
            >
              {checking ? SIGNUP_LABEL.checking : SIGNUP_LABEL.check}
            </button>
          </div>

          {/*
            **확인 결과는 그 이름에 붙는다.** 칸을 고치면 사라진다 — 「쓸 수 있습니다」가
            이미 바뀐 이름 옆에 남아 있으면 그 말이 무엇을 가리키는지 알 수 없다.
          */}
          <p
            role="status"
            className={`text-sm empty:hidden ${answer === null || answer.available ? 'text-secondary' : 'text-danger'}`}
          >
            {answer === null ? '' : answer.available ? NICKNAME_AVAILABLE_NOTE : NICKNAME_TAKEN_NOTE}
          </p>
          <SectionErrorLine id="signup-nickname-line" message={nicknameLine} className="mt-0.5" />
          {refusedHere('nickname') && (
            <p id="signup-nickname-refused" role="alert" className={`${FAILURE_TEXT} font-medium`}>
              {failure?.message}
            </p>
          )}

          <p className="text-small leading-5 text-muted">{SIGNUP_LABEL.nicknameNote}</p>
        </div>
      )}

      <div className="rounded-card bg-surface-sunken p-4 sm:p-5" aria-labelledby="signup-notice">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <h2 id="signup-notice" className="text-body font-bold">
            {SIGNUP_LABEL.noticeHead}
          </h2>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center text-small font-semibold text-foreground hover:opacity-70 active:opacity-55"
          >
            {SIGNUP_LABEL.privacy}
          </Link>
        </div>
        <ul className="mt-1 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6 text-secondary marker:text-muted">
          <li>{SIGNUP_NOTICE_USE}</li>
          <li>{SIGNUP_NOTICE_KEEP}</li>
          <li>{SIGNUP_NOTICE_DISCOVERY}</li>
        </ul>
      </div>

      {/* 만 14세 이상 — 필수 확인(ADR 0231). 나이를 재지 않고 스스로 밝힌다 */}
      <label htmlFor="signup-age" className={BOX}>
        <input
          type="checkbox"
          id="signup-age"
          {...invalid('age')}
          checked={fourteen}
          onChange={(event) => {
            setFourteen(event.target.checked);
            sections.edit('age');
          }}
          className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
        />
        <span className="block text-sm font-semibold">{SIGNUP_AGE_LABEL}</span>
      </label>
      <SectionErrorLine id="signup-age-line" message={sections.shown.age} className="-mt-4" />

      <label htmlFor="notice-ack" className={BOX}>
        <input
          type="checkbox"
          id="notice-ack"
          {...invalid('ack')}
          checked={acknowledged}
          onChange={(event) => {
            setAcknowledged(event.target.checked);
            sections.edit('ack');
          }}
          className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
        />
        <span>
          <span className="block text-sm font-semibold">{NOTICE_ACK_LABEL}</span>
          <span className="mt-1 block text-sm leading-6 text-secondary">{NOTICE_ACK_NOTE}</span>
        </span>
      </label>
      <SectionErrorLine id="signup-ack-line" message={sections.shown.ack} className="-mt-4" />

      {/*
        **기본값은 꺼짐이다.** 미리 켜 두면 고른 것이 아니라 안 끈 것이 되고, 그것을
        동의라고 부를 수 없다.
      */}
      <fieldset className="flex flex-col gap-3">
        <legend className={`float-left w-full ${LABEL}`}>{SIGNUP_LABEL.optional}</legend>
        <p className="text-small leading-5 text-secondary">{OPTIONAL_CONSENT_NOTE}</p>

        {OPTIONAL_CONSENTS.map((one) => (
          <label key={one.key} htmlFor={`consent-${one.key}`} className={BOX}>
            <input
              type="checkbox"
              id={`consent-${one.key}`}
              checked={chosen[one.key] === true}
              onChange={(event) =>
                setChosen((current) => ({ ...current, [one.key]: event.target.checked }))
              }
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-semibold">{one.label}</span>
              <span className="mt-1 block text-sm leading-6 text-secondary">{one.detail}</span>
              {/* 끄면 어떻게 되는지는 **켜기 전에도** 읽힌다 — 세 화면이 같은 줄을 쓴다 */}
              <span className="mt-1 block text-small leading-5 text-muted">{one.erasure}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* 칸을 모르는 거절(안내가 바뀜 · 테스트가 끝남 등)만 여기 — 칸의 거절은 그 칸 아래에 선다 */}
      {failure !== null && failure.field === null && (
        <FailureLine>{failure.message}</FailureLine>
      )}

      <div className="border-t border-border pt-5">
        {/* 폰에서는 단추가 폭을 채운다. 칸의 오류는 그 문단 아래에 선다(ADR 0252) — 칸을 모르는 서버 거절은 위 `FailureLine` 이다 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="submit"
            disabled={working}
            className={BUTTON_PRIMARY}
          >
            {working ? SIGNUP_LABEL.signingUp : firstSignup ? SIGNUP_LABEL.signUp : SIGNUP_LABEL.confirm}
          </button>
        </div>
      </div>
    </form>
  );
}
