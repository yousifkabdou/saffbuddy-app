import { describe, expect, it } from "@jest/globals";
import { otherPerson } from "@/lib/wording";

describe("otherPerson", () => {
  it("matches the viewer's gender, and stays neutral when it isn't known", () => {
    expect(otherPerson("Men")).toBe("a brother");
    expect(otherPerson("Women")).toBe("a sister");
    expect(otherPerson(null)).toBe("someone");
  });
});
