"use client";

import type { RuntimeProfileFormValues } from "@/application/hardware";
import { useState } from "react";
import { Field } from "./hardware-fields";

interface RuntimeFieldsProps {
  values: RuntimeProfileFormValues;
  fieldErrors: Record<string, string>;
  onChange: (field: keyof RuntimeProfileFormValues, value: string) => void;
}

export function RuntimeFields({
  values,
  fieldErrors,
  onChange,
}: RuntimeFieldsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasRuntimeError = Boolean(
    fieldErrors.runtime ||
    fieldErrors.backend ||
    fieldErrors.executionPreference ||
    fieldErrors.targetContextLength,
  );

  return (
    <details
      className="runtime-fields"
      open={isOpen || hasRuntimeError}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>Advanced settings</summary>
      <div className="runtime-fields-content">
        <div className="section-heading">
          <div>
            <h3>Optional runtime planning</h3>
            <p>
              These inputs add explanations only. They do not verify drivers,
              backend support, speed, or exact context memory.
            </p>
          </div>
        </div>
        <div className="field-grid">
          <Field
            id="runtime"
            label="Runtime"
            help="Choose llama.cpp when that is the runtime you plan to use."
            error={fieldErrors.runtime}
            required={false}
          >
            <select
              id="runtime"
              value={values.runtime}
              onChange={(event) => onChange("runtime", event.target.value)}
              aria-invalid={Boolean(fieldErrors.runtime)}
              aria-describedby={
                fieldErrors.runtime ? "runtime-error" : "runtime-help"
              }
            >
              <option value="">Not specified</option>
              <option value="llama.cpp">llama.cpp</option>
              <option value="unknown">Unknown runtime</option>
            </select>
          </Field>
          <Field
            id="backend"
            label="Backend/device path"
            help="This is an assumption, not a capability check."
            error={fieldErrors.backend}
            required={false}
          >
            <select
              id="backend"
              value={values.backend}
              onChange={(event) => onChange("backend", event.target.value)}
              aria-invalid={Boolean(fieldErrors.backend)}
              aria-describedby={
                fieldErrors.backend ? "backend-error" : "backend-help"
              }
            >
              <option value="">Not specified</option>
              <option value="cpu">CPU</option>
              <option value="cuda">CUDA</option>
              <option value="vulkan">Vulkan</option>
              <option value="metal">Metal</option>
              <option value="unknown">Unknown backend</option>
            </select>
          </Field>
        </div>
        <div className="field-grid">
          <Field
            id="execution-preference"
            label="Execution preference"
            help="The preference is advisory and does not override the result."
            error={fieldErrors.executionPreference}
            required={false}
          >
            <select
              id="execution-preference"
              value={values.executionPreference}
              onChange={(event) =>
                onChange("executionPreference", event.target.value)
              }
              aria-invalid={Boolean(fieldErrors.executionPreference)}
              aria-describedby={
                fieldErrors.executionPreference
                  ? "execution-preference-error"
                  : "execution-preference-help"
              }
            >
              <option value="">Not specified</option>
              <option value="automatic">Automatic</option>
              <option value="full-gpu">Full GPU</option>
              <option value="partial-offload">Partial offload</option>
              <option value="cpu">CPU</option>
            </select>
          </Field>
          <Field
            id="target-context-length"
            label="Target context length (tokens)"
            help="Optional planning target; exact context memory is not estimated."
            error={fieldErrors.targetContextLength}
            required={false}
          >
            <input
              id="target-context-length"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={values.targetContextLength}
              onChange={(event) =>
                onChange("targetContextLength", event.target.value)
              }
              aria-invalid={Boolean(fieldErrors.targetContextLength)}
              aria-describedby={
                fieldErrors.targetContextLength
                  ? "target-context-length-error"
                  : "target-context-length-help"
              }
            />
          </Field>
        </div>
      </div>
    </details>
  );
}
