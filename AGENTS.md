# AGENTS.md

Guidance for Codex and other AI coding agents working in this repository.

## Project Overview

LEO AI is a real-time conversational AI avatar app. It combines a React/Vite frontend, a Three.js/React Three Fiber avatar scene, browser voice capture/playback, an Express backend, and OpenAI API calls for chat, speech, transcription, image generation, and uploaded-object analysis.

Detailed docs:

- [Getting started](docs/agent/getting_started.md)
- [Architecture](docs/agent/architecture.md)
- [AI pipeline](docs/agent/ai_pipeline.md)
- [Avatar system](docs/agent/avatar_system.md)
- [Workspace artifacts](docs/agent/workspace_artifacts.md)
- [Example tasks](docs/agent/example_tasks.md)

## What The App Does

- Lets users chat with LEO AI using text or microphone input.
- Plays OpenAI-generated speech audio and drives mouth movement from audio volume.
- Renders a holographic 3D avatar with facial expressions, gestures, attention targeting, and state-based visuals.
- Accepts uploaded images, PDFs, text, code, and markdown for AI analysis.
- Creates downloadable AI-generated artifacts such as text-like files, PDFs, and images.
- Shows uploaded/generated artifacts in a spatial workspace ring.
- Supports production demo-token access via the `x-demo-token` request header.

## Tech Stack

- Root: Node/npm workspace-style scripts, `concurrently`.
- Frontend: React 19, TypeScript, Vite, Sass, Zustand, Three.js, React Three Fiber, Drei, Axios.
- Backend: Node.js, Express 5, TypeScript, tsx, OpenAI SDK, Multer, PDFKit, CORS, dotenv.

## Repo Structure

- `client/`: Vite React frontend.
- `client/src/App.tsx`: app shell, scene, panel, chat visibility, global UI color.
- `client/src/components/Chat/`: chat UI, voice/text message handling, neuro mode toggle.
- `client/src/components/Scene/`: Three.js scene, avatar model, workspace ring, visual effects.
- `client/src/components/SpatialObject/`: object upload/drop zone UI.
- `client/src/services/`: browser API client, session ID, audio helpers.
- `client/src/stores/`: Zustand state stores.
- `server/`: Express backend.
- `server/src/routes/ai.routes.ts`: AI endpoints and prompt/attachment logic.
- `server/src/services/conversationMemory.ts`: in-memory session history and object context.
- `server/src/config/env.ts`: dotenv loading and required env helper.
- `docs/agent/`: documentation for future coding agents.

## Setup Commands

Install root helper dependency:

```bash
npm install
```

Frontend:

```bash
cd client
npm install
npm run dev
```

Backend:

```bash
cd server
npm install
npm run dev
```

Run both from the root:

```bash
npm run dev
```

## Build Commands

Frontend:

```bash
cd client
npm run build
npm run lint
```

Backend:

```bash
cd server
npm run build
```

There is no working backend test suite yet; `server/package.json` has a placeholder `test` script that exits with an error.

## Environment Variable Rules

- Never commit `.env` files or real secrets.
- Use placeholders only in docs and examples.
- Server env lives in `server/.env` and is loaded by `server/src/config/env.ts`.
- Client env lives in `client/.env` and only exposes variables prefixed with `VITE_`.
- Required for real AI calls: `OPENAI_API_KEY`.
- Production demo access uses `DEMO_TOKEN`; the client passes it as `x-demo-token` when present in the URL query as `?token=...`.
- Keep contact values optional/placeholders unless the owner provides real public values.

## AI / OpenAI Security Rules

- Do not expose `OPENAI_API_KEY` to the frontend.
- Keep OpenAI calls server-side.
- Do not log secrets, uploaded file contents, full transcripts, or base64 artifact payloads.
- Treat uploaded files and prompts as untrusted user input.
- Preserve demo-token checks when editing protected routes.
- Be conservative with model, image size, and history changes because they affect cost and latency.

## File Upload Rules

- Upload analysis uses `POST /api/ai/object` with Multer field name `object`.
- Voice upload uses `POST /api/ai/voice` with Multer field name `audio`.
- Server uploads are temporary and should be deleted in success and error paths.
- Client object previews use `URL.createObjectURL`; revoke object URLs when removing or replacing objects.
- If adding a supported type, update server validation, client file input `accept`, client kind/type mapping, and docs together.

## Three.js / React Three Fiber Rules

- Keep render-loop work inside `useFrame`; avoid React state updates inside every frame.
- Reuse `useMemo`, refs, and existing stores for high-frequency animation values.
- Dispose custom materials, helpers, and temporary Three.js objects in cleanup effects.
- Keep GLB/public asset paths stable unless all references are updated.
- Add morph targets only if the model actually contains those target names.

## Audio / Voice Interaction Rules

- Browser recording uses `MediaRecorder` and requires microphone permission.
- Text-to-speech audio is returned as base64, converted to object URLs, played through Web Audio, and used to derive mouth-open volume.
- Always stop media tracks when recording ends or is cancelled.
- Avoid overlapping manual recording, neuro always-listening, and agent speech states.
- Preserve `setSpeaking(true/false)` behavior because it drives `state: "speaking"` and return-state handling.

## Generated Artifact Rules

- Server responses may include `attachment: { fileName, mimeType, data }` where `data` is base64.
- Client turns attachment base64 into Blob URLs for download and workspace display.
- Text-like files are generated from UTF-8 content.
- PDFs are generated server-side with PDFKit.
- Images are generated server-side through the OpenAI Images API.
- Do not persist generated artifact payloads unless a storage design is explicitly added.

## Coding Style Rules

- Prefer existing local patterns over new abstractions.
- Use TypeScript types for API contracts and store state.
- Keep changes scoped to the requested behavior.
- Use Zustand stores consistently for cross-component UI/avatar/workspace state.
- Keep Sass class naming compatible with existing styles.
- Avoid broad refactors while fixing a narrow bug.
- Use `rg` for search and inspect the actual code before changing docs or behavior.

## Checks Before Finishing

Run the smallest relevant checks for your change:

- Docs only: usually no build is required, but run build if references or package scripts changed.
- Frontend changes: `cd client && npm run build`; run `npm run lint` when practical.
- Backend changes: `cd server && npm run build`.
- Full app script smoke check when needed: `npm run dev`.

## Do Not

- Do not commit or print real `.env` values, API keys, demo tokens, or private contact details.
- Do not move OpenAI calls into the browser.
- Do not remove production demo-token protection without explicit instruction.
- Do not leave temporary uploaded files undeleted on the server.
- Do not add unbounded conversation history, large upload reads, or expensive model calls without cost/latency review.
- Do not update generated build output unless the project expects it.
- Do not modify 3D model assets casually; document why any asset changes are necessary.
- Do not change application logic while updating docs unless needed to fix broken docs references.
