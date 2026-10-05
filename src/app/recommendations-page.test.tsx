import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Recommendations, RecommendationResults } from "./recommendations";
import { Calculator } from "./calculator";
import { gpuCatalog, modelCatalog } from "@/data/catalog";
import { recommendModels } from "@/application/recommendations";
import {
  fixtureHardware,
  fixtureModel,
  fixtureProvenance,
} from "@/data/fixtures";
import type { ModelDefinition } from "@/domain/types";
import type { RecommendationSet } from "@/application/recommendations";

function renderRecommendations() {
  render(<Recommendations models={modelCatalog} gpus={gpuCatalog} />);
}
function submit(cpuName = "AMD Ryzen 7 7800X3D") {
  fireEvent.change(screen.getByLabelText("CPU"), {
    target: { value: cpuName },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /find suitable models/i }),
  );
}
function choose(label: string, value: string) {
  if (label === "GPU") {
    const gpu = gpuCatalog.find((entry) => entry.id === value);
    const input = screen.getByLabelText(label);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value } });
    fireEvent.click(
      screen.getByRole("option", {
        name: new RegExp(
          gpu?.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") ?? value,
        ),
      }),
    );
    return;
  }
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function sizedFixtureModel(
  id: string,
  displayName: string,
  parameterCountBillions: number,
  sizeGiB: number,
): ModelDefinition {
  return {
    ...fixtureModel,
    id,
    slug: id,
    displayName,
    parameterCountBillions,
    quantizations: [
      {
        ...fixtureModel.quantizations[0],
        id: "q4",
        displayName: "Q4",
        sizeGiB,
        provenance: fixtureProvenance,
      },
    ],
  };
}

function mixedDiscreteRecommendationSet(): RecommendationSet {
  const gpuHardware = { ...fixtureHardware.gpu, systemRamGiB: 64 };
  const gpuResults = recommendModels(gpuHardware, [
    sizedFixtureModel("small-fit", "Small GPU fit", 3, 1),
    sizedFixtureModel("large-fit", "Large GPU fit", 13, 2),
  ]);
  const partialResults = recommendModels(
    { ...fixtureHardware.lowMemory, systemRamGiB: 64 },
    [sizedFixtureModel("partial-model", "Partial model", 20, 8)],
  );
  const cpuResults = recommendModels(
    { ...fixtureHardware.cpuOnly, systemRamGiB: 64 },
    [sizedFixtureModel("cpu-model", "CPU model", 5, 1)],
  );
  const unsupportedResults = recommendModels(
    { ...fixtureHardware.cpuOnly, systemRamGiB: 1 },
    [sizedFixtureModel("unsupported-model", "Unsupported model", 30, 8)],
  );

  return {
    recommendations: [
      ...gpuResults.recommendations,
      ...partialResults.recommendations,
      ...cpuResults.recommendations,
    ],
    unsuitable: unsupportedResults.unsuitable,
    skippedModelIds: [],
  };
}

