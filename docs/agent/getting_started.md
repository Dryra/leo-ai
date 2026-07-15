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
- In development, backend demo-token checks are bypassed because `hasDemoAccess` allows all non-production requests.
- For production-like demo-token behavior, requests must include `x-demo-token`.
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
