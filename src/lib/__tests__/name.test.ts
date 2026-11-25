import { describe, expect, it } from "@jest/globals";
import { normalizeName, validateName } from "@/lib/name";

// Same cases as the N checks in supabase/tests/security_checks.sql, so both copies of the rule agree.
describe("validateName", () => {
  it.each(["Al", "Abdul-Rahman", "O'Neil", "O’Neil", "Mary Ann", "José", "Zoë", "Çelik", "Łukasz"])(
    "allows %s", (name) => {
      expect(validateName(normalizeName(name))).toBe("");
    });

  it.each(["A", "Abcdefghijklmnopqrstu"])("refuses the length of %s", (name) => {
    expect(validateName(name)).toBe("Name must be 2 to 20 characters");
  });

  it.each(["Ali3", "Al  Amin", "-Ali", "Ali-", "王小", "Ali×"])("refuses the characters in %s", (name) => {
    expect(validateName(name)).toBe("Name can only contain letters, spaces, hyphens and apostrophes");
  });
});

describe("normalizeName", () => {
  it("trims spaces", () => {
    expect(normalizeName("  Ali ")).toBe("Ali");
  });
  it("turns an e + combining accent into one é, which the database accepts", () => {
    const decomposed = "José";
    expect(validateName(decomposed)).not.toBe(""); // as typed, the rule refuses it
    expect(normalizeName(decomposed)).toBe("José");
    expect(validateName(normalizeName(decomposed))).toBe("");
  });
});
