# Requirements Document

## Introduction

SkateU provides shared skate spots for school and university campuses. This enhancement keeps the existing Supabase-backed global spot model, server-side Expo API boundary, image storage, authenticated ownership, likes, creator/timestamp data, edit/delete behavior, and Zustand client state, while making map and form states understandable and recoverable. The enhancement does not add ratings, videos, comments, multiple-image selection, or any other backend capability not currently supported by the application.

Global spots remain scoped by `schoolId`. Public spot reads remain available to anonymous users. Creating, editing, deleting, and liking spots remains authenticated and server-authorized. The map uses a Leaflet document inside a React Native WebView and therefore has an independent readiness/failure lifecycle from the spot API request.

## Original Request Context

Highest-priority improvements requested for this enhancement:

1. **Visible and recoverable map failures** — `src/app/map.tsx` and `src/components/LocationPicker.tsx` depend on external Leaflet scripts, styles, and tile providers. The UI must show loading until readiness, show “Map unavailable”, “Check your connection and try again”, and “Retry” on failure, and distinguish map failure from spot-loading failure and successful zero spots.
2. **Zero-spots map state** — `src/app/map.tsx` must show “No skate spots here yet”, “Be the first to add a spot to this campus”, a prominent “Add the first spot” action, and an authentication prompt for anonymous users.
3. **Add/edit completion** — `src/app/add-spot.tsx`, `src/app/edit-spot.tsx`, and `src/lib/addSpotForm.ts` must cover required fields, helper text, character counts, field-level validation after interaction, validation on press instead of a silently disabled save where appropriate, location confirmation, keyboard avoidance, and a clear photo-replacement affordance. Photo is required; name is 1–100 characters; description is 1–1000 characters.
4. **Product-language alignment** — product copy must describe currently supported spot details accurately: one displayed image, description, creator/timestamp, like count, and owner edit/delete actions; copy must not promise unsupported ratings, videos, comments, or creator capabilities.
5. **Actionable profile cards** — profile spot cards must show campus name/location, open the campus map and select the spot when tapped, provide explicit unlike behavior for liked spots, and keep owner edit/delete actions secondary to opening the spot.
6. **Recoverable data errors** — profile loading, school search, favorite-school refresh, map/WebView, and location-picker failures must expose retry actions, preserve stale content where possible, and show an inline refresh error.
7. **Anonymous-user sign-in modal** — the modal must say “Sign in to like and add spots” and “Create an account to save favorite campuses, like spots, and post your own.” and provide primary “Sign in” and secondary “Cancel” actions.

## Glossary

