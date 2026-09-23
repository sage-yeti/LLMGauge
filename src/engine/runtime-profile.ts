import { runtimeProfileSchema } from "@/domain/schemas";
import type {
  ContextGuidance,
  RuntimeProfile,
  RuntimeProfileGuidance,
  RuntimeProfileReasonCode,
} from "@/domain/types";

/**
 * Converts optional user-selected runtime inputs into advisory explanations.
 * It intentionally does not change memory estimates, classifications, or ranking.
 */
export function buildRuntimeProfileGuidance(
  profile: RuntimeProfile | undefined,
  contextGuidance: ContextGuidance,
): RuntimeProfileGuidance {
  const normalized = profile ?? {};
  const parsed = runtimeProfileSchema.safeParse(normalized);
  if (!parsed.success) throw new Error("Invalid runtime profile");

  const reasons: RuntimeProfileReasonCode[] = [];
  const assumptions: string[] = [];
  const warnings: string[] = [];
  const requestedContextLength = normalized.targetContextLength ?? null;
  const hasProfile = Object.keys(normalized).length > 0;

  if (!hasProfile) {
    return {
      profile: {},
      contextAssessment: "not-requested",
      requestedContextLength: null,
      assumptions: [],
      warnings: [],
      reasonCodes: [],
    };
  }

  reasons.push("runtime-profile-applied");
  assumptions.push(
    "Runtime profile values are user-selected planning assumptions and do not prove local runtime or backend support.",
  );

  if (normalized.runtime === "llama.cpp") {
    assumptions.push(
      "The llama.cpp profile describes intended execution; installed build, driver, and model-conversion support are not verified.",
    );
  } else if (normalized.runtime === "unknown") {
    reasons.push("runtime-profile-unknown");
    warnings.push(
      "The runtime is unknown, so runtime-specific behavior remains uncertain.",
    );
  }

  if (normalized.backend && normalized.backend !== "cpu") {
    if (normalized.backend === "unknown") {
      reasons.push("runtime-backend-unverified");
      warnings.push(
        "The backend is unknown; backend-specific support and memory behavior are not verified.",
      );
    } else {
      reasons.push("runtime-backend-unverified");
      warnings.push(
        `${normalized.backend} is a selected backend assumption, not a verified capability or performance prediction.`,
      );
    }
  }

  if (normalized.executionPreference) {
    reasons.push("execution-preference-advisory");
    assumptions.push(
      `The ${normalized.executionPreference} execution preference is advisory; compatibility classification remains based on the hardware estimate.`,
    );
  }

  let contextAssessment: RuntimeProfileGuidance["contextAssessment"] =
    "not-requested";
  if (requestedContextLength !== null) {
    if (
      contextGuidance.modelMaximumContextLength !== null &&
      requestedContextLength > contextGuidance.modelMaximumContextLength
    ) {
      contextAssessment = "exceeds-model-maximum";
      reasons.push("target-context-exceeds-model-maximum");
      warnings.push(
        `The requested context exceeds the model maximum of ${contextGuidance.modelMaximumContextLength.toLocaleString()} tokens.`,
      );
    } else if (contextGuidance.status === "unavailable") {
      contextAssessment = "unavailable";
      reasons.push("target-context-estimation-unavailable");
      warnings.push(
        "The requested context cannot be compared because the model context metadata is incomplete.",
      );
    } else if (
      contextGuidance.recommendedContextLength !== null &&
      requestedContextLength > contextGuidance.recommendedContextLength
    ) {
      contextAssessment = "above-practical-guidance";
      reasons.push("target-context-above-guidance");
      warnings.push(
        `The requested context is above the practical starting guidance of ${contextGuidance.recommendedContextLength.toLocaleString()} tokens; additional memory impact is not estimated.`,
      );
    } else {
      contextAssessment = "within-guidance";
      reasons.push("target-context-within-guidance");
      assumptions.push(
        "The requested context is at or below the practical starting guidance; exact context memory is still not estimated.",
      );
    }
  }

  return {
    profile: { ...normalized },
    contextAssessment,
    requestedContextLength,
    assumptions,
    warnings,
    reasonCodes: reasons,
  };
}
