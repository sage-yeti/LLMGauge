import {
  evaluateCompatibility,
  recommendQuantization,
} from "@/engine/compatibility";
import { getModelById } from "@/data/catalog";
import type { CompatibilityResult } from "@/domain/types";
import { parseHardwareForm, type HardwareFormValues } from "./hardware";

export interface CalculatorFormValues extends HardwareFormValues {
  modelId: string;
  quantizationId: string;
}

export interface CalculatorEvaluation {
  result?: CompatibilityResult;
  fieldErrors: Record<string, string>;
  formError?: string;
}

export function evaluateCalculator(
  values: CalculatorFormValues,
): CalculatorEvaluation {
  const model = getModelById(values.modelId);
  if (!model)
    return {
      fieldErrors: {},
      formError:
        "That model is no longer available. Please choose another model.",
    };
  const quantization = model.quantizations.find(
    (candidate) => candidate.id === values.quantizationId,
  );
  if (!quantization)
    return {
      fieldErrors: {
        quantizationId:
          "This quantization is not available for the selected model.",
      },
    };

  const hardwareEvaluation = parseHardwareForm(values);
  if (!hardwareEvaluation.hardware) return hardwareEvaluation;

  try {
    const result = evaluateCompatibility(
      hardwareEvaluation.hardware,
      model,
      quantization,
    );
    const recommendation = recommendQuantization(
      hardwareEvaluation.hardware,
      model,
    );
    return {
      fieldErrors: {},
      result: {
        ...result,
        recommendedQuantizationId:
          recommendation?.recommendedQuantizationId ?? null,
      },
    };
  } catch {
    return {
      fieldErrors: {},
      formError:
        "The hardware or model details could not be evaluated. Please review the form and try again.",
    };
  }
}
