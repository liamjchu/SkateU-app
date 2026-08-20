# Backend setup

## 1. Configure environment variables

Copy `.env.example` to `.env.local` for local client work:

```bash
cp .env.example .env.local
```

On Windows Command Prompt, use:

```cmd
copy .env.example .env.local
```

Values beginning with `EXPO_PUBLIC_` are embedded in the client bundle and must contain only the Supabase URL and anon key.

| Variable | Where it belongs | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Client | Supabase project URL. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Client | Public Supabase anon key for auth. |
| `EXPO_PUBLIC_API_URL` | Client build | Absolute HTTPS origin of deployed API routes. |
| `SUPABASE_URL` | API server / seed terminal | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | API server / seed terminal | Elevated server and seed access. |
| `OPENAI_API_KEY` | API server | Username, spot, and comment moderation. |
| `RESEND_API_KEY` | API server | Optional email when a spot reaches two unique removal requests. |
| `RESEND_FROM_EMAIL` | API server | From address for moderation emails. |
| `MODERATION_NOTIFY_EMAIL` | API server | Inbox that receives spot review emails. |

Never place `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, or `MODERATION_NOTIFY_EMAIL` in `.env.local` for a client build, an `EXPO_PUBLIC_*` value, or source control.

## 2. Create the Supabase data layer

Create a Supabase project, enable the required auth providers, and configure native redirect URLs for the `skateu` scheme:

```text
skateu://auth/callback
skateu://auth/reset-password
```

The repository does not yet include a migration for `public.schools`. Create it before applying the remaining scripts or seeding data. It needs `id`, `name`, `city`, `state`, `latitude`, `longitude`, `numspots`, and `type` (`k12_public`, `k12_private`, or `higher_ed`) columns. Add this schema as a versioned migration before production use.

In the Supabase SQL Editor, run the idempotent scripts in this order:

1. `supabase/profiles_setup.sql`
2. `supabase/spots_setup.sql`
3. `supabase/spots_creator_link.sql`
4. `supabase/spot_likes_setup.sql`
5. `supabase/spot_comments_setup.sql`
6. `supabase/spots_count_trigger.sql`
7. `supabase/account_deletion_proofs_setup.sql`
8. `supabase/spot_removal_requests_setup.sql`

Create a Storage bucket named `spot-images` with public read enabled. Image upload and deletion are performed by server routes with the service-role key; public read only serves the rendered image URLs.

After `spot_removal_requests_setup.sql` is applied, review spots that need a decision with:

```sql
select * from public.spots_needing_review;
```

Keep and remove snippets are documented at the top of that SQL file. If `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `MODERATION_NOTIFY_EMAIL` are set on the API server, crossing two unique removal requests also sends one email.

## 3. Generate and seed schools

The school search API currently returns only `higher_ed` schools. Generate a CSV from supported public data sources with Python 3:

```bash
python scripts/build_all_us_schools_csv.py --download
```

The output must contain `name,city,state,latitude,longitude,type`. Run the seed with server credentials available only in the current terminal. In Windows Command Prompt:

```cmd
set "SUPABASE_URL=https://your-project.supabase.co"
set "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
npm run seed:schools -- --csv all_us_schools.csv
```

The seeder batches 1,000 rows by default. Use `--batch-size 1` through `5000` only when needed, for example `npm run seed:schools -- --batch-size 500`.

## 4. Verify safely

Confirm that school search returns records, new spots receive a creator profile, image URLs load from `spot-images`, likes update `spots.likes_count`, comments update `spots.comments_count`, and `select * from public.spots_needing_review` runs without error. Use a non-production project for the first seed run; the current seeder inserts records and does not provide a rollback command.
