import type { RuntimeProfileGuidance } from "@/domain/types";

const runtimeLabels = {
  "llama.cpp": "llama.cpp",
  unknown: "Unknown runtime",
} as const;
const backendLabels = {
  cpu: "CPU",
  cuda: "CUDA",
  vulkan: "Vulkan",
  metal: "Metal",
  unknown: "Unknown backend",
} as const;
const preferenceLabels = {
  automatic: "Automatic",
  "full-gpu": "Full GPU",
  "partial-offload": "Partial offload",
  cpu: "CPU",
} as const;

export function RuntimeProfileView({
  guidance,
}: {
  guidance: RuntimeProfileGuidance;
}) {
  const { profile } = guidance;
  if (Object.keys(profile).length === 0) return null;

  return (
    <section
      className="runtime-profile-result"
      aria-labelledby="runtime-profile-result-heading"
    >
      <h3 id="runtime-profile-result-heading">Runtime assumptions</h3>
      <dl className="result-stats">
        {profile.runtime && (
          <div>
            <dt>Runtime</dt>
            <dd>{runtimeLabels[profile.runtime]}</dd>
          </div>
        )}
        {profile.backend && (
          <div>
            <dt>Backend/device path</dt>
            <dd>{backendLabels[profile.backend]}</dd>
          </div>
        )}
        {profile.executionPreference && (
          <div>
            <dt>Execution preference</dt>
            <dd>{preferenceLabels[profile.executionPreference]}</dd>
          </div>
        )}
        {guidance.requestedContextLength !== null && (
          <div>
            <dt>Target context</dt>
            <dd>{guidance.requestedContextLength.toLocaleString()} tokens</dd>
          </div>
        )}
      </dl>
      {guidance.assumptions.length > 0 && (
        <ul>
          {guidance.assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      )}
      {guidance.warnings.length > 0 && (
        <ul className="runtime-profile-warnings">
          {guidance.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
