import { describe, expect, it } from "vitest";
import { fixtureHardware, fixtureModel } from "@/data/fixtures";
import { evaluateCompatibility } from "./compatibility";
import { buildRuntimeProfileGuidance } from "./runtime-profile";
import { runtimeProfileFixtures } from "./runtime-profile-fixtures";

describe("runtime profile guidance", () => {
  it("leaves omitted profiles advisory-neutral and preserves classification", () => {
    const withoutProfile = evaluateCompatibility(
      fixtureHardware.gpu,
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    const withEmptyProfile = evaluateCompatibility(
      fixtureHardware.gpu,
      fixtureModel,
      fixtureModel.quantizations[0],
      undefined,
      {},
    );

    expect(withoutProfile.level).toBe(withEmptyProfile.level);
    expect(withoutProfile.executionMode).toBe(withEmptyProfile.executionMode);
    expect(withoutProfile.memory).toEqual(withEmptyProfile.memory);
    expect(withoutProfile.runtimeGuidance).toEqual({
      profile: {},
      contextAssessment: "not-requested",
      requestedContextLength: null,
      assumptions: [],
      warnings: [],
      reasonCodes: [],
    });
  });

  it.each([
    ["cpu", { backend: "cpu" as const }],
    ["cuda", { backend: "cuda" as const }],
    ["vulkan", { backend: "vulkan" as const }],
    ["metal", { backend: "metal" as const }],
    ["unknown", { backend: "unknown" as const }],
  ])(
    "accepts the %s backend without changing classification",
    (_name, profile) => {
      const result = evaluateCompatibility(
        fixtureHardware.gpu,
        fixtureModel,
        fixtureModel.quantizations[0],
        undefined,
        profile,
      );
      expect(result.level).toBe("gpu-capable");
      expect(result.runtimeGuidance.profile).toEqual(profile);
      expect(result.runtimeGuidance.reasonCodes).toContain(
        profile.backend === "cpu"
          ? "runtime-profile-applied"
          : "runtime-backend-unverified",
      );
    },
  );

  it("accepts the shared llama.cpp fixture without changing classification", () => {
    const baseline = evaluateCompatibility(
      fixtureHardware.gpu,
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    const profiled = evaluateCompatibility(
      fixtureHardware.gpu,
      fixtureModel,
      fixtureModel.quantizations[0],
      undefined,
      runtimeProfileFixtures.llamaCuda,
    );
    expect(profiled.level).toBe(baseline.level);
    expect(profiled.runtimeGuidance.contextAssessment).toBe("within-guidance");
  });

  it.each(["automatic", "full-gpu", "partial-offload", "cpu"] as const)(
    "treats %s execution preference as advisory",
    (preference) => {
      const result = evaluateCompatibility(
        fixtureHardware.gpu,
        fixtureModel,
        fixtureModel.quantizations[0],
        undefined,
        { executionPreference: preference },
      );
      expect(result.level).toBe("gpu-capable");
      expect(result.runtimeGuidance.reasonCodes).toContain(
        "execution-preference-advisory",
      );
    },
  );

  it("reports target contexts below, at, and above practical guidance", () => {
    const evaluate = (targetContextLength: number) =>
      evaluateCompatibility(
        fixtureHardware.gpu,
        fixtureModel,
        fixtureModel.quantizations[0],
        undefined,
        { runtime: "llama.cpp", targetContextLength },
      ).runtimeGuidance;

    expect(evaluate(2048).contextAssessment).toBe("within-guidance");
    expect(evaluate(4096).contextAssessment).toBe("within-guidance");
    expect(evaluate(8192).contextAssessment).toBe("above-practical-guidance");
    expect(evaluate(8192).warnings[0]).toMatch(/additional memory/);
  });

  it("warns when target context exceeds model maximum", () => {
    const guidance = evaluateCompatibility(
      fixtureHardware.gpu,
      fixtureModel,
      fixtureModel.quantizations[0],
      undefined,
      { targetContextLength: 16384 },
    ).runtimeGuidance;
    expect(guidance.contextAssessment).toBe("exceeds-model-maximum");
    expect(guidance.reasonCodes).toContain(
      "target-context-exceeds-model-maximum",
    );
  });

  it("keeps requested context uncertain when model metadata is unavailable", () => {
    const model = {
      ...fixtureModel,
      defaultContextLength: undefined,
      maxContextLength: undefined,
    };
    const guidance = evaluateCompatibility(
      fixtureHardware.gpu,
      model,
      model.quantizations[0],
      undefined,
      { targetContextLength: 4096 },
    ).runtimeGuidance;
    expect(guidance.contextAssessment).toBe("unavailable");
    expect(guidance.reasonCodes).toContain(
      "target-context-estimation-unavailable",
    );
  });

  it("reports a known maximum before unavailable practical guidance", () => {
    const guidance = buildRuntimeProfileGuidance(
      runtimeProfileFixtures.aboveMaximum,
      {
        status: "unavailable",
        confidence: "medium",
        message: "Context guidance is unavailable.",
        modelMaximumContextLength: 8192,
        recommendedContextLength: null,
        assumptions: [],
        reasonCodes: ["context-estimation-unavailable"],
      },
    );
    expect(guidance.contextAssessment).toBe("exceeds-model-maximum");
    expect(guidance.reasonCodes).toContain(
      "target-context-exceeds-model-maximum",
    );
  });

  it("rejects invalid runtime profile values at the engine boundary", () => {
    expect(() =>
      buildRuntimeProfileGuidance(
        { backend: "directml" } as never,
        evaluateCompatibility(
          fixtureHardware.gpu,
          fixtureModel,
          fixtureModel.quantizations[0],
        ).contextGuidance,
      ),
    ).toThrow("Invalid runtime profile");
  });
});
