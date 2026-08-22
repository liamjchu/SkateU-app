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
| `EXPO_PUBLIC_SENTRY_DSN` | Client build | Optional public Sentry DSN. Crash reporting stays off when this is empty. |
| `SUPABASE_URL` | API server / seed terminal | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | API server / seed terminal | Elevated server and seed access. |
| `OPENAI_API_KEY` | API server | Username, spot, and comment moderation, and a safety filter on Help & Support submissions. |
| `RESEND_API_KEY` | API server | Optional email when a spot reaches two unique removal requests, and for Help & Support notifications. |
| `RESEND_FROM_EMAIL` | API server | From address for moderation and Help & Support emails. |
| `MODERATION_NOTIFY_EMAIL` | API server | Inbox that receives spot review emails and Help & Support submissions. |

Never place `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`, `MODERATION_NOTIFY_EMAIL`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, or `SENTRY_PROJECT` in `.env.local` for a client build, an `EXPO_PUBLIC_*` value, or source control. `EXPO_PUBLIC_SENTRY_DSN` is a public client DSN and may live in the app build.

## 2. Create the Supabase data layer

Create a Supabase project, enable the required auth providers, and configure native redirect URLs for the `skateu` scheme:

```text
skateu://auth/callback
skateu://auth/reset-password
```

The repository includes `supabase/schools_setup.sql` for `public.schools`. Run it before applying the remaining scripts or seeding data.

In the Supabase SQL Editor, run the idempotent scripts in this order:

1. `supabase/schools_setup.sql`
2. `supabase/profiles_setup.sql`
3. `supabase/profile_legal_acceptance_setup.sql`
4. `supabase/profile_legal_private_setup.sql`
5. `supabase/spots_setup.sql`
6. `supabase/spots_creator_link.sql`
7. `supabase/spot_likes_setup.sql`
8. `supabase/spot_comments_setup.sql`
9. `supabase/spots_count_trigger.sql`
10. `supabase/account_deletion_proofs_setup.sql`
11. `supabase/spot_removal_requests_setup.sql`
12. `supabase/user_feedback_setup.sql`
13. `supabase/user_blocks_setup.sql`
14. `supabase/comment_reports_setup.sql`
15. `supabase/school_search_setup.sql`

Draft Terms of Use, Privacy Policy, and Community Guidelines live in `docs/`. They are product policies for later lawyer review, not legal advice.

Create a Storage bucket named `spot-images` with public read enabled. Image upload and deletion are performed by server routes with the service-role key; public read only serves the rendered image URLs. New uploads are sanitized on the server to remove extra image-file metadata before they are stored.

Create a private Storage bucket named `feedback-attachments` (public read off). Help & Support screenshots are uploaded only by `/api/user-feedback` with the service-role key.

After `spot_removal_requests_setup.sql` is applied, review spots that need a decision with:

```sql
select * from public.spots_needing_review;
```

After `user_feedback_setup.sql` is applied, review incoming Help & Support messages with:

```sql
select * from public.user_feedback order by created_at desc;
```

After `comment_reports_setup.sql` is applied, review reported comments with:

```sql
select * from public.comment_reports order by created_at desc;
```

Keep and remove snippets are documented at the top of the removal SQL file. If `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `MODERATION_NOTIFY_EMAIL` are set on the API server, crossing two unique removal requests also sends one email, and each Help & Support submission sends a notification to the same inbox.

## 3. Generate and seed schools

School search includes `k12_public`, `k12_private`, and `higher_ed`. Do not remove K-12 schools. Generate a CSV from supported public data sources with Python 3:

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

Confirm that school search returns records, new spots receive a creator profile, image URLs load from `spot-images`, likes update `spots.likes_count`, comments update `spots.comments_count`, `select * from public.spots_needing_review` runs without error, and `select * from public.user_feedback` runs without error. Use a non-production project for the first seed run; the current seeder inserts records and does not provide a rollback command.

Apply `profile_legal_acceptance_setup.sql` and `profile_legal_private_setup.sql` on production before shipping the app that reads `profile_legal`. After the private-table script, clients cannot select legal timestamps from `profiles`.

## 5. Under-13 and parent requests

If a parent or user says an account belongs to someone under 13, delete the account with the existing admin deletion path. Do not keep a volunteered date of birth in tickets or mailboxes. Keep only what is needed to complete the request, then remove it.
