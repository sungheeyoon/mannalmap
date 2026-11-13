import Link from 'next/link';
import { notFound } from 'next/navigation';

import { isBlocked, selfPersonIdOf } from '@/src/lib/account';
import { UNREADABLE_INPUT_NOTE } from '@/src/lib/input/stored';
import { chartTitleOf } from '@/src/lib/reading/person-screen';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { withCameFrom } from '../../../came-from';
import { choosableOf } from '../../../compat/choosable';
import { SajuResult } from '../../../saju/view';
import { BUTTON_TERTIARY } from '../../../ui/buttons';
import { Icon } from '../../../ui/icons';
import { COLUMN, TYPE_META, TYPE_TITLE } from '../../../ui/surfaces';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { readReadingCredits } from '../../credits/remaining';
import { myPeople } from '../../home/circle';
import { compatHrefOf, readingOf, selfReadingOf } from '../../home/map/model';
import { payloadForViewer } from '../../payload';
import { storedInputsOf } from '../../person-input';
import { currentReading, lastReadingRun, myReadings } from '../../reading/current';
import { readingMinutes } from '../../reading/essay';
import type { Partner } from './person-sheets';
import { PersonView, type PersonPair } from './person-view';

/** 풀이 생성은 응답 뒤에서 돈다 — 이 화면의 시트가 받기를 누른다(`app/me/(shelf)/readings/[subject]/page.tsx` 와 같은 값) */
export const maxDuration = 300;

export const metadata = {
  title: '사주 상세',
  description: '저장한 사람의 사주와 운의 흐름을 자세히 봅니다.',
};

/**
 * **저장한 사람 화면 — 한 장**(운영자 승인 2026-11-13, ADR 0248). 위에서부터 머리(일간 칩 · 이름 · 출생 한 줄 · 네 기둥 띠 ·
 * 「만세력 자세히」) → 사주풀이 칸 → 궁합 칸. 머리에 단추가 없고 탭도 없다 — 칸마다 「있으면 보기, 없으면 받기」 하나다.
 * 받기 · 궁합은 이 화면의 시트에서 끝난다(`person-sheets.tsx`). 만세력은 같은 주소의 다른 자리(`?tab=chart`)다 — 옛 링크가 그대로 산다.
 */
