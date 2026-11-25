import { describe, expect, it } from "@jest/globals";
import {
  isOsuEmail, isReviewEmail, isSixDigitCode, OSU_ONLY, passwordErrorMessage, secondsToWait,
  sendCodeErrorMessage, verifyCodeErrorMessage,
} from "@/lib/authErrors";

describe("isReviewEmail (only this address gets the password sign-in)", () => {
  it("matches the review address in any case", () => {
    expect(isReviewEmail("review@saffbuddy.app")).toBe(true);
    expect(isReviewEmail("Review@SaffBuddy.app")).toBe(true);
  });
  it.each([
    "buckeye.1@osu.edu", "review@osu.edu", "review2@saffbuddy.app", "xreview@saffbuddy.app",
    "review@saffbuddy.app.evil.com", "support@saffbuddy.app", "review@saffbuddy.ap", "",
  ])("NEGATIVE: %p gets the normal code flow", (email) => {
    expect(isReviewEmail(email)).toBe(false);
  });
});

describe("passwordErrorMessage", () => {
  it("names a wrong password, never Supabase's raw text", () => {
    expect(passwordErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("Wrong password.");
    expect(passwordErrorMessage({ code: "unexpected_failure", message: "boom" })).toBe("Couldn't sign in. Try again.");
  });
  it("shows No connection for a network failure", () => {
    expect(passwordErrorMessage({ message: "Network request failed" })).toBe("No connection. Check your internet and try again.");
  });
});

describe("isOsuEmail", () => {
  it("accepts an OSU address in any case", () => {
    expect(isOsuEmail("buckeye.1@osu.edu")).toBe(true);
    expect(isOsuEmail("Buckeye.1@OSU.EDU")).toBe(true);
  });
  it("rejects other domains, including look-alikes", () => {
    expect(isOsuEmail("someone@gmail.com")).toBe(false);
    expect(isOsuEmail("someone@notosu.edu")).toBe(false);
    expect(isOsuEmail("someone@osu.edu.evil.com")).toBe(false);
  });
  it("rejects incomplete or spaced input", () => {
    expect(isOsuEmail("@osu.edu")).toBe(false);
    expect(isOsuEmail("buckeye 1@osu.edu")).toBe(false);
    expect(isOsuEmail("")).toBe(false);
  });
});

describe("isSixDigitCode", () => {
  it("accepts exactly six digits", () => {
    expect(isSixDigitCode("012345")).toBe(true);
  });
  it("rejects short, long or non-numeric codes", () => {
    expect(isSixDigitCode("12345")).toBe(false);
    expect(isSixDigitCode("1234567")).toBe(false);
    expect(isSixDigitCode("12a456")).toBe(false);
  });
});

describe("secondsToWait", () => {
  it("reads the seconds from Supabase's cooldown message", () => {
    expect(secondsToWait("For security purposes, you can only request this after 42 seconds.")).toBe(42);
  });
  it("is null for other messages", () => {
    expect(secondsToWait("Token has expired or is invalid")).toBeNull();
  });
});

describe("sendCodeErrorMessage", () => {
  it("reports no connection for network failures", () => {
    expect(sendCodeErrorMessage({ message: "Network request failed" })).toMatch(/No connection/);
  });
  it("tells the user how long to wait during the cooldown", () => {
    expect(sendCodeErrorMessage({
      code: "over_email_send_rate_limit",
      message: "For security purposes, you can only request this after 37 seconds.",
    })).toBe("Wait 37 seconds before asking for another code.");
  });
  it("handles a rate limit without a seconds count", () => {
    expect(sendCodeErrorMessage({ code: "over_email_send_rate_limit", message: "Email rate limit exceeded" }))
      .toMatch(/Too many codes/);
  });
  it("turns the sign-up hook's refusal into the OSU-only message", () => {
    expect(sendCodeErrorMessage({ message: 'Invalid email, only "@osu.edu emails" are allowed to sign up' }))
      .toBe(OSU_ONLY);
  });
  it("never shows Supabase's raw message for unknown errors", () => {
    expect(sendCodeErrorMessage({ code: "unexpected_failure", message: "Error sending magic link email" }))
      .toBe("Couldn't send the code. Try again in a minute.");
  });
});

describe("verifyCodeErrorMessage", () => {
  it("covers both a wrong and an expired code (Supabase doesn't say which)", () => {
    expect(verifyCodeErrorMessage({ code: "otp_expired", message: "Token has expired or is invalid" }))
      .toMatch(/wrong or has expired/);
  });
  it("reports no connection for network failures", () => {
    expect(verifyCodeErrorMessage({ message: "Failed to fetch" })).toMatch(/No connection/);
  });
  it("reports too many tries", () => {
    expect(verifyCodeErrorMessage({ code: "over_request_rate_limit", message: "Request rate limit reached" }))
      .toMatch(/Too many tries/);
  });
});

describe("auth messages: branches not covered above", () => {
  it("asks for a valid email for either validation code", () => {
    expect(sendCodeErrorMessage({ code: "email_address_invalid", message: "" })).toBe("Enter a valid email address.");
    expect(sendCodeErrorMessage({ code: "validation_failed", message: "" })).toBe("Enter a valid email address.");
  });
  it("falls back to a generic message for an unknown verify error", () => {
    expect(verifyCodeErrorMessage({ code: "unexpected_failure", message: "boom" })).toBe("Couldn't verify the code. Try again.");
  });
});
