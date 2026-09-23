import type { GpuDefinition, OperatingSystem } from "@/domain/types";

export type DetectionConfidence = "high" | "medium" | "low" | "unknown";
export type DetectionSource =
  | "user-agent-data"
  | "user-agent"
  | "hardware-concurrency"
  | "device-memory"
  | "webgl"
  | "webgpu"
  | "not-exposed";

export interface DetectedField<T> {
  value: T | null;
  source: DetectionSource;
  confidence: DetectionConfidence;
  safeToApply: boolean;
  note: string;
}

export interface GpuSuggestion {
  gpuId: string;
  displayName: string;
}

export interface BrowserDetectionResult {
  operatingSystem: DetectedField<OperatingSystem>;
  logicalProcessors: DetectedField<number>;
  deviceMemoryGiB: DetectedField<number>;
  gpuRenderer: DetectedField<string>;
  gpuSuggestion: DetectedField<GpuSuggestion>;
  exactVramGiB: DetectedField<number>;
}

export interface BrowserDetectionEnvironment {
  userAgent?: string;
  userAgentDataPlatform?: string;
  hardwareConcurrency?: number;
  deviceMemoryGiB?: number;
  createCanvas?: () => {
    getContext: (contextId: string) => unknown;
  };
  webgpu?: {
    requestAdapter: () => Promise<{
      info?: { description?: string; device?: string; vendor?: string };
      requestAdapterInfo?: () => Promise<{
        description?: string;
        device?: string;
        vendor?: string;
      }>;
    } | null>;
  };
}

const unknownNote =
  "This value is not exposed reliably by normal browsers; enter it manually.";

export async function detectBrowserHardware(
  environment = getBrowserDetectionEnvironment(),
  gpus: readonly GpuDefinition[] = [],
): Promise<BrowserDetectionResult> {
  const platform = parseOperatingSystem(
    environment.userAgentDataPlatform,
    environment.userAgent,
  );
  const processors = parseLogicalProcessors(environment.hardwareConcurrency);
  const memory = parseDeviceMemory(environment.deviceMemoryGiB);
  const webgl = readWebglRenderer(environment.createCanvas);
  const webgpu = await readWebGpuRenderer(environment.webgpu);
  const renderer = webgl.value ? webgl : webgpu;
  const gpuSuggestion = renderer.value
    ? suggestCatalogGpu(
        renderer.value,
        gpus,
        renderer.source === "webgpu" ? "webgpu" : "webgl",
      )
    : unknownField<GpuSuggestion>();

  return {
    operatingSystem: platform,
    logicalProcessors: processors,
    deviceMemoryGiB: memory,
    gpuRenderer: renderer,
    gpuSuggestion,
    exactVramGiB: unknownField<number>(),
  };
}

export function getBrowserDetectionEnvironment(): BrowserDetectionEnvironment {
  if (typeof navigator === "undefined") return {};
  const navigatorWithHints = navigator as Navigator & {
    userAgentData?: { platform?: string };
    deviceMemory?: number;
    gpu?: BrowserDetectionEnvironment["webgpu"];
  };
  return {
    userAgent: navigator.userAgent,
    userAgentDataPlatform: navigatorWithHints.userAgentData?.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGiB: navigatorWithHints.deviceMemory,
    createCanvas:
      typeof document === "undefined"
        ? undefined
        : () => document.createElement("canvas"),
    webgpu: navigatorWithHints.gpu,
  };
}

export function parseOperatingSystem(
  platformHint?: string,
  userAgent?: string,
): DetectedField<OperatingSystem> {
  const sourceText = `${platformHint ?? ""} ${userAgent ?? ""}`.toLowerCase();
  let value: OperatingSystem | null = null;
  if (sourceText.includes("windows")) value = "windows";
  else if (sourceText.includes("android")) value = "other";
  else if (sourceText.includes("iphone") || sourceText.includes("ipad"))
    value = "other";
  else if (sourceText.includes("mac os") || sourceText.includes("macintosh"))
    value = "macos";
  else if (sourceText.includes("linux")) value = "linux";

  return {
    value,
    source: platformHint ? "user-agent-data" : "user-agent",
    confidence: value ? (platformHint ? "high" : "medium") : "unknown",
    safeToApply: Boolean(value),
    note: value
      ? "This is a platform hint, not a complete hardware or driver report."
      : "Your browser did not provide a recognizable operating-system hint.",
  };
}

