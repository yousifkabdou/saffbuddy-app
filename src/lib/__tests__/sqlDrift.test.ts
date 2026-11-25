/// <reference types="node" />
import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";

// The 2026-11-23 migration re-creates functions and policies that also live in the schema files.
// The live database (and npm test's local one) ends up with whichever copy ran last: the migration.
// sqlConstants.test.ts only reads the schema files, so if one copy is edited and not the other,
// every test still passes while the database runs the other version. This checks they match.
const sql = (file: string) => readFileSync(join(__dirname, "../../../supabase", file), "utf8");

// Every "create or replace function public.<name>" ... "$$;" block, keyed by name, whitespace squashed.
function functions(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/create or replace function public\.(\w+)\([\s\S]*?\$\$[\s\S]*?\$\$;/g)) {
    out[m[1]] = m[0].replace(/\s+/g, " ").trim();
  }
  return out;
}

// Every 'create policy "<name>"' ... ';' block, keyed by name, whitespace squashed and "public." dropped
// (the migration qualifies table names, the schema files don't; both mean the same table).
function policies(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/create policy "([^"]+)"[\s\S]*?;/g)) {
    out[m[1]] = m[0].replace(/public\./g, "").replace(/\s+/g, " ").trim();
  }
  return out;
}

describe("the migration and the schema files define the same SQL", () => {
  const migration = sql("hardening_2026_11_23.sql");
  const schema = ["profile.sql", "requests.sql", "joins.sql", "expiry.sql", "verify_osu_email.sql"].map(sql).join("\n");

  it.each(Object.keys(functions(migration)))("function %s", (name) => {
    expect(functions(schema)[name]).toBe(functions(migration)[name]);
  });

  it.each(Object.keys(policies(migration)))("policy %s", (name) => {
    expect(policies(schema)[name]).toBe(policies(migration)[name]);
  });

  it("finds the blocks it compares (so an empty match can't pass silently)", () => {
    expect(Object.keys(functions(migration)).length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(policies(migration)).length).toBeGreaterThanOrEqual(2);
  });
});
