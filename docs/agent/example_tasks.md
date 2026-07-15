# Example Tasks For Future Agents

Use these as practical starting points. Always inspect the current code before editing.

## Add A New Avatar Emotion

Goal:

- Add a new emotion that can be returned by the backend and rendered by the avatar.

Files likely involved:

- `client/src/constants/Expressions.ts`
- `client/src/stores/agentStore.ts`
- `client/src/services/api.ts`
- `server/src/routes/ai.routes.ts`

Files to avoid:

- `client/public/models/facecap.glb` unless the task explicitly requires model changes.
- Generated build output such as `client/dist/`.

Acceptance criteria:

- New emotion is included in shared TypeScript unions.
- Backend can emit the emotion through detection or response handling.
- Avatar expression uses real morph target names.
- Existing emotions still compile and render.

Build/check command:

```bash
cd client && npm run build
cd ../server && npm run build
```

## Add A New Supported File Type

Goal:

- Allow users to upload and analyze one new safe file type.

Files likely involved:

- `server/src/routes/ai.routes.ts`
- `client/src/components/SpatialObject/ObjectDropZone.tsx`
- `client/src/stores/SpatialObjectStore.ts`
- `client/src/stores/workspaceStore.ts`
- `client/src/components/Scene/WorkspaceSlot.tsx`
- `docs/agent/workspace_artifacts.md`

Files to avoid:

- OpenAI model assets and public GLBs unless display requires a new asset.
- `.env` files.

Acceptance criteria:

- Client file picker accepts the type.
- Server validates the type before processing.
- Server enforces reasonable content/size handling.
- Workspace object type and preview behavior are correct.
- Unsupported files still fail cleanly.

Build/check command:

```bash
cd client && npm run build
cd ../server && npm run build
```

## Add A New Generated Artifact Card

Goal:

- Improve how a generated artifact appears in chat or workspace.

Files likely involved:

- `client/src/components/Chat/ChatWindow.tsx`
- `client/src/components/Scene/WorkspaceSlot.tsx`
- `client/src/stores/workspaceStore.ts`
- `client/src/App.scss`
- `client/src/components/SpatialObject/spatial-object.scss`

Files to avoid:

- `server/src/routes/ai.routes.ts` unless changing attachment shape.
- Public model files unless necessary.

Acceptance criteria:

- Existing attachment downloads still work.
- Object URLs are revoked where appropriate.
- Card handles long filenames without layout breakage.
- Workspace navigation still works with multiple objects.

Build/check command:

```bash
cd client && npm run build
```

## Improve Mobile Responsiveness

Goal:

- Fix or improve mobile layout without breaking desktop scene/chat behavior.

Files likely involved:

- `client/src/App.scss`
- Component-specific Sass files under `client/src/components/**`
- `client/src/App.tsx` only if layout state changes are required.

Files to avoid:

- Backend files.
- Three.js model files.

Acceptance criteria:

- Chat panel can be opened and closed reliably on touch devices.
- Buttons remain tappable and do not jump away from the pointer.
- Text does not overflow compact controls.
- Desktop layout remains visually stable.

Build/check command:

```bash
cd client && npm run build
```

## Add Loading / Error States

Goal:

- Make an async workflow clearer when it is loading, succeeds, or fails.

Files likely involved:

- `client/src/components/Chat/ChatWindow.tsx`
- `client/src/components/SpatialObject/ObjectDropZone.tsx`
- `client/src/stores/agentStore.ts`
- `client/src/stores/hintStore.ts`
- Relevant Sass file.

Files to avoid:

- Backend AI prompt logic unless the error shape must change.

Acceptance criteria:

- Loading state appears promptly.
- Error state is visible and recoverable.
- Agent state returns to a sensible state after failure.
- Disabled controls prevent duplicate unsafe requests.

Build/check command:

```bash
cd client && npm run build
```

## Add A New AI Tool / Action

Goal:

- Add a new backend AI action and expose it safely in the frontend.

Files likely involved:

- `server/src/routes/ai.routes.ts`
- `server/src/services/conversationMemory.ts` if session context changes.
- `client/src/services/api.ts`
- `client/src/components/Chat/ChatWindow.tsx` or a new focused component.
- `client/src/types/agentSteps.ts` if response steps change.

Files to avoid:

- Moving OpenAI calls into `client/`.
- Hardcoding secrets or tokens.

Acceptance criteria:

- Route validates input and demo access.
- OpenAI call is server-side.
- Response type is explicit and handled by the client.
- Cost and latency are considered.
- Errors return safe messages without leaking internals.

Build/check command:

```bash
cd server && npm run build
cd ../client && npm run build
```

## Refactor One Component Safely

Goal:

- Reduce complexity in one component without changing behavior.

Files likely involved:

- The target component.
- Nearby helper/type files if an extraction is warranted.
- Existing Sass only if class ownership moves.

Files to avoid:

- Unrelated stores, services, and route files.
- Formatting churn across the repo.

Acceptance criteria:

- Behavior remains equivalent.
- Public props and API contracts remain stable unless intentionally changed.
- Extracted helpers are typed and locally understandable.
- Build still passes.

Build/check command:

```bash
cd client && npm run build
```