describe("recommendations interface", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/recommendations");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: undefined,
    });
  });

  it("groups discrete-GPU recommendations in outcome order with counts and no lost cards", () => {
    const recommendationSet = mixedDiscreteRecommendationSet();
    render(
      <RecommendationResults
        recommendationSet={recommendationSet}
        groupDiscreteGpuResults
      />,
    );

    const categories = document.querySelectorAll(".recommendation-category");
    expect(
      Array.from(
        categories,
        (category) => category.querySelector("h3")?.textContent,
      ),
    ).toEqual([
      "Fits estimated dedicated VRAM",
      "Estimated partial offload: some layers would use system RAM",
      "CPU-only options",
    ]);
    expect(
      within(categories[0] as HTMLElement).getByText("2 models"),
    ).toBeTruthy();
    expect(
      within(categories[1] as HTMLElement).getByText("1 model"),
    ).toBeTruthy();
    expect(
      within(categories[2] as HTMLElement).getByText("1 model"),
    ).toBeTruthy();

    const cardNames = Array.from(
      document.querySelectorAll(".recommendation-card-heading h3"),
      (heading) => heading.textContent,
    );
    expect(cardNames).toEqual([
      "Large GPU fit",
      "Small GPU fit",
      "Partial model",
      "CPU model",
      "Unsupported model",
    ]);
    expect(new Set(cardNames).size).toBe(5);
    expect(
      screen
        .getByRole("heading", { name: "Unsupported model" })
        .closest("details.unsuitable-section"),
    ).toBeTruthy();
  });

  it("shows the full-GPU empty state while retaining partial and CPU-only choices", () => {
    const recommendationSet = mixedDiscreteRecommendationSet();
    recommendationSet.recommendations =
      recommendationSet.recommendations.filter(
        (entry) => entry.result.level !== "gpu-capable",
      );
    render(
      <RecommendationResults
        recommendationSet={recommendationSet}
        groupDiscreteGpuResults
      />,
    );

    const gpuSection = document.querySelector(
      ".recommendation-category-gpu",
    ) as HTMLElement;
    expect(within(gpuSection).getByText("0 models")).toBeTruthy();
    expect(within(gpuSection).getByRole("status").textContent).toMatch(
      /No models are estimated to fit within dedicated VRAM/,
    );
    expect(screen.getByRole("heading", { name: "Partial model" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "CPU model" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Unsupported model" }),
    ).toBeTruthy();
  });

  it("keeps the legacy single-list presentation when discrete-GPU grouping is out of scope", () => {
    render(
      <RecommendationResults
        recommendationSet={mixedDiscreteRecommendationSet()}
      />,
    );

    expect(document.querySelector(".recommendation-categories")).toBeNull();
    expect(
      document.querySelectorAll(
        ".recommendation-results > .recommendation-list",
      ),
    ).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Large GPU fit" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Partial model" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "CPU model" })).toBeTruthy();
  });

  it("keeps context presets optional, manual, and non-submitting", () => {
    renderRecommendations();
    fireEvent.click(screen.getByText("Advanced settings"));

    const input = screen.getByLabelText(
      "Target context length (tokens)",
    ) as HTMLInputElement;
    const contexts = [4096, 8192, 16384, 32768];
    expect(input.value).toBe("");
    expect(
      screen.getByText(
        /evaluated against each model’s own documented context limit/,
      ),
    ).toBeTruthy();

    for (const contextLength of contexts) {
      const label = contextLength.toLocaleString("en-US");
      const preset = screen.getByRole("button", {
        name: `Set target context to ${label} tokens`,
      });
      expect(preset.getAttribute("aria-pressed")).toBe("false");
      expect(preset.getAttribute("type")).toBe("button");
      fireEvent.click(preset);

      expect(input.value).toBe(String(contextLength));
      expect(preset.getAttribute("aria-pressed")).toBe("true");
      expect(
        screen.getByRole("heading", { name: "Ready when you are." }),
      ).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    }

    fireEvent.change(input, { target: { value: "12345" } });
    expect(input.value).toBe("12345");
    for (const contextLength of contexts) {
      const label = contextLength.toLocaleString("en-US");
      expect(
        screen
          .getByRole("button", {
            name: `Set target context to ${label} tokens`,
          })
          .getAttribute("aria-pressed"),
      ).toBe("false");
    }
  });

  it("renders corrected fallback memory and classifies the representative using unrounded GiB", () => {
    renderRecommendations();
    choose("GPU", "nvidia-rtx-4060-8gb");
    fireEvent.change(screen.getByLabelText("Dedicated VRAM (GiB)"), {
      target: { value: "5.5" },
    });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "8" },
    });
    submit();
    const card = screen
      .getByRole("heading", { name: "Llama 3.1 8B Instruct" })
      .closest("article");
    expect(card?.textContent).toContain("Q4_K_M");
    expect(card?.textContent).toContain("GPU-capable");
    expect(card?.textContent).toContain("5.44 GiB");
    expect(card?.textContent).toContain("7.44 GiB");
  });

  it("includes GPT-OSS with sourced size and runtime caveats in recommendation results", () => {
    renderRecommendations();
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "128" },
    });
    submit();
    for (const [variant, size] of [
      ["20b", "11.28"],
      ["120b", "59.03"],
    ]) {
      const card = screen
        .getByRole("heading", { name: `OpenAI gpt-oss-${variant}` })
        .closest("article");
      expect(card?.textContent).toContain(
        `MXFP4 sourced file size: ${size} GiB`,
      );
      expect(card?.textContent).toContain(
        "Whole-model bits per weight is unavailable",
      );
      expect(card?.textContent).toContain(
        "memory-fit estimates remain approximate",
      );
      expect(card?.textContent).toMatch(/GPT-OSS\/MXFP4 support.*Harmony/);
      expect(card?.textContent).not.toContain("Multimodal memory scope");
    }
  });

  it("uses explicit target context consistently in recommendation memory results", () => {
    renderRecommendations();
    const summary = screen.getByText("Advanced settings");
    fireEvent.click(summary);
    fireEvent.change(screen.getByLabelText("Target context length (tokens)"), {
      target: { value: "4096" },
    });
    submit();
    const card = screen
      .getByRole("heading", { name: "Llama 3.1 8B Instruct" })
      .closest("article");
    expect(card?.textContent).toContain("4,096 tokens");
    expect(card?.textContent).toContain("0.5 GiB");
    expect(card?.textContent).toContain("Cache placement");
    expect(card?.textContent).toContain("Unverified");
    expect(card?.textContent).toContain(
      "KV cache not included in the fit decision",
    );
  });

  it("shows the three added sourced cache estimates and provenance in model recommendations", () => {
    renderRecommendations();
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "256" },
    });
    fireEvent.click(screen.getByText("Advanced settings"));
    fireEvent.change(screen.getByLabelText("Target context length (tokens)"), {
      target: { value: "4096" },
    });
    submit();

    for (const [displayName, estimate] of [
      ["Llama 3.2 1B Instruct", "0.13 GiB"],
      ["Llama 3.2 3B Instruct", "0.44 GiB"],
      ["Llama 3.3 70B Instruct", "1.25 GiB"],
    ]) {
      const card = screen
        .getByRole("heading", { name: displayName })
        .closest("article");
      expect(card?.textContent).toContain("4,096 tokens");
      expect(card?.textContent).toContain(estimate);
      expect(card?.textContent).toContain("Unverified");
      expect(card?.textContent).toContain(
        "KV cache not included in the fit decision",
      );
      expect(
        card?.querySelector(
          'a[href="https://github.com/meta-llama/llama-models/blob/main/models/sku_list.py"]',
        ),
      ).toBeTruthy();
    }
  });

  it("shows all four sourced dense Qwen3 estimates with provenance in recommendations", () => {
    renderRecommendations();
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "256" },
    });
    fireEvent.click(screen.getByText("Advanced settings"));
    fireEvent.change(screen.getByLabelText("Target context length (tokens)"), {
      target: { value: "4096" },
    });
    submit();

    for (const [displayName, estimate, modelName] of [
      ["Qwen3 4B", "0.56 GiB", "Qwen3-4B"],
      ["Qwen3 8B", "0.56 GiB", "Qwen3-8B"],
      ["Qwen3 14B", "0.63 GiB", "Qwen3-14B"],
      ["Qwen3 32B", "1 GiB", "Qwen3-32B"],
    ]) {
      const card = screen
        .getByRole("heading", { name: displayName })
        .closest("article");
      expect(card?.textContent).toContain("4,096 tokens");
      expect(card?.textContent).toContain(estimate);
      expect(card?.textContent).toContain("Unverified");
      expect(card?.textContent).toContain(
        "KV cache not included in the fit decision",
      );
      expect(
        card?.querySelector(
          `a[href="https://huggingface.co/Qwen/${modelName}/blob/main/config.json"]`,
        ),
      ).toBeTruthy();
    }
  });

  it.each(["4096", "16384"])(
    "shows both supported Qwen3 MoE estimates at %s tokens with provenance and advisory placement",
    (contextLength) => {
      renderRecommendations();
      fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
        target: { value: "256" },
      });
      fireEvent.click(screen.getByText("Advanced settings"));
      fireEvent.change(
        screen.getByLabelText("Target context length (tokens)"),
        { target: { value: contextLength } },
      );
      submit();

      const expectedEstimate =
        contextLength === "4096" ? "0.38 GiB" : "1.5 GiB";
      for (const [displayName, modelName] of [
        ["Qwen3-30B-A3B-Instruct-2507", "Qwen3-30B-A3B-Instruct-2507"],
        ["Qwen3-Coder-30B-A3B-Instruct", "Qwen3-Coder-30B-A3B-Instruct"],
      ]) {
        const card = screen
          .getByRole("heading", { name: displayName })
          .closest("article");
        expect(card?.textContent).toContain(
          `${Number(contextLength).toLocaleString()} tokens`,
        );
        expect(card?.textContent).toContain(expectedEstimate);
        expect(card?.textContent).toContain("Unverified");
        expect(card?.textContent).toContain(
          "KV cache not included in the fit decision",
        );
        expect(
          card?.querySelector(
            `a[href="https://huggingface.co/Qwen/${modelName}/blob/main/config.json"]`,
          ),
        ).toBeTruthy();
      }
    },
  );

  it("starts with an empty CPU name and accepts a user-entered name", () => {
    renderRecommendations();
    const cpuInput = screen.getByLabelText("CPU") as HTMLInputElement;

    expect(cpuInput.value).toBe("");
    fireEvent.change(cpuInput, { target: { value: "AMD Ryzen 7 7800X3D" } });
    expect(cpuInput.value).toBe("AMD Ryzen 7 7800X3D");
  });

  it("renders shared hardware controls and produces a CPU-only recommendation", () => {
    renderRecommendations();
    expect(screen.getByRole("button", { name: "Scan my device" })).toBeTruthy();
    expect(
      screen.getByText(
        /Prefilled values are starter examples, not readings detected/,
      ),
    ).toBeTruthy();
    const summary = screen.getByText("Advanced settings");
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.closest("details")?.hasAttribute("open")).toBe(false);
    expect(
      screen.getByLabelText("Runtime").closest("details")?.hasAttribute("open"),
    ).toBe(false);
    submit();
    expect(
      screen.getByRole("heading", { name: "Models for your hardware" }),
    ).toBeTruthy();
    expect(document.querySelector(".recommendation-categories")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Llama 3.2 1B Instruct" }),
    ).toBeTruthy();
    expect(screen.getAllByText("CPU-only").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Practical starting point").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /read about this model/i }).length,
    ).toBeGreaterThan(0);
  });

  it("shows a GPU-capable recommendation", () => {
    renderRecommendations();
    choose("GPU", "nvidia-rtx-3060-12gb");
    submit();
    expect(screen.getAllByText("GPU-capable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Full GPU execution").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Fits estimated dedicated VRAM" }),
    ).toBeTruthy();
  });

  it("keeps the searchable no-GPU choice available for CPU-only results", () => {
    renderRecommendations();
    const gpuInput = screen.getByRole("combobox", { name: "GPU" });
    fireEvent.focus(gpuInput);
    fireEvent.change(gpuInput, { target: { value: "CPU-only" } });
    fireEvent.click(screen.getByRole("option", { name: /No dedicated GPU/ }));

    expect((gpuInput as HTMLInputElement).value).toBe("No dedicated GPU");
    expect(
      (screen.getByLabelText("Dedicated VRAM (GiB)") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    submit();
    expect(screen.getAllByText("CPU-only").length).toBeGreaterThan(0);
    expect(document.querySelector(".recommendation-categories")).toBeNull();
  });

  it("searches shared GPU choices by name and memory and submits the chosen ID", () => {
    renderRecommendations();
    const gpuInput = screen.getByRole("combobox", { name: "GPU" });
    fireEvent.focus(gpuInput);
    fireEvent.change(gpuInput, { target: { value: "RTX 4090 Laptop" } });
    fireEvent.click(
      screen.getByRole("option", {
        name: /GeForce RTX 4090 Laptop GPU 16GB/,
      }),
    );

    expect((gpuInput as HTMLInputElement).value).toBe(
      "GeForce RTX 4090 Laptop GPU 16GB",
    );
    expect(
      (screen.getByLabelText("Dedicated VRAM (GiB)") as HTMLInputElement).value,
    ).toBe("16");
    submit();
    expect(screen.getAllByText("GPU-capable").length).toBeGreaterThan(0);
  });

  it("explains the GPU ordering without making quality or performance claims", () => {
    renderRecommendations();
    choose("GPU", "nvidia-rtx-4060-8gb");
    submit();

    const note = screen.getByText(
      /Full-GPU fits are ordered by the model's catalogued parameter count, largest first\./,
    );
    expect(note.textContent).toContain(
      "This size-based order does not predict model quality or performance.",
    );
    expect(note.textContent).toContain(
      "Where the catalog does not distinguish active from total parameters, the order follows the catalogued parameter-count field.",
    );
    expect(note.textContent).not.toMatch(/guarantee|faster|better model/i);
  });

  it("includes the new model records in the recommendation workflow", () => {
    renderRecommendations();
    choose("GPU", "nvidia-rtx-5090-32gb");
    submit();

    const lfmCard = screen
      .getByRole("heading", { name: "LFM2.5 2.6B" })
      .closest("article");
    expect(lfmCard).toBeTruthy();
    expect(
      lfmCard?.querySelector('a[href="/models/lfm2-5-2-6b"]'),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Gemma 4 E4B IT" }),
    ).toBeTruthy();
  });

  it("includes the verified Batch 35 models when system RAM is sufficient", () => {
    renderRecommendations();
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "512" },
    });
    choose("GPU", "nvidia-rtx-5090-32gb");
    submit();

    for (const name of [
      "Qwen3-Coder-30B-A3B-Instruct",
      "Qwen3-30B-A3B-Instruct-2507",
      "GLM-4.7-Flash",
      "Qwen3-Coder-Next",
      "Qwen3.5-122B-A10B",
      "Gemma 3n E2B IT",
      "Gemma 3n E4B IT",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
  });

  it("includes added Batch 37 models in recommendations when system RAM is sufficient", () => {
    renderRecommendations();
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "512" },
    });
    choose("GPU", "nvidia-rtx-5090-32gb");
    submit();

    for (const name of [
      "Qwen3-VL-8B-Instruct",
      "Qwen3-VL-30B-A3B-Instruct",
      "Ministral 3 14B Instruct 2512",
      "Devstral Small 2 24B Instruct 2512",
      "LFM2-24B-A2B",
      "NVIDIA Nemotron 3 Nano 30B-A3B",
      "Mistral Small 4 119B A6B",
      "NVIDIA Nemotron 3 Super 120B-A12B",
      "Laguna S 2.1",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }

    const qwenCard = screen
      .getByRole("heading", { name: "Qwen3-VL-8B-Instruct" })
      .closest("article");
    expect(qwenCard?.textContent).toMatch(/Multimodal memory scope/);
    expect(qwenCard?.textContent).toMatch(
      /multimodal runtime memory are not estimated separately/i,
    );
  });

  it("shows multimodal scope on affected recommendation cards only", () => {
    renderRecommendations();
    choose("GPU", "nvidia-rtx-5090-32gb");
    submit();

    const multimodalCard = screen
      .getByRole("heading", { name: "Qwen3.5 4B" })
      .closest("article");
    expect(multimodalCard?.textContent).toMatch(
      /excludes the separate vision\/projector file/,
    );

    const textOnlyCard = screen
      .getByRole("heading", { name: "Llama 3.2 1B Instruct" })
      .closest("article");
    expect(textOnlyCard?.textContent).not.toMatch(/Multimodal memory scope/);
  });

  it("shows Bonsai's runtime prerequisite on its memory recommendation", () => {
    renderRecommendations();
    choose("GPU", "nvidia-rtx-5090-32gb");
    submit();

    expect(
      screen.getAllByText(/PTQ1_0 and PQ2_0 require PrismML's llama\.cpp fork/)
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "PrismML Bonsai demo runtime guide" })
        .length,
    ).toBeGreaterThan(0);
  });

  it("shows partial offload and warnings when VRAM is limited", () => {
    renderRecommendations();
    choose("GPU", "nvidia-rtx-4060-8gb");
    fireEvent.change(screen.getByLabelText("Dedicated VRAM (GiB)"), {
      target: { value: "2" },
    });
    submit();
    expect(screen.getAllByText("Partial offload").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/dedicated VRAM is limited/).length,
    ).toBeGreaterThan(0);
  });

  it("keeps integrated GPU behavior aligned with the engine", () => {
    renderRecommendations();
    choose("GPU", "intel-uhd-graphics-770");
    submit();
    expect(screen.getAllByText("CPU-only").length).toBeGreaterThan(0);
    expect(document.querySelector(".recommendation-categories")).toBeNull();
  });

  it("shows no suitable model when system RAM is insufficient", () => {
    renderRecommendations();
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "1" },
    });
    submit();
    expect(
      screen.getByRole("heading", { name: "No suitable model found" }),
    ).toBeTruthy();
    expect(screen.getByText(/not-suitable candidate/)).toBeTruthy();
  });

  it("shows shared validation feedback for invalid hardware", () => {
    renderRecommendations();
    fireEvent.change(screen.getByLabelText("CPU"), { target: { value: "" } });
    submit("");
    expect(screen.getByText("Enter a CPU name.")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Models for your hardware" }),
    ).toBeNull();
  });

  it("shows runtime assumptions without changing recommendation categories", () => {
    renderRecommendations();
    const summary = screen.getByText("Advanced settings");
    fireEvent.click(summary);
    expect(screen.getByLabelText("Runtime")).toBeTruthy();
    choose("Runtime", "llama.cpp");
    choose("Backend/device path", "vulkan");
    choose("Execution preference", "partial-offload");
    fireEvent.click(summary);
    expect(summary.closest("details")?.hasAttribute("open")).toBe(false);
    submit();

    expect(
      screen.getAllByRole("heading", { name: "Runtime assumptions" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Vulkan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Partial offload").length).toBeGreaterThan(0);
  });

  it("carries a recommendation's selected model, hardware, and runtime into the calculator", async () => {
    renderRecommendations();
    choose("GPU", "nvidia-rtx-4060-8gb");
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "64" },
    });
    fireEvent.click(screen.getByText("Advanced settings"));
    choose("Runtime", "llama.cpp");
    choose("Backend/device path", "vulkan");
    choose("Execution preference", "partial-offload");
    fireEvent.change(screen.getByLabelText("Target context length (tokens)"), {
      target: { value: "8192" },
    });
    submit();

    const card = screen
      .getByRole("heading", { name: "Llama 3.1 8B Instruct" })
      .closest("article")!;
    const href = within(card)
      .getByRole("link", { name: /Open the calculator/i })
      .getAttribute("href")!;
    const search = new URL(href, window.location.origin).searchParams;
    const model = modelCatalog.find(
      (candidate) => candidate.id === search.get("model"),
    )!;
    const recommendedQuantizationName = card
      .querySelector(".recommendation-card-heading p")
      ?.textContent?.split(" · ")
      .at(-1);
    expect(search.get("v")).toBe("1");
    expect(search.get("model")).toBe("meta-llama-3-1-8b-instruct");
    expect(recommendedQuantizationName).toBeTruthy();
    expect(
      model.quantizations.find(
        (quantization) =>
          quantization.displayName === recommendedQuantizationName,
      )?.id,
    ).toBe(search.get("quantization"));
    expect(search.get("cpu")).toBe("AMD Ryzen 7 7800X3D");
    expect(search.get("gpu")).toBe("nvidia-rtx-4060-8gb");
    expect(search.get("vram")).toBe("8");
    expect(search.get("ram")).toBe("64");
    expect(search.get("os")).toBe("windows");
    expect(search.get("mode")).toBeNull();
    expect(search.get("runtime")).toBe("llama.cpp");
    expect(search.get("backend")).toBe("vulkan");
    expect(search.get("execution")).toBe("partial-offload");
    expect(search.get("context")).toBe("8192");

    window.history.replaceState({}, "", href);
    cleanup();
    render(<Calculator models={modelCatalog} gpus={gpuCatalog} />);
    expect(
      await screen.findByRole("button", { name: "Copy calculator link" }),
    ).toBeTruthy();
    expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe(
      "Llama 3.1 8B Instruct",
    );
    expect(
      (screen.getByLabelText("Quantization") as HTMLSelectElement).value,
    ).toBe(search.get("quantization"));
    expect((screen.getByLabelText("CPU") as HTMLInputElement).value).toBe(
      "AMD Ryzen 7 7800X3D",
    );
    expect((screen.getByLabelText("GPU") as HTMLInputElement).value).toBe(
      "GeForce RTX 4060 8GB",
    );
    expect(
      (screen.getByLabelText("System RAM (GiB)") as HTMLInputElement).value,
    ).toBe("64");
    fireEvent.click(screen.getByText("Advanced settings"));
    expect((screen.getByLabelText("Runtime") as HTMLSelectElement).value).toBe(
      "llama.cpp",
    );
    expect(
      (screen.getByLabelText("Backend/device path") as HTMLSelectElement).value,
    ).toBe("vulkan");
    expect(
      (screen.getByLabelText("Execution preference") as HTMLSelectElement)
        .value,
    ).toBe("partial-offload");
    expect(
      (
        screen.getByLabelText(
          "Target context length (tokens)",
        ) as HTMLInputElement
      ).value,
    ).toBe("8192");
  });

  it("carries Apple recommendations into the calculator without PC-only values", async () => {
    renderRecommendations();
    choose("Hardware mode", "apple-unified");
    choose("CPU / Apple chip", "Apple M4");
    choose("Total unified memory (GiB)", "128");
    fireEvent.click(
      screen.getByRole("button", { name: /find suitable models/i }),
    );

    const card = screen
      .getByRole("heading", { name: "Llama 3.2 1B Instruct" })
      .closest("article")!;
    const href = within(card)
      .getByRole("link", { name: /Open the calculator/i })
      .getAttribute("href")!;
    const search = new URL(href, window.location.origin).searchParams;
    expect(search.get("model")).toBe("meta-llama-3-2-1b-instruct");
    expect(search.get("quantization")).toBeTruthy();
    expect(search.get("cpu")).toBe("Apple M4");
    expect(search.get("ram")).toBe("128");
    expect(search.get("os")).toBe("macos");
    expect(search.get("mode")).toBe("apple-unified");
    expect(search.has("gpu")).toBe(false);
    expect(search.has("vram")).toBe(false);
    expect(search.has("runtime")).toBe(false);
    expect(search.has("backend")).toBe(false);
    expect(search.has("execution")).toBe(false);
    expect(search.has("context")).toBe(false);

    window.history.replaceState({}, "", href);
    cleanup();
    render(<Calculator models={modelCatalog} gpus={gpuCatalog} />);
    expect(
      await screen.findByRole("button", { name: "Copy calculator link" }),
    ).toBeTruthy();
    expect(
      (screen.getByLabelText("Hardware mode") as HTMLSelectElement).value,
    ).toBe("apple-unified");
    expect(
      (screen.getByLabelText("CPU / Apple chip") as HTMLInputElement).value,
    ).toBe("Apple M4");
    expect(
      (screen.getByLabelText("Total unified memory (GiB)") as HTMLInputElement)
        .value,
    ).toBe("128");
    expect(screen.queryByLabelText("GPU")).toBeNull();
    expect(screen.queryByLabelText("Dedicated VRAM (GiB)")).toBeNull();
  });

  it("opens advanced settings to expose a hidden runtime validation error", () => {
    renderRecommendations();
    const summary = screen.getByText("Advanced settings");
    fireEvent.click(summary);
    fireEvent.change(screen.getByLabelText("Target context length (tokens)"), {
      target: { value: "1.5" },
    });
    fireEvent.click(summary);
    expect(summary.closest("details")?.hasAttribute("open")).toBe(false);

    submit();

    const contextLength = screen.getByLabelText(
      "Target context length (tokens)",
    );
    expect(summary.closest("details")?.hasAttribute("open")).toBe(true);
    expect(contextLength.getAttribute("aria-invalid")).toBe("true");
    expect(contextLength.getAttribute("aria-describedby")).toBe(
      "target-context-length-error",
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Enter a whole number greater than 0.",
    );
  });
});

