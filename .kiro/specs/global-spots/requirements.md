# Requirements Document

## Introduction

SkateU currently stores skate spots only on each device using a React context (`SpotsContext`) backed by AsyncStorage. Spots added by one user are never visible to anyone else, and they are scoped only implicitly to a school. This feature makes skate spots global and shared by moving them into a Supabase-backed `spots` table linked to the existing `schools` table. Spots are read and written through server-side Expo API routes (following the existing `schools+api.ts` pattern) so that the Supabase service-role key and the verified user identity stay on the server and are never trusted from the client. Selected spot images are uploaded to Supabase Storage through the same server-side layer, and the returned public URLs are persisted on each spot record.

The goal is the smallest useful version first: a global spots table scoped by `schoolId`, a secure read/write API, image upload, and a client that fetches spots per school while keeping the map and add-spot experiences behaving as they do today. Client spot state moves from `SpotsContext`/AsyncStorage to a Zustand store, per the project architecture guidance.

## Glossary

- **Spot**: A user-contributed skate location associated with one school, containing name, description, coordinates, and image URLs.
- **School**: An existing record in the `schools` table (columns include `id`, `name`, `city`, `state`, `latitude`, `longitude`, `numspots`, `type`).
- **Spots_Table**: The Supabase Postgres table `public.spots` created by this feature to store Spot records.
- **Spots_Migration**: The SQL migration file under `supabase/` that creates the Spots_Table, its constraints, indexes, and RLS policies.
- **Spots_API**: The server-side Expo API route file `src/app/api/spots+api.ts` exposing `GET /api/spots` and `POST /api/spots`.
- **Spots_Store**: The Zustand store under `src/store/` that holds spot state for the client and replaces `SpotsContext`.
- **Add_Spot_Screen**: The screen `src/app/add-spot.tsx` used to create a new Spot.
- **Map_Screen**: The screen `src/app/map.tsx` that displays Spots as pins for the selected School.
- **Spot_Image_Picker**: The component `src/components/SpotImagePicker.tsx` used to select a spot image.
- **Spot_Storage_Bucket**: The Supabase Storage bucket that stores uploaded spot images.
- **Service_Role_Key**: The Supabase service-role API key, read from server-side environment variables only.
- **Access_Token**: The Supabase-issued JWT access token proving the identity of the authenticated user.
- **Created_By_User_Id**: The `auth.users` UUID of the user who created a Spot, derived server-side from the Access_Token.
- **Public_Image_Url**: The URL returned by Supabase Storage for an uploaded spot image.

## Requirements

### Requirement 1: Global Spots Database Schema

**User Story:** As a skater, I want spots stored in a shared database linked to my school, so that spots I and others add are visible to everyone viewing that campus.

#### Acceptance Criteria

1. THE Spots_Table SHALL define a primary key column `id` of type uuid that defaults to a generated uuid value.
2. THE Spots_Table SHALL define a column `school_id` of type uuid that is constrained to be non-null and references `public.schools (id)`.
3. WHERE a referenced School row is deleted, THE Spots_Table SHALL delete the associated Spot rows via an `on delete cascade` foreign key.
4. THE Spots_Table SHALL define a column `created_by_user_id` of type uuid that references `auth.users (id)`.
5. THE Spots_Table SHALL define a column `name` of type text that is constrained to be non-null and to a length between 1 and 100 characters inclusive.
6. THE Spots_Table SHALL define a column `description` of type text that is constrained to be non-null and to a length between 0 and 1000 characters inclusive.
7. THE Spots_Table SHALL define a column `latitude` of type double precision that is constrained to be non-null and to values between -90 and 90 inclusive.
8. THE Spots_Table SHALL define a column `longitude` of type double precision that is constrained to be non-null and to values between -180 and 180 inclusive.
9. THE Spots_Table SHALL define a column `image_urls` of type text array that defaults to an empty array and is constrained to a maximum of 10 elements.
10. THE Spots_Table SHALL define a column `created_at` of type timestamptz that is constrained to be non-null and defaults to the current timestamp.
11. THE Spots_Table SHALL define a column `updated_at` of type timestamptz that is constrained to be non-null and defaults to the current timestamp.
12. WHEN an existing Spot row is updated, THE Spots_Table SHALL set the `updated_at` column to the current timestamp.
13. IF an insert or update violates a column constraint (non-null, referential integrity, value range, length, or array size), THEN THE Spots_Table SHALL reject the operation, leave the existing row data unchanged, and return an error indication identifying the violated constraint.

### Requirement 2: Spots Migration File

**User Story:** As a developer, I want a re-runnable SQL migration for the spots table, so that I can provision the schema consistently in Supabase.

#### Acceptance Criteria

