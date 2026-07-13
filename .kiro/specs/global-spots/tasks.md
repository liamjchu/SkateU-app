# Implementation Plan: Global Spots

## Overview

This plan moves skate spots from device-local `SpotsContext`/AsyncStorage into a shared Supabase-backed `public.spots` table, exposed through a server-side Expo API route (`src/app/api/spots+api.ts`) that keeps the service-role key and verified user identity on the server. Client spot state moves to a Zustand store (`src/store/spotsStore.ts`), and the map/add-spot screens consume it.

Tasks are ordered for incremental, test-driven progress: build the type + pure helpers first (with property tests close to the code they cover), then the route handlers, then the store, then wire the screens together, and finally remove the old context and run the type-check gate. Each task builds on the previous ones, and the final tasks integrate everything so no code is left orphaned.

All code uses TypeScript in strict mode (no `any`, no `as any`), following the existing `schools+api.ts`, `profiles_setup.sql`, and Zustand store patterns per `AGENTS.md`.

> Prerequisite (not a coding task): the Supabase Storage bucket `spot-images` must exist with public read. Bucket creation is done in the Supabase dashboard/Storage API and is documented as a comment block in `supabase/spots_setup.sql` (see task 2.1). Uploads themselves happen server-side with the service-role key.

## Tasks

- [x] 1. Establish Spot types and property-test tooling
  - [x] 1.1 Define the strict Spot type and NewSpotInput
    - Update `src/types/spot.ts`: `Spot` with required `id`/`name`/`description` (string), `latitude`/`longitude` (number), `imageUris: string[]` (never null/undefined), required `city`/`state` (string), optional `schoolId?: string`
    - Add `NewSpotInput` (`schoolId`, `name`, `description`, `latitude`, `longitude`, optional `imageUri`)
    - No `any` / `as any`; keep the shapes simple and readable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 1.2 Set up the property-based test tooling
    - Inspect `package.json` for an existing test runner (Jest/Vitest) and for `fast-check`
    - If a runner exists but `fast-check` is missing, STOP and ask for approval before installing `fast-check` as a dev-only dependency (per `AGENTS.md` "ask before installing anything new"); if no runner exists, propose the standard choice and ask before adding it
    - After approval, install and add/confirm a `test` script; add one trivial fast-check spec configured for ≥100 iterations to confirm the runner executes property tests
    - _Requirements: 11.3, 11.4_

