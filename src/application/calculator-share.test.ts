import { gpuCatalog, modelCatalog } from "@/data/catalog";
import { describe, expect, it } from "vitest";
import type { CalculatorFormValues } from "./calculator";
import {
  buildCalculatorSharePath,
  parseCalculatorShareParams,
} from "./calculator-share";

const model = modelCatalog[0]!;
const quantization = model.quantizations[0]!;
const values: CalculatorFormValues = {
  modelId: model.id,
  quantizationId: quantization.id,
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
  return parseCalculatorShareParams(
    new URLSearchParams(query),
    modelCatalog,
    gpuCatalog,
  );
}

describe("calculator share links", () => {
  it("builds a deterministic URL from model, quantization, and evaluated hardware", () => {
    expect(buildCalculatorSharePath(values, modelCatalog, gpuCatalog)).toBe(
      `/?v=1&model=${model.id}&quantization=${quantization.id}&cpu=AMD+Ryzen+5&ram=16&os=windows&gpu=none&vram=0`,
    );
  });

  it("encodes explicit runtime values and a custom context", () => {
    const path = buildCalculatorSharePath(
      {
        ...values,
        runtime: "llama.cpp",
        backend: "cuda",
        executionPreference: "full-gpu",
        targetContextLength: "12345",
      },
      modelCatalog,
      gpuCatalog,
    );
    expect(path).toContain(
      "&runtime=llama.cpp&backend=cuda&execution=full-gpu&context=12345",
    );
  });

  it("restores valid state while omitted runtime and context remain unset", () => {
    const query = buildCalculatorSharePath(
      values,
      modelCatalog,
      gpuCatalog,
    )!.slice(2);
    expect(parse(query)).toEqual({ status: "valid", values });
  });

  it("does not reject explicit targets above a model maximum", () => {
    const path = buildCalculatorSharePath(
      { ...values, targetContextLength: "200000" },
      modelCatalog,
      gpuCatalog,
    )!;
    expect(parse(path.slice(2))).toMatchObject({
      status: "valid",
      values: { targetContextLength: "200000" },
    });
  });

  it("omits inactive PC GPU values in Apple unified-memory mode", () => {
    const appleValues: CalculatorFormValues = {
      ...values,
      memoryMode: "apple-unified",
      cpuName: "Apple M4",
      systemRamGiB: "128",
      operatingSystem: "macos",
      gpuId: "hidden-stale-gpu",
      vramGiB: "999",
    };
    const path = buildCalculatorSharePath(
      appleValues,
      modelCatalog,
      gpuCatalog,
    )!;
    expect(path).not.toContain("gpu=");
    expect(path).not.toContain("vram=");
    expect(parse(path.slice(2))).toMatchObject({
      status: "valid",
      values: { memoryMode: "apple-unified", gpuId: "none", vramGiB: "0" },
    });
  });

  it.each([
    "v=2&model=" +
      model.id +
      "&quantization=" +
      quantization.id +
      "&cpu=CPU&ram=16&os=windows&gpu=none&vram=0",
    "v=1&model=stale-model&quantization=" +
      quantization.id +
      "&cpu=CPU&ram=16&os=windows&gpu=none&vram=0",
    "v=1&model=" +
      model.id +
      "&quantization=stale-q&cpu=CPU&ram=16&os=windows&gpu=none&vram=0",
    "v=1&model=" +
      model.id +
      "&quantization=" +
      quantization.id +
      "&cpu=CPU&ram=16&os=windows&gpu=stale-gpu&vram=0",
    "v=1&model=" +
      model.id +
      "&quantization=" +
      quantization.id +
      "&cpu=CPU&ram=16&os=windows&gpu=none",
    "v=1&model=" +
      model.id +
      "&quantization=" +
      quantization.id +
      "&cpu=Apple+M4&ram=24&os=macos&mode=apple-unified&gpu=none&vram=0",
    "v=1&model=" +
      model.id +
      "&quantization=" +
      quantization.id +
      "&cpu=CPU&ram=16&os=windows&gpu=none&vram=0&execution=not-a-mode&context=4096",
    "v=1&model=" +
      model.id +
      "&quantization=" +
      quantization.id +
      "&cpu=CPU&ram=16&os=windows&gpu=none&vram=0&context=1.5",
    "v=1&model=" +
      model.id +
      "&quantization=" +
      quantization.id +
      "&cpu=CPU&ram=16&os=windows&gpu=none&vram=0&extra=profile",
  ])("rejects the entire invalid state: %s", (query) => {
    expect(parse(query).status).toBe("invalid");
  });

  it("does not build a link with a stale catalog value", () => {
    expect(
      buildCalculatorSharePath(
        { ...values, modelId: "stale-model" },
        modelCatalog,
        gpuCatalog,
      ),
    ).toBeNull();
  });
});
