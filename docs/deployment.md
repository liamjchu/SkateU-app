# Deployment guide

SkateU has two deployable pieces: a native Expo application and Expo Router server API routes. A native build does not host the API routes by itself.

## EAS build profiles

`eas.json` defines the following profiles:

| Profile | Intended use | Android output |
| --- | --- | --- |
| `development` | Internal development client builds. | APK |
| `preview` | Internal stakeholder or QA builds. | APK |
| `production` | Store-ready release builds with remote versioning and auto-increment. | Platform default |

Typical commands:

```bash
npx eas build --profile development --platform android
npx eas build --profile preview --platform android
npx eas build --profile production --platform all
npx eas submit --profile production --platform android
```

Run lint, tests, and `npx tsc --noEmit` before requesting a build. Confirm the app identifiers in `app.json` (`app.skateu.mobile`) match the configured Apple and Google store records.

## API deployment

Deploy the Expo Router server output to a runtime that supports Expo Router API routes. The deployed environment must expose the `/api/*` routes over HTTPS and provide server-only environment variables there:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
```

Set `EXPO_PUBLIC_API_URL` in the native app build environment to that HTTPS origin, without a trailing path. The mobile client requires an absolute URL outside local Expo development. Do not include service-role or OpenAI keys in a native build, `.env.example`, source control, or any `EXPO_PUBLIC_*` variable.

## Release checklist

1. Apply and verify the Supabase setup in [backend setup](backend-setup.md).
2. Confirm production API routes can reach Supabase and OpenAI without exposing credentials.
3. Build a preview artifact and validate authentication, password recovery deep links, map browsing, spot creation, image uploads, edits, likes, and account deletion.
4. Create the production build, then submit it through EAS after store metadata and signing credentials are complete.

No CI or automated release workflow is configured yet; build and release commands are currently run manually.
