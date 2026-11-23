/// <reference types="node" />
import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";
import {
  EXPIRY_MINUTES, JOIN_GRACE_MINUTES, SERVER_DELETE_MINUTES, START_OFFSETS,
} from "@/lib/requestTime";

// The app's time rules mirror intervals written in the SQL. Comments alone kept them in step;
// this turns "must match" into a failing test if one side changes without the other.
const sql = (file: string) => readFileSync(join(__dirname, "../../../supabase", file), "utf8");
const minutesIn = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((m) => Number(m[1]));

describe("app time constants match the SQL", () => {
  const joins = sql("joins.sql");
  const requests = sql("requests.sql");
  const expiry = sql("expiry.sql");

  it("join, leave and cancel cutoffs all use JOIN_GRACE_MINUTES", () => {
    const cutoffs = [
      ...minutesIn(joins, /now\(\) - interval '(\d+) minutes' </g),        // join insert policy
      ...minutesIn(joins, /> now\(\) - interval '(\d+) minutes'/g),        // leave policy
      ...minutesIn(requests, /> now\(\) - interval '(\d+) minutes'/g),     // cancel policy
    ];
    expect(cutoffs).toHaveLength(3);
    expect(cutoffs.every((m) => m === JOIN_GRACE_MINUTES)).toBe(true);
  });

  it("the expiry job deletes at SERVER_DELETE_MINUTES, after the app hides requests", () => {
    const deletes = minutesIn(expiry, /start_time <= now\(\) - interval '(\d+) minutes'/g);
    expect(deletes.length).toBeGreaterThanOrEqual(2);
    expect(deletes.every((m) => m === SERVER_DELETE_MINUTES)).toBe(true);
    expect(EXPIRY_MINUTES).toBeLessThan(SERVER_DELETE_MINUTES);
  });

  it("post_request accepts exactly START_OFFSETS", () => {
    const list = joins.match(/minutes not in \(([\d, ]+)\)/);
    expect(list).not.toBeNull();
    expect(list![1].split(",").map((m) => Number(m.trim()))).toEqual(START_OFFSETS);
  });

  it("every start offset fits inside the insert policy's window", () => {
    const window = joins.match(/between now\(\) \+ interval '(\d+) minutes' and now\(\) \+ interval '(\d+) minutes'/);
    expect(window).not.toBeNull();
    const [low, high] = [Number(window![1]), Number(window![2])];
    expect(START_OFFSETS.every((m) => m > low && m < high)).toBe(true);
  });
});
