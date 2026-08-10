-- Keep confirmation-email dispatch server-side while preserving generic signup behavior.

create or replace function public.subscribe_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_email text := lower(trim(p_email));
begin
    if v_email is null or v_email = '' then
        raise exception 'Email is required'
            using errcode = '22023';
    end if;

    if char_length(v_email) > 254
       or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then
        raise exception 'Invalid email address'
            using errcode = '22023';
    end if;

    insert into public.subscribers (
        email,
        source,
        confirmation_expires_at
    )
    values (
        v_email,
        'landing-page',
        now() + interval '7 days'
    )
    on conflict (email) do update
    set
        subscribed = true,
        unsubscribed_at = null,
        confirmed = case
            when subscribers.subscribed and subscribers.confirmed then true
            else false
        end,
        confirmed_at = case
            when subscribers.subscribed and subscribers.confirmed
                then subscribers.confirmed_at
            else null
        end,
        confirmation_token = case
            when subscribers.subscribed
             and subscribers.confirmed
                then subscribers.confirmation_token
            when subscribers.subscribed
             and subscribers.confirmation_token is not null
             and subscribers.confirmation_expires_at is not null
             and subscribers.confirmation_expires_at > now()
                then subscribers.confirmation_token
            else gen_random_uuid()
        end,
        confirmation_expires_at = case
            when subscribers.subscribed
             and subscribers.confirmed
                then subscribers.confirmation_expires_at
            when subscribers.subscribed
             and subscribers.confirmation_token is not null
             and subscribers.confirmation_expires_at is not null
             and subscribers.confirmation_expires_at > now()
                then subscribers.confirmation_expires_at
            else now() + interval '7 days'
        end,
        confirmation_sent_at = case
            when subscribers.subscribed
             and subscribers.confirmed
                then subscribers.confirmation_sent_at
            when subscribers.subscribed
             and subscribers.confirmation_token is not null
             and subscribers.confirmation_expires_at is not null
             and subscribers.confirmation_expires_at > now()
                then subscribers.confirmation_sent_at
            else null
        end;
end;
$$;

comment on function public.subscribe_email(text) is
'Internal landing-page signup function. It normalizes and validates email, preserves generic behavior, and refreshes expired pending confirmation tokens.';

revoke all on function public.subscribe_email(text) from public;
revoke all on function public.subscribe_email(text) from anon;
revoke all on function public.subscribe_email(text) from authenticated;
grant execute on function public.subscribe_email(text) to service_role;
grant execute on function public.confirm_subscription(uuid) to service_role;
