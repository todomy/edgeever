import { describe, expect, test } from "bun:test";
import { buildRevisionDiffRows } from "./revision-diff.ts";

describe("buildRevisionDiffRows", () => {
  test("aligns inserted lines without shifting unchanged content", () => {
    const result = buildRevisionDiffRows("alpha\nbeta", "alpha\ninserted\nbeta");

    expect(result.changed).toBe(1);
    expect(result.leftRows).toEqual([
      { lineNumber: 1, text: "alpha", state: "same" },
      { lineNumber: null, text: "", state: "empty" },
      { lineNumber: 2, text: "beta", state: "same" },
    ]);
    expect(result.rightRows).toEqual([
      { lineNumber: 1, text: "alpha", state: "same" },
      { lineNumber: 2, text: "inserted", state: "changed" },
      { lineNumber: 3, text: "beta", state: "same" },
    ]);
  });

  test("pairs replacement lines as changed rows", () => {
    const result = buildRevisionDiffRows("before\nkeep", "after\nkeep");

    expect(result.changed).toBe(1);
    expect(result.leftRows[0]).toEqual({ lineNumber: 1, text: "before", state: "changed" });
    expect(result.rightRows[0]).toEqual({ lineNumber: 1, text: "after", state: "changed" });
  });

  test("reports no changes for identical content", () => {
    const result = buildRevisionDiffRows("same\ncontent", "same\ncontent");

    expect(result.changed).toBe(0);
    expect(result.leftRows).toEqual(result.rightRows);
  });
});
