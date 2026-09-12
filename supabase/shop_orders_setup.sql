-- =============================================================================
-- SkateU shop orders from Stripe Checkout Sessions
--
-- Security model:
--   * RLS is enabled and there are NO policies for anon/authenticated.
--   * Direct browser access to shop_orders is blocked.
--   * The landing-page webhook upserts rows with the service-role key.
-- =============================================================================

create table if not exists public.shop_orders (
    id uuid primary key default gen_random_uuid(),
    session_id text not null,
    email text,
    product_slug text not null,
    quantity integer not null default 1,
    amount_total integer,
    currency text not null default 'usd',
    payment_status text not null,
    shipping_name text,
    shipping_line1 text,
    shipping_line2 text,
    shipping_city text,
    shipping_state text,
    shipping_postal_code text,
    shipping_country text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint shop_orders_session_id_unique
        unique (session_id),

    constraint shop_orders_quantity_positive
        check (quantity >= 1),

    constraint shop_orders_amount_total_nonnegative
        check (amount_total is null or amount_total >= 0),

    constraint shop_orders_payment_status_known
        check (
            payment_status in ('paid', 'unpaid', 'no_payment_required')
        )
);

comment on table public.shop_orders is
'Paid SkateU shop Checkout Sessions. Direct browser table access is blocked by RLS. Writes are performed by the landing-page webhook with the service-role key.';

create index if not exists shop_orders_created_at_idx
    on public.shop_orders (created_at desc);

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

drop trigger if exists shop_orders_set_updated_at
    on public.shop_orders;

create trigger shop_orders_set_updated_at
before update on public.shop_orders
for each row
execute function public.set_updated_at();

alter table public.shop_orders enable row level security;

revoke all on table public.shop_orders from anon;
revoke all on table public.shop_orders from authenticated;
