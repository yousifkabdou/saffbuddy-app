# SaffBuddy

A React Native (Expo) app for finding people on campus to pray in congregation with.

## How I want to work

I'm a first-year CS student building this as a resume project. I'm learning
JavaScript, TypeScript, and React Native as I go.

**Current priority (since 2026-11-22): ship first, learn after.** My top
priority is getting the app released. Claude writes the code and makes the
implementation decisions; I depend on it for that, so it has to be careful.
After launch I'll go back, learn the theory behind everything the app uses,
and make changes myself.

**Override:** If my message contains "ARISE" in all caps, Claude sets aside
any limit in this file that holds me back for that message only. Claude does
what I asked and says in one line which rule it set aside. Lowercase "arise"
doesn't count. The next message goes back to the normal rules.

- Think things through before writing code: read the code you're changing and
  what depends on it, consider edge cases (failed or slow network, empty
  results, expired requests, time zones, sign-out mid-action), and look for
  bugs nearby. Pick the right fix, not just the lowest-risk one.
- Decide the implementation yourself. Ask me only about product behaviour
  (what the app should do for the user) when it's genuinely unclear, and give
  a recommendation with the question.
- Explain each decision briefly: what you chose and why, in plain terms, so I
  can learn from it later. Not a line-by-line restatement.
- Leave short comments in the code where the reason for something isn't
  obvious, since I'll be reading it later to learn.
- If you find a bug outside the current change, report it and propose a fix
  rather than fixing it silently.
- Keep changes small: one feature or fix at a time.
- Skip style and grammar nitpicks. Focus on things that affect how the code works.

## Time and value

My time is limited, and this project exists to make me a strong SWE intern
candidate (and later ML/AI). Until launch, don't ask me to do things by hand
that you can do yourself. The things only I can do: phone testing, dashboard
and account steps (Supabase, Apple, Resend), running commits and pushes, and
product decisions. Tell me in one line what you did for anything else.

## Ownership

There are three tiers. When a task spans more than one, split it and say which
part falls in which tier.

1. **Security: Claude designs and implements, with tests.** Authentication,
   gender separation, invite/vouching logic, RLS policies, column grants, and
   `security definer` functions. Explain the design in plain terms before
   implementing it, so I can catch anything that conflicts with how the app
   should behave. Every security change must come with tests that prove the
   rule holds, including the negative case (e.g. a user of the other gender
   gets zero rows; an anonymous user can't read identifying columns). Run the
   tests before applying SQL to the live database. No quiz needed before
   committing until after launch.
2. **Features: I decide what it does; Claude designs and writes it.** I say
   what should happen for the user; Claude chooses how and implements it.
3. **Delegated.** UI layout and styling: positioning, spacing, colours, text
   styles. Claude writes these freely.

## Database guardrail

- Any change that touches migrations, RLS policies, grants, `security definer`
  functions, or table structure must be flagged clearly at the top of your
  response, before the code, with one line on how it affects who can see or
  write what. Never slip these changes in alongside other work.
- Never add code that stores location history, prayer history, or anything that
  could identify who prayed where, beyond the anonymous counts in
  docs/adr/0001. If a feature seems to need it, stop and ask.
- Never relax a security rule to make a feature work. If a feature is blocked
  by a policy, explain why and let me decide.

## Verification

- Before saying a task is done, run `npm run typecheck`, `npm run lint`, and
  `npm test`, and report the results. CI runs the same three on every PR
  (`.github/workflows/ci.yml`). If something can't be run, say so plainly, and
  list what still needs testing on my phone.
- Never weaken, skip, or delete a test to make it pass. If a test looks wrong,
  explain why and let me decide.
- When a feature has testable logic (expiry, filtering, date/time handling),
  suggest a test for it.

## Commits and the quiz

- The quiz is optional: only quiz me when I ask for it. Don't block or delay a
  commit or push because there was no quiz.
- When I do ask, have me explain what the code does and why, in my own words,
  until my explanation would hold up if an interviewer asked about it. If it's
  vague or wrong, point out the gap and ask again; don't just give me the answer.
- Quiz on what matters, not only "what does this do": why the state lives where
  it does, when an effect runs and what triggers a re-render, what happens if an
  async call fails or is slow, edge cases (expired requests, time zones, empty
  results), and for any database change, who can now read or write what.
- Skip quiz questions on styling-only changes.
- Commit messages: short, describe what changed and why.

## AI log

When I reject, correct, or override something Claude wrote, or a test or review
catches a mistake in AI-written code, add a two-line entry to `docs/ai-log.md`:
the date, what was wrong, and how it was caught. Create the file if it doesn't
exist. These become interview stories, so keep them factual.

## Project decisions

- Fixed prayer locations, no GPS-based matching. The map may show the user's
  own location; the app keeps it in memory only to move the map and never sends
  or stores it (see docs/adr/0002)
- Requests are opt-in and expire (there is no separate check-in concept)
- No location or prayer history is stored; the only exception is anonymous
  per-room, per-day congregation counts (see docs/adr/0001)
- The database is the gatekeeper: gender separation and anonymity are enforced
  by RLS and grants, not by app code alone

## Agent skills

### Issue tracker

Issues live in GitHub Issues for yousifkabdou/saffbuddy-app (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
