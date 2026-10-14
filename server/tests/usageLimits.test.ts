import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "leo-usage-"));
process.env.USAGE_STATE_PATH = path.join(dir, "usage.json");
process.env.PUBLIC_DAILY_REQUESTS = "2";
process.env.PUBLIC_REQUESTS_PER_MINUTE = "10";
process.env.PUBLIC_GLOBAL_DAILY_REQUESTS = "3";
process.env.PUBLIC_DAILY_IMAGES = "1";
process.env.DEMO_TOKEN = "test-only-token";
const { enforceUsage, reserveImage, UsageLimitError } = require("../src/middleware/usageLimits");

function request(ip: string, token?: string) {
  return { ip, socket: {}, get: (name: string) => name === "x-demo-token" ? token : undefined };
}
function call(ip: string, token?: string) {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200, body: null as unknown,
    set() { return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  });
  let passed = false;
  enforceUsage(request(ip, token), res, () => { passed = true; });
  return { res, passed };
}

test("enforces public quotas, concurrency, persistence and demo authentication", () => {
  try {
    const first = call("127.0.0.1");
    assert.equal(first.passed, true);
    assert.equal(call("127.0.0.1").res.statusCode, 429);
    first.res.emit("finish");
    const second = call("127.0.0.1");
    assert.equal(second.passed, true);
    first.res.emit("close");
    assert.equal(call("127.0.0.1").res.statusCode, 429);
    second.res.emit("finish");
    assert.equal(call("127.0.0.1").res.statusCode, 429);
    assert.equal(call("127.0.0.1", "wrong").res.statusCode, 403);
    assert.equal(call("127.0.0.1", "test-only-token").passed, true);
    const third = call("127.0.0.2");
    assert.equal(third.passed, true);
    third.res.emit("finish");
    assert.equal(call("127.0.0.3").res.statusCode, 429);
    reserveImage(request("127.0.0.1"));
    assert.throws(() => reserveImage(request("127.0.0.1")), UsageLimitError);
    assert.doesNotThrow(() => reserveImage(request("127.0.0.1", "test-only-token")));
    const saved = fs.readFileSync(process.env.USAGE_STATE_PATH!, "utf8");
    assert.equal(JSON.parse(saved).total.requests, 3);
    assert.equal(saved.includes("127.0.0.1"), false);
    // A fresh module instance must reload the daily counters from disk.
    delete require.cache[require.resolve("../src/middleware/usageLimits")];
    const reloaded = require("../src/middleware/usageLimits");
    assert.throws(() => reloaded.reserveImage(request("127.0.0.1")), reloaded.UsageLimitError);
    // Corrupt persisted state must fail closed on every attempt.
    fs.writeFileSync(process.env.USAGE_STATE_PATH!, '{"day":"broken"}');
    delete require.cache[require.resolve("../src/middleware/usageLimits")];
    const broken = require("../src/middleware/usageLimits");
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.throws(() => broken.reserveImage(request("127.0.0.8")));
    }
    // Old daily usage resets at the UTC day boundary.
    fs.writeFileSync(process.env.USAGE_STATE_PATH!, JSON.stringify({
      day: "2000-01-01", total: { requests: 999, images: 999 }, clients: {},
    }));
    delete require.cache[require.resolve("../src/middleware/usageLimits")];
    const fresh = require("../src/middleware/usageLimits");
    assert.doesNotThrow(() => fresh.reserveImage(request("127.0.0.8")));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
