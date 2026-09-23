import type { RuntimeProfile } from "@/domain/types";

/** Small advisory-profile cases used to keep runtime behavior deterministic. */
export const runtimeProfileFixtures = {
  omitted: undefined,
  llamaCuda: {
    runtime: "llama.cpp",
    backend: "cuda",
    executionPreference: "full-gpu",
    targetContextLength: 4096,
  },
  unknownBackend: {
    runtime: "llama.cpp",
    backend: "unknown",
  },
  cpu: {
    runtime: "llama.cpp",
    backend: "cpu",
    executionPreference: "cpu",
  },
  aboveGuidance: {
    runtime: "llama.cpp",
    targetContextLength: 8192,
  },
  aboveMaximum: {
    runtime: "llama.cpp",
    targetContextLength: 16384,
  },
} satisfies Record<string, RuntimeProfile | undefined>;
