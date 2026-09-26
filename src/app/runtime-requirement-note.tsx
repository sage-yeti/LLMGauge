import type { RuntimeRequirement } from "@/domain/types";

export function RuntimeRequirementNote({
  requirement,
}: {
  requirement: RuntimeRequirement;
}) {
  return (
    <p className="provenance-note runtime-requirement-note">
      <strong>Runtime prerequisite:</strong> {requirement.description} Memory
      compatibility does not confirm runtime-load compatibility.{" "}
      <a href={requirement.sourceUrl} target="_blank" rel="noreferrer">
        {requirement.source}
      </a>
    </p>
  );
}
