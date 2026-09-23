import { describe, expect, it } from "vitest";
import { parseRuntimeProfile } from "./hardware";

const emptyValues = {
  runtime: "" as const,
  backend: "" as const,
  executionPreference: "" as const,
  targetContextLength: "",
};

describe("parseRuntimeProfile", () => {
  it("omits the profile when no optional runtime field is selected", () => {
    expect(parseRuntimeProfile(emptyValues)).toEqual({ fieldErrors: {} });
  });

  it("normalizes a valid runtime planning profile", () => {
    expect(
      parseRuntimeProfile({
        ...emptyValues,
        runtime: "llama.cpp",
        backend: "cuda",
        executionPreference: "partial-offload",
        targetContextLength: "8192",
      }),
    ).toEqual({
      fieldErrors: {},
      runtimeProfile: {
        runtime: "llama.cpp",
        backend: "cuda",
        executionPreference: "partial-offload",
        targetContextLength: 8192,
      },
    });
  });

  it("reports invalid optional values without touching hardware parsing", () => {
    const result = parseRuntimeProfile({
      ...emptyValues,
      backend: "directx" as never,
      targetContextLength: "0",
    });
    expect(result.runtimeProfile).toBeUndefined();
    expect(result.fieldErrors.backend).toBeDefined();
    expect(result.fieldErrors.targetContextLength).toMatch(/whole number/);
  });
});
