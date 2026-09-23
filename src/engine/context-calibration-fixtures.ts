import type { HardwareProfile, ModelDefinition } from "@/domain/types";
import { fixtureHardware, fixtureModels, fixtureModel } from "@/data/fixtures";

/**
 * Small deterministic scenarios for reviewing context guidance independently
 * from the production catalog. They are not benchmark results or user data.
 */
export interface ContextCalibrationScenario {
  id: string;
  model: ModelDefinition;
  hardware: HardwareProfile;
  expectedLevel: "gpu-capable" | "partial-offload" | "cpu-only" | "unsupported";
}

const smallModel: ModelDefinition = {
  ...fixtureModels[0],
  defaultContextLength: 2048,
  maxContextLength: 4096,
};

const mediumModel: ModelDefinition = {
  ...fixtureModel,
  defaultContextLength: 4096,
  maxContextLength: 8192,
};

const largeModel: ModelDefinition = {
  ...fixtureModels[2],
  defaultContextLength: 8192,
  maxContextLength: 32768,
};

const integratedHardware: HardwareProfile = {
  ...fixtureHardware.cpuOnly,
  gpu: {
    id: "gpu-integrated",
    name: "Example Integrated GPU",
    kind: "integrated",
    vramGiB: 0,
    sharedMemoryGiB: 8,
  },
};

export const contextCalibrationScenarios: readonly ContextCalibrationScenario[] =
  [
    {
      id: "small-gpu-capable",
      model: smallModel,
      hardware: fixtureHardware.gpu,
      expectedLevel: "gpu-capable",
    },
    {
      id: "medium-partial-offload",
      model: mediumModel,
      hardware: fixtureHardware.lowMemory,
      expectedLevel: "partial-offload",
    },
    {
      id: "large-cpu-only",
      model: largeModel,
      hardware: fixtureHardware.cpuOnly,
      expectedLevel: "cpu-only",
    },
    {
      id: "medium-integrated-gpu",
      model: mediumModel,
      hardware: integratedHardware,
      expectedLevel: "cpu-only",
    },
    {
      id: "large-unsupported",
      model: largeModel,
      hardware: { ...fixtureHardware.gpu, systemRamGiB: 1 },
      expectedLevel: "unsupported",
    },
  ];
