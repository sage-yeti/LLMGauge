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
  it("documents explicit, sourced KV-cache estimates only in the reviewed guides", () => {
    const context = guideCatalog.find(
      (guide) => guide.slug === "context-length-and-memory",
    )!;
    const compatibility = guideCatalog.find(
      (guide) => guide.slug === "compatibility-estimates",
    )!;
    const body = (guide: (typeof guideCatalog)[number]) =>
      guide.sections
        .flatMap((section) => [
          section.heading,
          ...section.paragraphs,
          ...(section.bullets ?? []),
        ])
        .join(" ");

    for (const guide of [context, compatibility]) {
      const text = body(guide);
      expect(guide.lastReviewed).toBe("2026-10-03");
      expect(text).toContain("4,096");
      expect(text).toContain("8,192");
      expect(text).toContain("16,384");
      expect(text).toContain("32,768");
      expect(text).toContain("does not");
      expect(text).toContain("2 × transformer layers × KV heads × head dimension");
      expect(text).toContain("2^30");
      expect(text).toContain("unrounded");
      expect(text).toMatch(/[Ee]xplicit CPU/);
      expect(text).toContain("CUDA or Vulkan");
      expect(text).toContain("Apple unified-memory");
      expect(text).toContain("partial-offload");
      expect(text).toContain("documented maximum");
      expect(text).toContain("Llama 3.1 8B Instruct");
      expect(text).toContain("Llama 3.2 1B and 3B Instruct");
      expect(text).toContain("Llama 3.3 70B Instruct");
      expect(text).toContain("dense Qwen3 4B, 8B, 14B, and 32B");
      expect(text).toContain("Qwen3-30B-A3B-Instruct-2507");
      expect(text).toContain("Qwen3-Coder-30B-A3B-Instruct");
      expect(text).not.toContain("should not pretend to calculate");
      expect(guide.relatedLinks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ href: "/" }),
          expect.objectContaining({ href: "/recommendations" }),
        ]),
      );
      expect(guide.relatedGuideSlugs).toContain(
        guide.slug === context.slug
          ? "compatibility-estimates"
          : "context-length-and-memory",
      );
    }

    for (const url of [
      "https://github.com/meta-llama/llama-models/blob/main/models/sku_list.py",
      "https://huggingface.co/Qwen/Qwen3-4B/blob/main/config.json",
      "https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507/blob/main/config.json",
      "https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct/blob/main/config.json",
      "https://github.com/ggml-org/llama.cpp/blob/master/src/llama-kv-cache.cpp",
    ]) {
      expect(
        [context, compatibility].some((guide) =>
          guide.references.some((reference) => reference.url === url),
        ),
      ).toBe(true);
    }

    expect(
      guideCatalog.find((guide) => guide.slug === "what-is-vram")?.lastReviewed,
    ).toBe("2026-09-22");
  });

});
