import { describe, expect, it } from "vitest";
import { metadata as homeMetadata } from "./page";
import { metadata as recommendationsMetadata } from "./recommendations/page";
import { absoluteUrl } from "./site";

describe("core route canonical and Open Graph URLs", () => {
  it("sets canonical and Open Graph URLs for the homepage", () => {
    expect(homeMetadata.alternates?.canonical).toBe(absoluteUrl("/"));
    expect(homeMetadata.openGraph?.url).toBe(absoluteUrl("/"));
    expect(homeMetadata.title).toBe("Which Local LLMs Fit Your PC? | LLMGauge");
    expect(homeMetadata.description).toBe(
      "Check a local LLM against your PC or discover suitable models for your hardware, with compatibility guidance and approximate memory estimates.",
    );
  });

  it("sets canonical and Open Graph URLs for recommendations", () => {
    expect(recommendationsMetadata.alternates?.canonical).toBe(
      absoluteUrl("/recommendations"),
    );
    expect(recommendationsMetadata.openGraph?.url).toBe(
      absoluteUrl("/recommendations"),
    );
    expect(recommendationsMetadata.title).toBe("What Can My PC Run?");
    expect(recommendationsMetadata.description).toBe(
      "Find local language models that fit your computer's approximate memory limits.",
    );
  });
});
