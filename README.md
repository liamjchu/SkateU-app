# SkateU

SkateU helps students discover and share skateable spots around their school or university campus.

## What it does

- Lets people search for a school or university and explore its campus map.
- Shows community-contributed skate spots with a photo, description, likes, and creator information.
- Lets authenticated users create, edit, like, and manage their own spots.
- Supports email and Google authentication through Supabase.

## Stack

Expo 55 · React Native · TypeScript · Expo Router · NativeWind · Zustand · AsyncStorage · Supabase

## Set up on another computer

Use this guide when cloning the project on a new development computer or running it on a second physical device. Do not copy `node_modules`, `.expo`, or an existing `.env.local` file between machines. Install dependencies from the lockfile and share configuration through a secure channel instead.

### Prerequisites

- Git, Node.js 22.19.0 (pinned in `.nvmrc` and EAS), and npm.
- Access to this repository and, for data-backed features, access to either the existing Supabase project or a new Supabase project you configure.
- An Android device with Expo Go for quick testing, or an EAS account and a development build for full native-device testing. iOS simulator builds require macOS; iOS device builds also require the appropriate Apple Developer credentials.

### Clone, install, and configure the client

```bash
git clone <repository-url> SkateU-app
cd SkateU-app
npm ci
cp .env.example .env.local
```

On Windows Command Prompt, use:

```cmd
git clone <repository-url> SkateU-app
cd SkateU-app
npm ci
copy .env.example .env.local
```

Use `npm ci` for a clean, reproducible install. Run `npm install` only when intentionally changing dependencies and updating `package-lock.json`.

Fill in only these client-safe values in `.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

`EXPO_PUBLIC_*` values are bundled into the app. They must never contain a service-role key, OpenAI key, or other secret. `.env.local` is ignored by Git; do not commit it. For an existing shared backend, obtain the two values above from a project owner through a secure channel instead of copying their entire environment file.

`EXPO_PUBLIC_API_URL` is optional while using `npx expo start`, because Expo supplies the local host URL to native clients. Set it to the absolute HTTPS origin of a deployed API server for an installed development, preview, or production build:

```dotenv
EXPO_PUBLIC_API_URL=https://api.example.com
```

Do not include a path such as `/api` or a trailing slash. Changing an `EXPO_PUBLIC_*` value requires restarting Expo; values used in an EAS build must be present in that build's environment before the build is created.

### Landing page and confirmation emails

The Next.js landing page is a separate workspace. From `apps/landing-page`, run `npm ci` and `npm run dev` for local development; use `npm run build` followed by `npm run start` to run its production build.

Create `apps/landing-page/.env.local` through a secure channel with the public `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus the server-only `SUPABASE_SERVICE_ROLE_KEY` and `SUBSCRIPTION_DISPATCH_SECRET`. Set `NEXT_PUBLIC_TESTFLIGHT_URL` to your public TestFlight join URL (`https://testflight.apple.com/join/...`) so the iOS beta button appears. The subscription route limits each IP to five requests per 60 seconds by default; configure `WAITLIST_RATE_LIMIT_MAX_REQUESTS` and `WAITLIST_RATE_LIMIT_WINDOW_MS` to change that per-process limit. For the deployed `send-confirmation` Edge Function, configure `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUBSCRIPTION_DISPATCH_SECRET`, and its Supabase service credentials as deployment secrets. Never expose the service-role key, dispatch secret, or Resend key to the browser.

To smoke-test Android beta email delivery, submit a test address on the landing page, check that the message arrives, open its confirmation link, and verify that the confirmation page succeeds. See the [Deployment guide](docs/deployment.md) for the Expo build and API deployment workflow.

## Backend options

### Connect to the existing shared backend

If another team member already manages the Supabase project and API deployment, use its two client-safe Supabase values. Confirm that the project already has the schema, `spot-images` storage bucket, auth providers, redirect URLs, school data, and deployed API described below. Do not rerun the school seed unless the owner has approved it; the current seed command inserts rows and has no rollback command.

