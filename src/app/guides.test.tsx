import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GuidePage, {
  generateMetadata,
  generateStaticParams,
} from "./guides/[slug]/page";
import sitemap from "./sitemap";
import { guideCatalog } from "@/data/guides";

describe("educational guides", () => {
  afterEach(cleanup);

  it("renders structured guide content, sources, and calculator links", async () => {
    const guide = guideCatalog[0];
    const page = await GuidePage({
      params: Promise.resolve({ slug: guide.slug }),
    });
    render(page);

    expect(screen.getByRole("heading", { name: guide.title })).toBeTruthy();
    expect(screen.getByText(guide.summary)).toBeTruthy();
    expect(screen.getByText(guide.sections[0].paragraphs[0])).toBeTruthy();
    expect(screen.getByText(/Last reviewed 2026-09-22/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /try the compatibility calculator/i })
        .getAttribute("href"),
    ).toBe("/");
    expect(screen.getByRole("heading", { name: "References" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: guide.references[0].label })
        .getAttribute("href"),
    ).toBe(guide.references[0].url);
  });

  it("renders selected links from guides to relevant catalog examples", async () => {
    const cases = [
      ["llm-quantization", "Qwen3 4B", "/models/qwen3-4b"],
      ["context-length-and-memory", "Gemma 3 12B IT", "/models/gemma-3-12b-it"],
      ["compatibility-estimates", "Intel Arc B580 12GB", "/gpus/arc-b580-12gb"],
    ] as const;
    for (const [slug, label, href] of cases) {
      cleanup();
      const guide = guideCatalog.find((entry) => entry.slug === slug)!;
      render(await GuidePage({ params: Promise.resolve({ slug }) }));
      expect(
        screen.getByRole("link", { name: label }).getAttribute("href"),
      ).toBe(href);
      expect(guide.relatedLinks.some((link) => link.href === href)).toBe(true);
    }
  });

  it("returns not-found behavior for unknown guide slugs", async () => {
    await expect(
      GuidePage({ params: Promise.resolve({ slug: "missing-guide" }) }),
    ).rejects.toThrow();
  });

  it("generates canonical metadata and static params from the guide registry", async () => {
    const guide = guideCatalog[1];
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: guide.slug }),
    });

    expect(metadata.title).toBe(guide.title);
    expect(metadata.description).toBe(guide.description);
    expect(metadata.alternates?.canonical).toBe(`/guides/${guide.slug}`);
    expect(metadata.openGraph?.url).toBe(`/guides/${guide.slug}`);
    expect(generateStaticParams()).toEqual(
      guideCatalog.map((entry) => ({ slug: entry.slug })),
    );
  });

  it("includes the guide index and only real guide slugs in the sitemap", () => {
    const entries = sitemap();
    expect(entries.some((entry) => entry.url.endsWith("/guides"))).toBe(true);
    for (const guide of guideCatalog) {
      expect(
        entries.some((entry) => entry.url.endsWith(`/guides/${guide.slug}`)),
      ).toBe(true);
    }
    expect(entries.some((entry) => entry.url.includes("missing-guide"))).toBe(
      false,
    );
    expect(entries.every((entry) => !entry.url.includes("vercel.app"))).toBe(
      true,
    );
  });
});
