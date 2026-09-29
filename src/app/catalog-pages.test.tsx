import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ModelPage, {
  generateMetadata as generateModelMetadata,
} from "./models/[slug]/page";
import GpuPage, {
  generateMetadata as generateGpuMetadata,
} from "./gpus/[slug]/page";
import sitemap from "./sitemap";
import robots from "./robots";
import ModelsPage, { metadata as modelsMetadata } from "./models/page";
import GpusPage, { metadata as gpusMetadata } from "./gpus/page";
import { ModelCatalogIndex, GpuCatalogIndex } from "./catalog-index";
import HomePage from "./page";
import { SiteNavigation } from "./site-header";
import { absoluteUrl } from "./site";
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

  it("keeps invalid model slugs on the not-found route", async () => {
    await expect(
      ModelPage({ params: Promise.resolve({ slug: "not-a-real-model" }) }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
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

  it("renders every Batch 32 GPU detail page with sourced capacity and specs", async () => {
    const expected = [
      ["rtx-3090-24gb", "GeForce RTX 3090 24GB", "24 GiB", "GDDR6X", "Ampere"],
      [
        "rtx-4070-12gb",
        "GeForce RTX 4070 12GB",
        "12 GiB",
        undefined,
        "Ada Lovelace",
      ],
      ["rtx-3070-8gb", "GeForce RTX 3070 8GB", "8 GiB", "GDDR6", "Ampere"],
      ["rtx-3080-10gb", "GeForce RTX 3080 10GB", "10 GiB", "GDDR6X", "Ampere"],
      ["rtx-3080-12gb", "GeForce RTX 3080 12GB", "12 GiB", "GDDR6X", "Ampere"],
      [
        "rtx-3060-ti-8gb",
        "GeForce RTX 3060 Ti 8GB",
        "8 GiB",
        undefined,
        "Ampere",
      ],
      [
        "rtx-4080-super-16gb",
        "GeForce RTX 4080 SUPER 16GB",
        "16 GiB",
        "GDDR6X",
        "Ada Lovelace",
      ],
      [
        "radeon-rx-7900-xt-20gb",
        "Radeon RX 7900 XT 20GB",
        "20 GiB",
        "GDDR6",
        "RDNA 3",
      ],
      [
        "radeon-rx-6800-16gb",
        "Radeon RX 6800 16GB",
        "16 GiB",
        "GDDR6",
        "RDNA 2",
      ],
      [
        "radeon-rx-6800-xt-16gb",
        "Radeon RX 6800 XT 16GB",
        "16 GiB",
        "GDDR6",
        "RDNA 2",
      ],
      [
        "radeon-rx-6700-xt-12gb",
        "Radeon RX 6700 XT 12GB",
        "12 GiB",
        "GDDR6",
        "RDNA 2",
      ],
      ["tesla-p40-24gb", "NVIDIA Tesla P40 24GB", "24 GiB", "GDDR5", "Pascal"],
      ["rtx-a6000-48gb", "NVIDIA RTX A6000 48GB", "48 GiB", "GDDR6", "Ampere"],
    ] as const;

    for (const [
      slug,
      displayName,
      capacity,
      memoryType,
      architecture,
    ] of expected) {
      const gpu = gpuCatalog.find((entry) => entry.slug === slug);
      expect(gpu).toBeDefined();
      const page = await GpuPage({ params: Promise.resolve({ slug }) });
      const { unmount } = render(page);
      expect(screen.getByRole("heading", { name: displayName })).toBeTruthy();
      expect(screen.getByText(capacity)).toBeTruthy();
      if (memoryType) expect(screen.getByText(memoryType)).toBeTruthy();
      else
        expect(screen.queryByText("Memory type", { exact: true })).toBeNull();
      expect(screen.getByText(architecture)).toBeTruthy();
      const sourceLink = screen.getByRole("link", {
        name: gpu!.provenance.source,
      });
      expect(sourceLink.getAttribute("href")).toBe(gpu!.provenance.sourceUrl);
      unmount();
    }
  });

  it("renders each NVIDIA laptop GPU detail page with laptop-specific sourced specs", async () => {
    const expected = [
      [
        "rtx-3060-laptop-gpu-6gb",
        "GeForce RTX 3060 Laptop GPU 6GB",
        "6 GiB",
        "Ampere",
      ],
      [
        "rtx-4050-laptop-gpu-6gb",
        "GeForce RTX 4050 Laptop GPU 6GB",
        "6 GiB",
        "Ada Lovelace",
      ],
      [
        "rtx-4060-laptop-gpu-8gb",
        "GeForce RTX 4060 Laptop GPU 8GB",
        "8 GiB",
        "Ada Lovelace",
      ],
      [
        "rtx-4070-laptop-gpu-8gb",
        "GeForce RTX 4070 Laptop GPU 8GB",
        "8 GiB",
        "Ada Lovelace",
      ],
      [
        "rtx-4080-laptop-gpu-12gb",
        "GeForce RTX 4080 Laptop GPU 12GB",
        "12 GiB",
        "Ada Lovelace",
      ],
      [
        "rtx-4090-laptop-gpu-16gb",
        "GeForce RTX 4090 Laptop GPU 16GB",
        "16 GiB",
        "Ada Lovelace",
      ],
    ] as const;

    for (const [slug, displayName, capacity, architecture] of expected) {
      const gpu = gpuCatalog.find((entry) => entry.slug === slug);
      expect(gpu).toBeDefined();
      const page = await GpuPage({ params: Promise.resolve({ slug }) });
      const { unmount } = render(page);
      expect(screen.getByRole("heading", { name: displayName })).toBeTruthy();
      expect(screen.getByText(capacity)).toBeTruthy();
      expect(screen.getByText("GDDR6")).toBeTruthy();
      expect(screen.getByText(architecture)).toBeTruthy();
      const sourceLink = screen.getByRole("link", {
        name: gpu!.provenance.source,
      });
      expect(sourceLink.getAttribute("href")).toBe(gpu!.provenance.sourceUrl);
      unmount();
    }
  });

  it("shows Bonsai's runtime prerequisite separately from its memory facts", async () => {
    const bonsai = modelCatalog.find((model) => model.slug === "bonsai-2-27b");
    expect(bonsai).toBeDefined();
    const page = await ModelPage({
      params: Promise.resolve({ slug: bonsai!.slug }),
    });
    render(page);

    expect(screen.getByRole("heading", { name: "Bonsai 2 27B" })).toBeTruthy();
    expect(screen.getByText("PTQ1_0")).toBeTruthy();
    expect(screen.getByText("PQ2_0")).toBeTruthy();
    expect(
      screen.getByText(
        /Memory compatibility does not confirm runtime-load compatibility/,
      ),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "PrismML Bonsai demo runtime guide" })
        .getAttribute("href"),
    ).toBe("https://github.com/PrismML-Eng/Bonsai-demo");
    expect(
      screen.getAllByText(/optional vision projector/).length,
    ).toBeGreaterThan(0);
  });

  it("explains excluded and unverified vision memory without flagging text-only models", async () => {
    const unverifiedPage = await ModelPage({
      params: Promise.resolve({ slug: "qwen3-5-0-8b" }),
    });
    render(unverifiedPage);
    expect(
      screen.getByText(/has not verified whether the selected GGUF weights/),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", {
          name: "ggml-org Qwen3.5 0.8B GGUF repository",
        })
        .getAttribute("href"),
    ).toBe("https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF");

    cleanup();
    const excludedPage = await ModelPage({
      params: Promise.resolve({ slug: "qwen3-5-4b" }),
    });
    render(excludedPage);
    expect(
      screen.getByText(/excludes the separate vision\/projector file/),
    ).toBeTruthy();

    cleanup();
    const textOnlyPage = await ModelPage({
      params: Promise.resolve({ slug: "llama-3-2-1b-instruct" }),
    });
    render(textOnlyPage);
    expect(screen.queryByText(/Multimodal memory scope/)).toBeNull();
  });

  it("renders the new Qwen detail pages with their quant files and sources", async () => {
    const models = [
      ["qwen3-5-0-8b", "Qwen3.5 0.8B", "Q4_0", "0.52 GiB"],
      ["qwen3-5-4b", "Qwen3.5 4B", "Q4_K_M", "2.80 GiB"],
      ["qwen3-5-9b", "Qwen3.5 9B", "Q4_K_M", "5.75 GiB"],
      ["qwen3-8-27b", "Qwen3.8 27B", "Q4_K_M", "17.69 GiB"],
    ] as const;

    for (const [slug, displayName, quantization, modelSize] of models) {
      const model = modelCatalog.find((entry) => entry.slug === slug);
      expect(model).toBeDefined();
      const page = await ModelPage({ params: Promise.resolve({ slug }) });
      const { unmount } = render(page);
      expect(screen.getByRole("heading", { name: displayName })).toBeTruthy();
      expect(screen.getByText(quantization)).toBeTruthy();
      expect(screen.getByText(modelSize)).toBeTruthy();
      expect(screen.getByText("262,144 tokens")).toBeTruthy();
      expect(screen.getByText("Apache-2.0")).toBeTruthy();
      const q4 = model!.quantizations.find(
        (entry) => entry.displayName === quantization,
      );
      expect(q4).toBeDefined();
      expect(
        screen
          .getAllByRole("link", { name: q4!.provenance.source })
          .some(
            (link) => link.getAttribute("href") === q4!.provenance.sourceUrl,
          ),
      ).toBe(true);
      unmount();
    }
  });

  it("renders each Batch 31 model page with its sourced weight size and multimodal scope", async () => {
    const slugs = [
      "gemma-4-12b-it",
      "qwen3-6-27b",
      "gemma-4-26b-a4b-it",
      "qwen3-6-35b-a3b",
      "lfm2-5-2-6b",
      "gemma-4-e4b-it",
      "muse-glimmer-30b",
      "deepseek-v4-flash-0731",
      "gemma-4-31b-it",
    ];

    for (const slug of slugs) {
      const model = modelCatalog.find((entry) => entry.slug === slug);
      expect(model).toBeDefined();
      const page = await ModelPage({ params: Promise.resolve({ slug }) });
      const { unmount } = render(page);
      expect(
        screen.getByRole("heading", { name: model!.displayName }),
      ).toBeTruthy();
      expect(
        screen.getByText(model!.quantizations[0].displayName),
      ).toBeTruthy();
      expect(
        screen.getByRole("link", {
          name: model!.quantizations[0].provenance.source,
        }),
      ).toBeTruthy();
      if (model!.memoryEstimateScope) {
        expect(
          screen.getByText(/excludes the separate vision\/projector file/),
        ).toBeTruthy();
      } else {
        expect(screen.queryByText(/Multimodal memory scope/)).toBeNull();
      }
      unmount();
    }
  });

  it("renders every model and GPU in directly browsable catalog indexes", () => {
    const modelsPage = ModelsPage();
    render(modelsPage);
    for (const model of modelCatalog) {
      expect(
        screen
          .getByRole("link", { name: model.displayName })
          .getAttribute("href"),
      ).toBe(`/models/${model.slug}`);
      expect(
        screen.getAllByText(`${model.parameterCountBillions}B`).length,
      ).toBeGreaterThan(0);
    }

    cleanup();
    const gpusPage = GpusPage();
    render(gpusPage);
    for (const gpu of gpuCatalog) {
      expect(
        screen
          .getByRole("link", { name: gpu.displayName })
          .getAttribute("href"),
      ).toBe(`/gpus/${gpu.slug}`);
      expect(screen.getAllByText(gpu.vendor).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("0 GiB (integrated)").length).toBeGreaterThan(0);
  });

  it("filters and sorts models with catalog fields, and resets to the full list", () => {
    render(ModelsPage());
    const search = screen.getByRole("searchbox", { name: "Search models" });
    const family = screen.getByLabelText("Family");
    const format = screen.getByLabelText("Format");
    const sort = screen.getByLabelText("Sort models");
    search.focus();
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: "qwen" } });
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/models/"))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("status").textContent).toMatch(/found\./);
    expect(screen.queryByRole("link", { name: /Llama 3\.2/ })).toBeNull();

    fireEvent.change(family, { target: { value: "Qwen2.5" } });
    fireEvent.change(format, { target: { value: "gguf" } });
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(sort, { target: { value: "parameters-asc" } });
    const modelLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/models/"));
    const lowestParameterModel = modelCatalog
      .filter(
        (model) =>
          model.family === "Qwen2.5" && model.supportedFormats.includes("gguf"),
      )
      .sort(
        (a, b) =>
          a.parameterCountBillions - b.parameterCountBillions ||
          a.displayName.localeCompare(b.displayName, "en"),
      )[0];
    expect(modelLinks[0].getAttribute("href")).toBe(
      `/models/${lowestParameterModel.slug}`,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/models/"))
        .length,
    ).toBe(modelCatalog.length);
    expect((screen.getByLabelText("Family") as HTMLSelectElement).value).toBe(
      "",
    );
    expect(
      (screen.getByLabelText("Sort models") as HTMLSelectElement).value,
    ).toBe("name");
  });

  it("filters and sorts GPUs, exposes empty results, and resets from that state", () => {
    render(GpusPage());
    const search = screen.getByRole("searchbox", { name: "Search GPUs" });
    fireEvent.change(screen.getByLabelText("GPU type"), {
      target: { value: "integrated" },
    });
    expect(screen.getByRole("status").textContent).toMatch(/found\./);
    for (const gpu of gpuCatalog.filter(
      (entry) => entry.kind === "integrated",
    )) {
      expect(
        screen
          .getByRole("link", { name: gpu.displayName })
          .getAttribute("href"),
      ).toBe(`/gpus/${gpu.slug}`);
    }
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/gpus/"))
        .length,
    ).toBe(gpuCatalog.filter((gpu) => gpu.kind === "integrated").length);

    fireEvent.change(screen.getByLabelText("GPU type"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Sort GPUs"), {
      target: { value: "memory-desc" },
    });
    const gpuLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/gpus/"));
    const highestMemoryGpu = [...gpuCatalog].sort(
      (a, b) =>
        b.vramGiB - a.vramGiB ||
        a.displayName.localeCompare(b.displayName, "en"),
    )[0];
    expect(gpuLinks[0].getAttribute("href")).toBe(
      `/gpus/${highestMemoryGpu.slug}`,
    );

    fireEvent.change(search, { target: { value: "no matching hardware" } });
    expect(screen.getByText(/No GPUs match these filters/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset filters" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.queryByText(/No GPUs match these filters/i)).toBeNull();
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/gpus/"))
        .length,
    ).toBe(gpuCatalog.length);
  });

  it("uses associated labels and keyboard-focusable native catalog controls", () => {
    render(ModelsPage());
    fireEvent.change(screen.getByRole("searchbox", { name: "Search models" }), {
      target: { value: "qwen" },
    });
    const controls = [
      screen.getByRole("searchbox", { name: "Search models" }),
      screen.getByLabelText("Family"),
      screen.getByLabelText("Format"),
      screen.getByLabelText("Sort models"),
      screen.getByRole("button", { name: "Reset filters" }),
    ];
    for (const control of controls) {
      expect(
        control.getAttribute("id") || control.tagName === "BUTTON",
      ).toBeTruthy();
      control.focus();
      expect(document.activeElement).toBe(control);
    }
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByRole("region", { name: "Models" })).toBeTruthy();
  });

  it("links to both catalogs from the landing page navigation", () => {
    render(
      <>
        <SiteNavigation />
        {HomePage()}
      </>,
    );
    expect(
      screen.getByRole("link", { name: "Models" }).getAttribute("href"),
    ).toBe("/models");
    expect(
      screen.getByRole("link", { name: "GPUs" }).getAttribute("href"),
    ).toBe("/gpus");
  });

  it("handles empty indexes and absent optional GPU facts", () => {
    const gpuWithoutOptionalFacts = {
      ...gpuCatalog[0],
      architecture: undefined,
      memoryType: undefined,
    };
    const modelWithoutOptionalFacts = {
      ...modelCatalog[0],
      license: undefined,
      defaultContextLength: undefined,
      maxContextLength: undefined,
    };
    const { rerender } = render(
      <ModelCatalogIndex models={[modelWithoutOptionalFacts]} />,
    );
    expect(
      screen.getByRole("link", { name: modelCatalog[0].displayName }),
    ).toBeTruthy();
    rerender(<GpuCatalogIndex gpus={[gpuWithoutOptionalFacts]} />);
    expect(
      screen.getByRole("link", { name: gpuCatalog[0].displayName }),
    ).toBeTruthy();
    expect(screen.queryByText("Memory type")).toBeNull();
    expect(screen.queryByText("Architecture")).toBeNull();

    rerender(<ModelCatalogIndex models={[]} />);
    expect(screen.getByText("No models are currently listed.")).toBeTruthy();
    rerender(<GpuCatalogIndex gpus={[]} />);
    expect(screen.getByText("No GPUs are currently listed.")).toBeTruthy();
  });

  it("sets descriptive index metadata and canonical Open Graph URLs", () => {
    expect(modelsMetadata.title).toBe("Browse Local LLM Models");
    expect(modelsMetadata.description).toContain("curated local model catalog");
    expect(modelsMetadata.alternates?.canonical).toBe(absoluteUrl("/models"));
    expect(modelsMetadata.openGraph?.url).toBe(absoluteUrl("/models"));
    expect(gpusMetadata.title).toBe("Browse GPU Memory Profiles");
    expect(gpusMetadata.description).toContain("curated GPU catalog");
    expect(gpusMetadata.alternates?.canonical).toBe(absoluteUrl("/gpus"));
    expect(gpusMetadata.openGraph?.url).toBe(absoluteUrl("/gpus"));
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
    expect(entries.some((entry) => entry.url.endsWith("/models"))).toBe(true);
    expect(entries.some((entry) => entry.url.endsWith("/gpus"))).toBe(true);
    expect(
      entries.some((entry) => entry.url.endsWith("/guides/what-is-vram")),
    ).toBe(true);
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/" });
    expect(robots().sitemap).toContain("/sitemap.xml");
  });
});
