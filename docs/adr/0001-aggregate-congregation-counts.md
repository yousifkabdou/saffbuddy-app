# Keep aggregate congregation counts despite storing no prayer history

SaffBuddy stores no location or prayer history: requests are deleted when they expire or are cancelled. We still need usage metrics, so when a request expires with at least one joiner we add to a per-room, per-day tally (number of congregations and number of people) before deleting it. The tally holds no user IDs, no request IDs and no times of day, so no individual can be traced from it. Day-level granularity is deliberate: finer buckets (e.g. "Thompson, 1:42pm, 2 people") could identify someone.

## Consequences

- The counts measure commitments, not attendance: a joiner who never showed up is still counted.
- Cancelled requests are never counted.

Note (2026-11-23): live updates (supabase/live_updates.sql) also leave rows in `realtime.messages`: one per ping, holding only the gender channel and a timestamp (no account, room or request). Supabase deletes them after a few days. They can't identify anyone, but they are a per-gender record of when requests changed, so the privacy policy lists them.