- **Spot**: A user-contributed skate location with a name, description, coordinates, one currently selectable image in the client flow, school association, creator/timestamp data, and like state/count.
- **School**: An existing `schools` record with identifier, name, city, state, coordinates, spot count, and type.
- **Spots_Table**: `public.spots`, the Supabase table storing shared Spot records.
- **Spots_Migration**: The re-runnable SQL file directly under `supabase/` that creates the Spots_Table, indexes, trigger, and row-level security policies.
- **Spots_API**: `src/app/api/spots+api.ts`, the server-side route exposing school, own-spot, create, edit, and delete Spot operations.
- **Spots_Store**: The Zustand store in `src/store/spotsStore.ts` holding campus, own, and liked Spot state and request statuses.
- **Map_Screen**: `src/app/map.tsx`, the campus map screen containing the Leaflet WebView and spot selection sheet.
- **Profile_Screen**: `src/app/profile.tsx`, the authenticated screen containing created and liked Spot cards.
- **ProfileScreen**: The implementation name for Profile_Screen in `src/app/profile.tsx`.
- **Home_Screen**: `src/app/index.tsx`, the school search and favorite-school screen.
- **HomeScreen**: The implementation name for Home_Screen in `src/app/index.tsx`.
- **Location_Picker**: `src/components/LocationPicker.tsx`, the Leaflet WebView used to choose Spot coordinates in add/edit forms.
- **Detail_Sheet**: The map surface showing the selected Spot's currently supported details and owner actions.
- **Add_Spot_Screen**: `src/app/add-spot.tsx`, the authenticated form for creating a Spot.
- **Edit_Spot_Screen**: `src/app/edit-spot.tsx`, the owner form for changing an existing Spot.
- **Spot_Image_Picker**: `src/components/SpotImagePicker.tsx`, the image selector that currently returns one image asset.
- **Leaflet_WebView**: The React Native WebView document that loads Leaflet JavaScript, CSS, and external map tiles.
- **Map_Readiness**: The state in which the Leaflet_WebView has initialized and sent its readiness message to the native screen.
- **Map_Failure**: A Leaflet_WebView initialization, script, stylesheet, tile, WebView, or native WebView load failure that prevents reliable map interaction.
- **Spot_Loading**: The independent request state while the Spots_Store loads Spot records for a school.
- **Stale_Content**: Previously rendered Spot records, profile cards, school search results, or favorite-school data retained while a refresh request fails.
- **Inline_Refresh_Error**: An in-context error message paired with a Retry action and rendered without replacing available Stale_Content.
- **Access_Token**: The Supabase JWT proving the authenticated user session.
- **Created_By_User_Id**: The user identifier resolved server-side from the Access_Token.
- **Service_Role_Key**: The server-only Supabase service-role key.
- **Public_Image_Url**: A public Supabase Storage URL returned for an uploaded image.

## Requirements

### Requirement 1: Global Spots Database Schema

**User Story:** As a skater, I want spots stored in a shared database linked to my school, so that spots added by the community are visible at that campus.

#### Acceptance Criteria

1. THE Spots_Table SHALL define a generated uuid primary key column named `id`.
2. THE Spots_Table SHALL define a non-null uuid `school_id` column referencing `public.schools(id)`.
3. WHERE a referenced School row is deleted, THE Spots_Table SHALL delete associated Spot rows through an `on delete cascade` foreign key.
4. THE Spots_Table SHALL define a uuid `created_by_user_id` column referencing `auth.users(id)`.
5. THE Spots_Table SHALL constrain non-null `name` text to 1–100 characters inclusive.
6. THE Spots_Table SHALL constrain non-null `description` text to 1–1000 characters inclusive.
7. THE Spots_Table SHALL constrain non-null `latitude` to -90 through 90 inclusive.
8. THE Spots_Table SHALL constrain non-null `longitude` to -180 through 180 inclusive.
9. THE Spots_Table SHALL define non-null `image_urls` text array data with an empty-array default and no more than 10 elements.
10. THE Spots_Table SHALL define non-null `created_at` and `updated_at` timestamptz columns with current-timestamp defaults.
11. WHEN an existing Spot row is updated, THE Spots_Table SHALL set that row's `updated_at` to the current timestamp.
12. IF a write violates a non-null, referential-integrity, range, length, or array-size constraint, THEN THE Spots_Table SHALL reject the write, leave existing row data unchanged, and return an error identifying the violated constraint.

### Requirement 2: Re-runnable Spots Migration

**User Story:** As a developer, I want a re-runnable migration, so that Supabase can be provisioned consistently.

#### Acceptance Criteria

1. THE Spots_Migration SHALL be one self-contained `.sql` file directly under `supabase/`.
2. THE Spots_Migration SHALL use idempotent table and index creation from the first execution so that the file works correctly on an empty database and executing the file at least twice leaves one Spots_Table without an already-exists error.
3. THE Spots_Migration SHALL create an index on `school_id` and one composite index on `(latitude, longitude)`.
4. WHEN an existing Spot row is updated, THE Spots_Migration SHALL update only that row's `updated_at` through a trigger.
5. THE Spots_Migration SHALL drop an existing trigger of the same name before creating the `updated_at` trigger, leaving one active trigger after repeated execution.

### Requirement 3: Row-Level Security

**User Story:** As a product owner, I want public reads and owner-authorized writes, so that shared spots remain safe.

