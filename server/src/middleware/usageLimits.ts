import type { Request, RequestHandler } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function limit(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`Invalid ${name}`);
  return value;
}
export const usageLimits = {
  daily: limit("PUBLIC_DAILY_REQUESTS", 20),
  minute: limit("PUBLIC_REQUESTS_PER_MINUTE", 5),
  globalDaily: limit("PUBLIC_GLOBAL_DAILY_REQUESTS", 200),
  images: limit("PUBLIC_DAILY_IMAGES", 2),
  globalImages: limit("PUBLIC_GLOBAL_DAILY_IMAGES", 20),
};
const statePath = path.resolve(
  process.env.USAGE_STATE_PATH ?? "data/usage.json",
);
type Counter = { requests: number; images: number };
type State = { day: string; total: Counter; clients: Record<string, Counter> };
let state: State;
const recent = new Map<string, number[]>();
const active = new Set<string>();

export function hasDemoAccess(req: Request) {
  const expected = process.env.DEMO_TOKEN;
  const supplied = req.get("x-demo-token");
  if (!expected || !supplied) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(expected), hash(supplied));
}
function clientKey(req: Request) {
  return createHash("sha256")
    .update(req.ip ?? req.socket.remoteAddress ?? "unknown")
    .digest("hex");
}
function currentState() {
  if (!state) {
    try {
      const loaded: State = JSON.parse(fs.readFileSync(statePath, "utf8"));
      if (
        !loaded ||
        typeof loaded.day !== "string" ||
        !loaded.total ||
        !loaded.clients ||
        ![loaded.total, ...Object.values(loaded.clients)].every(
          (c) =>
            Number.isSafeInteger(c.requests) &&
            c.requests >= 0 &&
            Number.isSafeInteger(c.images) &&
            c.images >= 0,
        )
      ) {
        throw new Error("Invalid usage state");
      }
      state = loaded;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const day = new Date().toISOString().slice(0, 10);
  if (!state || state.day !== day)
    state = { day, total: { requests: 0, images: 0 }, clients: {} };
  return state;
}
export class UsageLimitError extends Error {
  constructor(
    public retryAfter: number,
    message = "Normal-mode usage limit reached. Please try again later or use a valid demo token.",
  ) {
    super(message);
  }
}
function untilTomorrow() {
  const now = Date.now();
  return Math.ceil(
    (Date.parse(new Date(now).toISOString().slice(0, 10)) + 86400000 - now) /
      1000,
  );
}
function reserve(req: Request, kind: keyof Counter) {
  const data = currentState();
  const key = clientKey(req);
  const client = data.clients[key] ?? { requests: 0, images: 0 };
  const perClient = kind === "images" ? usageLimits.images : usageLimits.daily;
  const global =
    kind === "images" ? usageLimits.globalImages : usageLimits.globalDaily;
  if (client[kind] >= perClient || data.total[kind] >= global)
    throw new UsageLimitError(untilTomorrow());
  client[kind]++;
  data.total[kind]++;
  data.clients[key] = client;
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(`${statePath}.tmp`, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(`${statePath}.tmp`, statePath);
}
export function reserveImage(req: Request) {
  if (!hasDemoAccess(req)) reserve(req, "images");
}
export const enforceUsage: RequestHandler = (req, res, next) => {
  if (req.get("x-demo-token") && !hasDemoAccess(req)) {
    res.status(403).json({
      error: "Invalid demo token. Remove it to use limited normal mode.",
    });
    return;
  }
  if (hasDemoAccess(req)) {
    next();
    return;
  }
  const key = clientKey(req);
  const now = Date.now();
  for (const [id, times] of recent)
    if (times.every((t) => t <= now - 60000)) recent.delete(id);
  const times = (recent.get(key) ?? []).filter((t) => t > now - 60000);
  try {
    if (active.has(key))
      throw new UsageLimitError(
        5,
        "An AI request is already running. Please wait for it to finish.",
      );
    if (times.length >= usageLimits.minute)
      throw new UsageLimitError(Math.ceil((times[0] + 60000 - now) / 1000));
    reserve(req, "requests");
    recent.set(key, [...times, now]);
    active.add(key);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active.delete(key);
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  } catch (error) {
    if (error instanceof UsageLimitError) {
      res
        .set("Retry-After", String(error.retryAfter))
        .status(429)
        .json({ error: error.message, retryAfter: error.retryAfter });
    } else {
      res.status(503).json({
        error: "Usage accounting is unavailable. Please try again later.",
      });
    }
  }
};
