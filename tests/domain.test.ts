import { describe, it, expect } from "vitest";
import { examples } from "../shared/fixtures";
import {
  stages,
  publicActivity,
  grade,
  decodeAnswer,
  validateActivity,
  parseNumber,
  ranked,
  arithmetic,
} from "../shared/domain";
import { mathActivities } from "../shared/math";
describe("activity contracts across stages", () => {
  for (const stage of stages)
    it("validates all eight formats for " + stage, () => {
      const all = examples(stage);
      expect(new Set(all.map((a) => a.type)).size).toBe(8);
      for (const a of all) expect(validateActivity(a).stage).toBe(stage);
    });
  it("does not expose solutions, hints, rubrics, arithmetic or pair relationships", () => {
    for (const a of examples("superior")) {
      const p = publicActivity(a);
      for (const key of [
        "solution",
        "hint",
        "explanation",
        "rubric",
        "arithmetic",
      ])
        expect(p).not.toHaveProperty(key);
      if (p.pairs)
        for (const pair of p.pairs) expect(pair).not.toHaveProperty("right");
    }
  });
  it("grades matches through opaque option keys", () => {
    const a = examples("superior").find((a) => a.type === "match")!;
    if (a.type !== "match") throw Error();
    const p = publicActivity(a);
    const response = Object.fromEntries(
      a.pairs.map((pair) => [
        pair.id,
        p.rightOptions!.find((v) => v.text === pair.right)!.id,
      ]),
    );
    expect(grade(a, decodeAnswer(a, response))).toBe(true);
    expect(grade(a, decodeAnswer(a, { a: "a", b: "b", c: "c" }))).toBe(false);
  });
  it("rejects invalid answer indices, duplicate ids and arithmetic mismatch", () => {
    const all = examples("superior");
    expect(() => validateActivity({ ...all[0], solution: 30 })).toThrow();
    const order = all.find((a) => a.type === "order")!;
    expect(() =>
      validateActivity({ ...order, solution: ["a", "a", "c"] }),
    ).toThrow();
    const num = all.find((a) => a.type === "numeric")!;
    expect(() => validateActivity({ ...num, solution: 33 })).toThrow();
  });
  it("normalizes whitespace and case, but retains meaningful accents", () => {
    const blank = examples("fundamental-inicial").find(
      (a) => a.type === "blank",
    )!;
    expect(grade(blank, "  RAÍZES ")).toBe(true);
    expect(grade(blank, "raizes")).toBe(false);
  });
  it("accepts numeric equivalents and rejects ambiguous input", () => {
    for (const value of ["1,5", "1.50", "15e-1"])
      expect(parseNumber(value)).toBe(1.5);
    for (const value of ["", "1.000,5", "NaN", "Infinity", "1/2", "2 kg"])
      expect(parseNumber(value)).toBeNull();
    const num = validateActivity({
      ...examples("superior").find((a) => a.type === "numeric"),
      arithmetic: undefined,
      solution: 1.5,
      tolerance: 0.01,
    });
    expect(grade(num, "1,51")).toBe(true);
    expect(grade(num, "1.52")).toBe(false);
  });
});
describe("math and rankings", () => {
  it("rejects division by zero", () =>
    expect(() => arithmetic(1, 0, "/")).toThrow());
  it("generates exact divisions and verifies every solution", () => {
    const all = mathActivities(
      {
        count: 30,
        min: 0,
        max: 100,
        operations: ["/"],
        regroup: true,
        stage: "fundamental-final",
        difficulty: "pratica",
      },
      () => crypto.randomUUID(),
    );
    for (const a of all) {
      expect(a.type).toBe("numeric");
      if (a.type === "numeric") {
        expect(Number.isInteger(a.solution)).toBe(true);
        expect(a.arithmetic!.b).not.toBe(0);
        expect(grade(a, a.solution)).toBe(true);
      }
    }
  });
  it("does not carry or borrow when regrouping is disabled", () => {
    const all = mathActivities(
      {
        count: 30,
        min: 0,
        max: 100,
        operations: ["+", "-"],
        regroup: false,
        stage: "fundamental-inicial",
        difficulty: "introducao",
      },
      () => crypto.randomUUID(),
    );
    for (const a of all)
      if (a.type === "numeric") {
        let x = a.arithmetic!.a,
          y = a.arithmetic!.b;
        while (x || y) {
          expect(
            a.arithmetic!.op === "+"
              ? (x % 10) + (y % 10) < 10
              : x % 10 >= y % 10,
          ).toBe(true);
          x = Math.floor(x / 10);
          y = Math.floor(y / 10);
        }
      }
  });
  it("preserves ties without speed as a criterion", () => {
    expect(
      ranked([
        { profileId: "b", nickname: "B", points: 100 },
        { profileId: "a", nickname: "A", points: 100 },
        { profileId: "c", nickname: "C", points: 0 },
      ]).map((v) => v.rank),
    ).toEqual([1, 1, 3]);
  });
});
