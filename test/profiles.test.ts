import { describe, expect, it } from "vitest";
import { buildSwitchFrame, nextProfile, normalizeProfiles } from "../src/profiles.js";

describe("nextProfile", () => {
  it("advances to the next selected profile", () => {
    expect(nextProfile(1, [1, 3, 5])).toBe(3);
    expect(nextProfile(3, [1, 3, 5])).toBe(5);
  });
  it("wraps around", () => {
    expect(nextProfile(5, [1, 3, 5])).toBe(1);
  });
  it("takes the first selected when current is not selected", () => {
    expect(nextProfile(2, [3, 5])).toBe(3);
    expect(nextProfile(5, [2, 4])).toBe(2);
    expect(nextProfile(1, [4, 2])).toBe(2);
  });
  it("stays on a single selection", () => {
    expect(nextProfile(4, [4])).toBe(4);
    expect(nextProfile(1, [4])).toBe(4);
  });
  it("handles unsorted and duplicated settings", () => {
    expect(nextProfile(2, [5, 2, 4, 2])).toBe(4);
  });
  it("falls back to the default on empty selection", () => {
    expect(nextProfile(1, [])).toBe(2);
  });
});

describe("normalizeProfiles", () => {
  it("drops invalid values", () => {
    expect(normalizeProfiles([0, 3, 9, 3.5, "2", 1])).toEqual([1, 3]);
    expect(normalizeProfiles(undefined)).toEqual([1, 2]);
  });
});

describe("buildSwitchFrame", () => {
  it("builds the 13-byte frame with a 0-based index", () => {
    expect([...buildSwitchFrame(1)]).toEqual([0x0f, 0x27, 0, 0, 5, 3, 1, 8, 0, 0, 10, 1, 0]);
    expect(buildSwitchFrame(5)[12]).toBe(4);
    expect(buildSwitchFrame(3)).toHaveLength(13);
  });
  it("rejects out-of-range profiles", () => {
    expect(() => buildSwitchFrame(0)).toThrow(RangeError);
    expect(() => buildSwitchFrame(6)).toThrow(RangeError);
  });
});
