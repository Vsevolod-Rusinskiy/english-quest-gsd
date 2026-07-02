import { describe, it, expect } from "vitest";
import { normalize } from "../../../src/core/answer-checking/normalize";

describe("normalize", () => {
  it("lowercases, trims, collapses internal spaces, and strips trailing punctuation", () => {
    expect(normalize("  Is  Working. ")).toBe("is working");
  });

  it("strips trailing punctuation from the set .!?,;: only when trailing", () => {
    expect(normalize("Hello!")).toBe("hello");
    expect(normalize("Hello, world!")).toBe("hello, world");
  });

  it("does not perform fuzzy/edit-distance transforms", () => {
    expect(normalize("go")).toBe("go");
    expect(normalize("goes")).toBe("goes");
    expect(normalize("go")).not.toBe(normalize("goes"));
  });
});