export default async function PersonSajuPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ from?: string | string[]; tab?: string | string[] }>;
}) {
  const supabase = await supabaseOnServer();
  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  /**
   * **못 읽은 것을 중지로 말하지 않는다**(ADR 0048).
   *
   * 여기는 `account?.status !== 'active'` 로 물어서, 계정을 못 읽었을 때도 「중지된
   * 계정입니다」를 세우고 있었다. `app_user` 의 select 정책은 `id = auth.uid()` 하나이고
   * `status` 를 안 보므로 — 정지된 계정도 자기 행을 읽는다 — 그 말은 참일 수가 없었다.
   */
  const { state, row: account } = await readAccount(supabase, ['status', 'self_person_id', 'nickname']);
  if (isBlocked(state)) {
    return (
      <main className={`app-shell flex ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
        <AccountNotice state={state} />
      </main>
    );
  }

  const { personId } = await params;
  const view = await payloadForViewer(personId);
  if (view === null) notFound();

  /**
   * 못 읽는 입력은 **메우지 않는다** — 저장된 값은 그대로 있고 읽는 쪽이 못 읽는 것이다.
   *
   * 앞서는 이 자리가 `instanceof` 로 예외를 받았다. 받는 것을 잊으면 500 이 되는 모양이라
   * 문이 값으로 내주는 쪽으로 옮겼다(`PersonView`).
   */
  if (view.kind === 'unreadable-input') {
    return (
      <main className={`app-shell flex ${COLUMN} flex-1 flex-col gap-6 py-8 sm:py-12`}>
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5 sm:p-6">
          <p className="text-body">{view.message}</p>
          <p className={TYPE_META}>{UNREADABLE_INPUT_NOTE}</p>
        </section>
      </main>
    );
  }

  const person = view.payload;

  /**
   * 내 명식이면 풀이 칸은 내 사주풀이다 · 궁합 칸은 빠진다.
   *
   * **주소에 적힌 글자가 아니라 `person.personId` 로 견준다.** uuid 비교는 대소문자를
   * 안 가려서 대문자로 적은 주소도 조회를 지나가는데, 문자열 비교는 가린다. 그 둘이
   * 갈리는 순간 이 값이 거짓이 되고 화면은 못 만드는 버튼을 세운다 — DB 는 거절하므로
   * 안전은 지켜지지만, 「못 만드는 버튼을 안 보여 준다」는 약속이 깨진다.
   */
  const selfPersonId = selfPersonIdOf(state);
  const mine = selfPersonId === person.personId;
  const query = await searchParams;
  /* 홈의 줄(`?from=me`)이나 내 사주에서 왔으면 ← 홈, 저장한 사람 목록에서 왔으면 ← 저장한 사람 */
  const fromHome = mine || query.from === 'me';
  const here = `/me/people/${person.personId}${fromHome && !mine ? '?from=me' : ''}`;

  /*
    **만세력 화면** — 머리의 「만세력 자세히」가 여는 같은 주소의 다른 자리(`?tab=chart`). 지금까지 「만세력」 탭에 있던 것 그대로다.
    ← 는 이 사람 화면이다. 홈 카드의 「만세력 보기」(내 명식, `from=me`)로 왔으면 ← 홈
  */
  if (query.tab === 'chart') {
    const backHome = mine && query.from === 'me';
    return (
      <main className={`app-shell flex ${COLUMN} flex-1 flex-col gap-5 py-8 sm:gap-6 sm:py-12`}>
        <Link href={backHome ? '/me' : here} className={`${BUTTON_TERTIARY} self-start`}>
          <Icon name="back" className="size-4" />
          {backHome ? '홈' : person.name}
        </Link>
        <h1 className={`break-keep [overflow-wrap:anywhere] ${TYPE_TITLE}`}>{chartTitleOf(person.name)}</h1>
        <SajuResult saju={person.saju} />
      </main>
    );
  }

  const target = mine ? ({ kind: 'self' } as const) : ({ kind: 'person', personId: person.personId } as const);
  const readingHref = mine ? '/me/readings/self' : `/me/readings/${person.personId}`;

  /*
    **이 사람에게서 받은 것** — 이 사람의 사주풀이와 이 사람이 들어간 궁합풀이. 목록 문(`my_readings`)이 홈과 같은 값을 준다. 못 읽으면
    「받기」로 선다 — 그 화면이 다시 읽어 맞는 글을 세운다(부속 정보, ADR 0078). 글 · 마지막 시도 · 풀이권은 받기 시트가 쓴다
  */
  const [readings, reading, run, credits, people] = await Promise.all([
    myReadings().catch(() => [] as const),
    currentReading(target).catch(() => null),
    lastReadingRun(target).catch(() => null),
    readReadingCredits(supabase),
    mine ? null : myPeople(supabase),
  ]);
  const own = mine ? selfReadingOf(readings) : readingOf(readings, person.personId);
  const making = own === null && run?.status === 'running';

  /*
    **이 사람이 들어간 궁합풀이 전부**(2026-10-26 운영자) — 나와의 것만이 아니다. 최근 순. 줄은 상대 이름(내 자리는 닉네임) · 비유 · 점수.
    누르면 그 궁합이고 ← 가 이 사람 화면이다(`from=person`)
  */
  const nickname = account?.nickname?.trim() || '나';
  const backHere = (href: string) => `${withCameFrom(href, 'person')}&p=${person.personId}`;
  const pairs: PersonPair[] = mine
    ? []
    : readings
        .filter((entry) => entry.kind === 'private' && (entry.personA === person.personId || entry.personB === person.personId))
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((entry) => {
          const first = entry.personA === person.personId;
          const other = first ? entry.personB : entry.personA;
          return {
            key: `${entry.personA}:${entry.personB}`,
            other,
            name: other === selfPersonId ? nickname : ((first ? entry.labelB : entry.labelA) ?? ''),
            stems: [person.saju.pillars.dayMaster, first ? entry.dayMasterB : entry.dayMasterA] as const,
            score: entry.score,
            metaphor: entry.metaphor,
            href: backHere(compatHrefOf(entry, selfPersonId, person.personId)),
          };
        });

  /* 상대 고르기 시트의 사람들 — 궁합 탭의 고르는 칸과 같은 사람 · 같은 차례(`choosableOf`), 이 사람만 빠진다 */
  let partners: Partner[] = [];
  if (people !== null) {
    const listed = people.listed.filter((edge) => edge.personId !== person.personId);
    const ids = listed.map((edge) => edge.personId);
    const stored = await storedInputsOf(supabase, ids).catch(() => new Map());
    partners = choosableOf(listed, stored, selfPersonId).map((one) => ({
      ...one,
      seenHref: pairs.find((pair) => pair.other === one.personId)?.href ?? null,
    }));
  }

  return (
    <PersonView
      person={person}
      mine={mine}
      fromHome={fromHome}
      own={own}
      minutes={reading === null ? null : readingMinutes(reading.output)}
      making={making}
      target={target}
      readingHref={readingHref}
      credits={credits.ok ? credits.value : null}
      pairs={pairs}
      partners={partners}
    />
  );
}
