import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { activitySchema } from "../shared/domain";
import { examples } from "../shared/fixtures";
const provider = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: provider };
  },
}));
import { generateJson, toGeminiJsonSchema } from "../functions/src/ai";
beforeEach(() => {
  provider.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "unit-test-key");
});
afterEach(() => vi.unstubAllEnvs());
describe("Gemini structured output contract", () => {
  it("sends compatible discriminated formats and validates real activity shapes", async () => {
    const activities = examples("fundamental-inicial");
    const schema = z.object({ activities: z.array(activitySchema) });
    provider.mockResolvedValue({ text: JSON.stringify({ activities }) });
    expect(
      (await generateJson(schema, "Texto de estudo")).activities,
    ).toHaveLength(activities.length);
    const wire = provider.mock.calls[0][0].config.responseJsonSchema;
    expect(wire.properties.activities.items.oneOf).toBeUndefined();
    const branches = wire.properties.activities.items.anyOf;
    expect(
      branches.map(
        (branch: { properties: { type: { enum: string[] } } }) =>
          branch.properties.type.enum[0],
      ),
    ).toEqual([
      "choice",
      "boolean",
      "blank",
      "match",
      "order",
      "classify",
      "numeric",
      "open",
    ]);
  });
  it("keeps domain validation strict even when the provider returns invalid values", async () => {
    provider.mockResolvedValue({
      text: JSON.stringify({
        ...examples("superior").find((a) => a.type === "numeric")!,
        tolerance: -1,
      }),
    });
    await expect(
      generateJson(activitySchema, "Uma operação"),
    ).rejects.toBeInstanceOf(z.ZodError);
  });
  it("preserves property names that happen to match schema keywords", () => {
    const wire = toGeminiJsonSchema(
      z.object({ const: z.literal(false), oneOf: z.literal("x") }),
    );
    expect(wire.properties).toMatchObject({
      const: { type: "boolean" },
      oneOf: { enum: ["x"] },
    });
    expect(wire.required).toEqual(["const", "oneOf"]);
  });
});
