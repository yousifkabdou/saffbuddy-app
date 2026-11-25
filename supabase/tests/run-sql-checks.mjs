// Runs the SQL checks in supabase/tests/ on a local Postgres (PGlite: real Postgres compiled
// to WebAssembly, in memory), so `npm test` and CI catch a broken security rule without
// touching the live project. Plain Node, not Jest: Jest can't load PGlite's WebAssembly.
//
// It builds the database from the schema files in the README's order, on top of a small stub
// of Supabase's auth/realtime/cron (local/supabase_stub.sql), then applies the latest migration
// again to prove it's safe to re-run. Each check file raises "FAIL: ..." if a check fails.
// The live project can still differ (dashboard edits), so also run the files in the SQL Editor.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(dir, file), "utf8");

// Order matters: each file uses tables or functions from the ones before it.
const SCHEMA_ORDER = [
  "profile.sql", "rooms.sql", "requests.sql", "joins.sql", "tally.sql",
  "expiry.sql", "live_updates.sql", "delete_account.sql", "verify_osu_email.sql",
];
const MIGRATIONS = ["hardening_2026_11_23.sql"];
const CHECKS = ["security_checks.sql", "expiry_checks.sql", "delete_account_checks.sql", "live_updates_checks.sql", "overnight_checks.sql"];

async function run(db, label, file) {
  try {
    await db.exec(read(file));
    console.log(`  ok    ${label} ${file}`);
    return true;
  } catch (e) {
    console.log(`  FAIL  ${label} ${file}\n        ${e.message}`);
    await db.exec("rollback").catch(() => {}); // a failed file leaves its transaction open
    return false;
  }
}

const db = new PGlite();
let ok = await run(db, "stub  ", "tests/local/supabase_stub.sql");
for (const f of SCHEMA_ORDER) ok = ok && (await run(db, "schema", f));
for (const f of MIGRATIONS) ok = ok && (await run(db, "rerun ", f));
if (ok) {
  // Every check file runs even if an earlier one failed, so one run shows all failures.
  for (const f of CHECKS) ok = (await run(db, "check ", `tests/${f}`)) && ok;
}
await db.close();
console.log(ok ? "SQL checks passed" : "SQL checks FAILED");
process.exit(ok ? 0 : 1);
