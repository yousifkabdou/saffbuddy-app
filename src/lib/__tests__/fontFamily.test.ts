import { describe, expect, it } from "@jest/globals";
import { BODY, DISPLAY, DISPLAY_MIN_SIZE, fontFamilyFor, toWeight } from "@/lib/fontFamily";

describe("toWeight", () => {
  it("treats a missing weight as regular", () => {
    expect(toWeight(undefined)).toBe(400);
  });

  it("treats 'bold' as 700", () => {
    expect(toWeight("bold")).toBe(700);
  });

  it("reads the string weights React Native styles use", () => {
    expect(toWeight("600")).toBe(600);
    expect(toWeight("700")).toBe(700);
    expect(toWeight("800")).toBe(800);
  });

  it("rounds weights we have no file for to the nearest one", () => {
    expect(toWeight("300")).toBe(400);
    expect(toWeight("500")).toBe(600);
    expect(toWeight("900")).toBe(800);
  });

  it("falls back to regular for something that isn't a weight", () => {
    expect(toWeight("normal")).toBe(400);
  });
});

describe("fontFamilyFor", () => {
  it("uses Work Sans below heading size", () => {
    expect(fontFamilyFor("600", 17, false)).toBe(BODY[600]);
  });

  it("uses Work Sans when there's no size (inherits the default)", () => {
    expect(fontFamilyFor(undefined, undefined, false)).toBe(BODY[400]);
  });

  it("uses Reem Kufi from heading size up", () => {
    expect(fontFamilyFor("800", DISPLAY_MIN_SIZE, false)).toBe(DISPLAY[800]);
    expect(fontFamilyFor("700", 30, false)).toBe(DISPLAY[700]);
  });

  it("uses Work Sans for big text that needs equal-width digits (the countdown)", () => {
    expect(fontFamilyFor("700", 30, true)).toBe(BODY[700]);
  });

  it("maps 800 to Reem Kufi's heaviest weight, 700", () => {
    expect(DISPLAY[800]).toBe(DISPLAY[700]);
  });
});