1. THE Spots_Migration SHALL be a single self-contained `.sql` file located directly under the `supabase/` directory.
2. THE Spots_Migration SHALL create the Spots_Table using `create table if not exists` so that executing the file two or more times in succession completes without an "already exists" error and leaves exactly one Spots_Table.
3. THE Spots_Migration SHALL create an index on the `school_id` column of the Spots_Table.
4. THE Spots_Migration SHALL create a single composite index covering the `latitude` and `longitude` columns of the Spots_Table.
5. THE Spots_Migration SHALL create the indexes using `create index if not exists` so that repeated execution completes without raising an error.
6. WHEN an existing Spot row is updated, THE Spots_Migration SHALL set only that updated row's `updated_at` column to the current UTC timestamp at the moment of the update via a trigger, leaving other rows unchanged.
7. THE Spots_Migration SHALL create the `updated_at` trigger idempotently (dropping any existing trigger of the same name before creation) so that repeated execution results in exactly one active `updated_at` trigger.

### Requirement 3: Row Level Security for Spots

**User Story:** As a product owner, I want row-level security on spots, so that anyone can view spots but only authenticated users can create their own and only owners can modify theirs.

#### Acceptance Criteria

1. THE Spots_Migration SHALL enable row level security on the Spots_Table, and WHERE row level security is already enabled on the Spots_Table, THE Spots_Migration SHALL complete without raising an error.
2. THE Spots_Migration SHALL define a select policy on the Spots_Table whose `using` expression evaluates to true for every requester, including anonymous (unauthenticated) requesters.
3. THE Spots_Migration SHALL define an insert policy on the Spots_Table whose `with check` expression requires `auth.uid()` to equal the inserted row's `created_by_user_id`.
4. THE Spots_Migration SHALL define an update policy on the Spots_Table whose `using` expression requires `auth.uid()` to equal the existing row's `created_by_user_id` and whose `with check` expression requires `auth.uid()` to equal the updated row's `created_by_user_id`.
5. THE Spots_Migration SHALL define a delete policy on the Spots_Table whose `using` expression requires `auth.uid()` to equal the existing row's `created_by_user_id`.
6. THE Spots_Migration SHALL precede the creation of each policy on the Spots_Table with a `drop policy if exists` statement for that policy, so that executing the Spots_Migration two or more times in succession completes without raising an error.
7. IF a requester attempts to insert a row into the Spots_Table where `auth.uid()` is null or does not equal the inserted row's `created_by_user_id`, THEN THE Spots_Table SHALL reject the insert and SHALL NOT create the row.
8. IF a requester whose `auth.uid()` does not equal the target row's `created_by_user_id` attempts to update or delete that row in the Spots_Table, THEN THE Spots_Table SHALL reject the operation and SHALL leave the target row unchanged.

### Requirement 4: Read Spots API

**User Story:** As a skater, I want the app to load spots for the campus I am viewing, so that I see the pins for that school.

#### Acceptance Criteria

1. THE Spots_API SHALL expose a `GET` handler at the route `/api/spots`.
2. WHEN a GET request includes a `schoolId` query parameter that matches the identifier format `^[A-Za-z0-9_-]+$` and is between 1 and 64 characters in length, THE Spots_API SHALL return an HTTP 200 response containing the Spot records whose `school_id` equals that `schoolId`.
3. WHEN a GET request includes a valid `schoolId` query parameter that matches no stored Spot records, THE Spots_API SHALL return an HTTP 200 response with an empty collection.
4. IF a GET request omits the `schoolId` query parameter, THEN THE Spots_API SHALL return an HTTP 400 response with an error message indicating the `schoolId` parameter is required.
5. IF a GET request includes a `schoolId` query parameter that does not match the format `^[A-Za-z0-9_-]+$` or exceeds 64 characters in length, THEN THE Spots_API SHALL return an HTTP 400 response with an error message indicating the `schoolId` parameter is invalid.
6. WHEN the Spots_API returns Spot records, THE Spots_API SHALL map each stored column to its corresponding field in the client Spot shape defined in `src/types/spot.ts`, populating every required field (`id`, `name`, `description`, `latitude`, `longitude`, `imageUris`, `city`, `state`) for each record.
7. IF the Supabase configuration is unavailable, THEN THE Spots_API SHALL return an HTTP 500 response with an error message indicating a server configuration error, and SHALL return no Spot records.
8. IF the Supabase request fails, THEN THE Spots_API SHALL return an HTTP 500 response with an error message indicating the request could not be completed, and SHALL return no Spot records.

### Requirement 5: Create Spot API

**User Story:** As a skater, I want to save a new spot to the shared database, so that other users at my campus can find it.

#### Acceptance Criteria

