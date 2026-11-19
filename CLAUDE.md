# SaffBuddy

A React Native (Expo) app for finding people on campus to pray in congregation with.

## How I want to work

I'm a first-year CS student building this as a resume project. I'm learning
JavaScript, TypeScript, and React Native as I go. I need to understand and be
able to explain all of the app's logic: data, state, effects, async code, and
security. UI styling is the one exception (see "Ownership" below).

**Override:** If my message contains "ARISE" in all caps, Claude sets aside
any limit in this file that holds me back for that message only. This includes
the ownership tiers and the "ask questions first" rule. Claude does what I asked and says in one line which rule it set
aside. Lowercase "arise" doesn't count. The next message goes back to the
normal rules.

- I want to move fast, so Claude can write and edit code when my request is
  specific enough to show I understand it: what should happen, where it goes,
  and roughly how it works (e.g. "tapping a marker sets selectedRoom, the panel
  renders only when it's set, and the X sets it back to null").
- If my request is vague ("add the panel", "make check-ins work"), don't write
  code yet. Ask me a few questions about the approach first, and write it once
  my answers show I understand it.
- Fix small syntax errors and typos in my code directly, and tell me in one line
  what was wrong.
- Keep changes small: one feature or fix at a time.
- After writing code, explain anything that's new to me: the concept and why,
  not a line-by-line restatement.
- Skip style and grammar nitpicks. Focus on things that affect how the code works.

## Time and value

My time is limited, and this project exists to make me a strong SWE intern
candidate (and later ML/AI). Before asking me to do something by hand, check
whether it builds a skill that matters for that:

- Worth my time: the security model, data modeling, state/effects/async,
  testing, debugging, Git workflow, and anything an interviewer would
  plausibly ask about.
- Not worth my time: tool-specific setup and config, styling, build errors,
  library quirks, boilerplate, and one-off plumbing. Just do these and tell me
  in one line what you did.

If you're unsure which category something is in, say so in one sentence and
recommend one. Don't make me hand-write something just because I could.

## Ownership

There are three tiers. When a task spans more than one, split it and say which
part falls in which tier.

1. **Security: Claude implements, I understand.** Authentication, gender
   separation, invite/vouching logic, RLS policies, column grants, and
   `security definer` functions. I'm still learning this, so don't assume I
   know the right approach. Propose the design first and explain it in plain
   terms, then implement it. Every security change must come with tests that
   prove the rule holds, including the negative case (e.g. a user of the other
   gender gets zero rows; an anonymous user can't read identifying columns).
   Before committing, I must be able to explain the rule, why it exists, and
   what the tests prove. Quiz me on that, not on syntax.
2. **I design it; Claude writes it.** Features and how they behave. I decide
   what happens and roughly how; Claude implements it. I must be able to
   explain and debug it, and rewrite a small piece without help.
3. **Delegated.** UI layout and styling: positioning, spacing, colours, text
   styles. Claude can write these freely. I only need to be able to read the
   component structure (components, props, state) in a diff, not produce the
   styling myself. Don't quiz me on styling details.

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

- Before saying a task is done, run the type check and any tests that exist,
  and report the results. If something can't be run, say so plainly.
- Never weaken, skip, or delete a test to make it pass. If a test looks wrong,
  explain why and let me decide.
- When a feature has testable logic (expiry, filtering, date/time handling),
  suggest a test for it.

## Commits and the quiz

- The quiz is optional: only quiz me when I ask for it. Don't block or delay a
  commit or push because there was no quiz. Exception: security changes need
  the tier-1 quiz before committing (see "Ownership").
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

- Fixed prayer locations, no live GPS tracking
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
