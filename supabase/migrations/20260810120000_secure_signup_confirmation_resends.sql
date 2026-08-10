-- Enforce signup-confirmation resend cooldowns away from the client.
-- Only a one-way SHA-256 email digest is retained, and expired records are
-- pruned during claims. Direct access is denied to all client roles.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.signup_confirmation_resend_cooldowns (
    email_hash text primary key,
    next_allowed_at timestamptz not null,
    created_at timestamptz not null default now(),
    constraint signup_confirmation_resend_cooldowns_email_hash_check
        check (email_hash ~ '^[a-f0-9]{64}$')
);

alter table private.signup_confirmation_resend_cooldowns enable row level security;
revoke all on table private.signup_confirmation_resend_cooldowns from public;
revoke all on table private.signup_confirmation_resend_cooldowns from anon;
revoke all on table private.signup_confirmation_resend_cooldowns from authenticated;

create index if not exists signup_confirmation_resend_cooldowns_expiry_idx
    on private.signup_confirmation_resend_cooldowns (next_allowed_at);

create or replace function public.claim_signup_confirmation_resend(
    p_email text,
    p_email_hash text,
    p_cooldown_seconds integer default 60
)
returns integer
language plpgsql
security definer
set search_path = private, pg_temp
as $$
declare
    v_auth_next_allowed_at timestamptz;
    v_retry_after_seconds integer;
begin
    if p_email is null
       or char_length(trim(p_email)) = 0
       or char_length(trim(p_email)) > 254
       or trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then
        raise exception 'Invalid email address' using errcode = '22023';
    end if;

    if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' then
        raise exception 'Invalid email hash' using errcode = '22023';
    end if;

    if p_cooldown_seconds is null
       or p_cooldown_seconds < 1
       or p_cooldown_seconds > 3600 then
        raise exception 'Invalid cooldown duration' using errcode = '22023';
    end if;

    -- Supabase Auth creates the original confirmation email. Respect its
    -- server-side timestamp too, so reopening the client cannot bypass the
    -- first cooldown before this function has recorded a resend.
    select confirmation_sent_at + make_interval(secs => p_cooldown_seconds)
    into v_auth_next_allowed_at
    from auth.users
    where lower(email) = lower(trim(p_email));

    if v_auth_next_allowed_at > statement_timestamp() then
        insert into private.signup_confirmation_resend_cooldowns (
            email_hash,
            next_allowed_at
        )
        values (p_email_hash, v_auth_next_allowed_at)
        on conflict (email_hash) do update
        set next_allowed_at = greatest(
            private.signup_confirmation_resend_cooldowns.next_allowed_at,
            excluded.next_allowed_at
        )
        returning next_allowed_at into v_auth_next_allowed_at;

        return greatest(
            1,
            ceil(
                extract(epoch from v_auth_next_allowed_at - statement_timestamp())
            )::integer
        );
    end if;

    -- Retain only active/recent rate-limit state, never raw addresses.
    delete from private.signup_confirmation_resend_cooldowns
    where next_allowed_at < statement_timestamp() - interval '1 day';

    -- The unique key and conditional upsert make concurrent requests atomic:
    -- exactly one caller receives 0 and may dispatch a new email.
    insert into private.signup_confirmation_resend_cooldowns (
        email_hash,
        next_allowed_at
    )
    values (
        p_email_hash,
        statement_timestamp() + make_interval(secs => p_cooldown_seconds)
    )
    on conflict (email_hash) do update
    set next_allowed_at = excluded.next_allowed_at
    where private.signup_confirmation_resend_cooldowns.next_allowed_at <= statement_timestamp()
    returning 0 into v_retry_after_seconds;

    if found then
        return v_retry_after_seconds;
    end if;

    select greatest(
        1,
        ceil(
            extract(
                epoch from next_allowed_at - statement_timestamp()
            )
        )::integer
    )
    into v_retry_after_seconds
    from private.signup_confirmation_resend_cooldowns
    where email_hash = p_email_hash;

    return coalesce(v_retry_after_seconds, p_cooldown_seconds);
end;
$$;

comment on function public.claim_signup_confirmation_resend(text, text, integer) is
'Atomically claims a signup confirmation resend slot. It respects Supabase Auth confirmation_sent_at for the initial email, retains only an email hash, and returns 0 when the caller may send or remaining cooldown seconds otherwise.';

revoke all on function public.claim_signup_confirmation_resend(text, text, integer) from public;
revoke all on function public.claim_signup_confirmation_resend(text, text, integer) from anon;
revoke all on function public.claim_signup_confirmation_resend(text, text, integer) from authenticated;
grant execute on function public.claim_signup_confirmation_resend(text, text, integer) to service_role;
