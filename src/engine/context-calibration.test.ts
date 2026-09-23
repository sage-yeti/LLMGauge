import { describe, expect, it } from "vitest";
import {
  buildContextGuidance,
  evaluateCompatibility,
  estimateMemory,
} from "./compatibility";
import { DEFAULT_COMPATIBILITY_POLICY } from "./assumptions";
import { contextCalibrationScenarios } from "./context-calibration-fixtures";
import { fixtureModel, fixtureHardware } from "@/data/fixtures";

describe("context guidance calibration scenarios", () => {
  it("covers small, medium, and large models across execution modes", () => {
    for (const scenario of contextCalibrationScenarios) {
      const result = evaluateCompatibility(
        scenario.hardware,
        scenario.model,
        scenario.model.quantizations[0],
      );

      expect(result.level, scenario.id).toBe(scenario.expectedLevel);
      expect(result.contextGuidance.status, scenario.id).toBe("available");
      expect(
        result.contextGuidance.recommendedContextLength,
        scenario.id,
      ).toBeLessThanOrEqual(result.contextGuidance.modelMaximumContextLength!);
    }
  });

  it("keeps guidance independent from compatibility classification", () => {
    const modelWithoutContext = {
      ...fixtureModel,
      defaultContextLength: undefined,
      maxContextLength: undefined,
    };
    const withGuidance = evaluateCompatibility(
      fixtureHardware.gpu,
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    const withoutGuidance = evaluateCompatibility(
      fixtureHardware.gpu,
      modelWithoutContext,
      modelWithoutContext.quantizations[0],
    );

    expect(withoutGuidance.level).toBe(withGuidance.level);
    expect(withoutGuidance.contextGuidance.status).toBe("unavailable");
    expect(withoutGuidance.contextGuidance.recommendedContextLength).toBeNull();
    expect(withoutGuidance.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        "context-estimation-unavailable",
        "approximate-context-assumption",
      ]),
    );
  });

  it("reports partial metadata as uncertainty instead of inventing a recommendation", () => {
    const maxOnly = buildContextGuidance(
      { ...fixtureModel, defaultContextLength: undefined },
      DEFAULT_COMPATIBILITY_POLICY,
    );
    const defaultOnly = buildContextGuidance(
      { ...fixtureModel, maxContextLength: undefined },
      DEFAULT_COMPATIBILITY_POLICY,
    );

    expect(maxOnly).toMatchObject({
      status: "unavailable",
      modelMaximumContextLength: 8192,
      recommendedContextLength: null,
      confidence: "unknown",
    });
    expect(defaultOnly).toMatchObject({
      status: "unavailable",
      modelMaximumContextLength: null,
      recommendedContextLength: null,
      confidence: "unknown",
    });
  });

  it("keeps exact and configured boundaries stable", () => {
    const modelAtConfiguredBoundary = {
      ...fixtureModel,
      defaultContextLength: 8192,
      maxContextLength: 8192,
    };
    const boundaryGuidance = buildContextGuidance(modelAtConfiguredBoundary, {
      ...DEFAULT_COMPATIBILITY_POLICY,
      defaultContextLength: 8192,
    });
    expect(boundaryGuidance.recommendedContextLength).toBe(8192);
    expect(boundaryGuidance.recommendedContextLength).toBe(
      boundaryGuidance.modelMaximumContextLength,
    );

    const estimate = estimateMemory(
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    const result = evaluateCompatibility(
      {
        ...fixtureHardware.gpu,
        gpu: {
          ...fixtureHardware.gpu.gpu!,
          vramGiB: estimate.estimatedVramGiB,
        },
        systemRamGiB: estimate.estimatedSystemRamGiB,
      },
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    expect(result.level).toBe("gpu-capable");
    expect(result.reasons.map((reason) => reason.code)).toContain(
      "exact-memory-boundary",
    );
  });

  it("keeps context reason codes and warnings consistent", () => {
    const available = evaluateCompatibility(
      fixtureHardware.cpuOnly,
      fixtureModel,
      fixtureModel.quantizations[0],
    );
    const unavailable = evaluateCompatibility(
      fixtureHardware.cpuOnly,
      { ...fixtureModel, maxContextLength: undefined },
      fixtureModel.quantizations[0],
    );

    expect(available.contextGuidance.reasonCodes).toEqual([
      "model-context-limit",
      "conservative-context-guidance",
      "approximate-context-assumption",
    ]);
    expect(available.warnings).toEqual(
      expect.arrayContaining([
        "Context guidance is conservative and advisory; it does not calculate KV-cache memory.",
      ]),
    );
    expect(unavailable.contextGuidance.reasonCodes).toEqual([
      "context-estimation-unavailable",
      "approximate-context-assumption",
    ]);
  });
});
