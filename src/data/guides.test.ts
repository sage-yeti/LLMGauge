import { describe, expect, it } from "vitest";
import { guideCatalog } from "./guides";

describe("guide catalog", () => {
  it("has unique stable slugs and source-aware content", () => {
    const slugs = guideCatalog.map((guide) => guide.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    for (const guide of guideCatalog) {
      expect(guide.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(guide.sections.length).toBeGreaterThanOrEqual(2);
      expect(guide.references.length).toBeGreaterThan(0);
      expect(guide.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const reference of guide.references) {
        expect(new URL(reference.url).protocol).toBe("https:");
      }
    }
  });
});
