import { gpuCatalog, modelCatalog } from "@/data/catalog";
import { describe, expect, it } from "vitest";
import type { RecommendationsFormValues } from "./recommendations-share";
import {
  buildRecommendationsSharePath,
  parseRecommendationsShareParams,
} from "./recommendations-share";

const values: RecommendationsFormValues = {
  cpuName: "AMD Ryzen 5",
  gpuId: "none",
  vramGiB: "0",
  systemRamGiB: "16",
  operatingSystem: "windows",
  runtime: "",
  backend: "",
  executionPreference: "",
  targetContextLength: "",
};

function parse(query: string) {
  return parseRecommendationsShareParams(
    new URLSearchParams(query),
    gpuCatalog,
  );
}

describe("recommendations share links", () => {
  it("builds a deterministic URL from only hardware values used by evaluation", () => {
    expect(buildRecommendationsSharePath(values, gpuCatalog)).toBe(
      "/recommendations?v=1&cpu=AMD+Ryzen+5&ram=16&os=windows&gpu=none&vram=0",
    );
  });

  it("preserves explicit runtime and custom context settings", () => {
    expect(
      buildRecommendationsSharePath(
        {
          ...values,
          runtime: "llama.cpp",
          backend: "cuda",
          executionPreference: "full-gpu",
          targetContextLength: "12345",
        },
        gpuCatalog,
      ),
    ).toBe(
      "/recommendations?v=1&cpu=AMD+Ryzen+5&ram=16&os=windows&gpu=none&vram=0&runtime=llama.cpp&backend=cuda&execution=full-gpu&context=12345",
    );
  });

  it("restores omitted optional settings as unset", () => {
    expect(
      parse("v=1&cpu=AMD+Ryzen+5&ram=16&os=windows&gpu=none&vram=0"),
    ).toEqual({ status: "valid", values });
  });

  it("omits inactive PC GPU values in Apple unified-memory mode", () => {
    const appleValues: RecommendationsFormValues = {
      ...values,
      memoryMode: "apple-unified",
      cpuName: "Apple M4",
      systemRamGiB: "24",
      operatingSystem: "macos",
      gpuId: "hidden-stale-gpu",
      vramGiB: "999",
    };
    const path = buildRecommendationsSharePath(appleValues, gpuCatalog)!;
    expect(path).toBe(
      "/recommendations?v=1&cpu=Apple+M4&ram=24&os=macos&mode=apple-unified",
    );
    expect(parse(path.split("?")[1]!)).toMatchObject({
      status: "valid",
      values: {
        memoryMode: "apple-unified",
        gpuId: "none",
        vramGiB: "0",
        targetContextLength: "",
      },
    });
  });

  it.each([
    "v=2&cpu=CPU&ram=16&os=windows&gpu=none&vram=0",
    "v=1&cpu=CPU&ram=16&os=windows&gpu=stale-gpu&vram=0",
    "v=1&cpu=CPU&ram=0&os=windows&gpu=none&vram=0",
    "v=1&cpu=CPU&ram=16&os=windows&gpu=none&vram=0&context=1.5",
    "v=1&cpu=CPU&ram=16&os=windows&gpu=none&vram=0&extra=profile",
    "v=1&cpu=CPU&ram=16&os=windows&gpu=none&gpu=none&vram=0",
  ])("rejects the entire invalid state: %s", (query) => {
    expect(parse(query).status).toBe("invalid");
  });

  it("does not serialize hardware scan values that were not applied", () => {
    expect(
      buildRecommendationsSharePath(
        { ...values, gpuId: modelCatalog[0]?.id ?? "none" },
        gpuCatalog,
      ),
    ).toBeNull();
  });
});
