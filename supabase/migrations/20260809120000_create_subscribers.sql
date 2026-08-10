-- =============================================================================
-- SkateU Landing Page Subscriber System
--
-- Security model:
--   * RLS is enabled and there are NO policies for anon/authenticated.
--   * Direct browser access to the subscribers table is blocked.
--   * The landing page can only call public.subscribe_email(text).
--   * Confirmation is handled through a server-side function.
--   * Service-role credentials must NEVER be exposed to the browser.
-- =============================================================================


-- =============================================================================
-- 1. Subscribers table
-- =============================================================================

create table if not exists public.subscribers (
    id uuid primary key default gen_random_uuid(),

    -- Stored normalized (lowercased + trimmed) by subscribe_email().
    email text not null,

    -- Subscription state
    subscribed boolean not null default true,
    unsubscribed_at timestamptz,

    -- Double opt-in / confirmation tracking
    confirmed boolean not null default false,
    confirmed_at timestamptz,

    -- Secure confirmation token
    confirmation_token uuid not null default gen_random_uuid(),

    -- Confirmation token expiration
    confirmation_expires_at timestamptz,

    -- Email tracking
    confirmation_sent_at timestamptz,

    -- Where the signup came from
    source text not null default 'landing-page',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint subscribers_email_unique
        unique (email),

    constraint subscribers_email_format
        check (
            char_length(email) between 3 and 254
            and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        ),

    constraint subscribers_email_is_normalized
        check (email = lower(email)),

    constraint subscribers_confirmed_at_present
        check (
            (confirmed = false and confirmed_at is null)
            or
            (confirmed = true and confirmed_at is not null)
        ),

    constraint subscribers_unsubscribe_state
        check (
            (subscribed = true and unsubscribed_at is null)
            or
            (subscribed = false and unsubscribed_at is not null)
        )
);


comment on table public.subscribers is
'Landing-page email signups for SkateU. Direct browser table access is blocked by RLS. Signup is performed through public.subscribe_email().';


-- =============================================================================
-- 2. Indexes
-- =============================================================================

create unique index if not exists subscribers_confirmation_token_key
    on public.subscribers (confirmation_token);

create index if not exists subscribers_created_at_idx
    on public.subscribers (created_at desc);

create index if not exists subscribers_launch_eligible_idx
    on public.subscribers (confirmed, subscribed)
    where confirmed = true and subscribed = true;


-- =============================================================================
-- 3. updated_at trigger
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;


drop trigger if exists subscribers_set_updated_at
    on public.subscribers;

create trigger subscribers_set_updated_at
before update on public.subscribers
for each row
execute function public.set_updated_at();


-- =============================================================================
-- 4. Row Level Security
-- =============================================================================

alter table public.subscribers enable row level security;

-- Intentionally no RLS policies are created.
--
-- Therefore:
--   anon         -> cannot read/write subscribers
--   authenticated -> cannot read/write subscribers
--
-- Server-side privileged operations can use the appropriate server-side
-- Supabase credentials/functions.


-- Explicitly remove direct table privileges from browser-facing roles.

revoke all on table public.subscribers from anon;
revoke all on table public.subscribers from authenticated;


-- =============================================================================
-- 5. Public signup function
-- =============================================================================
--
-- The landing page calls:
--
--     public.subscribe_email(email)
--
-- The function:
--   * normalizes the email
--   * validates the email
--   * inserts a new subscriber
--   * handles duplicate emails
--   * re-opens an unsubscribed address
--   * creates a new confirmation token when necessary
--   * never reveals whether the email already existed
--
-- It intentionally returns void.
-- =============================================================================

