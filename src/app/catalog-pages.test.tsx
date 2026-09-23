import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ModelPage, {
  generateMetadata as generateModelMetadata,
} from "./models/[slug]/page";
import GpuPage, {
  generateMetadata as generateGpuMetadata,
} from "./gpus/[slug]/page";
import sitemap from "./sitemap";
import robots from "./robots";
import { gpuCatalog, modelCatalog } from "@/data/catalog";

describe("public catalog pages", () => {
  afterEach(cleanup);

  it("renders useful model information and calculator links", async () => {
    const page = await ModelPage({
      params: Promise.resolve({ slug: modelCatalog[0].slug }),
    });
    render(page);
    expect(
      screen.getByRole("heading", { name: modelCatalog[0].displayName }),
    ).toBeTruthy();
    expect(screen.getByText(modelCatalog[0].summary)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /check this model/i })
        .getAttribute("href"),
    ).toBe("/");
    expect(
      screen
        .getByRole("link", { name: /see what your pc can run/i })
        .getAttribute("href"),
    ).toBe("/recommendations");
    expect(screen.getByText(/performance guarantee/i)).toBeTruthy();
  });

  it("renders useful GPU information and calculator links", async () => {
    const gpu = gpuCatalog[0];
    const page = await GpuPage({ params: Promise.resolve({ slug: gpu.slug }) });
    render(page);
    expect(screen.getByRole("heading", { name: gpu.displayName })).toBeTruthy();
    expect(screen.getAllByText(gpu.suitabilitySummary).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/dedicated VRAM/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /find models/i }).getAttribute("href"),
    ).toBe("/recommendations");
    expect(screen.queryByText(/tokens per second/i)).toBeNull();
  });

  it("renders distinct details from newly curated model and GPU records", async () => {
    const qwen = modelCatalog.find((model) => model.slug === "qwen3-4b");
    const gpu = gpuCatalog.find((entry) => entry.slug === "arc-b580-12gb");
    expect(qwen).toBeDefined();
    expect(gpu).toBeDefined();

    const modelPage = await ModelPage({
      params: Promise.resolve({ slug: qwen!.slug }),
    });
    render(modelPage);
    expect(screen.getByRole("heading", { name: "Qwen3 4B" })).toBeTruthy();
    expect(screen.getByText(/memory input is an estimate/i)).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: /qwen\/qwen3-4b-gguf/i }),
    ).toHaveLength(2);

    cleanup();
    const gpuPage = await GpuPage({
      params: Promise.resolve({ slug: gpu!.slug }),
    });
    render(gpuPage);
    expect(
      screen.getByRole("heading", { name: "Intel Arc B580 12GB" }),
    ).toBeTruthy();
    expect(screen.getByText("12 GiB")).toBeTruthy();
    expect(screen.getByText("GDDR6")).toBeTruthy();
  });

  it("rejects unknown slugs through Next not-found behavior", async () => {
    await expect(
      ModelPage({ params: Promise.resolve({ slug: "missing-model" }) }),
    ).rejects.toThrow();
    await expect(
      GpuPage({ params: Promise.resolve({ slug: "missing-gpu" }) }),
    ).rejects.toThrow();
  });

  it("generates distinct catalog metadata with canonical paths", async () => {
    const modelMetadata = await generateModelMetadata({
      params: Promise.resolve({ slug: modelCatalog[0].slug }),
    });
    const gpuMetadata = await generateGpuMetadata({
      params: Promise.resolve({ slug: gpuCatalog[0].slug }),
    });
    expect(modelMetadata.title).toBe(modelCatalog[0].displayName);
    expect(modelMetadata.alternates?.canonical).toBe(
      `/models/${modelCatalog[0].slug}`,
    );
    expect(modelMetadata.description).toContain(modelCatalog[0].summary);
    expect(gpuMetadata.title).toBe(gpuCatalog[0].displayName);
    expect(gpuMetadata.alternates?.canonical).toBe(
      `/gpus/${gpuCatalog[0].slug}`,
    );
    expect(gpuMetadata.description).toContain(gpuCatalog[0].vendor);
    expect(modelMetadata.description).not.toBe(gpuMetadata.description);
  });

  it("includes only catalog entries in the sitemap and exposes robots", () => {
    const entries = sitemap();
    for (const model of modelCatalog) {
      expect(
        entries.some((entry) => entry.url.endsWith(`/models/${model.slug}`)),
      ).toBe(true);
    }
    for (const gpu of gpuCatalog) {
      expect(
        entries.some((entry) => entry.url.endsWith(`/gpus/${gpu.slug}`)),
      ).toBe(true);
    }
    expect(
      entries.some((entry) =>
        entry.url.endsWith(`/models/${modelCatalog[0].slug}`),
      ),
    ).toBe(true);
    expect(
      entries.some((entry) =>
        entry.url.endsWith(`/gpus/${gpuCatalog[0].slug}`),
      ),
    ).toBe(true);
    expect(entries.some((entry) => entry.url.includes("missing"))).toBe(false);
    expect(entries.some((entry) => entry.url.endsWith("/guides"))).toBe(true);
    expect(
      entries.some((entry) => entry.url.endsWith("/guides/what-is-vram")),
    ).toBe(true);
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/" });
    expect(robots().sitemap).toContain("/sitemap.xml");
  });
});