1. THE Spots_API SHALL expose a `POST` handler at the route `/api/spots`.
2. WHEN a POST request body is parseable JSON and contains a non-empty string `schoolId`, a `name` string of 1 to 100 characters, a `description` string of 1 to 1000 characters, a numeric `latitude` in the range -90 to 90 inclusive, and a numeric `longitude` in the range -180 to 180 inclusive, THE Spots_API SHALL insert a Spot record with those values and return an HTTP 201 response.
3. IF a POST request is missing, or provides an empty or whitespace-only value for, any of the required fields `schoolId`, `name`, `description`, `latitude`, or `longitude`, THEN THE Spots_API SHALL return an HTTP 400 response with an error message indicating which required field is missing or empty.
4. IF a POST request provides a `name` longer than 100 characters or a `description` longer than 1000 characters, THEN THE Spots_API SHALL return an HTTP 400 response with an error message indicating the field length limit that was exceeded.
5. IF a POST request provides a non-numeric `latitude` or `longitude`, or a `latitude` outside the range -90 to 90 inclusive, or a `longitude` outside the range -180 to 180 inclusive, THEN THE Spots_API SHALL return an HTTP 400 response with an error message indicating the invalid coordinate.
6. IF a POST request body cannot be parsed as JSON, THEN THE Spots_API SHALL return an HTTP 400 response with an error message indicating the body is malformed, and SHALL NOT insert a Spot record.
7. WHEN the Spots_API inserts a Spot record, THE Spots_API SHALL return the created Spot mapped to the client Spot shape defined in `src/types/spot.ts`.
8. IF the Supabase insert fails, THEN THE Spots_API SHALL return an HTTP 500 response with an error message indicating the insert failed, and SHALL NOT return a partially created Spot.
9. THE Spots_API SHALL read the Service_Role_Key from server-side environment variables only and SHALL exclude the Service_Role_Key from every response body.

### Requirement 6: Server-Verified Spot Ownership

**User Story:** As a product owner, I want the creator of a spot to be derived from the verified session, so that a client cannot forge who created a spot.

#### Acceptance Criteria

1. WHEN a POST request to create a Spot is received, THE Spots_API SHALL read the Access_Token from the request `Authorization` header.
2. IF a POST request omits the `Authorization` header or the header does not contain an Access_Token, THEN THE Spots_API SHALL reject the request with an HTTP 401 response, return an error message indicating that authentication is required, and SHALL NOT create a Spot record.
3. IF the Access_Token is invalid, THEN THE Spots_API SHALL reject the request with an HTTP 401 response, return an error message indicating that the token is invalid, and SHALL NOT create a Spot record.
4. IF the Access_Token is expired, THEN THE Spots_API SHALL reject the request with an HTTP 401 response, return an error message indicating that the token is expired, and SHALL NOT create a Spot record.
5. WHEN the Access_Token is valid, THE Spots_API SHALL resolve the Created_By_User_Id from the Access_Token and SHALL set the Spot record's `created_by_user_id` field to that resolved identifier.
6. WHEN a POST request body includes a user identifier field, THE Spots_API SHALL ignore that supplied value and SHALL use only the Created_By_User_Id resolved from the verified Access_Token.

### Requirement 7: Spot Image Upload

**User Story:** As a skater, I want the photo I choose for a spot to be stored in the cloud, so that other users can see the spot's image.

#### Acceptance Criteria

1. WHERE a new Spot has between 1 and 10 selected images, THE Spots_API SHALL upload each selected image to the Spot_Storage_Bucket before creating the Spot record.
2. IF a selected image exceeds 10 MB or is not in a supported image format (JPEG, PNG, or WEBP), THEN THE Spots_API SHALL reject the request with an HTTP 400 response containing an error message indicating the invalid file size or format, and SHALL NOT create the Spot record.
3. WHEN an image is successfully uploaded to the Spot_Storage_Bucket, THE Spots_API SHALL store the resulting Public_Image_Url in the created Spot's `image_urls` column in the same order the images were selected.
4. THE Spots_API SHALL perform image uploads server-side using the Service_Role_Key and SHALL exclude the Service_Role_Key from all client-visible code.
5. IF any single image upload fails or does not complete within 30 seconds, THEN THE Spots_API SHALL return an HTTP 500 response with an error message indicating the upload failure, SHALL NOT create the Spot record, and SHALL NOT persist any Public_Image_Url from the same request.
6. WHEN a skater confirms an image selection in the Spot_Image_Picker, THE Spot_Image_Picker SHALL provide the selected image to the Add_Spot_Screen so that the image can be sent to the Spots_API.

### Requirement 8: Spot Type Definition

**User Story:** As a developer, I want the Spot type to match the database-backed model, so that screens compile and behave correctly without using `any`.

#### Acceptance Criteria