#### Acceptance Criteria

1. THE Spots_Migration SHALL enable row-level security on the Spots_Table.
2. THE Spots_Migration SHALL define and enforce an idempotent select policy whose `using` expression permits authenticated and anonymous requesters.
3. THE Spots_Migration SHALL define and enforce an idempotent insert policy whose `with check` expression requires an authenticated `auth.uid()` to equal `created_by_user_id`.
4. THE Spots_Migration SHALL define and enforce an idempotent update policy whose `using` and `with check` expressions require an authenticated user to own the row before and after the update.
5. THE Spots_Migration SHALL define and enforce an idempotent delete policy whose `using` expression requires an authenticated user to own the row.
6. THE Spots_Migration SHALL precede each policy creation with `drop policy if exists` so repeated execution remains safe.
7. IF an unauthenticated requester or non-owner attempts an unauthorized insert, update, or delete, THEN THE Spots_Table SHALL reject the operation and SHALL leave existing data unchanged.

### Requirement 4: Read Spots API

**User Story:** As a skater, I want the app to load spots for a campus or for my profile, so that the map and profile remain current.

#### Acceptance Criteria

1. THE Spots_API SHALL expose `GET /api/spots`.
2. WHEN `schoolId` matches `^[A-Za-z0-9_-]+$` and is 1–64 characters, THE Spots_API SHALL return HTTP 200 with Spot records whose `school_id` equals `schoolId`.
3. WHEN a valid `schoolId` has no matching records, THE Spots_API SHALL return HTTP 200 with an empty collection.
4. WHEN `mine=1` or `mine=true` is supplied with a valid Access_Token, THE Spots_API SHALL return HTTP 200 with the authenticated user's created Spot records across schools.
5. IF a school read omits `schoolId`, THEN THE Spots_API SHALL return HTTP 400 identifying `schoolId` as required.
6. IF a school read has an invalid or over-length `schoolId`, THEN THE Spots_API SHALL return HTTP 400 identifying `schoolId` as invalid.
7. WHEN the Spots_API returns Spot records, THE Spots_API SHALL map stored fields to the strict client Spot shape, including id, name, description, coordinates, imageUris, school name/location, creator username, timestamps, and like count.
8. IF `mine` is requested without a valid Access_Token, THEN THE Spots_API SHALL return HTTP 401 and SHALL return no Spot records.
9. IF Supabase configuration is unavailable, THEN THE Spots_API SHALL return HTTP 500 with a safe configuration error and no Spot records.
10. IF an upstream Supabase request fails, THEN THE Spots_API SHALL return HTTP 500 with a safe load error and no partial Spot records.

### Requirement 5: Create, Edit, and Delete Spot API

**User Story:** As an authenticated skater, I want to create and manage my spots, so that shared campus data stays useful.

#### Acceptance Criteria

1. THE Spots_API SHALL expose `POST /api/spots`, `PATCH /api/spots?id=<spotId>`, and `DELETE /api/spots?id=<spotId>`.
2. WHEN a POST or PATCH body is parseable multipart form data and contains required text and coordinate fields, THE Spots_API SHALL validate the fields before any database write.
3. THE Spots_API SHALL require a non-empty `schoolId` for POST, a name of 1–100 characters, a description of 1–1000 characters, and numeric latitude and longitude within their valid ranges.
4. THE Spots_API SHALL require a name of 1–100 characters, a description of 1–1000 characters, and valid numeric coordinates for PATCH.
5. IF a required field is missing, empty, over length, non-numeric, or outside its coordinate range, THEN THE Spots_API SHALL return HTTP 400 naming the invalid field and SHALL perform no database write.
6. IF a request body cannot be parsed as multipart form data, THEN THE Spots_API SHALL return HTTP 400 identifying the body as malformed and SHALL perform no database write.
7. WHEN a valid POST or PATCH completes, THE Spots_API SHALL return HTTP 201 for POST or HTTP 200 for PATCH with the created or updated Spot mapped to the strict client shape.
8. IF a POST insert, PATCH update, or DELETE operation fails, THEN THE Spots_API SHALL return a safe failure response and SHALL not return a partially created or updated Spot.
9. WHEN a DELETE request targets a Spot owned by the verified user, THE Spots_API SHALL remove the Spot and its associated stored image reference data.
10. IF a PATCH or DELETE request targets a Spot not owned by the verified user, THEN THE Spots_API SHALL return HTTP 403 and SHALL leave the Spot unchanged.
11. THE Spots_API SHALL read the Service_Role_Key only from server-side environment variables and SHALL exclude the key from every response and client bundle.

