import { describe, expect, it } from "vitest";
import { absoluteUrl } from "./site";
import sitemap from "./sitemap";

describe("shareable query variants", () => {
  it("keeps workflow sitemap entries canonical and independent of query state", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain(absoluteUrl("/"));
    expect(urls).toContain(absoluteUrl("/recommendations"));
    expect(urls.every((url) => !url.includes("?"))).toBe(true);
  });
});
