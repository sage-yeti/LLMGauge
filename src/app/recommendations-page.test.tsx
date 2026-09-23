import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Recommendations } from "./recommendations";
import { gpuCatalog, modelCatalog } from "@/data/catalog";

function renderRecommendations() {
  render(<Recommendations models={modelCatalog} gpus={gpuCatalog} />);
}
function submit() {
  fireEvent.click(
    screen.getByRole("button", { name: /find suitable models/i }),
  );
}
function choose(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("recommendations interface", () => {
  afterEach(cleanup);

  it("renders shared hardware controls and produces a CPU-only recommendation", () => {
    renderRecommendations();
    expect(screen.getByRole("button", { name: "Scan my device" })).toBeTruthy();
    submit();
    expect(
      screen.getByRole("heading", { name: "Models for your hardware" }),
    ).toBeTruthy();
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
    submit();
    expect(screen.getByText("Enter a CPU name.")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Models for your hardware" }),
    ).toBeNull();
  });

  it("shows runtime assumptions without changing recommendation categories", () => {
    renderRecommendations();
    choose("Runtime", "llama.cpp");
    choose("Backend/device path", "vulkan");
    choose("Execution preference", "partial-offload");
    submit();

    expect(
      screen.getAllByRole("heading", { name: "Runtime assumptions" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Vulkan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Partial offload").length).toBeGreaterThan(0);
  });
});
