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

## EAS Update (over-the-air JS)

Preview builds listen on the `preview` channel. Production store builds listen on the `production` channel. The app checks for a JS/asset update on launch and applies it on the **next cold start**. Do not expect an in-app reload prompt.

OTA updates cannot land on a store or internal build until that binary includes `expo-updates`. After adding or changing native code, create a new native build, then publish JS updates to its channel:

```bash
npx eas update --channel preview --message "Describe the JS change"
npx eas update --channel production --message "Describe the JS change"
```

`runtimeVersion` follows `app.json` `version` (`appVersion` policy). Bumping the app version requires a new native build before production OTA can target that version.

## API deployment

Deploy the Expo Router server output to a runtime that supports Expo Router API routes. The deployed environment must expose the `/api/*` routes over HTTPS and provide server-only environment variables there:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
MODERATION_NOTIFY_EMAIL
PUSH_DISPATCH_SECRET
```

Set `EXPO_PUBLIC_API_URL` in the native app build environment to that HTTPS origin, without a trailing path. The mobile client requires an absolute URL outside local Expo development. Do not include service-role, OpenAI, Resend, or push-dispatch keys in a native build, `.env.example`, source control, or any `EXPO_PUBLIC_*` variable.

Native push notifications need APNs (iOS) and FCM (Android) credentials in EAS for `app.skateu.mobile`. Android FCM also needs `google-services.json` referenced as `android.googleServicesFile` in `app.json`. After adding `expo-notifications` or changing that file, create a new native build. OTA JS updates cannot add the notification permission plugin. Confirm Resend can deliver account-deletion codes to Apple Hide My Email addresses (`@privaterelay.appleid.com`).

Optional crash reporting: set `EXPO_PUBLIC_SENTRY_DSN` on the native build. Native Sentry Gradle/Xcode upload is enabled only when `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are all set in the EAS environment (or `SENTRY_DISABLE_AUTO_UPLOAD=true` with org and project). Preview builds can omit those secrets; missing `SENTRY_AUTH_TOKEN` previously failed Android Gradle during source-map upload. Leave the DSN empty to keep crash reporting off.

Optional product analytics: set `EXPO_PUBLIC_POSTHOG_API_KEY` on the native build (PostHog Cloud US). `EXPO_PUBLIC_POSTHOG_HOST` defaults to `https://us.i.posthog.com`. Leave the key empty to keep analytics off. Do not send analytics from local development unless `EXPO_PUBLIC_POSTHOG_ENABLE_DEV=1`.

## Release checklist

1. Apply and verify the Supabase setup in [backend setup](backend-setup.md), plus every pending file in `supabase/migrations/` (nearest-school and notification-type updates included), before a reviewer uses the production binary.
2. Confirm production API routes can reach Supabase and OpenAI without exposing credentials.
3. Confirm the production EAS environment has `EXPO_PUBLIC_API_URL` (HTTPS origin, no trailing path), public Supabase values, and that the API deployment has the server-only secrets listed above.
4. Build a preview artifact and validate authentication (email, Google, Apple), password recovery deep links, map browsing, spot creation, image uploads, edits, likes, follows, saved-school sync, Help & Support, comment and profile reports, blocking, and account deletion.
5. Create the production build, then submit it through EAS after store metadata and signing credentials are complete. `eas build --auto-submit` only uploads the binary; it does not finish store listings or questionnaires.
6. Confirm `https://skateu.app/privacy`, `https://skateu.app/terms`, and `https://skateu.app/support` resolve. Community Guidelines also stay in the app.
7. Inspect the production IPA/AAB permission list before App Privacy and Data Safety. The app may request when-in-use location to show the user on campus maps. GPS is not stored on SkateU servers. Camera and photo library are used to add skate-spot pictures. Notifications are used for likes, comments, follows, and campus/spot alerts. Unused native map SDKs must not add background location permission. If the AAB declares `READ_MEDIA_VIDEO` or `READ_MEDIA_AUDIO`, remove or justify those permissions — the app only picks images.

