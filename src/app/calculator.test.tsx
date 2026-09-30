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
