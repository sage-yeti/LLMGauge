import { describe, expect, it } from "vitest";
import { metadata as homeMetadata } from "./page";
import { metadata as recommendationsMetadata } from "./recommendations/page";
import { absoluteUrl } from "./site";

describe("core route canonical and Open Graph URLs", () => {
  it("sets canonical and Open Graph URLs for the homepage", () => {
    expect(homeMetadata.alternates?.canonical).toBe(absoluteUrl("/"));
    expect(homeMetadata.openGraph?.url).toBe(absoluteUrl("/"));
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
