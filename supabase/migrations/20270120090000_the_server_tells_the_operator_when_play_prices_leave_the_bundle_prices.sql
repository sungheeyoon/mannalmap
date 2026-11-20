-- Play 콘솔의 상품 가격이 묶음 가격과 다르거나 읽을 수 없으면 운영자가 이용자보다 먼저 안다 (G-166, ADR 0259 · ADR 0262)
--
-- 앱의 진열(`mobile/src/credits/shelf.ts` 의 `shelfOf`)은 Play 금액이 묶음 가격과 다르거나 같은지 모르는 묶음을 조용히 뺀다(ADR 0259).
-- 운영자는 그 묶음이 앱에서 안 보이는 것으로만 알았다. 날마다의 크론 `/api/cron/store-prices` 가 Android Publisher API 의 상품 목록
-- (`monetization.onetimeproducts.list`)에서 대한민국 가격을 읽어 묶음마다 같은 판정(`storePriceVerdict`, `src/lib/reading/store-products.ts`)으로
-- 견주고, 그 결과를 여기 문 둘로 넘긴다. **문은 알리기만 한다** — 진열 · 장부 · 판매 여닫음은 건드리지 않는다.
--
-- 1. `report_store_prices(p_differs, p_unknown)` — 가격이 다른 상품 · 같은지 모르는 상품(대한민국 가격 없음 · 원화 아님 · 판매 중 아님 · 목록에 없음)
-- 2. `report_store_prices_unread(p_status)` — 목록 자체를 못 읽었다(권한 없음 401 · 403, 그 밖의 HTTP 답, 못 닿음은 `null`)
--
-- **같은 내용은 7일에 한 번**(ADR 0262) — `notify_ops` 는 종류마다 하루 한 줄이다. 크론은 날마다 돌고 콘솔 가격 · 권한은 사람이 고칠 때까지
-- 그대로라, 하루 한 줄이면 같은 알림이 날마다 쌓인다. 종류에 상품 id(장수 차례) · HTTP 답을 실어, 어긋난 상품이 바뀌거나 늘면 그날 바로 새 알림이고
-- 같은 것이면 마지막 알림 뒤 7일이 지나야 다시 온다. 알림 줄(`ops_alert`)이 그 기억이다 — 새 표는 없다.
--
-- **열쇠(`service_role`)에만 연다**(`report_request_error` 와 같은 규율) — 로그인한 사람이 부를 수 있으면 알림함을 채울 수 있다. 상품 id 는 아는 넷만
-- 받는다(`store_product_credits`). 앱의 문이 아니므로 옛 앱에 안전하다(넓히기).
--
-- 재는 자리는 `supabase/tests/99_store_price_check.test.sql`.

/**
 * 같은 종류의 알림이 지난 7일(서울 날짜, 오늘 포함 7일) 안에 없을 때만 `notify_ops` 로 보낸다. 아무에게도 열지 않는다 — 위 두 문만 부른다.
 *
 * @returns 이번에 새로 적었으면 참
 */
create function public.notify_ops_weekly(p_kind text, p_detail text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ops_alert a
    where a.kind = p_kind
      and a.day > (now() at time zone 'Asia/Seoul')::date - 7
  ) then
    return false;
  end if;
  return public.notify_ops(p_kind, p_detail);
end;
$$;

