// Reruns the time zone tests with the phone set to zones east and west of Columbus, each in its
// own Jest process (the zone has to be set before the process starts). Part of npm test.
const { spawnSync } = require("node:child_process");

const ZONES = ["Europe/Paris", "America/Los_Angeles", "Asia/Riyadh", "UTC"];
let failed = false;
for (const zone of ZONES) {
  console.log(`\nTime zone tests with the phone set to ${zone}`);
  const result = spawnSync("npx", ["jest", "--silent", "src/lib/__tests__/timeZones.test.ts"], {
    stdio: "inherit",
    shell: true, // npx is npx.cmd on Windows
    env: { ...process.env, TEST_PHONE_TZ: zone },
  });
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
