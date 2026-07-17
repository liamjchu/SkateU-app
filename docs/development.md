# Development guide

## Project layout

The app currently uses a flat Expo Router layout under `src/app/`. Routes compose UI and coordinate stores or helpers; reusable UI lives in `src/components/`.

| Path | Responsibility |
| --- | --- |
| `src/app/` | Screens, route layout, and Expo Router API routes in `api/`. |
| `src/components/` | Reusable UI concepts such as image pickers and location controls. |
| `src/constants/images.ts` | Centralized static image imports. |
| `src/lib/` | Supabase client, API URL resolution, validation, and focused helpers. |
| `src/store/` | Zustand state for auth, profile, schools, spots, and favourites. |
| `src/types/` | Shared domain and environment types. |
| `src/**/__tests__/` | Jest tests colocated with the behaviour they verify. |
| `supabase/` | Idempotent SQL setup scripts. |
| `scripts/` | School data import and seeding utilities. |

`AGENTS.md` is the source of truth for coding conventions. It describes the intended long-term folder conventions; document and plan a route-group migration before moving the current flat routes.

## Architecture

`_layout.tsx` restores the Supabase session, loads a profile, handles OAuth and recovery deep links, and gates signed-in users without a username onto onboarding. Zustand owns shared client state; component state is reserved for temporary UI state.

The Supabase client uses the anon key and AsyncStorage on device. Requests requiring elevated access, media writes, account deletion, or AI moderation go through `src/app/api/` and must remain server-side.

## Working conventions

- Use strict TypeScript; do not use `any`.
- Prefer NativeWind `className` styling. Use the documented exceptions in `AGENTS.md` only when necessary.
- Add image assets to `src/constants/images.ts`; do not import assets directly in a screen or component.
- Keep API routes responsible for validation and authorization. Never return server secrets in a response.
- Keep tests next to the relevant feature and run them as part of the validation commands below.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run start` | Start Expo. |
| `npm run android`, `npm run ios`, `npm run web` | Start Expo for a specific target. |
| `npm run lint` | Run Expo ESLint. |
| `npm test` | Run the Jest suite once. |
| `npm run test:watch` | Run Jest in watch mode. |
| `npx tsc --noEmit` | Type-check the workspace without output. |

See [backend setup](backend-setup.md) before working on data-backed features and [deployment](deployment.md) before creating a release build.
