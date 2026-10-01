import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Calculator } from "./calculator";
import { gpuCatalog, modelCatalog } from "@/data/catalog";

function renderCalculator() {
  render(<Calculator models={modelCatalog} gpus={gpuCatalog} />);
}

function submit(cpuName = "AMD Ryzen 7 7800X3D") {
  fireEvent.change(screen.getByLabelText("CPU"), {
    target: { value: cpuName },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /evaluate compatibility/i }),
  );
}

function choose(label: string, value: string) {
  if (label === "Model" || label === "GPU") {
    const entry =
      label === "Model"
        ? modelCatalog.find((model) => model.id === value)
        : gpuCatalog.find((gpu) => gpu.id === value);
    const input = screen.getByLabelText(label);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value } });
    fireEvent.click(
      screen.getByRole("option", {
        name: new RegExp(
          entry?.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") ?? value,
        ),
      }),
    );
    return;
  }
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("compatibility calculator", () => {
  afterEach(cleanup);

  it("renders corrected fallback estimates and a newly fitting GPU profile", () => {
    renderCalculator();
    choose("Model", "meta-llama-3-1-8b-instruct");
    choose("GPU", "nvidia-rtx-4060-8gb");
    fireEvent.change(screen.getByLabelText("Dedicated VRAM (GiB)"), {
      target: { value: "5.5" },
    });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "8" },
    });
    submit();
    // 8B × 4.5 bits = 4.5 billion bytes; default overhead/reserve remain unchanged.
    expect(screen.getByText("5.44 GiB")).toBeTruthy();
    expect(screen.getByText("7.44 GiB")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "GPU-capable" })).toBeTruthy();
  });

  it("formats the same estimate while preserving distinct sub-display-precision fits", () => {
    renderCalculator();
    choose("Model", "openai-gpt-oss-20b");
    choose("GPU", "nvidia-rtx-4060-8gb");
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "32" },
    });
    for (const [vram, level] of [
      ["13.38", "Partial offload"],
      ["13.382", "GPU-capable"],
    ]) {
      fireEvent.change(screen.getByLabelText("Dedicated VRAM (GiB)"), {
        target: { value: vram },
      });
      submit();
      expect(screen.getByText("13.38 GiB")).toBeTruthy();
      expect(screen.getByText("15.38 GiB")).toBeTruthy();
      expect(screen.getByRole("heading", { name: level })).toBeTruthy();
    }
  });

  it("selects and evaluates both GPT-OSS size-only candidates without claiming a bit width", () => {
    for (const [variant, size, vram, ram] of [
      ["20b", "11.28", "13.38", "15.38"],
      ["120b", "59.03", "66.87", "68.87"],
    ]) {
      renderCalculator();
      choose("Model", `openai-gpt-oss-${variant}`);
      expect(
        screen.getByRole("option", {
          name: `MXFP4 · ${size} GiB · whole-model bits/weight unavailable`,
        }),
      ).toBeTruthy();
      fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
        target: { value: "128" },
      });
      submit();
      expect(screen.getByRole("heading", { name: "CPU-only" })).toBeTruthy();
      expect(screen.getByText(`${vram} GiB`)).toBeTruthy();
      expect(screen.getByText(`${ram} GiB`)).toBeTruthy();
      expect(
        screen.getByText(
          /Whole-model bits per weight is unavailable.*memory-fit estimates remain approximate/,
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(/Use a current llama.cpp build.*Harmony/),
      ).toBeTruthy();
      expect(screen.queryByText(/highest-bit candidate/)).toBeNull();
      expect(screen.queryByText(/Multimodal memory scope/)).toBeNull();
      cleanup();
    }
  });

  it("renders the registry model, quantizations, and GPU options", () => {
    renderCalculator();

    expect(screen.getByRole("combobox", { name: "Model" })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Q4/ })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "GPU" })).toBeTruthy();
    expect(screen.getByLabelText("System RAM (GiB)").getAttribute("id")).toBe(
      "system-ram",
    );
    expect(
      screen
        .getByLabelText("System RAM (GiB)")
        .getAttribute("aria-describedby"),
    ).toBe("system-ram-help");
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
    expect((screen.getByLabelText("CPU") as HTMLInputElement).value).toBe("");
    expect(screen.getByLabelText("CPU").getAttribute("placeholder")).toBe(
      "e.g. AMD Ryzen 7 7800X3D",
    );
    expect(
      (screen.getByLabelText("System RAM (GiB)") as HTMLInputElement).value,
    ).toBe("16");
  });

  it("starts with an empty CPU name and accepts a user-entered name", () => {
    renderCalculator();
    const cpuInput = screen.getByLabelText("CPU") as HTMLInputElement;

    expect(cpuInput.value).toBe("");
    fireEvent.change(cpuInput, { target: { value: "AMD Ryzen 7 7800X3D" } });
    expect(cpuInput.value).toBe("AMD Ryzen 7 7800X3D");
  });

  it("searches models by family and submits the selected model ID", () => {
    renderCalculator();
    const modelInput = screen.getByRole("combobox", { name: "Model" });
    fireEvent.focus(modelInput);
    fireEvent.change(modelInput, { target: { value: "Qwen3.5" } });

    fireEvent.click(screen.getByRole("option", { name: /Qwen3\.5 4B/ }));
    expect((modelInput as HTMLInputElement).value).toBe("Qwen3.5 4B");
    submit();

    expect(screen.getByText("Qwen3.5 4B", { selector: "strong" })).toBeTruthy();
  });

  it("searches for a Batch 35 model and submits its catalog ID", () => {
    renderCalculator();
    choose("Model", "qwen-qwen3-coder-30b-a3b-instruct");
    expect(
      (screen.getByRole("combobox", { name: "Model" }) as HTMLInputElement)
        .value,
    ).toBe("Qwen3-Coder-30B-A3B-Instruct");
    submit();

    expect(
      screen.getByText("Qwen3-Coder-30B-A3B-Instruct", { selector: "strong" }),
    ).toBeTruthy();
  });

  it("shows a CPU-only result for the default no-GPU profile", () => {
    renderCalculator();
    submit();

    expect(screen.getByRole("heading", { name: "CPU-only" })).toBeTruthy();
    expect(screen.getByText("CPU execution")).toBeTruthy();
    expect(screen.getByText(/No GPU was supplied/)).toBeTruthy();
    expect(screen.getByText("Practical starting point")).toBeTruthy();
    expect(screen.getByText("Model maximum")).toBeTruthy();
  });

  it("shows a GPU-capable result and recommendation", () => {
    renderCalculator();
    choose("GPU", "nvidia-rtx-3060-12gb");
    submit();

    expect(screen.getByRole("heading", { name: "GPU-capable" })).toBeTruthy();
    expect(screen.getByText("Full GPU execution")).toBeTruthy();
    expect(screen.getByText("Recommended quantization")).toBeTruthy();
    expect(screen.getByText("Q8_0")).toBeTruthy();
  });

  it("shows multimodal scope for affected estimates and keeps text-only results clear", () => {
    renderCalculator();
    submit();
    expect(screen.queryByText(/Multimodal memory scope/)).toBeNull();

    choose("Model", "qwen-qwen3-5-0-8b");
    submit();
    expect(
      screen.getByText(/has not verified whether the selected GGUF weights/),
    ).toBeTruthy();
  });

  it("shows Bonsai's runtime prerequisite with the compatibility result", () => {
    renderCalculator();
    choose("Model", "prismml-bonsai-2-27b");
    choose("GPU", "nvidia-rtx-5090-32gb");
    submit();

    expect(
      screen.getByText(/PTQ1_0 and PQ2_0 require PrismML's llama\.cpp fork/),
    ).toBeTruthy();
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
  });

  it("shows partial offload and its limiting factor", () => {
    renderCalculator();
    choose("Model", "mistralai-mistral-7b-instruct-v0-3");
    choose("GPU", "nvidia-rtx-4060-8gb");
    choose("Quantization", "q8-0");
    submit();

    expect(
      screen.getByRole("heading", { name: "Partial offload" }),
    ).toBeTruthy();
    expect(screen.getByText("Partial GPU offload")).toBeTruthy();
    expect(screen.getByText(/Available VRAM is below/)).toBeTruthy();
  });

  it("shows unsupported when both memory pools are insufficient", () => {
    renderCalculator();
    choose("Model", "mistralai-mistral-7b-instruct-v0-3");
    choose("GPU", "nvidia-rtx-4060-8gb");
    choose("Quantization", "q8-0");
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "4" },
    });
    submit();

    expect(screen.getByRole("heading", { name: "Unsupported" })).toBeTruthy();
    expect(screen.getByText(/Available system RAM is below/)).toBeTruthy();
  });

  it("keeps integrated GPU behavior aligned with the engine", () => {
    renderCalculator();
    choose("GPU", "intel-uhd-graphics-770");
    submit();

    expect(screen.getByRole("heading", { name: "CPU-only" })).toBeTruthy();
    expect(
      screen.getAllByText(/Integrated GPU shared memory is not counted/),
    ).toHaveLength(2);
  });

  it("shows concise validation feedback for invalid form input", () => {
    renderCalculator();
    fireEvent.change(screen.getByLabelText("CPU"), { target: { value: "" } });
    submit("");

    expect(screen.getByRole("alert", { name: "" })).toBeTruthy();
    expect(screen.getByText("Enter a CPU name.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "CPU-only" })).toBeNull();
  });

  it("displays assumptions and warnings in the result", () => {
    renderCalculator();
    submit();

    expect(screen.getByText("Assumptions and warnings")).toBeTruthy();
    expect(screen.getByText(/deterministic memory estimate/)).toBeTruthy();
    expect(
      screen.getByText(/Context guidance is conservative and advisory/),
    ).toBeTruthy();
    expect(screen.getByText(/Weight overhead: 1.12×/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /interpret this estimate/i }),
    ).toBeTruthy();
  });

  it("shows optional runtime assumptions and context warnings", () => {
    renderCalculator();
    const summary = screen.getByText("Advanced settings");
    fireEvent.click(summary);
    expect(screen.getByLabelText("Runtime")).toBeTruthy();
    choose("Runtime", "llama.cpp");
    choose("Backend/device path", "cuda");
    choose("Execution preference", "full-gpu");
    fireEvent.change(screen.getByLabelText("Target context length (tokens)"), {
      target: { value: "8192" },
    });
    fireEvent.click(summary);
    expect(summary.closest("details")?.hasAttribute("open")).toBe(false);
    submit();

    expect(
      screen.getByRole("heading", { name: "Runtime assumptions" }),
    ).toBeTruthy();
    expect(screen.getAllByText("llama.cpp").length).toBeGreaterThan(1);
    expect(
      screen.getByText(/above the practical starting guidance/),
    ).toBeTruthy();
    expect(
      screen.getByText(/do not prove local runtime or backend support/),
    ).toBeTruthy();
  });

  it("opens advanced settings to expose a hidden runtime validation error", () => {
    renderCalculator();
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

describe("Apple hardware workflow", () => {
  afterEach(cleanup);
  it("switches explicitly, excludes hidden dedicated memory and restores retained PC values", () => {
    renderCalculator();
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
      screen.getByRole("button", { name: /evaluate compatibility/i }),
    );
    expect(screen.getAllByText("Unsupported").length).toBeGreaterThan(0);
    expect(screen.queryByText("GPU-capable")).toBeNull();
    fireEvent.change(screen.getByLabelText("Total unified memory (GiB)"), {
      target: { value: "128" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /evaluate compatibility/i }),
    );
    expect(
      screen.getAllByText("Fits estimated unified memory").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Estimated unified memory (approx.)").length,
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
      screen.getByRole("button", { name: /evaluate compatibility/i }),
    );
    expect(screen.getAllByText("GPU-capable").length).toBeGreaterThan(0);
    expect(screen.queryByText("Fits estimated unified memory")).toBeNull();
  });
});

it("keeps GPT-OSS and multimodal caveats visible for Apple memory results", () => {
  renderCalculator();
  choose("Hardware mode", "apple-unified");
  choose("Total unified memory (GiB)", "128");
  choose("CPU / Apple chip", "Apple M4");
  for (const id of ["openai-gpt-oss-20b", "openai-gpt-oss-120b"]) {
    choose("Model", id);
    fireEvent.click(
      screen.getByRole("button", { name: /evaluate compatibility/i }),
    );
    expect(
      screen.getByRole("heading", { name: "Fits estimated unified memory" }),
    ).toBeTruthy();
    expect(screen.getAllByText(/Harmony/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/whole-model bits/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Not applicable")).toBeTruthy();
  }
  const multimodal = modelCatalog.find((model) => model.memoryEstimateScope)!;
  choose("Model", multimodal.id);
  fireEvent.click(
    screen.getByRole("button", { name: /evaluate compatibility/i }),
  );
  expect(screen.getByText(/Multimodal memory scope:/i)).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Context guidance" }),
  ).toBeTruthy();
});