### Requirement 6: Server-Verified Ownership and Image Handling

**User Story:** As a product owner, I want writes and images controlled by the server, so that clients cannot forge ownership or expose secrets.

#### Acceptance Criteria

1. WHEN a POST, PATCH, or DELETE request is received, THE Spots_API SHALL read an Access_Token from the `Authorization` header.
2. IF an access token is missing, invalid, or expired, THEN THE Spots_API SHALL return HTTP 401 with an authentication-specific error and SHALL perform no write.
3. WHEN an Access_Token is valid, THE Spots_API SHALL derive Created_By_User_Id from the verified session.
4. WHEN a request body supplies a user identifier, THE Spots_API SHALL ignore the supplied identifier and SHALL use only Created_By_User_Id.
5. WHERE a new Spot has 1–10 selected images, THE Spots_API SHALL validate and upload the images before inserting the Spot.
6. IF an image exceeds 10 MB or is not JPEG, PNG, or WEBP, THEN THE Spots_API SHALL return HTTP 400 naming the invalid size or format and SHALL create no Spot.
7. WHEN images upload successfully, THE Spots_API SHALL persist Public_Image_Url values in selection order.
8. IF an image upload fails or exceeds 30 seconds, THEN THE Spots_API SHALL return HTTP 500 identifying the upload failure and SHALL insert no Spot or image URL reference.
9. WHEN a PATCH request omits a replacement image, THE Spots_API SHALL retain the existing image URL; WHEN a PATCH request includes a replacement image, THE Spots_API SHALL replace the existing image reference after successful validation and upload.
10. WHEN a skater confirms image selection in the Spot_Image_Picker, THE Spot_Image_Picker SHALL provide the selected image asset to the Add_Spot_Screen or Edit_Spot_Screen.

### Requirement 7: Strict Spot Types and Client State

**User Story:** As a developer, I want strict shared types and predictable state, so that map, profile, and forms remain consistent.

#### Acceptance Criteria

1. THE Spot type in `src/types/spot.ts` SHALL explicitly type every field consumed by map, profile, detail, add, and edit screens and SHALL use no explicit or implicit `any`.
2. THE Spot type SHALL declare id, name, description, imageUris, school name/location, creator/timestamp fields, and coordinates with explicit types; imageUris SHALL be a string array.
3. THE Spot type SHALL represent no images as an empty array and SHALL represent optional like state/count using explicit optional types.
4. THE Spot type SHALL retain optional `schoolId` compatibility for records without an associated school.
5. THE Spots_Store SHALL be a non-persisted Zustand store in `src/store/` with independent campus, own-spot, liked-spot, loading, and error state.
6. WHEN the Map_Screen requests a non-empty schoolId, THE Spots_Store SHALL fetch campus Spot records within 10 seconds and SHALL expose Spot_Loading while the request is pending.
7. WHEN campus Spot loading succeeds with zero records, THE Spots_Store SHALL expose an empty collection with no error; WHEN campus Spot loading succeeds with records, THE Spots_Store SHALL expose the returned records.
8. IF campus, own-spot, or liked-spot loading fails or times out, THEN THE Spots_Store SHALL expose an error, set the corresponding loading state false, retain the corresponding Stale_Content unchanged, and SHALL NOT represent the failed request as a successful-empty state.
9. IF the Map_Screen supplies a missing or whitespace-only schoolId, THEN THE Spots_Store SHALL skip the network request and expose an invalid-identifier error.
10. THE Spots_Store SHALL NOT persist backend-sourced campus Spots to AsyncStorage.
11. WHEN the Spots_Store exposes a non-empty campus collection, THE Map_Screen SHALL render one marker per Spot using the existing marker behavior.

