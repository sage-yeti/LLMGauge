import { describe, expect, it } from "vitest";
import {
  detectBrowserHardware,
  parseDeviceMemory,
  parseLogicalProcessors,
  parseOperatingSystem,
  parseRendererHint,
  suggestCatalogGpu,
} from "./browser-detection";
import { gpuCatalog } from "@/data/catalog";

describe("browser hardware detection", () => {
  it("parses operating-system hints with a user-agent-data preference", () => {
    expect(parseOperatingSystem("Windows", "Linux").value).toBe("windows");
    expect(parseOperatingSystem(undefined, "Mozilla Linux").value).toBe(
      "linux",
    );
    expect(parseOperatingSystem(undefined, "opaque").value).toBeNull();
  });

  it("accepts only useful logical processor values", () => {
    expect(parseLogicalProcessors(8).value).toBe(8);
    expect(parseLogicalProcessors(0).value).toBeNull();
    expect(parseLogicalProcessors(2.5).value).toBeNull();
    expect(parseLogicalProcessors(8).safeToApply).toBe(false);
  });

  it("marks device memory as a coarse, non-authoritative hint", () => {
    const hint = parseDeviceMemory(16);
    expect(hint.value).toBe(16);
    expect(hint.confidence).toBe("low");
    expect(hint.safeToApply).toBe(false);
    expect(parseDeviceMemory(-1).value).toBeNull();
  });

  it("hides privacy placeholders and preserves useful renderer text", () => {
    expect(parseRendererHint("WebGL Renderer")).toBeNull();
    expect(
      parseRendererHint("ANGLE (NVIDIA, GeForce RTX 3060 12GB)"),
    ).toContain("RTX 3060");
  });

  it("suggests a unique catalog GPU without inventing VRAM", () => {
    const suggestion = suggestCatalogGpu(
      "ANGLE (NVIDIA, GeForce RTX 3060)",
      gpuCatalog,
    );
    expect(suggestion.value?.gpuId).toBe("nvidia-rtx-3060-12gb");
    expect(suggestion.confidence).toBe("low");
    expect(suggestion.safeToApply).toBe(false);
  });

  it("leaves exact VRAM unknown when browser APIs are available", async () => {
    const result = await detectBrowserHardware({
      userAgentDataPlatform: "Linux",
      hardwareConcurrency: 12,
      deviceMemoryGiB: 8,
      createCanvas: () => ({
        getContext: () => null,
      }),
    });
    expect(result.operatingSystem.value).toBe("linux");
    expect(result.logicalProcessors.value).toBe(12);
    expect(result.deviceMemoryGiB.value).toBe(8);
    expect(result.gpuRenderer.value).toBeNull();
    expect(result.exactVramGiB.value).toBeNull();
  });

  it("uses a WebGPU adapter hint when WebGL is unavailable", async () => {
    const result = await detectBrowserHardware({
      webgpu: {
        requestAdapter: async () => ({
          info: { vendor: "NVIDIA", device: "GeForce RTX 3060" },
        }),
      },
    });
    expect(result.gpuRenderer.value).toContain("GeForce RTX 3060");
    expect(result.gpuRenderer.source).toBe("webgpu");
    expect(result.exactVramGiB.value).toBeNull();
  });

  it("handles unsupported or privacy-restricted browsers gracefully", async () => {
    const result = await detectBrowserHardware({
      createCanvas: () => ({
        getContext: () => ({
          getExtension: () => null,
          getParameter: () => "WebGL Renderer",
          RENDERER: 1,
        }),
      }),
    });
    expect(result.operatingSystem.value).toBeNull();
    expect(result.deviceMemoryGiB.value).toBeNull();
    expect(result.gpuRenderer.value).toBeNull();
    expect(result.gpuSuggestion.value).toBeNull();
  });
});
