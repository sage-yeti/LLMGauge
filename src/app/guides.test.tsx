import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GuidePage, {
  generateMetadata,
  generateStaticParams,
} from "./guides/[slug]/page";
import sitemap from "./sitemap";
import GuidesIndexPage from "./guides/page";
import { guideCatalog } from "@/data/guides";

describe("educational guides", () => {
  afterEach(cleanup);

  it("links the Guides hub to model, GPU, and calculator examples", () => {
    render(<GuidesIndexPage />);
    expect(
      screen
        .getByRole("link", { name: "Qwen3 4B model profile" })
        .getAttribute("href"),
    ).toBe("/models/qwen3-4b");
    expect(
      screen
        .getByRole("link", { name: "GeForce RTX 3060 12GB GPU profile" })
        .getAttribute("href"),
    ).toBe("/gpus/rtx-3060-12gb");
    expect(
      screen
        .getByRole("link", { name: "check your hardware in the calculator" })
        .getAttribute("href"),
    ).toBe("/#calculator");
  });

  it("explains partial offload with a practical estimate and relevant links", async () => {
    const guide = guideCatalog.find(
      (entry) => entry.slug === "gpu-offloading",
    )!;
    render(await GuidePage({ params: Promise.resolve({ slug: guide.slug }) }));

    expect(
      screen.getByRole("heading", {
        name: "Can you partially offload a model to GPU?",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /10 GiB planning estimate.*8 GiB VRAM.*32 GiB of system RAM/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/does not verify runtime support or successful loading/),
    ).toBeTruthy();
    expect(screen.getByText(/Last reviewed 2026-10-05/)).toBeTruthy();

    for (const [label, href] of [
      ["Check your hardware in the calculator", "/#calculator"],
      ["Qwen3 4B model profile", "/models/qwen3-4b"],
      [
        "Mistral 7B Instruct v0.3 model profile",
        "/models/mistral-7b-instruct-v0-3",
      ],
      ["GeForce RTX 3060 12GB", "/gpus/rtx-3060-12gb"],
      ["Intel UHD Graphics 770", "/gpus/intel-uhd-graphics-770"],
    ]) {
      expect(
        screen.getByRole("link", { name: label }).getAttribute("href"),
      ).toBe(href);
    }
  });

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

  it("renders updated guide sources and related links", async () => {
    for (const slug of [
      "context-length-and-memory",
      "compatibility-estimates",
    ] as const) {
      cleanup();
      const guide = guideCatalog.find((entry) => entry.slug === slug)!;
      render(await GuidePage({ params: Promise.resolve({ slug }) }));

      expect(screen.getByRole("heading", { name: guide.title })).toBeTruthy();
      expect(screen.getByText(/Last reviewed 2026-10-03/)).toBeTruthy();
      expect(
        screen.getAllByText(/target context|context target/i).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText(/unrounded/i)).toBeTruthy();

      for (const reference of guide.references) {
        expect(
          screen
            .getByRole("link", { name: reference.label })
            .getAttribute("href"),
        ).toBe(reference.url);
      }
      for (const link of guide.relatedLinks) {
        expect(
          screen
            .getAllByRole("link", { name: link.label })
            .some((anchor) => anchor.getAttribute("href") === link.href),
        ).toBe(true);
      }
      for (const relatedSlug of guide.relatedGuideSlugs) {
        const relatedGuide = guideCatalog.find(
          (entry) => entry.slug === relatedSlug,
        )!;
        expect(
          screen
            .getAllByRole("link", { name: relatedGuide.title })
            .some(
              (anchor) =>
                anchor.getAttribute("href") === `/guides/${relatedSlug}`,
            ),
        ).toBe(true);
      }
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
