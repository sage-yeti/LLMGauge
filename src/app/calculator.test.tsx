import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Calculator } from "./calculator";
import { gpuCatalog, modelCatalog } from "@/data/catalog";

function renderCalculator() {
  render(<Calculator models={modelCatalog} gpus={gpuCatalog} />);
}

function submit() {
  fireEvent.click(
    screen.getByRole("button", { name: /evaluate compatibility/i }),
  );
}

function choose(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("compatibility calculator", () => {
  afterEach(cleanup);

  it("renders the registry model, quantizations, and GPU options", () => {
    renderCalculator();

    expect(
      screen.getByRole("option", { name: /Llama 3\.2 1B Instruct/ }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /Q4/ })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /GeForce RTX 3060 12GB/ }),
    ).toBeTruthy();
    expect(screen.getByLabelText("System RAM (GiB)").getAttribute("id")).toBe(
      "system-ram",
    );
    expect(
      screen
        .getByLabelText("System RAM (GiB)")
        .getAttribute("aria-describedby"),
    ).toBe("system-ram-help");
    expect(screen.getByRole("button", { name: "Scan my device" })).toBeTruthy();
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
    submit();

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
});
