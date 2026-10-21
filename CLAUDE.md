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

- Fixed prayer locations. The app may read the user's location once, on the
  device, to show distance/walking time to rooms. The location is never stored,
  never sent to the server, and never shared with other users. No continuous
  tracking.
- Check-ins are opt-in and expire
- No location or prayer history is stored