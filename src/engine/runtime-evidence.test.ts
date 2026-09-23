import { describe, expect, it } from "vitest";
import { productionModels } from "@/data/production-catalog";
import { fixtureHardware } from "@/data/fixtures";
import { evaluateCompatibility } from "./compatibility";
import { runtimeEvidenceMatrix } from "./runtime-evidence";

describe("runtime evidence review matrix", () => {
  it("contains source-backed coverage for the reviewed behavior", () => {
    expect(runtimeEvidenceMatrix.length).toBeGreaterThanOrEqual(5);
    expect(
      new Set(runtimeEvidenceMatrix.map((entry) => entry.assessment)),
    ).toEqual(
      new Set([
        "metadata-supported",
        "conservative-policy",
        "approximate-planning",
        "currently-unknowable",
      ]),
    );
    for (const entry of runtimeEvidenceMatrix) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/);
      expect(entry.sourceUrl).toMatch(
        /^https:\/\/(github\.com|huggingface\.co)\//,
      );
      expect(entry.expectedQualitativeBehavior.length).toBeGreaterThan(20);
      expect(entry.currentTreatment.length).toBeGreaterThan(20);
    }
  });

  it("keeps representative production classifications unchanged", () => {
    const llama = productionModels.find(
      (model) => model.id === "meta-llama-3-2-1b-instruct",
    );
    const gemma = productionModels.find(
      (model) => model.id === "google-gemma-3-1b-it",
    );
    expect(llama).toBeDefined();
    expect(gemma).toBeDefined();

    const llamaResult = evaluateCompatibility(
      fixtureHardware.gpu,
      llama!,
      llama!.quantizations[0],
    );
    const gemmaResult = evaluateCompatibility(
      fixtureHardware.gpu,
      gemma!,
      gemma!.quantizations[0],
    );

    expect(llamaResult.level).toBe("gpu-capable");
    expect(gemmaResult.level).toBe("gpu-capable");
    expect(llamaResult.contextGuidance.modelMaximumContextLength).toBe(131072);
    expect(gemmaResult.contextGuidance.modelMaximumContextLength).toBe(32768);
    expect(gemmaResult.contextGuidance.recommendedContextLength).toBe(4096);
  });
});
