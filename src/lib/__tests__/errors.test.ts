import { describe, expect, it } from "@jest/globals";
import { actionErrorMessage, isNetworkError, NOTHING_DELETED_ERROR } from "@/lib/errors";
import { OFFLINE_ERROR } from "@/lib/network";

const NO_CONNECTION = "No connection. Check your internet and try again.";

describe("isNetworkError", () => {
  it("is true for a fetch failure with no code", () => {
    expect(isNetworkError({ message: "TypeError: Network request failed" })).toBe(true);
    expect(isNetworkError({ code: "", message: "fetch failed" })).toBe(true);
  });
  it("is false for a database error, even if the message mentions fetch", () => {
    expect(isNetworkError({ code: "42501", message: "could not fetch row" })).toBe(false);
  });
  it("is false for an unknown error with no code", () => {
    expect(isNetworkError({ message: "something odd" })).toBe(false);
  });
  it("is true for timeouts, including our own fetch timeout (an abort)", () => {
    expect(isNetworkError({ message: "The request timed out." })).toBe(true);
    expect(isNetworkError({ message: "timeout" })).toBe(true);
    expect(isNetworkError({ code: "", message: "AbortError: Aborted" })).toBe(true);
  });
  it("is true for the error the app reports when the phone is offline", () => {
    expect(isNetworkError(OFFLINE_ERROR)).toBe(true);
  });
});

describe("actionErrorMessage", () => {
  it("says 'no connection' for network failures, whatever the action", () => {
    for (const action of ["post", "join", "leave", "cancel"] as const) {
      expect(actionErrorMessage(action, { message: "Network request failed" })).toBe(NO_CONNECTION);
    }
  });

  it("post: already has a request (unique requester)", () => {
    expect(actionErrorMessage("post", { code: "23505", message: "" })).toMatch(/already have a request/);
  });
  it("post: refused by the insert policy (e.g. already joined another request)", () => {
    expect(actionErrorMessage("post", { code: "42501", message: "" })).toMatch(/another request/);
  });

  it("join: already in a request (joiners primary key)", () => {
    expect(actionErrorMessage("join", { code: "23505", message: "" })).toMatch(/already in a request/);
  });
  it("join: request gone (foreign key) or past the cutoff (RLS) give the same message", () => {
    const gone = actionErrorMessage("join", { code: "23503", message: "" });
    const refused = actionErrorMessage("join", { code: "42501", message: "" });
    expect(gone).toMatch(/started or been cancelled/);
    expect(refused).toBe(gone);
  });

  it("falls back to a 'try again' message for unknown codes", () => {
    expect(actionErrorMessage("post", { code: "XX000", message: "" })).toBe("Couldn't post your request. Try again.");
    expect(actionErrorMessage("join", { code: "XX000", message: "" })).toBe("Couldn't join. Try again.");
    expect(actionErrorMessage("leave", { code: "42501", message: "" })).toBe("Couldn't leave the request. Try again.");
    expect(actionErrorMessage("cancel", { code: "42501", message: "" })).toBe("Couldn't cancel your request. Try again.");
  });

  it("leave/cancel: a delete that removed zero rows says it may have already ended", () => {
    expect(actionErrorMessage("leave", NOTHING_DELETED_ERROR)).toMatch(/may have already ended/);
    expect(actionErrorMessage("cancel", NOTHING_DELETED_ERROR)).toMatch(/may have already ended/);
  });
  it("NOTHING_DELETED is not mistaken for a network error", () => {
    expect(isNetworkError(NOTHING_DELETED_ERROR)).toBe(false);
  });
});
