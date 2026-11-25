// App-wide colours: Ohio State scarlet and grey. Screens and components read from here,
// so changing the theme is one edit.
export const colors = {
  scarlet: "#bb0000",   // primary: main buttons, links, highlights
  grey: "#666666",      // secondary text and icons
  greyLight: "#767676", // softer text ("waiting" states). #767676 is the lightest grey that
                        // still reads on white (4.5:1 contrast); the old #a0a0a0 was 2.6:1.
  charcoal: "#3a3a3a",  // "you're in a request" buttons and neutral banners (dark grey, so it doesn't read as primary)
  ink: "#222222",       // main text
  paper: "#ffffff",     // backgrounds, text on coloured buttons
  background: "#d6d6d6", // grey screen behind cards, so the glass cards stand apart
  line: "#dddddd",      // borders and dividers
  success: "#1e8e3e",   // green: the prayer is happening (kept as a status colour)
  marker: "#bb0000",         // map pins and dots
  markerSelected: "#666666", // the open room's pin or dot
};