### Requirement 8: Map WebView Lifecycle and Independent Spot States

**User Story:** As a skater, I want the campus map to explain failures and empty results separately, so that I know whether retrying can help or whether a campus has no spots.

#### Acceptance Criteria

1. WHILE the Leaflet_WebView has not sent a readiness message, THE Map_Screen SHALL show a visible map-loading state and SHALL not present the map as ready.
2. WHEN the Leaflet_WebView sends its readiness message, THE Map_Screen SHALL mark Map_Readiness ready and SHALL render the current map layer and available marker data.
3. IF the Leaflet_WebView, Leaflet script, Leaflet stylesheet, tile provider, or native WebView reports a load or initialization failure, THEN THE Map_Screen SHALL mark Map_Failure independently from Spot_Loading and SHALL show all of the following visible copy: “Map unavailable”, “Check your connection and try again”, and “Retry”.
4. WHEN a user activates Retry for Map_Failure, THE Map_Screen SHALL recreate or reload the Leaflet_WebView, return to the visible map-loading state, and clear Map_Failure until readiness or another failure is observed.
5. IF Spot_Loading fails while the Leaflet_WebView is ready, THEN THE Map_Screen SHALL retain any Stale_Content markers, show an Inline_Refresh_Error for spot loading, and provide a Spot Retry action without showing “Map unavailable”.
6. WHILE Spot_Loading is pending and the Leaflet_WebView is ready, THE Map_Screen SHALL show a distinct spot-loading indicator that does not replace map readiness.
7. WHEN Spot_Loading succeeds with zero Spot records for the selected School, THE Map_Screen SHALL show the successful-empty state with “No skate spots here yet” and “Be the first to add a spot to this campus”.
8. WHEN Spot_Loading succeeds with one or more Spot records, THE Map_Screen SHALL show the successful-nonempty state with one selectable marker per Spot and SHALL not show the zero-spots empty message.
9. WHEN a user activates “Add the first spot” or the existing add action while authenticated, THE Map_Screen SHALL navigate to the Add_Spot_Screen with the selected campus and current map center.
10. WHEN an anonymous user activates “Add the first spot” or the existing add action, THE Map_Screen SHALL show the LoginRequiredModal and SHALL not navigate to the Add_Spot_Screen.
11. WHEN the Map_Screen receives a profile-card target Spot identifier, THE Map_Screen SHALL select that Spot after the campus records and Leaflet_WebView are ready; IF the target Spot is unavailable in the returned campus records, THEN THE Map_Screen SHALL leave the map unselected and SHALL retain normal campus-map behavior.

### Requirement 9: Location Picker Lifecycle and Confirmation

**User Story:** As a skater, I want to choose and confirm a spot location reliably, so that a network failure does not silently create an incorrect location.

#### Acceptance Criteria

1. WHILE the Location_Picker Leaflet_WebView has not sent a readiness message, THE Add_Spot_Screen and Edit_Spot_Screen SHALL show a visible location-loading state.
2. WHEN the Location_Picker Leaflet_WebView sends readiness, THE Location_Picker SHALL report the current map center to the owning form.
3. IF the Location_Picker WebView, Leaflet dependency, tile provider, or native WebView reports a load or initialization failure, THEN THE Location_Picker SHALL replace its loading state with visible copy reading “Map unavailable”, “Check your connection and try again”, and “Retry” inside the location section.
4. WHEN a user activates Location_Picker Retry, THE Location_Picker SHALL reload or recreate its WebView, show location loading, and preserve the last confirmed coordinates until a new center is reported.
5. WHEN the ready Location_Picker reports a map center, THE Location_Picker SHALL expose that latitude and longitude to the owning form and SHALL show a visible location confirmation affordance or confirmed status; IF the ready Location_Picker has not reported a center, THEN THE Location_Picker SHALL expose no coordinates to the owning form.
6. WHEN a user confirms a location, THE Add_Spot_Screen or Edit_Spot_Screen SHALL use the confirmed latitude and longitude in the next save request.
7. IF the Location_Picker has not reached readiness or no location has been confirmed, THEN the owning form SHALL show a field-level location error when the user presses Save and SHALL perform no save request.

