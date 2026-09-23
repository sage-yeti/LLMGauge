import type { ContextGuidance } from "@/domain/types";

export function ContextGuidanceView({
  guidance,
  headingId = "context-guidance-heading",
}: {
  guidance: ContextGuidance;
  headingId?: string;
}) {
  return (
    <section className="context-guidance" aria-labelledby={headingId}>
      <h3 id={headingId}>Context guidance</h3>
      <p>{guidance.message}</p>
      <dl className="context-guidance-stats">
        <div>
          <dt>Model maximum</dt>
          <dd>
            {guidance.modelMaximumContextLength === null
              ? "Unavailable"
              : `${guidance.modelMaximumContextLength.toLocaleString()} tokens`}
          </dd>
        </div>
        <div>
          <dt>Practical starting point</dt>
          <dd>
            {guidance.recommendedContextLength === null
              ? "Unavailable"
              : `${guidance.recommendedContextLength.toLocaleString()} tokens`}
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>
            {guidance.confidence === "medium" ? "Advisory" : "Unavailable"}
          </dd>
        </div>
      </dl>
      <ul>
        {guidance.assumptions.map((assumption) => (
          <li key={assumption}>{assumption}</li>
        ))}
      </ul>
    </section>
  );
}
