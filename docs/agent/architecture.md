# Architecture

## High-Level Architecture

LEO AI is split into:

- Frontend: React app served by Vite from `client/`.
- Backend: Express API from `server/`.
- AI provider: OpenAI API calls made only from the backend.
- Browser capabilities: microphone recording, Web Audio playback/analysis, localStorage session ID, Blob/Object URLs for previews and downloads.

Runtime flow:

1. User interacts with chat, microphone, or object drop zone in the browser.
2. Client sends requests to backend `/api/ai/*` endpoints with `x-session-id`.
3. Backend uses in-memory session history and object context.
4. Backend calls OpenAI APIs.
5. Backend returns text, audio base64, emotion/gesture hints, and optional base64 attachments.
6. Client updates chat messages, avatar state, workspace stores, and audio playback.

## Frontend Responsibilities

Key files:

- `client/src/App.tsx`: top-level scene and panel composition, chat visibility, UI color binding.
- `client/src/components/Chat/ChatWindow.tsx`: text chat, voice chat, demo token extraction, messages, generated attachments, avatar state updates.
- `client/src/components/SpatialObject/ObjectDropZone.tsx`: file selection/drop, upload lifecycle, workspace object creation, delete behavior.
- `client/src/components/Scene/AgentScene.tsx`: React Three Fiber `Canvas`, avatar, environment, voice waveform, workspace ring, camera controls.
- `client/src/components/Scene/FaceModel.tsx`: GLB face model, morph target expressions, gestures, head motion, state-based visual material changes.
- `client/src/services/api.ts`: Axios API functions and demo-token header behavior.
- `client/src/services/audio.ts`: base64 audio conversion, Web Audio playback, mouth volume callbacks.
- `client/src/stores/`: Zustand stores for agent, neuro voice, spatial object, workspace, hints, camera, and background audio.

Frontend owns:

- UI state and layout.
- Browser media recording.
- Audio playback and mouth-volume analysis.
- Object preview URLs and download URLs.
- Spatial workspace display state.
- Avatar animation inputs and visual state.

## Backend Responsibilities

Key files:

- `server/src/index.ts`: Express app, CORS, JSON body middleware, route mount.
- `server/src/routes/ai.routes.ts`: chat, voice, speech, object analysis, generated attachments, emotion/gesture detection.
- `server/src/services/conversationMemory.ts`: in-memory conversation sessions, object context, session lock.
- `server/src/config/env.ts`: dotenv loading and required env helper.

Backend owns:

- OpenAI API usage.
- Demo-token authorization in production.
- Conversation memory and uploaded-object context.
- Temporary upload handling through Multer.
- PDF/image/text attachment generation.
- TTS and transcription.

## AI Request Flow

Text chat:

1. `ChatWindow.handleSend` calls `sendMessage`.
2. `sendMessage` posts to `POST /api/ai/chat`.
3. Backend validates demo access and message.
4. Backend builds conversation input from `conversationMemory`.
5. Backend calls `openai.responses.create` with `CHAT_FILE_INSTRUCTIONS` and a JSON schema.
6. Backend optionally creates a generated attachment.
7. Backend creates TTS audio with `openai.audio.speech.create`.
8. Client receives response, updates chat, expression, gesture, workspace artifact, and plays audio.

Voice chat:

1. `useVoiceRecorder` records `audio/webm`.
2. `sendVoiceMessage` posts multipart field `audio` to `POST /api/ai/voice`.
3. Backend transcribes with `gpt-4o-mini-transcribe`.
4. Backend follows the same structured response and TTS flow as chat.

Speech-only:

- `POST /api/ai/speech` accepts `{ text }` and returns base64 TTS audio.
- This endpoint exists in the API service but is not the main chat path.

## File Upload / Analysis Flow

1. User drops/selects a file in `ObjectDropZone`.
2. Client creates a local object ID and optional image preview URL.
3. Client adds entries to `useSpatialObjectStore` and `useWorkspaceStore`.
4. Client calls `uploadObject` with multipart field `object`.
5. Backend analyzes supported files:
   - Images: OpenAI Responses API with `input_image` data URL.
   - PDFs: OpenAI Files API with purpose `user_data`, then Responses API with `input_file`.
   - Text/code/markdown extensions: file content read as UTF-8 and sliced to 120,000 characters.
6. Backend stores object context for follow-up chat.
7. Backend returns analysis, reply, audio, emotion, gesture, and a server-generated `objectId`.
8. Client patches the spatial object, updates workspace object ID/details, plays analysis audio, and sets agent state.
9. Delete calls `DELETE /api/ai/object`, clears server object context, and clears client object state.

## Generated Artifact Flow

Generated artifacts originate from chat or voice responses.

- `CHAT_FILE_INSTRUCTIONS` asks the model to return structured JSON.
- `parseChatResponse` normalizes model output.
- `createChatAttachment` supports PDFs, images, and text-like MIME types.
- Direct image requests are also detected by `getImageGenerationPrompt` and sent to the OpenAI Images API.
- Backend returns attachments as base64 `{ fileName, mimeType, data }`.
- Client converts attachment base64 to Blob URLs for download.
- Client creates workspace entries for generated attachments in `ChatWindow.displayAttachmentInWorkspace`.

## Avatar / 3D Rendering Flow

- `App.tsx` stores `facialExpression` and passes it to `AgentScene`.
- `AgentScene` renders `FaceModel`, two `VoiceWaveform` instances, `FuturisticEnvironment`, and `WorkspaceRing`.
- `FaceModel` loads `/models/facecap.glb`, applies hologram materials, and lerps morph target influences from `FACIAL_EXPRESSIONS`.
- `useAgentStore` drives high-level state: `idle`, `listening`, `inspecting`, `thinking`, `ready`, `speaking`.
- `setSpeaking(true)` sets `state` to `speaking`; `setSpeaking(false)` returns to `afterSpeakingState` or `idle`.
- `mouthOpen` comes from Web Audio volume analysis.
- `gesture` currently supports `none` and `wink`.

## State Management Notes

- Zustand is the cross-component state mechanism.
- `agentStore` controls avatar state, emotion, speaking, mouth-open amount, gestures, attention, and activity.
- `neuroVoiceStore` controls always-listening mode and voice activity state.
- `SpatialObjectStore` tracks the current uploaded/generated object for close spatial display.
- `workspaceStore` tracks all workspace objects and active navigation index.
- `session.ts` persists a browser session ID in `localStorage`.

## Deployment Overview

- README links a Netlify frontend deployment.
- Backend hosting/deployment details are to be confirmed.
- Production backend demo access depends on `NODE_ENV === "production"` and matching `DEMO_TOKEN`.
- CORS origins are configured in `server/src/index.ts` and include localhost, one LAN URL, the Netlify URL, and optional `CLIENT_URL`.
- Generated/uploaded files are not persisted by the current code except temporarily during request handling.