1. THE Spot type in `src/types/spot.ts` SHALL define every field consumed by the Map_Screen and Add_Spot_Screen with an explicit named type, and SHALL NOT use the `any` type or an implicit `any` for any field.
2. THE Spot type SHALL declare `id`, `name`, and `description` as required string fields, `latitude` and `longitude` as required number fields, and an image URL collection field declared as an array of strings.
3. THE Spot type SHALL declare `schoolId` as an optional string field so that a Spot with no associated school omits the field or sets it to `undefined`.
4. WHERE a Spot has no images, THE Spot type SHALL represent the image URL collection as an empty array of length 0 rather than `undefined` or `null`.
5. IF a value assigned to any required Spot field is missing or is of a type other than the field's declared type, THEN the TypeScript compiler running under strict mode SHALL report a type error and fail compilation.

### Requirement 9: Client Spot State via Zustand

**User Story:** As a developer, I want spot state managed in a Zustand store, so that the client follows the project's state architecture and loads spots from the backend.

#### Acceptance Criteria

1. THE Spots_Store SHALL be implemented as a Zustand store located in the `src/store/` directory.
2. WHEN the Map_Screen requests spots for a non-empty `schoolId`, THE Spots_Store SHALL fetch all Spot records associated with that `schoolId` from the Spots_API and complete or time out within 10 seconds.
3. WHILE a fetch for spots is in progress, THE Spots_Store SHALL expose a loading state equal to true to the Map_Screen, and SHALL set the loading state to false within 100 milliseconds after the fetch completes, fails, or times out.
4. IF a spot fetch fails or does not complete within 10 seconds, THEN THE Spots_Store SHALL expose an error state to the Map_Screen indicating the fetch failure, SHALL retain any previously loaded spots unchanged, and SHALL set the loading state to false.
5. WHEN a spot fetch completes successfully and returns zero Spot records for the requested `schoolId`, THE Spots_Store SHALL expose an empty spot collection with no error state set.
6. IF the Map_Screen requests spots with a missing or empty `schoolId`, THEN THE Spots_Store SHALL NOT initiate a fetch to the Spots_API and SHALL expose an error state indicating an invalid identifier.
7. THE Spots_Store SHALL NOT persist backend-sourced global spots to AsyncStorage.
8. WHEN the Spots_Store exposes a non-empty spot collection, THE Map_Screen SHALL render one spot pin per Spot record using the same marker rendering behavior currently used.

### Requirement 10: Add Spot Flow Persists to Backend

**User Story:** As a skater, I want saving a new spot to store it in the shared database and return me to the map, so that my spot appears for everyone at that campus.

#### Acceptance Criteria

1. WHILE the Add_Spot_Screen form has a selected image, a trimmed name of 1 to 100 characters, and a trimmed description of 1 to 1000 characters, THE Add_Spot_Screen SHALL enable the save action.
2. IF the Add_Spot_Screen form is missing a selected image, a non-empty trimmed name, or a non-empty trimmed description, THEN THE Add_Spot_Screen SHALL keep the save action disabled.
3. WHEN the user saves a valid Add_Spot_Screen form, THE Add_Spot_Screen SHALL send a POST request to the Spots_API with the spot data and the Access_Token, expecting confirmation within 10 seconds.
4. WHEN the Spots_API confirms the Spot was created, THE Add_Spot_Screen SHALL navigate back to the Map_Screen.
5. THE Add_Spot_Screen SHALL NOT write newly created global spots to AsyncStorage.
6. IF the save request fails, is rejected by the Spots_API, or does not complete within 10 seconds, THEN THE Add_Spot_Screen SHALL display an error message to the user, SHALL retain the entered form data, and SHALL remain on the Add_Spot_Screen.
7. WHILE a save request is in progress, THE Add_Spot_Screen SHALL indicate that the save is in progress and SHALL disable the save action to prevent duplicate submissions.
8. IF a save is attempted without a valid Access_Token available, THEN THE Add_Spot_Screen SHALL display an authentication-required error and SHALL NOT send the POST request to the Spots_API.

### Requirement 11: Type Check Verification

**User Story:** As a developer, I want the project to pass type checking after this feature, so that I can be confident there are no type regressions.

#### Acceptance Criteria

1. WHEN the command `npx tsc --noEmit` is executed against the SkateU codebase after the feature is implemented, THE SkateU codebase SHALL complete the type check reporting zero type errors and terminating with a success (zero) exit status.
2. IF the command `npx tsc --noEmit` reports one or more type errors after the feature is implemented, THEN THE SkateU codebase SHALL be treated as failing this requirement until every reported error is resolved and the command reruns with zero reported errors.
3. THE SkateU codebase SHALL contain zero explicit `any` type annotations and zero `as any` casts in the files added or modified by this feature.
4. THE SkateU codebase SHALL introduce zero new implicit `any` occurrences (as reported by `npx tsc --noEmit` under the project's existing strict configuration) in the files added or modified by this feature.
