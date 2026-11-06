-- 구매 제한이 걸린 채 떠난 로그인의 기록을 1년 두고, 같은 로그인이 가입을 마치면 제한이 이어진다
-- (`20270114100000`, ADR 0230 추기 B)
--
--   1. **남는 것** — 제한된 채 지워지면 로그인 · 갈래 · 운영자 · 무효 요약이 남고, 풀린 제한은 안 남는다. 앱 역할은 못 읽는다
--   2. **이어지는 것** — 같은 이메일(대소문자 무시) · 같은 구글 계정이 가입을 마치면 제한이 걸린다. 풀렸던 이는 그대로다
--   3. **1년** — 처분일부터 1년이 지난 기록은 잇지 않고 크론 함수가 지운다. 1년 안의 기록은 남고, 크론은 매일 05:13 UTC 에 돈다
begin;
select plan(15);

create or replace function pg_temp.grant(who uuid, product text, token text, order_no text)
returns text language sql as $$
  select g.outcome from public.grant_store_purchase(who, 'google_play', product, token, order_no, now(), false) g;
$$;

create or replace function pg_temp.void(token text, order_no text)
returns text language sql as $$
  select v.outcome || ':' || v.credits_revoked || ':' || v.credits_kept
  from public.void_store_purchase('google_play', token, order_no, 'notification', 1, 0, 1, now()) v;
$$;

create temporary table folks as
select
  tests.signup('keep-restricted@example.com') as restricted,
  tests.signup('keep-lifted@example.com') as lifted,
  tests.signup('keep-op@example.com') as op;
grant select on folks to authenticated, service_role;

insert into public.operator (user_id, note) values ((select op from folks), '시험 — 구매 제한 보존');

-- ── 1. 남는 것 · 이어지는 것 · 1년 ─────────────────────────────────────────────────

set local role service_role;
select pg_temp.grant((select restricted from folks), 'reading_credits_1', 'tok-r', 'GPA.3000-0000-0000-0000R');
select pg_temp.void('tok-r', 'GPA.3000-0000-0000-0000R');
reset role;

select set_store_purchase_restriction(f.op, f.restricted, 'restrict', 'refund_abuse', '환불 반복 — 검토함', gen_random_uuid()) from folks f;
select set_store_purchase_restriction(f.op, f.lifted, 'restrict', 'other', '시험 — 풀 제한', gen_random_uuid()) from folks f;
select set_store_purchase_restriction(f.op, f.lifted, 'lift', 'mistake', '시험 — 잘못 제한', gen_random_uuid()) from folks f;

insert into auth.identities (provider_id, user_id, identity_data, provider)
select 'google-sub-restricted', f.restricted, jsonb_build_object('sub', 'google-sub-restricted'), 'google' from folks f;

delete from auth.users where id in (select restricted from folks union all select lifted from folks);

select is(
  (select r.email || ':' || r.reason || ':' || (r.restricted_by = f.op)::text || ':' || jsonb_array_length(r.voids)
   from retention.store_purchase_restriction r, folks f where r.identities @> array['google:google-sub-restricted']),
  'keep-restricted@example.com:refund_abuse:true:1', '제한된 채 지워지면 로그인 · 갈래 · 운영자 · 무효 이력이 남는다');
select is(
  (select (r.voids -> 0 ->> 'credits_revoked') || ':' || (r.voids -> 0 ->> 'voided_reason') || ':'
          || (select string_agg(k, ',' order by k) from jsonb_object_keys(r.voids -> 0) k)
   from retention.store_purchase_restriction r where r.email = 'keep-restricted@example.com'),
  '1:1:credits_kept,credits_revoked,refund_type,voided_at,voided_reason,voided_source',
  '근거는 무효의 요약만 — 시각 · Google 의 갈래 · 회수한 장수 · 남긴 장수, 금액 · 주문 · 메모는 없다');
select is(
  (select count(*)::integer from retention.store_purchase_restriction r where r.email = 'keep-lifted@example.com'), 0,
  '풀린 제한은 남지 않는다');
select ok(
  not has_table_privilege('authenticated', 'retention.store_purchase_restriction', 'SELECT')
  and not has_table_privilege('service_role', 'retention.store_purchase_restriction', 'SELECT'),
  '앱 역할은 보관 기록을 못 읽는다');

create temporary table comers as
select
  tests.signup_raw('Keep-Restricted@Example.com') as same_mail,
  tests.signup_raw('keep-other-mail@example.com') as same_login,
  tests.signup_raw('keep-lifted@example.com') as was_lifted;
insert into auth.identities (provider_id, user_id, identity_data, provider)
select 'google-sub-restricted', c.same_login, jsonb_build_object('sub', 'google-sub-restricted'), 'google' from comers c;
grant select on comers to service_role;

set local role service_role;
select is(public.store_purchase_refusal((select same_mail from comers)), 'open', '가입을 마치기 전에는 제한을 잇지 않는다');
reset role;

update public.app_user set nickname = '같은메일', signed_up_at = now() where id = (select same_mail from comers);
update public.app_user set nickname = '같은로그인', signed_up_at = now() where id = (select same_login from comers);
update public.app_user set nickname = '풀렸던이', signed_up_at = now() where id = (select was_lifted from comers);

set local role service_role;
select is(public.store_purchase_refusal((select same_mail from comers)), 'restricted', '같은 이메일(대소문자 무시)로 가입을 마치면 제한이 이어진다');
select is(public.store_purchase_refusal((select same_login from comers)), 'restricted', '이메일이 달라도 같은 구글 계정이면 이어진다');
select is(public.store_purchase_refusal((select was_lifted from comers)), 'open', '제한이 풀린 채 떠난 사람은 그대로다');
select is(pg_temp.grant((select same_mail from comers), 'reading_credits_1', 'tok-again', 'GPA.3000-0000-0000-000RR'),
  'restricted', '이어진 제한도 지급하지 않는다');
reset role;

select is(
  (select r.reason || ':' || (r.actor_user_id = f.op)::text || ':' || (r.note like '탈퇴 전 계정의 구매 제한을 이었다%')::text
   from public.store_purchase_restriction r, folks f where r.user_id = (select same_mail from comers)),
  'refund_abuse:true:true', '이은 제한은 앞 제한의 갈래 · 운영자로 이력에 적힌다');
select is(
  (select count(*)::integer from public.ops_alert a where a.kind like 'store-restriction-carried:%'), 2,
  '제한을 이으면 운영자에게 한 줄씩 간다');

insert into retention.store_purchase_restriction (email, reason, restricted_at, retained_at)
values ('keep-recent@example.com', 'other', now() - interval '30 days', now() - interval '364 days');
update retention.store_purchase_restriction set retained_at = now() - interval '1 year 1 day'
where email = 'keep-restricted@example.com';
create temporary table late as select tests.signup_raw('keep-restricted@example.com') as comer;
grant select on late to service_role;
update public.app_user set nickname = '일년뒤', signed_up_at = now() where id = (select comer from late);
set local role service_role;
select is(public.store_purchase_refusal((select comer from late)), 'open', '처분일부터 1년이 지난 기록은 제한을 잇지 않는다');
reset role;
select is(retention.purge_expired_store_restrictions(), 1, '크론 함수가 1년 지난 기록만 지운다');
select is(
  (select array_agg(r.email order by r.email) from retention.store_purchase_restriction r),
  array['keep-recent@example.com'], '1년이 안 된 기록은 남는다');

select is(
  (select schedule from cron.job where jobname = 'store-restriction-retention-purge'),
  '13 5 * * *', '크론이 매일 05:13 UTC 에 돈다');

select * from finish();
rollback;