### Requirement 10: Add and Edit Spot Form Completion

**User Story:** As a skater, I want clear, forgiving add and edit forms, so that I can complete a valid Spot without guessing why a save failed.

#### Acceptance Criteria

1. THE Add_Spot_Screen and Edit_Spot_Screen SHALL show required labels for Photo, Spot name, Description, and Location.
2. THE Add_Spot_Screen and Edit_Spot_Screen SHALL show helper text explaining the expected spot name, description, image, and location input.
3. THE Add_Spot_Screen and Edit_Spot_Screen SHALL show live character counts for the name against 100 characters and description against 1000 characters.
4. THE Add_Spot_Screen SHALL require one selected image, a trimmed name of 1–100 characters, a trimmed description of 1–1000 characters, and a confirmed location before saving.
5. THE Edit_Spot_Screen SHALL treat an existing image as satisfying the image requirement, SHALL preserve the existing image when no replacement is selected, and SHALL require a valid image when an existing image is absent.
6. WHEN a user interacts with a name, description, photo, or location field, THE owning form SHALL display that field's validation result without waiting for submission.
7. WHEN a user presses Save, THE Add_Spot_Screen and Edit_Spot_Screen SHALL validate every required field, display field-level errors for invalid fields, and identify the first invalid field for accessibility or focus.
8. THE Add_Spot_Screen and Edit_Spot_Screen SHALL keep Save pressable when the form is not saving so that press-time validation is available; THE forms SHALL disable Save while a save request is in progress.
9. WHEN a user selects a photo in Edit_Spot_Screen, THE Spot_Image_Picker SHALL expose a clear “Change photo” affordance, show the replacement preview, and mark the image as replaced for the next save.
10. WHEN a valid Add_Spot_Screen save succeeds, THE Add_Spot_Screen SHALL send the confirmed coordinates and authenticated Spot data to the Spots_API and SHALL navigate back to the Map_Screen.
11. WHEN a valid Edit_Spot_Screen save succeeds, THE Edit_Spot_Screen SHALL send changed text, confirmed coordinates, and a replacement image only when selected, then SHALL navigate back to the previous screen.
12. IF a save request fails, is rejected, or times out, THEN the owning form SHALL show an actionable error, retain all entered values and validation state, remain on the form, and allow a later retry.
13. IF a save is attempted without a valid Access_Token, THEN the owning form SHALL show an authentication-required error and SHALL send no write request.
14. WHILE a form keyboard is visible, THE Add_Spot_Screen and Edit_Spot_Screen SHALL keep the focused input visible, allow scrolling through the form, and keep the Save action reachable without keyboard overlap.
15. THE Add_Spot_Screen and Edit_Spot_Screen SHALL NOT write newly created or edited global Spot records to AsyncStorage.

### Requirement 11: Spot Detail Capability Language

**User Story:** As a skater, I want spot details and product copy to match the app, so that the feature does not promise unavailable interactions.

#### Acceptance Criteria