create or replace function public.subscribe_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_email text := lower(trim(p_email));
begin

    -- Basic validation
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


    -- Insert a new subscriber.
    --
    -- New subscribers:
    --   subscribed = true
    --   confirmed = false
    --   confirmation token generated automatically
    --   confirmation expires in 7 days

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

        -- If they were previously unsubscribed, they must
        -- confirm again.
        confirmed = case
            when subscribers.subscribed
                then subscribers.confirmed
            else false
        end,

        confirmed_at = case
            when subscribers.subscribed
                then subscribers.confirmed_at
            else null
        end,

        confirmation_token = case
            when subscribers.subscribed
                then subscribers.confirmation_token
            else gen_random_uuid()
        end,

        confirmation_expires_at = case
            when subscribers.subscribed
                then subscribers.confirmation_expires_at
            else now() + interval '7 days'
        end;

end;
$$;


comment on function public.subscribe_email(text) is
'Public landing-page signup function. Normalizes and validates email, creates or re-opens a subscriber, and does not reveal whether the email already existed.';


-- Remove any existing execute permissions.

revoke all on function public.subscribe_email(text) from public;
revoke all on function public.subscribe_email(text) from anon;
revoke all on function public.subscribe_email(text) from authenticated;


-- Allow the landing page to call this function.

grant execute on function public.subscribe_email(text) to anon;
grant execute on function public.subscribe_email(text) to authenticated;


-- =============================================================================
-- 6. Confirmation function
-- =============================================================================
--
-- This function is NOT exposed to anon/authenticated.
--
-- Your server-side confirmation route can call it.
--
-- The confirmation token:
--   * must exist
--   * must not be expired
--
-- Once confirmed:
--   confirmed = true
--   confirmed_at = current time
--   subscribed = true
--   unsubscribed_at = null
--
-- The confirmation token is then invalidated by setting it to a new UUID,
-- preventing the same link from being reused.
-- =============================================================================

create or replace function public.confirm_subscription(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_found boolean;
begin

    update public.subscribers

    set
        confirmed = true,
        confirmed_at = coalesce(confirmed_at, now()),
        subscribed = true,
        unsubscribed_at = null,

        -- Rotate the token after successful confirmation so
        -- the confirmation URL cannot be reused.
        confirmation_token = gen_random_uuid(),

        confirmation_expires_at = null

    where confirmation_token = p_token
      and confirmation_expires_at is not null
      and confirmation_expires_at > now()

    returning true into v_found;

    return coalesce(v_found, false);

end;
$$;


comment on function public.confirm_subscription(uuid) is
'Server-side confirmation function. Confirms a subscriber only when the token exists and has not expired. The token is rotated after successful confirmation.';


-- Do NOT expose confirmation to the browser.

revoke all on function public.confirm_subscription(uuid) from public;
revoke all on function public.confirm_subscription(uuid) from anon;
revoke all on function public.confirm_subscription(uuid) from authenticated;


-- =============================================================================
-- 7. Unsubscribe function
-- =============================================================================
--
-- This is included now because the eventual email system needs a safe
-- unsubscribe mechanism.
--
-- This function should NOT be exposed publicly until you build the
-- authenticated/token-based unsubscribe route.
-- =============================================================================

create or replace function public.unsubscribe_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_email text := lower(trim(p_email));
    v_found boolean;
begin

    update public.subscribers

    set
        subscribed = false,
        unsubscribed_at = now()

    where email = v_email
      and subscribed = true

    returning true into v_found;

    return coalesce(v_found, false);

end;
$$;


comment on function public.unsubscribe_email(text) is
'Server-side unsubscribe function. Do not expose directly to the public without a secure unsubscribe-token flow.';


-- Keep unsubscribe server-side for now.

revoke all on function public.unsubscribe_email(text) from public;
revoke all on function public.unsubscribe_email(text) from anon;
revoke all on function public.unsubscribe_email(text) from authenticated;


-- =============================================================================
-- DONE
-- =============================================================================
--
-- Current public API:
--
--   public.subscribe_email(text)
--
-- Server-side functions:
--
--   public.confirm_subscription(uuid)
--   public.unsubscribe_email(text)
--
-- Browser cannot directly read/write the subscribers table.
--
-- Next step:
--   Connect the landing-page email form to subscribe_email().
--
-- After that:
--   Add the server-side confirmation email through Resend.
-- =============================================================================