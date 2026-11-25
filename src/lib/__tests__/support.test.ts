import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Alert, Linking } from "react-native";
import { openSupportEmail, SUPPORT_EMAIL, supportMailto } from "@/lib/support";

describe("supportMailto", () => {
  it("addresses support and encodes the subject and body", () => {
    const url = supportMailto("ios", "18.1");
    expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`)).toBe(true);
    // Spaces must be %20, not "+", and newlines %0A.
    expect(url).not.toContain("+");
    expect(url).not.toContain(" ");
    expect(url).toContain("%0A");
  });

  it("round-trips to the expected text, with only the OS and version added", () => {
    const query = new URLSearchParams(supportMailto("android", 34).split("?")[1]);
    expect(query.get("subject")).toBe("SaffBuddy: problem report");
    expect(query.get("body")).toBe("What happened: \nWhat did you expect: \n\n(android 34)");
  });
});

describe("openSupportEmail", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the mailto link", async () => {
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await openSupportEmail();
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^mailto:support@saffbuddy\.app\?/));
    expect(alert).not.toHaveBeenCalled();
  });

  it("shows the address when no mail app can open it", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no mail app"));
    jest.spyOn(console, "log").mockImplementation(() => {});
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await openSupportEmail();
    expect(alert).toHaveBeenCalledWith("Report a problem", `Email us at ${SUPPORT_EMAIL}`);
  });
});
