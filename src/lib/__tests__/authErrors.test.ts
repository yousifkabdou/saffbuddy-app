import { describe, expect, it } from "@jest/globals";
import {
  isOsuEmail, isSixDigitCode, OSU_ONLY, secondsToWait, sendCodeErrorMessage, verifyCodeErrorMessage,
} from "@/lib/authErrors";

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
