/// <reference types="node" />
import { afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";

// fetchWithTimeout (src/lib/supabase.ts): the only thing stopping a stalled request from
// spinning forever. Module side effects (storage, URL polyfill, the real client) are mocked out.
jest.mock("react-native-url-polyfill/auto", () => ({}));
jest.mock("expo-sqlite/localStorage/install", () => ({}));
jest.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));

let fetchWithTimeout: typeof import("@/lib/supabase").fetchWithTimeout;
let REQUEST_TIMEOUT_MS: number;

beforeAll(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.invalid";
  process.env.EXPO_PUBLIC_SUPABASE_KEY = "test-key";
  // supabase.ts passes the global localStorage (installed by expo-sqlite, mocked above) to the client.
  (globalThis as { localStorage?: object }).localStorage = {};
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- must load after the env vars are set
  ({ fetchWithTimeout, REQUEST_TIMEOUT_MS } = require("@/lib/supabase"));
});

// A fetch that never answers on its own; it only rejects when its signal aborts (like a real one).
function hangingFetch() {
  const abortError = () => Object.assign(new Error("Aborted"), { name: "AbortError" });
  return jest.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    if (init?.signal?.aborted) return reject(abortError()); // real fetch refuses an already-aborted signal
    init?.signal?.addEventListener("abort", () => reject(abortError()));
  }));
}

afterEach(() => {
  jest.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("aborts a stalled request after REQUEST_TIMEOUT_MS", async () => {
    jest.useFakeTimers();
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const result = fetchWithTimeout("https://example.invalid/x");
    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS - 1);
    let settled = false;
    result.catch(() => {}).finally(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false); // not yet
    jest.advanceTimersByTime(1);
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it("passes through a caller's abort", async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const caller = new AbortController();
    const result = fetchWithTimeout("https://example.invalid/x", { signal: caller.signal });
    caller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it("an already-aborted caller signal aborts at once", async () => {
    global.fetch = hangingFetch() as unknown as typeof fetch;
    const caller = new AbortController();
    caller.abort();
    await expect(fetchWithTimeout("https://example.invalid/x", { signal: caller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("clears its timer when the response arrives (no stray abort later)", async () => {
    jest.useFakeTimers();
    const ok = new Response("{}", { status: 200 });
    global.fetch = jest.fn(async () => ok) as unknown as typeof fetch;
    await expect(fetchWithTimeout("https://example.invalid/x")).resolves.toBe(ok);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("keeps the caller's other options (method, headers, body)", async () => {
    const spy = jest.fn(async (_input: unknown, _init?: RequestInit) => new Response("{}"));
    global.fetch = spy as unknown as typeof fetch;
    await fetchWithTimeout("https://example.invalid/x", { method: "POST", headers: { a: "b" }, body: "x" });
    expect(spy.mock.calls[0][1]).toMatchObject({ method: "POST", headers: { a: "b" }, body: "x" });
  });
});
