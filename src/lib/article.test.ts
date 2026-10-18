import { describe, expect, it } from "vitest";
import { aOrAn } from "./article";

describe("aOrAn", () => {
  it("uses an before a vowel sound and a otherwise", () => {
    expect(aOrAn("Australia")).toBe("an");
    expect(aOrAn("India")).toBe("an");
    expect(aOrAn("Canada")).toBe("a");
    expect(aOrAn("Germany")).toBe("a");
  });
  it("treats US, UK and UAE as a consonant sound", () => {
    expect(aOrAn("US")).toBe("a");
    expect(aOrAn("UK")).toBe("a");
    expect(aOrAn("UAE")).toBe("a");
  });
});