export function parseLogicalProcessors(value?: number): DetectedField<number> {
  const valid =
    typeof value === "number" && Number.isInteger(value) && value > 0
      ? value
      : null;
  return {
    value: valid,
    source: "hardware-concurrency",
    confidence: valid ? "medium" : "unknown",
    safeToApply: false,
    note: valid
      ? "Browsers expose a logical-processor hint, not the exact CPU model."
      : "Logical processor count is unavailable in this browser.",
  };
}

export function parseDeviceMemory(value?: number): DetectedField<number> {
  const valid =
    typeof value === "number" && Number.isFinite(value) && value > 0
      ? value
      : null;
  return {
    value: valid,
    source: "device-memory",
    confidence: valid ? "low" : "unknown",
    safeToApply: false,
    note: valid
      ? "This is a coarse browser hint. Review it before using it as system RAM."
      : "Exact system RAM is not exposed by this browser.",
  };
}

export function parseRendererHint(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const renderer = value.trim();
  if (!renderer) return null;
  const privacyPlaceholders = new Set([
    "webgl",
    "webgl renderer",
    "renderer",
    "unknown",
    "swiftshader",
  ]);
  return privacyPlaceholders.has(renderer.toLowerCase()) ? null : renderer;
}

export function suggestCatalogGpu(
  renderer: string,
  gpus: readonly GpuDefinition[],
  source: "webgl" | "webgpu" = "webgl",
): DetectedField<GpuSuggestion> {
  const normalizedRenderer = normalizeGpuText(renderer);
  const matches = gpus.filter((gpu) => {
    const name = normalizeGpuText(gpu.displayName);
    const withoutCapacity = name.replace(/\d{1,3}(?:gb|gib)$/, "");
    return (
      withoutCapacity.length > 4 &&
      normalizedRenderer.includes(withoutCapacity) &&
      gpu.kind === "discrete"
    );
  });
  const match = matches.length === 1 ? matches[0] : undefined;
  return {
    value: match ? { gpuId: match.id, displayName: match.displayName } : null,
    source,
    confidence: match ? "low" : "unknown",
    safeToApply: false,
    note: match
      ? "This is only a renderer-name suggestion. Confirm the GPU and enter or review VRAM manually."
      : "The renderer hint did not exactly identify one catalog GPU.",
  };
}

function readWebglRenderer(
  createCanvas?: BrowserDetectionEnvironment["createCanvas"],
): DetectedField<string> {
  if (!createCanvas) return unknownField<string>("webgl");
  try {
    const canvas = createCanvas();
    const context = canvas.getContext("webgl") ?? canvas.getContext("webgl2");
    if (!context || typeof context !== "object")
      return unknownField<string>("webgl");
    const gl = context as {
      getExtension?: (name: string) => {
        UNMASKED_RENDERER_WEBGL?: number;
        loseContext?: () => void;
      } | null;
      getParameter?: (parameter: number) => unknown;
      RENDERER?: number;
    };
    const debug = gl.getExtension?.("WEBGL_debug_renderer_info");
    const parameter = debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER;
    const renderer = parseRendererHint(
      parameter === undefined ? null : gl.getParameter?.(parameter),
    );
    (
      gl.getExtension?.("WEBGL_lose_context") as {
        loseContext?: () => void;
      } | null
    )?.loseContext?.();
    return renderer
      ? {
          value: renderer,
          source: "webgl",
          confidence: debug ? "low" : "unknown",
          safeToApply: false,
          note: "Renderer strings can be masked or incomplete and do not reveal reliable VRAM.",
        }
      : unknownField<string>("webgl");
  } catch {
    return unknownField<string>("webgl");
  }
}

async function readWebGpuRenderer(
  webgpu?: BrowserDetectionEnvironment["webgpu"],
): Promise<DetectedField<string>> {
  if (!webgpu) return unknownField<string>("webgpu");
  try {
    const adapter = await webgpu.requestAdapter();
    if (!adapter) return unknownField<string>("webgpu");
    const info = adapter.info ?? (await adapter.requestAdapterInfo?.());
    const renderer = parseRendererHint(
      [info?.vendor, info?.device, info?.description].filter(Boolean).join(" "),
    );
    return renderer
      ? {
          value: renderer,
          source: "webgpu",
          confidence: "low",
          safeToApply: false,
          note: "Adapter names can be masked or incomplete and do not reveal reliable VRAM.",
        }
      : unknownField<string>("webgpu");
  } catch {
    return unknownField<string>("webgpu");
  }
}

function normalizeGpuText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function unknownField<T>(
  source: DetectionSource = "not-exposed",
): DetectedField<T> {
  return {
    value: null,
    source,
    confidence: "unknown",
    safeToApply: false,
    note: unknownNote,
  };
}