## App icon verification

`app.json` points iOS and the generic Expo icon at `assets/images/app-icon.png` (pink pin on cream). Android uses the padded adaptive-icon foreground in `assets/images/android-icon-foreground.png`.

iOS caches home-screen and app-switcher icons aggressively. After an icon change, a new EAS/dev-client build is required; Expo Go and OTA updates do not replace the installed icon. To confirm the new branding:

1. Delete the SkateU app from the device.
2. Restart the device.
3. Install a fresh build that includes the updated `app-icon.png`.
4. Check the home screen and the app switcher. If an old green icon remains after a clean install, the installed binary is still an older build.

Android launcher icons also require a new native build after adaptive-icon asset changes.

## App Store Connect (complete manually)

These answers are product inputs, not a claim of store approval:

- Not Made for Kids. K-12 campuses appear as map locations only. SkateU is not a children’s app and is not affiliated with those schools.
- Age: accounts are 13+. UGC/social apps often rate 12+ on Apple’s matrix; keep the in-app rule at 13+ and complete the questionnaire honestly.
- User-generated content: yes (spots, photos, comments, usernames, profile photos, profile bios).
- Social: public usernames, profile bios, comments, and follows. Users can report comments, report profiles, request spot removal, and block other accounts. No DMs.
- Photos: camera and photo library.
- Location: when-in-use device GPS to show the user on campus maps. GPS is processed on the device and is not stored on SkateU servers. Spot pins remain user-placed place data.
- iPad: the app supports iPad (`supportsTablet`). Provide 13-inch iPad screenshots. Phone screenshots are still required for 6.7-inch iPhone.
- Privacy policy URL: `https://skateu.app/privacy`.
- Support URL: `https://skateu.app/support`.
- Marketing URL (optional): `https://skateu.app`.
- App Privacy labels: account email; user content (photos, text); identifiers (account id, and a push token if the user enables alerts); saved schools and follows; product analytics (account id only, no email) if PostHog is configured; crash data if Sentry is configured; not advertising tracking. Do not declare ATT / tracking.
- Demo account: provide email and password in Review Notes. Guests can browse without signing in.
- Review notes to paste:

> SkateU is a 13+ campus skate-spot map. Guests can browse schools, maps, spots, photos, and comments without an account.
> Demo account: `[email]` / `[password]`
> Location is when-in-use only, to show the user on the campus map. Denying location still allows browsing and placing pins. GPS is not stored on our servers.
> User content: spots, photos, comments, usernames, bios. Users can report comments, report profiles, request spot removal, block accounts, and contact us from Settings → Help & Support. Content is also checked automatically before posting.
> The school directory includes K–12 campuses as map locations. SkateU is not a children’s app and is not affiliated with those schools.
> Account deletion: Settings → Delete account.

## Google Play Console (complete manually)

- New personal developer accounts must complete closed testing with 20 testers opted in for 14 consecutive days before production. An EAS upload to the internal track is not that test.
- Store listing needs a 1024×500 feature graphic and at least two phone screenshots. If you also target tablets, add tablet screenshots.
- Target audience: 13–15, 16–17, and 18+ as appropriate. Do not select under-13. Do not enroll in Designed for Families as a children’s app.
- “Is this app primarily for children?” → No, for this 13+ general-audience product.
- Data safety: email, user-generated photos/text, account identifiers, follows, saved schools, push tokens when alerts are on; approximate/precise location used on-device for map display and not collected on SkateU servers; no advertising SDK; product analytics through PostHog when `EXPO_PUBLIC_POSTHOG_API_KEY` is set (account id, not email); crash reporting through Sentry when `EXPO_PUBLIC_SENTRY_DSN` is set. The website Android beta email list is not the Play app.
- Privacy policy URL: `https://skateu.app/privacy`. Terms URL: `https://skateu.app/terms`.
- IARC: UGC, social-ish features, skateboarding.
