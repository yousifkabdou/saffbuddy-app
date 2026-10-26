# SaffBuddy

A React Native (Expo) app for finding people on campus to pray in congregation with.

## How I want to work

I'm a first-year CS student building this as a resume project. I'm learning
JavaScript, TypeScript, and React Native as I go. I need to understand and be
able to explain every line in this project.

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
- Before committing or pushing (including "C&P"), quiz me on the changes being
  committed. Ask me to explain what the code does and why, in my own words.
  Don't commit until my explanation would hold up if an interviewer asked about
  it. If it's vague or wrong, point out the gap and ask again; don't just give
  me the answer.
- Never write authentication, gender separation, or invite/vouching logic for
  me. I write those myself. Review my code for those instead.
- Skip style and grammar nitpicks. Focus on things that affect how the code works.

## Project decisions

- Fixed prayer locations, no live GPS tracking
- Check-ins are opt-in and expire
- No location or prayer history is stored

## Agent skills

### Issue tracker

Issues live in GitHub Issues for yousifkabdou/saffbuddy-app (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.