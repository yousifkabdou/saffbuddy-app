import { START_OFFSETS } from "@/lib/requestTime";

// The welcome screen's text, kept out of the screen so it can be tested.
// The request window is built from START_OFFSETS rather than typed out, so the copy can't
// promise times the app doesn't offer.
const earliest = Math.min(...START_OFFSETS);
const latest = Math.max(...START_OFFSETS);

export type WelcomeStep = { title: string; body: string };

export const WELCOME_STEPS: WelcomeStep[] = [
  {
    title: "Pick a prayer room",
    body: "Tap a pin on the map to see the room and get walking directions.",
  },
  {
    title: "Start or join a request",
    body: `Post a request for a prayer starting in ${earliest}–${latest} minutes, or join one someone else posted.`,
  },
  {
    title: "Show up and pray",
    body: "Head to the room by the start time. Requests disappear on their own shortly after.",
  },
];

// Must stay true to the privacy policy (docs/privacy-policy.md): names aren't shown to other
// users, brothers and sisters only see their own requests, and location stays on the phone.
export const PRIVACY_NOTE = {
  title: "Private by design",
  body: "Brothers only see brothers' requests, and sisters only see sisters'. Nobody sees your name, and your location never leaves your phone.",
};