- [x] 2. Create the database migration
  - [x] 2.1 Write `supabase/spots_setup.sql`
    - Follow `profiles_setup.sql` conventions exactly (`create table if not exists`, `create index if not exists`, `create or replace function ... security definer set search_path = ''`, `drop trigger if exists` before `create trigger`, `enable row level security`, `drop policy if exists` before each `create policy`) so the file is re-runnable
    - Define the `spots` table columns, checks (name 1–100, description 0–1000, lat −90..90, lng −180..180, `image_urls` ≤ 10, non-null/defaults), the `school_id` FK (`on delete cascade`), and `created_by_user_id` FK to `auth.users`
    - Add `spots_school_id_idx` and the single composite `spots_lat_lng_idx (latitude, longitude)`
    - Add the idempotent `set_spots_updated_at` trigger
    - Add the public select policy and owner-only insert/update/delete policies keyed on `auth.uid()`
    - Include a header comment block documenting the `spot-images` public-read bucket creation prerequisite
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Implement API validation helpers and mapping (`src/app/api/spots+api.ts`)
  - [x] 3.1 Add config helper, constants, and `validateSchoolId`
    - Create the file with `getSupabaseConfig()` (reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY`, mirroring `schools+api.ts`), the shared constants (`SPOT_ID_PATTERN`, `MAX_SCHOOL_ID_LENGTH`, name/description/image limits, allowed image types, timeouts), and `validateSchoolId` (accept iff `^[A-Za-z0-9_-]+$` and length 1–64)
    - Service-role key stays server-side; never returned in any response
    - _Requirements: 4.4, 4.5, 5.9, 7.4_

  - [x]* 3.2 Write property test for schoolId validation
    - **Feature: global-spots, Property 1: schoolId validation accepts valid ids and rejects invalid ones**
    - Assert `validateSchoolId` accepts iff match `^[A-Za-z0-9_-]+$` and length 1–64; rejected/missing ids map to 400 (≥100 iterations)
    - **Validates: Requirements 4.2, 4.4, 4.5**

  - [x] 3.3 Add `DatabaseSpot` types and `mapSpot`
    - Define `DatabaseSpot` (selected columns + embedded `schools(city,state)`) and `DatabaseSpotInsert`; implement `mapSpot` to produce a strict `Spot`, defaulting `imageUris` to `[]` and `city`/`state` to `''` when the embed is absent
    - _Requirements: 4.6, 5.7_

  - [x]* 3.4 Write property test for row→Spot mapping
    - **Feature: global-spots, Property 2: row→Spot mapping populates every required field**
    - For any row (embed present/absent, empty/non-empty `image_urls`), assert all required fields are correctly typed and `imageUris` is always an array (≥100 iterations)
    - **Validates: Requirements 4.6, 5.7, 8.4**

  - [x] 3.5 Implement `validatePostBody`
    - Validate trimmed non-empty `schoolId`; `name` 1–100; `description` 1–1000; numeric `latitude` in [−90,90]; numeric `longitude` in [−180,180]; first failing field yields a 400 message naming it
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [x]* 3.6 Write property test for POST body validation
    - **Feature: global-spots, Property 3: POST body validation enforces required fields, lengths, and coordinate ranges**
    - Assert success iff all field predicates hold; each violation rejected with a field-identifying 400 (≥100 iterations)
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

  - [x] 3.7 Implement `buildInsertRecord`
    - Build `DatabaseSpotInsert` that always sets `created_by_user_id` to the verified user id, ignoring any client-supplied id field
    - _Requirements: 6.5, 6.6_

  - [x]* 3.8 Write property test for server-verified ownership
    - **Feature: global-spots, Property 4: created_by_user_id is always the verified user, never the client value**
    - For any body (including one supplying its own `created_by_user_id`/`userId`), assert the record's `created_by_user_id` equals the verified id (≥100 iterations)
    - **Validates: Requirements 6.5, 6.6**

  - [x] 3.9 Implement `validateImageFile`
    - Accept iff `size <= 10 MB` and `type` in {JPEG, PNG, WEBP}; a rejected file yields a 400 and no record creation
    - _Requirements: 7.2_

  - [x]* 3.10 Write property test for image file validation
    - **Feature: global-spots, Property 5: image file validation**
    - Assert accept iff size ≤ 10 MB and allowed content type (≥100 iterations)
    - **Validates: Requirements 7.2**

- [x] 4. Implement the Read Spots GET handler
  - [x] 4.1 Implement `GET /api/spots`
    - Validate `schoolId` (400 required/invalid before any DB call), read via PostgREST with the `schools(city,state)` embed ordered by `created_at.asc`, map rows through `mapSpot`, return 200 `{ spots }`; 500 for missing config or upstream failure
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x]* 4.2 Write unit tests for GET edge cases
    - Empty result → 200 `{ spots: [] }`; missing config → 500; failing upstream fetch → 500 (mock `fetch`)
    - _Requirements: 4.3, 4.7, 4.8_

- [x] 5. Implement image upload and the Create Spot POST handler
  - [x] 5.1 Implement `uploadImages`
    - Upload each file in selection order to `spot-images` via the Storage REST endpoint using the service-role key, with per-request 30s `AbortController` timeout; collect public URLs preserving order; any failure/timeout throws so no record is inserted
    - _Requirements: 7.1, 7.3, 7.4, 7.5_

  - [x]* 5.2 Write property test for upload URL ordering
    - **Feature: global-spots, Property 6: uploaded image URLs preserve selection order**
    - For any 1–10 successfully uploaded images, assert one URL per image in the same order (mock upload; ≥100 iterations)
    - **Validates: Requirements 7.3**

  - [x] 5.3 Implement `resolveUserId` (token verification)
    - Verify the bearer token via `GET /auth/v1/user`; return the user id on 200, otherwise signal invalid/expired for a 401
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.4 Implement `POST /api/spots` wiring
    - Order: read bearer (401 if absent) → verify token via `resolveUserId` (401 invalid/expired) → parse `formData` (400 malformed) → `validatePostBody` (400) → `validateImageFile` per file (400) → `uploadImages` (500 on failure, no insert) → `buildInsertRecord` → PostgREST insert with `Prefer: return=representation` + `schools(city,state)` embed (500 on failure, no partial) → 201 `{ spot }` via `mapSpot`
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8, 6.1, 6.5, 6.6, 7.1, 7.5_

  - [x]* 5.5 Write unit tests for POST error paths
    - Malformed body → 400; missing/invalid/expired token → 401; insert failure → 500 with no partial Spot; assert service-role key never appears in any response body (mock `fetch`)
    - _Requirements: 5.6, 5.8, 5.9, 6.2, 6.3, 6.4_

- [x] 6. Implement the client Zustand spots store
  - [x] 6.1 Implement `src/store/spotsStore.ts`
    - Plain `create` store (no persistence) with `spots`, `loading`, `error`, `schoolId`, `fetchSpots`, `addSpot`, `reset`
    - `fetchSpots`: reject missing/empty/whitespace `schoolId` without calling the API (invalid-identifier error, spots unchanged); otherwise set loading, `GET /api/spots?schoolId=...` with 10s `AbortController` timeout; on success set mapped spots (empty allowed, no error), clear loading; on failure/timeout set error, keep previous spots, clear loading
    - `addSpot(input, accessToken)`: build `FormData`, `POST /api/spots` with `Authorization: Bearer` and 10s timeout, return created `Spot`; never writes AsyncStorage
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.7, 10.3_

  - [x]* 6.2 Write property test for failed-fetch preservation
    - **Feature: global-spots, Property 7: a failed fetch preserves previously loaded spots**
    - For any prior state and any failing/timing-out fetch, assert error set, loading false, previous `spots` unchanged (mock `fetch`; ≥100 iterations)
    - **Validates: Requirements 9.4**

  - [x]* 6.3 Write property test for blank schoolId rejection
    - **Feature: global-spots, Property 8: blank schoolId is rejected without a fetch**
    - For any missing/empty/whitespace `schoolId`, assert no API request is made and an invalid-identifier error is exposed (spy on `fetch`; ≥100 iterations)
    - **Validates: Requirements 9.6**

  - [x]* 6.4 Write unit tests for store loading/empty/persistence behavior
    - Loading transitions to false within budget on success/timeout; zero records → empty spots, no error; no AsyncStorage persistence
    - _Requirements: 9.2, 9.3, 9.5, 9.7_

- [x] 7. Wire screens to the store and remove the old context
  - [x] 7.1 Confirm `SpotImagePicker` forwards the selected image
    - Verify/adjust `src/components/SpotImagePicker.tsx` so it calls `onImageSelected(uri)` on confirmation for the add-spot screen to forward
    - _Requirements: 7.6_

  - [x] 7.2 Integrate `src/app/map.tsx` with the store
    - Replace `useSpots` context usage with `useSpotsStore` selectors (`spots`, `loading`, `error`, `fetchSpots`); fetch on mount/`schoolId` change and on focus after returning from add-spot; keep `renderSpots` marker rendering (one pin per record); surface loading/error non-destructively
    - _Requirements: 9.2, 9.4, 9.8_

  - [x] 7.3 Integrate `src/app/add-spot.tsx` with the store
    - Remove local id generation, AsyncStorage/`useSpots().addSpot`, and `city`/`state` placeholders; keep the validity predicate (image + trimmed name 1–100 + trimmed description 1–1000); read `session` from `useAuthStore`; on save with no token show auth-required error and do not POST; otherwise set `saving`, call `spotsStore.addSpot` (10s), navigate back on success, on failure keep form data + show error and stay; disable save while saving
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x]* 7.4 Write property test for save enablement
    - **Feature: global-spots, Property 9: add-spot save enablement matches the validity predicate**
    - Extract the form-validity predicate and assert save is enabled iff image selected AND trimmed name length 1–100 AND trimmed description length 1–1000 (≥100 iterations)
    - **Validates: Requirements 10.1, 10.2**

  - [x] 7.5 Remove `src/context/SpotsContext.tsx` and update references
    - Delete the file and update any remaining imports/providers so nothing references the removed context and the app compiles
    - _Requirements: 9.1_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Type-check verification
  - [x] 9.1 Run `npx tsc --noEmit` and resolve all errors
    - Execute `npx tsc --noEmit`; fix every reported error; confirm zero errors and that changed/added files contain no `any` / `as any` and no new implicit `any`
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Property tests use fast-check at ≥100 iterations and are tagged `Feature: global-spots, Property {n}: {text}`; each pure helper is exported so it can be exercised directly, and store properties run against the store with `fetch` mocked.
- Each task references the specific requirement clauses it satisfies for traceability.
- The `spot-images` Storage bucket (public read) is an operator prerequisite documented in `supabase/spots_setup.sql`, not a coding task.
- The final type-check gate (`npx tsc --noEmit`) is run per `AGENTS.md` after implementation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["3.1", "6.1", "7.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "6.2", "6.3", "6.4"] },
    { "id": 3, "tasks": ["3.4", "3.5"] },
    { "id": 4, "tasks": ["3.6", "3.7"] },
    { "id": 5, "tasks": ["3.8", "3.9"] },
    { "id": 6, "tasks": ["3.10", "4.1"] },
    { "id": 7, "tasks": ["4.2", "5.1"] },
    { "id": 8, "tasks": ["5.2", "5.3"] },
    { "id": 9, "tasks": ["5.4"] },
    { "id": 10, "tasks": ["5.5", "7.2", "7.3"] },
    { "id": 11, "tasks": ["7.4", "7.5"] },
    { "id": 12, "tasks": ["9.1"] }
  ]
}
```
