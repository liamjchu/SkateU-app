-- Durable waitlist rate limits for the landing-page subscribe route.
-- consume_waitlist_rate_limit() locks keys in sorted order, increments in one
-- transaction, and deletes expired rows so limits are shared across instances.

create table if not exists public.waitlist_rate_limits (
    limiter_key text primary key,
    request_count integer not null check (request_count > 0),
    reset_at timestamptz not null
);

create index if not exists waitlist_rate_limits_reset_at_idx
    on public.waitlist_rate_limits (reset_at);

comment on table public.waitlist_rate_limits is
'Shared waitlist rate-limit buckets. Written only through consume_waitlist_rate_limit().';

alter table public.waitlist_rate_limits enable row level security;

revoke all on table public.waitlist_rate_limits from public;
revoke all on table public.waitlist_rate_limits from anon;
revoke all on table public.waitlist_rate_limits from authenticated;

create or replace function public.consume_waitlist_rate_limit(
    p_keys text[],
    p_max_requests integer,
    p_window_ms integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_now timestamptz := clock_timestamp();
    v_window interval;
    v_key text;
    v_count integer;
    v_reset_at timestamptz;
    v_retry_after integer := 0;
    v_key_retry integer;
begin
    if p_keys is null or cardinality(p_keys) = 0 then
        raise exception 'Rate limit keys are required'
            using errcode = '22023';
    end if;

    if p_max_requests is null or p_max_requests <= 0
       or p_window_ms is null or p_window_ms <= 0
    then
        raise exception 'Rate limit window is invalid'
            using errcode = '22023';
    end if;

    v_window := make_interval(secs => p_window_ms::double precision / 1000.0);

    delete from public.waitlist_rate_limits
    where reset_at <= v_now;

    for v_key in
        select distinct trim(key_value) as limiter_key
        from unnest(p_keys) as key_value
        where trim(key_value) <> ''
        order by 1
    loop
        loop
            select request_count, reset_at
            into v_count, v_reset_at
            from public.waitlist_rate_limits
            where limiter_key = v_key
            for update;

            if not found then
                begin
                    insert into public.waitlist_rate_limits (
                        limiter_key,
                        request_count,
                        reset_at
                    )
                    values (v_key, 1, v_now + v_window);
                    exit;
                exception
                    when unique_violation then
                        continue;
                end;
            end if;

            if v_reset_at <= v_now then
                update public.waitlist_rate_limits
                set
                    request_count = 1,
                    reset_at = v_now + v_window
                where limiter_key = v_key;
                exit;
            end if;

            if v_count >= p_max_requests then
                v_key_retry := greatest(
                    1,
                    ceil(extract(epoch from (v_reset_at - v_now)))::integer
                );
                if v_key_retry > v_retry_after then
                    v_retry_after := v_key_retry;
                end if;
                exit;
            end if;

            update public.waitlist_rate_limits
            set request_count = v_count + 1
            where limiter_key = v_key;
            exit;
        end loop;
    end loop;

    return v_retry_after;
end;
$$;

comment on function public.consume_waitlist_rate_limit(text[], integer, integer) is
'Atomically consumes waitlist rate-limit keys. Returns Retry-After seconds, or 0 when allowed. Deletes expired buckets.';

revoke all on function public.consume_waitlist_rate_limit(text[], integer, integer) from public;
revoke all on function public.consume_waitlist_rate_limit(text[], integer, integer) from anon;
revoke all on function public.consume_waitlist_rate_limit(text[], integer, integer) from authenticated;
grant execute on function public.consume_waitlist_rate_limit(text[], integer, integer) to service_role;
