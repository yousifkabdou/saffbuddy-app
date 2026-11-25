// Runs once before Jest starts its workers, which inherit this time zone. Pins it so date tests
// behave the same on a laptop in Ohio and on CI (which runs in UTC).
// TEST_PHONE_TZ overrides it: scripts/jest/other-time-zones.js uses that to rerun the time zone
// tests as if the phone were set to another zone. (Setting process.env.TZ inside a test file
// doesn't work: Jest gives each file its own copy of process.env.)
module.exports = async () => {
  process.env.TZ = process.env.TEST_PHONE_TZ || "America/New_York";
};