/** 상품 id 들을 장수 차례로, 겹침 없이 — 알림 종류와 문장이 같은 내용에 같은 글자가 되게 */
create function public.store_products_in_order(p_ids text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(x.id, ',' order by public.store_product_credits(x.id))
  from (select distinct id from unnest(p_ids) as u(id)) x
$$;

/**
 * 가격 대조의 결과를 운영자에게 알린다 — 다른 것 · 모르는 것을 따로, 같은 내용은 7일에 한 번.
 *
 * @param p_differs Play 의 대한민국 가격이 묶음 가격과 다른 상품 id
 * @param p_unknown 같은지 모르는 상품 id — 대한민국 가격 없음 · 원화 아님 · 판매 중인 구매 옵션 없음 · 목록에 없음. 두 목록에 다 들면 「다름」에만 센다
 * @returns 이번에 보낸 알림 수(0 ~ 2)
 */
create function public.report_store_prices(p_differs text[], p_unknown text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  differs text;
  unknown text;
  sent integer := 0;
begin
  if p_differs is null or p_unknown is null then
    raise exception 'store-price: both lists are given, empty when none' using errcode = '22023';
  end if;

  if exists (select 1 from unnest(p_differs || p_unknown) as u(id) where id is null or public.store_product_credits(id) is null) then
    raise exception 'store-price: product ids are the four store products' using errcode = '22023';
  end if;

  differs := public.store_products_in_order(p_differs);
  unknown := public.store_products_in_order(array(select id from unnest(p_unknown) as u(id) where id <> all (p_differs)));

  if differs is not null and public.notify_ops_weekly(
       'store-price-differs:' || differs,
       format('Play 콘솔의 대한민국 가격이 묶음 가격과 다른 상품 — %s. 앱은 그 묶음을 진열에서 뺐다(ADR 0259). 콘솔 가격을 묶음 가격(%s)으로 되돌린다 — docs/ops/runbook/credits.md 「Google Play 결제」',
              differs,
              (select string_agg(id || ' ' || to_char(public.reading_bundle_price(public.store_product_credits(id)), 'FM999,999') || '원', ', '
                                 order by public.store_product_credits(id))
               from unnest(string_to_array(differs, ',')) as u(id))))
  then
    sent := sent + 1;
  end if;

  if unknown is not null and public.notify_ops_weekly(
       'store-price-unknown:' || unknown,
       format('Play 콘솔에서 묶음 가격과 같은지 모르는 상품 — %s(상품 없음 · 판매 중인 구매 옵션 없음 · 대한민국 가격 없음 · 원화 아님). 앱은 그 묶음을 진열에서 뺐다(ADR 0259). docs/ops/runbook/credits.md 「Google Play 결제」',
              unknown))
  then
    sent := sent + 1;
  end if;

  return sent;
end;
$$;

/**
 * 상품 목록을 못 읽었다고 알린다 — HTTP 답마다 7일에 한 번.
 *
 * @param p_status Google 이 돌려준 HTTP 답(100 ~ 599) — 401 · 403 은 서비스 계정의 권한, 못 닿았거나(시간 초과 · 토큰 못 받음) 답이 없으면 `null`
 * @returns 이번에 새로 적었으면 참
 */
create function public.report_store_prices_unread(p_status integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status is not null and (p_status < 100 or p_status > 599) then
    raise exception 'store-price: status is an HTTP status or null' using errcode = '22023';
  end if;

  return public.notify_ops_weekly(
    'store-price-unread:' || coalesce(p_status::text, 'none'),
    case
      when p_status in (401, 403) then format('Play 상품 목록을 못 읽었다(HTTP %s) — 결제 검증용 서비스 계정에 상품을 볼 권한이 없다 — Play Console 사용자 및 권한에서 그 계정의 「앱 정보 보기(읽기 전용)」를 본다. 그동안 콘솔 가격과 묶음 가격의 대조가 서지 않는다 — docs/ops/runbook/credits.md 「Google Play 결제」', p_status)
      when p_status is null then 'Play 상품 목록을 못 읽었다(답 없음 — 시간 초과 · 토큰 못 받음). 그동안 콘솔 가격과 묶음 가격의 대조가 서지 않는다 — docs/ops/runbook/credits.md 「Google Play 결제」'
      else format('Play 상품 목록을 못 읽었다(HTTP %s). 그동안 콘솔 가격과 묶음 가격의 대조가 서지 않는다 — docs/ops/runbook/credits.md 「Google Play 결제」', p_status)
    end);
end;
$$;

revoke execute on function public.notify_ops_weekly(text, text) from public, anon, authenticated, service_role;
revoke execute on function public.store_products_in_order(text[]) from public, anon, authenticated;
revoke execute on function public.report_store_prices(text[], text[]) from public, anon, authenticated;
revoke execute on function public.report_store_prices_unread(integer) from public, anon, authenticated;
grant execute on function public.report_store_prices(text[], text[]) to service_role;
grant execute on function public.report_store_prices_unread(integer) to service_role;