1. WHEN a Spot detail sheet is shown, THE Map_Screen SHALL show the currently supported Spot name, one displayed image when an image exists, description, creation/edit timestamp, like count, and the current user's like state.
2. WHEN the Spot creator account is deleted or no creator username is available, THE Map_Screen SHALL show the “Deleted User” fallback instead of a creator username; WHEN a creator username is available, THE Map_Screen SHALL show that username.
3. WHERE the authenticated user owns the selected Spot, THE Map_Screen SHALL show owner edit and delete actions.
4. WHERE the authenticated user does not own the selected Spot, THE Map_Screen SHALL omit owner edit and delete actions.
5. THE README and user-facing product copy for global spots SHALL describe discovery, sharing, one currently supported image, description, creator/timestamp information, likes, and owner edit/delete actions.
6. THE README and user-facing product copy for global spots SHALL not describe ratings, videos, comments, or unsupported multi-image/detail interactions as available functionality.
7. WHEN a user toggles a like on a Spot, THE client SHALL send the existing authenticated like operation, update like count and liked state from the response, and show an actionable error if the operation fails.
8. IF an anonymous user attempts to like a Spot, THEN THE Map_Screen SHALL show the LoginRequiredModal instead of sending a like request.

### Requirement 12: Actionable Profile Spot Cards

**User Story:** As an authenticated user, I want profile spot cards to open the corresponding campus spot, so that profile data leads directly to map context.

#### Acceptance Criteria

1. THE ProfileScreen SHALL show each displayed Spot card's campus name and campus city/state when those values are available.
2. WHEN a user taps any non-action area of a created or liked Spot card, THE ProfileScreen SHALL navigate to Map_Screen with the Spot's school identifier, school name, school city/state, school coordinates, and target Spot identifier.
3. WHEN Map_Screen receives a target Spot identifier from ProfileScreen, THE Map_Screen SHALL select the matching Spot after map and Spot_Loading readiness, using the same detail sheet as a marker selection.
4. WHEN a liked Spot card is displayed, THE ProfileScreen SHALL provide an explicit “Unlike” action that invokes the existing authenticated unlike operation and removes or updates the card after success.
5. IF an unlike operation fails, THEN THE ProfileScreen SHALL retain the liked card, show an Inline_Refresh_Error or actionable operation error, and allow a later retry.
6. WHERE the displayed card belongs to the authenticated user, THE ProfileScreen SHALL provide edit and delete controls as secondary actions that do not intercept a card tap intended to open Map_Screen.
7. IF profile Spot loading fails while cards are already present, THEN THE ProfileScreen SHALL retain the cards, show an Inline_Refresh_Error, and provide “Retry” for the affected created or liked Spot collection.
8. IF profile Spot loading fails before any cards are available, THEN THE ProfileScreen SHALL show the Inline_Refresh_Error and “Retry” in place of the empty-state message.
9. WHEN profile Spot loading is pending, THE ProfileScreen SHALL show a loading indicator distinct from an empty collection and SHALL not discard Stale_Content.

### Requirement 13: Recoverable Profile, School Search, and Favorite-School Reads

**User Story:** As a returning user, I want read failures to be recoverable without losing visible information, so that transient network errors do not make the app appear empty.

#### Acceptance Criteria

1. IF profile record loading fails, THEN THE profile surface SHALL retain the last profile data when available, show an Inline_Refresh_Error, and provide a “Retry” action that invokes the existing profile fetch.
2. IF profile record loading fails before profile data exists, THEN THE profile surface SHALL show the Inline_Refresh_Error and “Retry” instead of silently showing a successful profile state.
3. IF a school search request fails for a query that has Stale_Content, THEN THE HomeScreen search dropdown SHALL retain those results, show an Inline_Refresh_Error, and provide a “Retry” action for the same query.
4. IF a school search request fails for a query without Stale_Content, THEN THE HomeScreen search dropdown SHALL show an Inline_Refresh_Error and “Retry” without reporting “No schools found”.
5. WHEN a school-search Retry action is activated, THE HomeScreen SHALL repeat the request for the current trimmed query and SHALL keep the search query unchanged.
6. IF a favorite-school lookup or refresh fails, THEN THE HomeScreen SHALL retain the last favorite-school names, locations, and counts, show an Inline_Refresh_Error within the Favorites area, and provide a “Retry” action.
7. WHEN a favorite-school Retry action is activated, THE HomeScreen SHALL repeat the existing favorite-school lookup or refresh using the persisted favorite identifiers and SHALL not remove a favorite solely because the refresh failed.
8. WHEN a school-search or favorite-school request succeeds, THE HomeScreen SHALL replace the corresponding Stale_Content with the returned School records and SHALL clear the associated Inline_Refresh_Error.
9. THE retry behavior for profile, school search, and favorite-school reads SHALL not create a second backend capability or change the existing API response shape.

