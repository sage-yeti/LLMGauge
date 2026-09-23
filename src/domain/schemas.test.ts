import { describe, expect, it } from "vitest";
import {
  fixtureHardware,
  fixtureModel,
  fixtureProvenance,
} from "@/data/fixtures";
import {
  gpuDefinitionSchema,
  hardwareProfileSchema,
  modelDefinitionSchema,
  runtimeProfileSchema,
} from "./schemas";

describe("domain schemas", () => {
  it("accept the representative valid contracts", () => {
    expect(hardwareProfileSchema.safeParse(fixtureHardware.gpu).success).toBe(
      true,
    );
    expect(modelDefinitionSchema.safeParse(fixtureModel).success).toBe(true);
  });

  it("reject zero system RAM and negative memory values", () => {
    expect(
      hardwareProfileSchema.safeParse({
        ...fixtureHardware.cpuOnly,
        systemRamGiB: 0,
      }).success,
    ).toBe(false);
    expect(
      hardwareProfileSchema.safeParse({
        ...fixtureHardware.cpuOnly,
        systemRamGiB: -1,
      }).success,
    ).toBe(false);
  });

  it("allows an integrated GPU with zero dedicated VRAM", () => {
    expect(
      gpuDefinitionSchema.safeParse({
        id: "igpu",
        slug: "igpu",
        displayName: "Integrated",
        kind: "integrated",
        vendor: "Example",
        vramGiB: 0,
        sharedMemoryGiB: 4,
        suitabilitySummary: "Shared-memory fixture GPU.",
        provenance: fixtureProvenance,
      }).success,
    ).toBe(true);
  });

  it("rejects malformed model metadata and quantizations", () => {
    expect(
      modelDefinitionSchema.safeParse({ ...fixtureModel, id: "" }).success,
    ).toBe(false);
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        quantizations: [{ ...fixtureModel.quantizations[0], bitsPerWeight: 0 }],
      }).success,
    ).toBe(false);
  });

  it("requires URL-safe slugs and well-formed provenance", () => {
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        slug: "Not URL Safe",
      }).success,
    ).toBe(false);
    expect(
      modelDefinitionSchema.safeParse({
        ...fixtureModel,
        provenance: { ...fixtureModel.provenance, lastVerified: "yesterday" },
      }).success,
    ).toBe(false);
  });

  it("accepts optional runtime profiles and rejects invalid values", () => {
    expect(
      runtimeProfileSchema.safeParse({
        runtime: "llama.cpp",
        backend: "cuda",
        executionPreference: "full-gpu",
        targetContextLength: 4096,
      }).success,
    ).toBe(true);
    expect(runtimeProfileSchema.safeParse({}).success).toBe(true);
    expect(
      runtimeProfileSchema.safeParse({ backend: "directml" }).success,
    ).toBe(false);
    expect(
      runtimeProfileSchema.safeParse({ targetContextLength: 0 }).success,
    ).toBe(false);
    expect(
      runtimeProfileSchema.safeParse({ targetContextLength: 4096.5 }).success,
    ).toBe(false);
  });
});