### Provision a new Supabase project

Follow the complete [Backend setup](docs/backend-setup.md). Before this app can use a new project:

1. Create the project and enable the auth providers your build uses.
2. Add these native redirect URLs in Supabase Auth:

   ```text
   skateu://auth/callback
   skateu://auth/reset-password
   ```

3. Create the `public.schools` table by running `supabase/schools_setup.sql` before the remaining scripts.
4. In the Supabase SQL Editor, run these repository scripts in order:

   ```text
   supabase/schools_setup.sql
   supabase/profiles_setup.sql
   supabase/avatars_setup.sql
   supabase/profile_legal_acceptance_setup.sql
   supabase/profile_legal_private_setup.sql
   supabase/spots_setup.sql
   supabase/spots_creator_link.sql
   supabase/spot_likes_setup.sql
   supabase/spot_comments_setup.sql
   supabase/spots_count_trigger.sql
   supabase/account_deletion_proofs_setup.sql
   supabase/spot_removal_requests_setup.sql
   supabase/user_feedback_setup.sql
   supabase/user_blocks_setup.sql
   supabase/comment_reports_setup.sql
   supabase/school_search_setup.sql
   ```

5. Create `spot-images` and `avatars` Storage buckets with public read enabled.
6. Optionally generate and seed school data. This requires Python 3 and temporary server credentials in the terminal that runs the seed:

   ```bash
   python scripts/build_all_us_schools_csv.py --download
   npm run seed:schools -- --csv all_us_schools.csv
   ```

   Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in that terminal before running the command. Never put either value in a native build, an `EXPO_PUBLIC_*` variable, committed files, or a client `.env.local`.

## Run on a new development computer or physical device

### Start locally

```bash
npx expo start
```

Use the Expo CLI prompt or QR code to open the app on an Android emulator, iOS simulator, web browser, Expo Go, or an installed development client. A physical device must be able to reach the computer running Expo, normally by being on the same Wi-Fi network.

If the device cannot use the local network, start a tunnel instead:

```bash
npx expo start --tunnel
```

For normal local Expo sessions, requests to the project's Expo Router API routes use Expo's host URL. A built app cannot host `/api/*` routes itself; it must use a separately deployed HTTPS API through `EXPO_PUBLIC_API_URL`.

### Use a development build

Prefer a development build when validating the actual native app configuration, custom `skateu` deep links, or native integrations. Sign in to the EAS account that owns the configured project, create an internal build, install the resulting artifact on the device, then start Expo for the development client:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
npx expo start --dev-client
```

The `development` EAS profile produces an Android APK for internal installation. For iOS, create an iOS development build with EAS and follow its provisioning/install instructions. Rebuild the development client after changes to `app.json`, native plugins, or native dependencies.

### Server/API deployment

The native Expo app and Expo Router API routes are separate deployables. Before sharing an installed build that needs media uploads, account deletion, or AI moderation, deploy the API routes to an HTTPS runtime that supports Expo Router server output. Configure these values only in that server deployment environment:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
```

Set the API's HTTPS base URL as `EXPO_PUBLIC_API_URL` for the native build. See the [Deployment guide](docs/deployment.md) for EAS build profiles, production builds, and release requirements.

## Verify the handoff

On the new device, verify that you can:

1. Start the app without missing-environment-variable errors.
2. Sign up, sign in, and complete password recovery; confirm the app returns through the `skateu` deep link.
3. Search for a school, open its map, and view existing spots.
4. Create a spot with an image, then verify the image loads from `spot-images`.
5. Like a spot and confirm the displayed like count changes.

## Validation

Run these checks before opening a pull request:

```bash
npm run lint
npm test
npm run typecheck
```

Use `npm run test:watch` only for local, interactive test work.

## Documentation

- [Backend setup](docs/backend-setup.md) — Supabase, storage, environment variables, and school data seeding.
- [Development guide](docs/development.md) — project structure, architecture, conventions, and testing.
- [Deployment guide](docs/deployment.md) — EAS builds, server API deployment, and production secrets.
