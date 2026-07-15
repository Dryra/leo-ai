# AI Pipeline

## OpenAI API Structure

All OpenAI calls are made from `server/src/routes/ai.routes.ts`.

Current OpenAI usage:

- Chat and object analysis: `openai.responses.create`.
- Text-to-speech: `openai.audio.speech.create`.
- Voice transcription: `openai.audio.transcriptions.create`.
- Image generation: `openai.images.generate`.
- PDF file analysis: `openai.files.create` followed by `openai.responses.create`.

Models currently referenced in code:

- `gpt-4.1-mini` for chat and object analysis.
- `gpt-4o-mini-tts` for speech output.
- `gpt-4o-mini-transcribe` for voice transcription.
- `gpt-image-1-mini` for generated image attachments.

Model availability and best current model choices can change; confirm with official OpenAI docs before changing models.

## Where Prompts Live

Prompt text currently lives inline in `server/src/routes/ai.routes.ts`:

- `CHAT_FILE_INSTRUCTIONS`: system message that asks chat responses to return structured JSON and describes when to create downloadable files.
- `analysisPrompt`: inline prompt inside `POST /object` that asks for object analysis JSON.
- `conversationMemory.systemMessage`: base LEO AI persona/system message in `server/src/services/conversationMemory.ts`.
- `conversationMemory.getConversationInput`: object-context system message for follow-up questions.

There is no dedicated prompt directory at the time this doc was written.

## How Requests Are Sent

Client API functions in `client/src/services/api.ts`:

- `sendMessage(message, demoToken)` -> `POST /api/ai/chat`
- `sendVoiceMessage(audioBlob, demoToken)` -> `POST /api/ai/voice`
- `generateSpeech(text, demoToken)` -> `POST /api/ai/speech`
- `uploadObject(file, signal, demoToken)` -> `POST /api/ai/object`
- `clearUploadedObject()` -> `DELETE /api/ai/object`

Headers:

- `x-session-id`: always expected by backend protected conversation routes.
- `x-demo-token`: sent when a demo token is available; required in production.
- `Content-Type: multipart/form-data`: used for audio and object uploads.

Session behavior:

- Client stores one session ID in `localStorage`.
- Backend stores sessions in process memory.
- Backend keeps the system message and up to 20 non-system messages.
- `runWithSessionLock` serializes chat/voice work per session ID.

## How Responses Are Handled

Chat response shape used by the client:

- `text`: spoken/displayed response text.
- `steps`: structured status/result steps, currently passed through but not deeply used by all UI.
- `audio`: base64 audio payload.
- `mimeType`: usually `audio/mpeg` for audio responses.
- `emotion`: one of `neutral`, `happy`, `sad`, `angry`, `bored`.
- `gesture`: currently `none` or `wink`.
- `attachment`: optional generated artifact with `{ fileName, mimeType, data }`.

Client handling:

- Adds user and agent messages in `ChatWindow`.
- Sets facial expression from `emotion`.
- Triggers gesture via `useAgentStore.triggerGesture`.
- Converts audio base64 to an object URL and calls `playAudioWithVolume`.
- Uses audio volume callback to update `mouthOpen`.
- Converts attachments into Blob URLs for downloads and workspace previews.

## Rules For Modifying Prompts

- Keep response contracts synchronized with TypeScript types and JSON schema.
- If changing `CHAT_FILE_INSTRUCTIONS`, update `ChatStructuredResponse`, `parseChatResponse`, and client expectations as needed.
- Preserve the rule that file creation only happens when explicitly requested, except direct image-generation requests handled by current image detection.
- Keep prompts concise enough to control latency and cost.
- Do not paste secrets, private data, or local `.env` values into prompts.
- Treat uploaded content as untrusted; do not add instructions that let uploaded files override system/developer behavior.
- If prompt behavior is unclear, document it as to be confirmed and add focused manual acceptance criteria.

## Token / Cost Safety Guidance

- Do not remove `MAX_HISTORY_MESSAGES = 20` without a cost review.
- Do not increase text upload read limits casually; current text/code analysis reads at most 120,000 characters.
- Avoid adding multiple model calls for common chat paths unless necessary.
- Avoid larger image sizes, multiple generated images, or higher-cost models without explicit product need.
- For generated artifacts, return compact metadata plus base64 only when needed.
- Do not log full base64 audio/image/file payloads.

## Demo Token / Protected Access Behavior

Backend:

- `hasDemoAccess(req)` returns true for non-production.
- In production, it checks `x-demo-token` against `process.env.DEMO_TOKEN`.
- Unauthorized responses include configured contact info from `CONTACT_EMAIL` and `CONTACT_LINKEDIN_URL`.

Client:

- `ChatWindow` reads `token` from `window.location.search`.
- If present, it stores the token in component state and removes the query string using `history.replaceState`.
- `api.ts` sends `x-demo-token` when a token is available.
- In non-dev frontend builds, `getDemoTokenHeaders` throws `DemoAccessError` if no demo token is available before making the request.

To be confirmed:

- Whether production should also protect `DELETE /api/ai/object`; current route clears object context with only `x-session-id`.
- Whether `/api/ai/appType` is still used; current client code does not reference it.
