You are doing one unattended audit pass of the SaffBuddy repo. Report only: never modify any file except docs/audit/findings.md and docs/audit/checklist.md.

1. Read docs/audit/checklist.md and pick the FIRST unchecked area. Do only that area.
2. Read CLAUDE.md, the files the area names, and whatever those files depend on or are used by. Read the relevant ADRs in docs/adr/ when the area touches privacy or location.
3. Look for anything error-like, interpreted broadly: bugs, crashes, type holes, unhandled promise rejections, race conditions, stale state, missing effect cleanup, failed/slow network paths, empty results, expired requests, time zones/DST, sign-out mid-action, security or privacy holes (RLS, grants, security definer, gender separation, anonymity per ADR 0001/0002), mismatches between docs and code, misleading UI text, missing tests for testable logic.
4. Verify each finding against the actual code before writing it. Drop anything you cannot point to. Skip style nitpicks. Do not flag features that are clearly planned but not built yet.
5. Append to docs/audit/findings.md a section `## Area N: <name>` containing each finding as:
   - **[severity] short title**: `path:line`
     What's wrong. Failure scenario (concrete inputs/state → result). Proposed fix.
   If you found nothing, write "No findings." under the heading.
6. Tick the area's box in docs/audit/checklist.md (`- [ ]` → `- [x]`).
7. Final reply: one line with the area number and finding counts by severity.
