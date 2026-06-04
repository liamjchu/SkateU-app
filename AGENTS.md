You are an expert React Native and Expo engineer helping me build
SkateU.
Write clean, simple, maintainable code. Prioritize clarity over
unnecessary abstraction.
Think like a senior mobile developer.
---
## Project Overview
We are building SkateU, a skate spot finder and sharer for your school
or university campus.
The app includes:
 - login/user authentication screen
 - search screen to find your school or university
 - respective campus map which is navigatable from satellite view
 - each map holds skate spots already added as pins that user can interact with,
   pops up ratings of the spot as well as images, videos, and comments, similar
   to Google Maps
 - option to add spots yourself
 
Keep the implementation simple and readable.
---
## Tech Stack
- Expo

- React Native

- TypeScript

- Expo Router

- NativeWind

- Zustand

- AsyncStorage

- Clerk for authentication
Do not introduce new major libraries unless there is a strong reason.
Ask before installing anything new.
---
## Development Philosophy
Build feature by feature.
For every feature:
1. Read this file first.

2. Keep the implementation simple.

3. Avoid overengineering.

4. Prefer readable code over clever code.

5. Build the smallest useful version first.

6. Refactor only when repetition appears.
---
## Decision Making
If something is unclear or could be improved, suggest a better
approach. If a new library would significantly help, recommend it,
explain why, and ask before adding it.
Do not install new libraries without approval.
Can run pwsh command "npx tsc --noEmit" without permission.
---
## Architecture
Use this folder structure:
```

app/

 (auth)/

 (tabs)/

components/

constants/

data/

hooks/

lib/

store/

types/

assets/

```
**app/** is for routes and screens only. Screens compose components and
call hooks or stores. They should not contain large reusable UI blocks
or business logic.
**components/** is for reusable UI. Create a component when it is
reused in multiple places, when it makes a screen easier to read, or
when it represents a clear UI concept. Examples for this app:
skate spot info/details, campus map sidebar. Do not create components too early.
**data/** holds hardcoded content. Keep it typed.
**store/** holds Zustand stores. Examples of state to keep here:
uploaded spots and spot details, users. Persist with AsyncStorage when needed.
**lib/** holds external service helpers (clerk.ts, api.ts, cn.ts).
Never expose secret keys here.
---
## UI Rules
For any UI task:
- Replicate the provided design exactly.
- Match layout, spacing, padding, font sizes, font hierarchy, colors,
border radius, shadows, alignment, and proportions.

- Do not approximate. Do not simplify unless explicitly asked.
---
## Styling Rules
Use NativeWind classes. Do not use StyleSheet unless it is not possible
to style with className.
Use the NativeWind version installed in this project. Check
package.json. Do not upgrade without approval.
Reuse class patterns through utilities in global.css.
### Style Exception List
Use StyleSheet or inline styles for:
- SafeAreaView (className not supported)

- KeyboardAvoidingView (behavior props)

- Modal (visible, transparent props)

- Animated.View (animated style values)

- Dynamic styles calculated at runtime

- Platform specific styles

- Pressable or TouchableOpacity pressed states

- Shadows (different per platform)
Everywhere else, use NativeWind.
---
## Image Rule
Use centralized image imports.

1. Check if constants/images.ts exists.

2. If not, create it.

3. Import all app images there.

4. Use them through the centralized object.

```
Do not import image assets directly inside screens or components.
---
## State Management
- Zustand for global client state.

- Local state for temporary UI state.

- AsyncStorage for persistence.
---
## TypeScript
- Strict mode.

- No `any`.

- Keep types simple and readable.
---
## Feature Implementation
When building a feature:
1. Read this file first.

2. Identify the files to change.

3. Keep changes focused.

4. Do not rewrite unrelated code.

5. Follow existing patterns.

6. Make sure the feature works end to end.

7. Fix lint and type errors before finishing.
---
## Secrets
- Never expose secret keys in client code.

- Use server routes for tokens, AI calls, and any external API access.
---
## Authentication
Use Clerk. Do not build custom auth.
---
## Communication
Be concise. Explain what changed and how to test it.
---
## Final Reminder
Before every feature:
- Read this file.

- Follow it strictly.

- Build clean, simple code.

- Replicate UI exactly when designs are provided.