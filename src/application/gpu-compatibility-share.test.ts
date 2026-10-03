import { modelCatalog } from "@/data/catalog";
import type { GpuCompatibilityFormValues } from "./gpu-compatibility";
import {
  buildGpuCompatibilitySharePath,
  parseGpuCompatibilityShareParams,
} from "./gpu-compatibility-share";
import { describe, expect, it } from "vitest";

const values: GpuCompatibilityFormValues = {
  modelId: "meta-llama-3-2-1b-instruct",
  systemRamGiB: "128",
  runtime: "",
  backend: "",
  executionPreference: "",
  targetContextLength: "",
};

function parse(query: string) {
  return parseGpuCompatibilityShareParams(
    new URLSearchParams(query),
    modelCatalog,
  );
}

describe("GPU comparison share links", () => {
  it("constructs a stable URL with only required comparison values", () => {
    expect(buildGpuCompatibilitySharePath(values, modelCatalog)).toBe(
      "/gpu-compatibility?v=1&model=meta-llama-3-2-1b-instruct&ram=128",
    );
  });

  it("encodes explicit runtime settings and custom or preset context values", () => {
    expect(
      buildGpuCompatibilitySharePath(
        {
          ...values,
          runtime: "llama.cpp",
          backend: "cuda",
          executionPreference: "full-gpu",
          targetContextLength: "16384",
        },
        modelCatalog,
      ),
    ).toBe(
      "/gpu-compatibility?v=1&model=meta-llama-3-2-1b-instruct&ram=128&runtime=llama.cpp&backend=cuda&execution=full-gpu&context=16384",
    );
    expect(
      buildGpuCompatibilitySharePath(
        { ...values, targetContextLength: "12345" },
        modelCatalog,
      ),
    ).toContain("&context=12345");
  });

  it("restores valid state and leaves omitted settings unset", () => {
    const result = parse("v=1&model=meta-llama-3-2-1b-instruct&ram=64");
    expect(result).toEqual({
      status: "valid",
      values: {
        ...values,
        systemRamGiB: "64",
      },
    });
  });

  it("restores optional runtime and context values through the form schema", () => {
    const result = parse(
      "v=1&model=meta-llama-3-2-1b-instruct&ram=128&runtime=llama.cpp&backend=cuda&execution=full-gpu&context=4096",
    );
    expect(result).toMatchObject({
      status: "valid",
      values: {
        runtime: "llama.cpp",
        backend: "cuda",
        executionPreference: "full-gpu",
        targetContextLength: "4096",
      },
    });
    expect(
      parse("v=1&model=meta-llama-3-2-1b-instruct&ram=128&context=12345"),
    ).toMatchObject({
      status: "valid",
      values: { targetContextLength: "12345" },
    });
  });

  it.each([
    "v=1&model=stale-model&ram=128",
    "v=1&model=meta-llama-3-2-1b-instruct&ram=0",
    "v=1&model=meta-llama-3-2-1b-instruct&ram=128&context=0",
    "v=1&model=meta-llama-3-2-1b-instruct&ram=128&backend=not-a-backend",
    "v=2&model=meta-llama-3-2-1b-instruct&ram=128",
    "v=1&model=meta-llama-3-2-1b-instruct",
    "v=1&model=meta-llama-3-2-1b-instruct&ram=128&extra=profile",
    "v=1&model=meta-llama-3-2-1b-instruct&ram=128&ram=256",
  ])("rejects the whole invalid state: %s", (query) => {
    expect(parse(query).status).toBe("invalid");
  });

  it("does not treat an empty query as shared state", () => {
    expect(parse("")).toEqual({ status: "none" });
  });

  it("does not build a link from invalid values", () => {
    expect(
      buildGpuCompatibilitySharePath(
        { ...values, modelId: "stale-model" },
        modelCatalog,
      ),
    ).toBeNull();
  });
});