### Requirement 14: Anonymous-User Sign-In Modal

**User Story:** As an anonymous visitor, I want to understand the value of signing in, so that I can choose whether to continue to authentication.

#### Acceptance Criteria

1. WHEN LoginRequiredModal is visible, THE LoginRequiredModal SHALL show the heading “Sign in to like and add spots”.
2. WHEN LoginRequiredModal is visible, THE LoginRequiredModal SHALL show the message “Create an account to save favorite campuses, like spots, and post your own.”
3. WHEN LoginRequiredModal is visible, THE LoginRequiredModal SHALL show a primary “Sign in” action and a secondary “Cancel” action.
4. WHEN an anonymous user activates “Sign in”, THE LoginRequiredModal SHALL dismiss and navigate to the existing sign-in route.
5. WHEN an anonymous user activates “Cancel” or dismisses the modal through the platform request, THE LoginRequiredModal SHALL dismiss without navigation or mutation.
6. THE LoginRequiredModal SHALL expose accessible labels and roles that distinguish the Sign in and Cancel actions.

### Requirement 15: Authentication and Mutation Behavior

**User Story:** As a product owner, I want authenticated mutations to remain safe and recoverable, so that UI retries cannot create duplicates or bypass ownership.

#### Acceptance Criteria

1. WHEN a save, like, unlike, edit, or delete operation is in progress, THE client SHALL prevent a second submission for the same operation until the first operation completes or fails.
2. WHEN an authenticated mutation succeeds, THE Spots_Store SHALL update the affected campus, own-spot, liked-spot, or detail state without writing backend-sourced global spots to AsyncStorage.
3. IF an authenticated mutation fails, THEN THE client SHALL preserve the last known content, show an actionable error, and allow a later retry without silently changing ownership or like state.
4. WHEN an Access_Token is absent or invalid for an authenticated mutation, THE client SHALL show an authentication-required error and SHALL not retry the mutation with anonymous credentials.
5. THE client SHALL use only existing Spots_API and spot-likes operations for global Spot mutations and SHALL not assume ratings, comments, videos, or unsupported server fields.

### Requirement 16: Type-Check Verification

**User Story:** As a developer, I want the project to pass strict type checking after the enhancement, so that state and UI changes do not introduce regressions.

#### Acceptance Criteria

1. WHEN `npx tsc --noEmit` is executed against the SkateU codebase after implementation, THE codebase SHALL report zero type errors and exit successfully.
2. IF strict type checking reports an error in a file added or modified by this enhancement, THEN the enhancement SHALL remain incomplete until the error is resolved.
3. THE files added or modified by this enhancement SHALL contain zero explicit `any` annotations, zero `as any` casts, and zero new implicit `any` occurrences.

## Scope and Product Decisions

- The enhancement changes requirements and user-facing behavior only; it does not require a new backend service, rating model, comment model, video model, or multi-image picker.
- The existing server-side Supabase trust boundary, image moderation/upload flow, owner authorization, spot-like endpoint, school API response shape, and Zustand architecture remain in scope.
- The exact visual styling, spacing, animation, and NativeWind implementation remain design decisions; the required copy, states, actions, and observable outcomes above are product requirements.
- Open product decision: confirm whether the “location confirmation” affordance should be a dedicated button or a clearly labeled confirmed-status control after the map center changes. Both options must preserve confirmed coordinates and must block saving before confirmation.
- Open product decision: confirm whether the zero-spots authentication prompt appears as supporting text beside “Add the first spot” or as a separate Sign in action. Anonymous activation must still open LoginRequiredModal and must not open the form.