describe("recommendations share links", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/recommendations");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: undefined,
    });
  });

  it("restores valid hardware, evaluates once into results, and leaves context unset", async () => {
    window.history.replaceState(
      {},
      "",
      "/recommendations?v=1&cpu=AMD+Ryzen+5&ram=64&os=windows&gpu=none&vram=0",
    );
    renderRecommendations();
    expect(
      await screen.findByRole("heading", { name: "Models for your hardware" }),
    ).toBeTruthy();
    expect((screen.getByLabelText("CPU") as HTMLInputElement).value).toBe(
      "AMD Ryzen 5",
    );
    expect(
      (screen.getByLabelText("System RAM (GiB)") as HTMLInputElement).value,
    ).toBe("64");
    expect(window.location.search).toContain("ram=64");
    expect(
      screen.getByRole("button", { name: "Copy recommendations link" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Advanced settings"));
    expect(
      (
        screen.getByLabelText(
          "Target context length (tokens)",
        ) as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("restores a preset context and performs no automatic clipboard or URL update", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    window.history.replaceState(
      {},
      "",
      "/recommendations?v=1&cpu=AMD+Ryzen+5&ram=64&os=windows&gpu=none&vram=0&context=4096",
    );
    renderRecommendations();
    expect(
      await screen.findByRole("button", { name: "Copy recommendations link" }),
    ).toBeTruthy();
    expect(writeText).not.toHaveBeenCalled();
    expect(window.location.search).toContain("context=4096");
    expect(
      screen.getByText(
        /anyone with the link can see these values.*browser history or logs/i,
      ),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Copy recommendations link" }),
    );
    expect((await screen.findByRole("status")).textContent).toContain(
      "Link copied.",
    );
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/recommendations?v=1&cpu=AMD+Ryzen+5&ram=64&os=windows&gpu=none&vram=0&context=4096`,
    );
  });

  it("rejects invalid shared hardware without applying any of its values", async () => {
    window.history.replaceState(
      {},
      "",
      "/recommendations?v=1&cpu=Other+CPU&ram=128&os=windows&gpu=stale-gpu&vram=0",
    );
    renderRecommendations();
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /unavailable GPU/i,
    );
    expect((screen.getByLabelText("CPU") as HTMLInputElement).value).toBe("");
    expect(
      (screen.getByLabelText("System RAM (GiB)") as HTMLInputElement).value,
    ).toBe("16");
    expect(screen.getByText("Ready when you are.")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Copy recommendations link" }),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("CPU"), {
      target: { value: "Manual CPU" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers a manual selectable URL after clipboard failure", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
    renderRecommendations();
    submit();
    fireEvent.click(
      screen.getByRole("button", { name: "Copy recommendations link" }),
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /select and copy/i,
    );
    expect(
      (screen.getByLabelText("Share link") as HTMLInputElement).value,
    ).toContain("cpu=AMD+Ryzen+7+7800X3D");
  });
});

describe("Apple hardware workflow", () => {
  afterEach(cleanup);
  it("switches explicitly, excludes hidden dedicated memory and restores retained PC values", () => {
    renderRecommendations();
    choose("GPU", "nvidia-rtx-4060-8gb");
    fireEvent.change(screen.getByLabelText("Dedicated VRAM (GiB)"), {
      target: { value: "999" },
    });
    fireEvent.change(screen.getByLabelText("Hardware mode"), {
      target: { value: "apple-unified" },
    });
    expect(screen.queryByLabelText("GPU")).toBeNull();
    expect(screen.queryByLabelText("Dedicated VRAM (GiB)")).toBeNull();
    expect(
      (screen.getByLabelText("Operating system") as HTMLSelectElement).value,
    ).toBe("macos");
    expect(
      (screen.getByLabelText("Operating system") as HTMLSelectElement).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("CPU / Apple chip"), {
      target: { value: "Apple M4" },
    });
    fireEvent.change(screen.getByLabelText("Total unified memory (GiB)"), {
      target: { value: "0.1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /find suitable models/i }),
    );
    expect(document.querySelector(".recommendation-categories")).toBeNull();
    expect(screen.getAllByText("Unsupported").length).toBeGreaterThan(0);
    expect(screen.queryByText("GPU-capable")).toBeNull();
    fireEvent.change(screen.getByLabelText("Total unified memory (GiB)"), {
      target: { value: "128" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /find suitable models/i }),
    );
    expect(
      screen.getAllByText("Fits estimated unified memory").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Total assessed unified memory (approx.)").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Not applicable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unverified (advisory)").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText(
        /Total unified-memory fit does not guarantee full GPU offload/,
      ).length,
    ).toBeGreaterThan(0);
    for (const id of ["openai-gpt-oss-20b", "openai-gpt-oss-120b"]) {
      const model = modelCatalog.find((model) => model.id === id)!;
      const card = screen
        .getByRole("heading", { name: model.displayName })
        .closest("article")!;
      expect(card.textContent).toContain("Harmony");
      expect(card.textContent).toContain("Fits estimated unified memory");
      expect(card.textContent).toContain("Unverified (advisory)");
    }
    const multimodal = modelCatalog.find((model) => model.memoryEstimateScope)!;
    expect(
      screen
        .getByRole("heading", { name: multimodal.displayName })
        .closest("article")?.textContent,
    ).toMatch(/Multimodal memory scope:/i);
    fireEvent.change(screen.getByLabelText("Hardware mode"), {
      target: { value: "pc" },
    });
    expect(
      (screen.getByLabelText("Dedicated VRAM (GiB)") as HTMLInputElement).value,
    ).toBe("999");
    expect((screen.getByLabelText("GPU") as HTMLInputElement).value).toBe(
      "GeForce RTX 4060 8GB",
    );
    expect(screen.queryByLabelText("Total unified memory (GiB)")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /find suitable models/i }),
    );
    expect(screen.getAllByText("GPU-capable").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Fits estimated dedicated VRAM" }),
    ).toBeTruthy();
    expect(screen.queryByText("Fits estimated unified memory")).toBeNull();
  });
});
