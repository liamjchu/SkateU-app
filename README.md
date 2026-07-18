# SkateU

SkateU helps students discover, share, and rate skateable spots around their school or university campus.

## What it does

- Lets people search for a school or university and explore its campus map.
- Shows community-contributed skate spots with images, details, likes, and creator information.
- Lets authenticated users create, edit, like, and manage their own spots.
- Supports email, Google, and Apple authentication through Supabase.

## Stack

Expo 55 · React Native · TypeScript · Expo Router · NativeWind · Zustand · AsyncStorage · Supabase

## Quick start

### Prerequisites

- A supported Node.js LTS release (the repository does not currently pin a Node version).
- npm; `package-lock.json` is the source of truth for dependencies.
- A Supabase project configured with the steps in [Backend setup](docs/backend-setup.md).

### Install and run

```bash
npm install
cp .env.example .env.local
npx expo start
```

On Windows Command Prompt, use:

```cmd
copy .env.example .env.local
```

Add the client-safe Supabase values to `.env.local` before starting. Use the Expo CLI prompts to open a development build, Android emulator, iOS simulator, or web browser.

For a native app that calls deployed API routes, set `EXPO_PUBLIC_API_URL` to the absolute HTTPS base URL of the deployed server. The local Expo host URI is used automatically when available during development.

## Validation

Run these checks before opening a pull request:

```bash
npm run lint
npm test
npx tsc --noEmit
```

Use `npm run test:watch` only for local, interactive test work.

## Documentation

- [Backend setup](docs/backend-setup.md) — Supabase, storage, environment variables, and school data seeding.
- [Development guide](docs/development.md) — project structure, architecture, conventions, and testing.
- [Deployment guide](docs/deployment.md) — EAS builds, server API deployment, and production secrets.

