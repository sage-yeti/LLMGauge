import { z } from "zod";
import { getGpuById } from "@/data/catalog";
import { hardwareProfileSchema } from "@/domain/schemas";
import type {
  GpuDefinition,
  HardwareProfile,
  OperatingSystem,
} from "@/domain/types";

export interface HardwareFormValues {
  cpuName: string;
  gpuId: string;
  vramGiB: string;
  systemRamGiB: string;
  operatingSystem: OperatingSystem;
}

export interface HardwareFormEvaluation {
  hardware?: HardwareProfile;
  fieldErrors: Record<string, string>;
  formError?: string;
}

const positiveNumberText = z
  .string()
  .trim()
  .min(1, "Enter a value.")
  .refine(isPositiveNumber, "Enter a number greater than 0.");
const nonNegativeNumberText = z
  .string()
  .trim()
  .min(1, "Enter a value.")
  .refine(isNonNegativeNumber, "Enter a number of 0 or more.");

const hardwareFormSchema = z.object({
  cpuName: z.string().trim().min(1, "Enter a CPU name."),
  gpuId: z.string().trim().min(1, "Choose a GPU option."),
  vramGiB: nonNegativeNumberText,
  systemRamGiB: positiveNumberText,
  operatingSystem: z.enum(["windows", "linux", "macos", "other"]),
});

export function parseHardwareForm(
  values: HardwareFormValues,
): HardwareFormEvaluation {
  const parsed = hardwareFormSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };

  const vramGiB = Number(parsed.data.vramGiB);
  const gpu =
    parsed.data.gpuId === "none" ? undefined : getGpuById(parsed.data.gpuId);
  if (parsed.data.gpuId !== "none" && !gpu) {
    return {
      fieldErrors: {
        gpuId: "That GPU is no longer available. Please choose another GPU.",
      },
    };
  }
  if (!gpu && vramGiB !== 0) {
    return {
      fieldErrors: { vramGiB: "VRAM must be 0 when no GPU is selected." },
    };
  }
  if (gpu?.kind === "integrated" && vramGiB !== 0) {
    return {
      fieldErrors: {
        vramGiB: "Integrated GPUs use 0 GiB of dedicated VRAM in this version.",
      },
    };
  }

  const hardware: HardwareProfile = {
    cpu: { name: parsed.data.cpuName },
    ...(gpu ? { gpu: toGpuInfo(gpu, vramGiB) } : {}),
    systemRamGiB: Number(parsed.data.systemRamGiB),
    operatingSystem: parsed.data.operatingSystem,
  };
  const validHardware = hardwareProfileSchema.safeParse(hardware);
  if (!validHardware.success) {
    return {
      fieldErrors: {},
      formError:
        "The hardware details could not be validated. Please review the form and try again.",
    };
  }
  return { fieldErrors: {}, hardware };
}

function toGpuInfo(
  gpu: GpuDefinition,
  vramGiB: number,
): NonNullable<HardwareProfile["gpu"]> {
  return {
    id: gpu.id,
    name: gpu.displayName,
    kind: gpu.kind,
    vramGiB,
    sharedMemoryGiB: gpu.sharedMemoryGiB,
  };
}

function isPositiveNumber(value: string): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function isNonNegativeNumber(value: string): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function issuesToFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  return Object.fromEntries(
    issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
  );
}
