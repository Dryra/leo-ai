# Getting Started For Agents

This guide is for AI coding agents setting up and validating the LEO AI repository locally.

## Install Dependencies

From the repository root:

```bash
npm install
```

Install the frontend:

```bash
cd client
npm install
```

Install the backend:

```bash
cd server
npm install
```

## Run Frontend

```bash
cd client
npm run dev
```

Default Vite URL is usually:

```text
http://localhost:5173
```

## Run Backend

```bash
cd server
npm run dev
```

Default backend URL:

```text
http://localhost:3001
```

## Run Both

From the repository root:

```bash
npm run dev
```

This runs `server` and `client` dev scripts concurrently.

## Environment Variables

Create `server/.env` with placeholders like:

```bash
PORT=3001
OPENAI_API_KEY=replace_with_openai_api_key
DEMO_TOKEN=replace_with_demo_token
CLIENT_URL=http://localhost:5173
CONTACT_EMAIL=replace_with_contact_email
CONTACT_LINKEDIN_URL=replace_with_public_linkedin_url
```

Create `client/.env` with placeholders like:

```bash
VITE_API_URL=http://localhost:3001
VITE_CONTACT_EMAIL=replace_with_contact_email
VITE_CONTACT_LINKEDIN_URL=replace_with_public_linkedin_url
```

Rules:

- Never commit `.env` files.
- Never write real secrets into docs.
- Only `VITE_` variables are available in the browser.
- `OPENAI_API_KEY` must remain server-side.

## Local Development Workflow

- Start backend first when testing AI features.
- Start frontend after `VITE_API_URL` points to the backend.
- In every environment, token-free requests use limited normal mode. A valid `x-demo-token` matching `DEMO_TOKEN` bypasses public quotas; invalid tokens receive HTTP 403.
- Client session IDs are stored in `localStorage` under `leo-ai-session-id`.
- Uploads, voice, and chat all pass `x-session-id` to the backend.

## Build And Check Commands

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

Root dev smoke check:

```bash
npm run dev
```

There is no implemented automated test suite at the time this doc was written. The backend `npm test` script is a placeholder that intentionally exits with an error.

## Troubleshooting

- `Missing required environment variable`: check `server/.env`; `OPENAI_API_KEY` is required for real AI calls.
- Browser cannot reach backend: check `VITE_API_URL`, backend port, and CORS `CLIENT_URL`.
- CORS blocked origin: add the exact frontend origin to `CLIENT_URL` or update `allowedOrigins` in `server/src/index.ts`.
- Microphone does not work: use HTTPS or localhost, grant browser microphone permission, and ensure no other recorder is active.
- Voice upload fails: verify browser `MediaRecorder` can produce `audio/webm`.
- Object upload fails with unsupported type: check server `IMAGE_MIME_TYPES`, `TEXT_EXTENSIONS`, PDF branch, and client file input `accept`.
- 3D model or texture missing: check `client/public/models`, `client/public/basis`, and public asset paths.
- Production demo access denied: verify the URL token and `DEMO_TOKEN` match; client expects `?token=...` and then sends `x-demo-token`.

## Normal Mode Usage Limits

Normal mode retains chat, voice, speech, upload analysis, and artifact/image generation.
The server reserves quota before uploads or AI calls. Chat and voice each count as one
request including their generated speech; standalone speech and object analysis each
count as one. Failed or cancelled requests still consume quota to prevent retry abuse.
Image generation additionally reserves image quota, including model-selected images.

Defaults in `server/.env.example`:

- `PUBLIC_DAILY_REQUESTS=20`: shared requests per client IP per UTC day.
- `PUBLIC_REQUESTS_PER_MINUTE=5`: requests per IP in a rolling minute.
- `PUBLIC_GLOBAL_DAILY_REQUESTS=200`: total public requests per UTC day.
- `PUBLIC_DAILY_IMAGES=2` and `PUBLIC_GLOBAL_DAILY_IMAGES=20`: image sublimits.
- One public request in flight per IP while its HTTP connection remains open.

HTTP 429 includes a readable error, `retryAfter` seconds, and a `Retry-After` header.
The chat already displays server errors. `GET /api/ai/appType` reports the mode and
configured public limits using the same token header; it does not consume quota.
Messages and speech inputs are capped at 4,000 characters and uploads at 5 MB.
Public responses have a 1,200 output-token ceiling; demo responses have a 4,096 ceiling.
Public text-file analysis reads at most 12,000 characters into the model prompt.
Generated speech is capped at 4,000 characters. Oversized transcriptions are rejected
after transcription, so their transcription cost is still incurred.

Daily counters persist in `USAGE_STATE_PATH` (default `data/usage.json`, relative to
the backend working directory). Mount this path on persistent storage in production.
The file contains hashed IP identifiers and counters, not conversations or uploads.
Accounting read/write failures block public requests. Keep this deployment to one
backend process: multiple replicas need an atomic shared store such as Redis before
these quotas can be relied on. Ephemeral disks reset quotas on redeployment.
Minute/concurrency counters are in memory and reset on restart.

IP quotas group users behind a shared network and can be evaded by changing IPs;
the global daily cap bounds aggregate public requests. Configure `TRUST_PROXY` only
with the addresses/subnets of your actual trusted reverse proxies and block direct
access around them. Otherwise requests behind a proxy share its IP allowance.
Client-controlled session IDs and forwarded headers are not trusted as identities.
These are request limits, not an exact currency budget: upload complexity and model
costs vary. Valid demo tokens bypass public quotas and should remain private.
