import * as WebBrowser from "expo-web-browser";

// The published legal pages. Cloudflare serves them from the saffbuddy-site repo
// (public/privacy.html, public/terms.html); docs/privacy-policy.md and docs/terms-of-use.md
// here are the sources they're generated from. App Store Connect lists the same privacy URL.
export const PRIVACY_POLICY_URL = "https://saffbuddy.app/privacy";
export const TERMS_URL = "https://saffbuddy.app/terms";

// Opens a page in an in-app browser sheet, so the user stays in SaffBuddy.
// onError lets each screen report the failure its own way (a toast in the menu, an alert on login).
export function openLegalPage(url: string, onError: () => void): void {
  WebBrowser.openBrowserAsync(url).catch((e) => {
    console.log("couldn't open", url, e);
    onError();
  });
}
