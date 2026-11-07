import { noticeEdition, type BetaDates, type Operator } from './notice';

/** 지금 안내 한 벌 — 날짜와 **누가 약속하는가**, 그리고 서버의 재확인 기준 */
export type BetaSchedule = {
  readonly scheduleId: number;
  readonly dates: BetaDates;
  readonly operator: Operator;
  /** 이 판본 이상을 확인했으면 다시 묻지 않는다 — 원본은 DB 의 `public.notice_ack_floor()`(ADR 0237) */
  readonly ackFloor: string;
};

/**
 * 일정 한 줄 — 이름은 이미 도메인의 말이다.
 *
 * DB 를 부르는 일은 문(웹 `app/beta-schedule.ts` · 앱 `mobile/src/auth/schedule.ts`)이 하고, snake_case 는 둘이 함께 쓰는
 * `scheduleOfDbRow` 가 옮긴다. 여기 남는 것은 **셋이 다 있어야 안내가 선다**는 규칙 하나다. 운영자 칸이 `string` 만이
 * 아닌 것은 그 규칙이 빈 값과 `undefined` 를 재기 때문이다.
 */
type ScheduleRow = {
  readonly scheduleId: number;
  readonly endsOn: string;
  readonly purgeBy: string;
  readonly purgeWithinDays: number;
  readonly operatorName: string | null | undefined;
  readonly operatorOfficer: string | null | undefined;
  readonly operatorContact: string | null | undefined;
  readonly ackFloor: string | null | undefined;
};

/**
 * 적힌 값인가 — **`null` 만 보면 안 된다.**
 *
 * 타입 단언 뒤에 `=== null` 만 보고 있었다. 그러면 빈 문자열과, 마이그레이션보다 앱이
 * 먼저 배포됐을 때의 `undefined` 가 그대로 지나간다 — 「연락처가 있다」로 판정되면서
 * 화면에는 아무것도 안 적히는 자리가 된다. 없는 것보다 나쁘다.
 */
const filled = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * 일정 한 줄을 안내로 — 날짜와 **누가 약속하는가**. 하나라도 없으면 `null`.
 *
 * `null` 을 「모른다」로 흘려보내지 않는다. 부르는 화면은 날짜를 못 받으면 안내를 세울
 * 수 없고, 그러면 스스로 「아직 시작할 수 없습니다」를 말한다(ADR 0024).
 */
export function scheduleOf(row: ScheduleRow): BetaSchedule | null {
  /*
    **셋이 다 있어야 안내가 선다.** 날짜만 있고 연락처가 없으면 열람·정정·삭제를
    어디에 요구하는지 말할 수 없다 — 지키는 것이 없는 문장만 남는다. 반쪽은 안 낸다.
  */
  const name = filled(row.operatorName);
  const officer = filled(row.operatorOfficer);
  const contact = filled(row.operatorContact);
  if (name === null || officer === null || contact === null) return null;

  /*
    **기준을 못 읽으면 안내를 세우지 않는다**(ADR 0237). 칸이 없는 것은 웹 · 앱이 마이그레이션보다 먼저 섰을 때다 — 그때 번들의 값으로
    갈음하면 서버가 기준을 든 까닭이 없다. 화면은 「아직 시작할 수 없습니다」를 말하고, 가입을 마친 사람만 관문을 지난다(`gateFor`).
  */
  const floor = filled(row.ackFloor);
  if (floor === null || noticeEdition(floor) === null) return null;

  return {
    scheduleId: row.scheduleId,
    dates: {
      endsOn: row.endsOn,
      purgeBy: row.purgeBy,
      purgeWithinDays: row.purgeWithinDays,
    },
    operator: { name, officer, contact },
    ackFloor: floor,
  };
}

/** `current_beta_schedule` 이 내주는 칸 가운데 읽는 다섯 — 칸 이름은 생성 타입과 같아야 문이 넘길 수 있다. 줄의 `operator_*` 칸은 안 읽는다 */
type ScheduleDbRow = {
  readonly schedule_id: number;
  readonly ends_on: string;
  readonly purge_by: string;
  readonly purge_within_days: number;
  /** 마이그레이션(`20270116090000`)보다 웹 · 앱이 먼저 서면 없다 */
  readonly notice_ack_floor?: string | null;
};

/**
 * `current_beta_schedule` 의 답을 안내로 — 웹과 앱의 문이 함께 쓴다. 줄이 없으면 `null` 이다(문이 성공했고 일정이 없다).
 *
 * 운영자는 줄이 아니라 부르는 쪽이 넘기는 상수 `PRIVACY_OPERATOR`(`src/lib/brand/business.ts`, ADR 0232)다 — `consent` 는 `brand` 를 부르지 않는다.
 */
export function scheduleOfDbRow(rows: readonly ScheduleDbRow[] | null, operator: Operator): BetaSchedule | null {
  const row = rows?.[0];
  if (row === undefined) return null;
  return scheduleOf({
    scheduleId: row.schedule_id,
    endsOn: row.ends_on,
    purgeBy: row.purge_by,
    purgeWithinDays: row.purge_within_days,
    operatorName: operator.name,
    operatorOfficer: operator.officer,
    operatorContact: operator.contact,
    ackFloor: row.notice_ack_floor,
  });
}
