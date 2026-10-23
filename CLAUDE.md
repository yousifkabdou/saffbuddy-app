# SaffBuddy

A React Native (Expo) app for finding people on campus to pray in congregation with.

## How I want to work

I'm a first-year CS student building this as a resume project. I'm learning
JavaScript, TypeScript, and React Native as I go. I need to understand and be
able to explain every line in this project.

- Before writing code, explain the approach and wait for me to agree.
- When I'm doing something for the first time, guide me with hints and docs
  instead of writing it for me.
- Keep changes small: one feature or fix at a time.
- After writing code, explain anything that's new to me.
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