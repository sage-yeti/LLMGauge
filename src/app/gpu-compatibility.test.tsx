import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GpuCompatibility } from "./gpu-compatibility";
import { gpuCatalog, modelCatalog } from "@/data/catalog";

describe("GPU compatibility workflow", () => {
  afterEach(cleanup);

  it("starts without RAM or a context target and lists catalog GPU pages after submit", () => {
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    expect((screen.getByLabelText("System RAM (GiB)") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "meta-llama-3-2-1b-instruct" },
    });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "128" },
    });
    fireEvent.click(screen.getByRole("button", { name: /compare catalog GPUs/i }));
    expect(screen.getByRole("heading", { name: "Discrete GPU results" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /View .* catalog page/ }).length).toBeGreaterThan(1);
    expect(screen.getByText(/representative quantization follows LLMGauge’s existing fit and metadata policy/i)).toBeTruthy();

    fireEvent.click(screen.getByText("Advanced settings"));
    const context = screen.getByLabelText("Target context length (tokens)") as HTMLInputElement;
    expect(context.value).toBe("");
    for (const tokens of ["4,096", "8,192", "16,384", "32,768"]) {
      expect(screen.getByRole("button", { name: `Set target context to ${tokens} tokens` }).getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("uses explicitly selected context and preserves filter and catalog link rendering", () => {
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "meta-llama-3-2-1b-instruct" },
    });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), { target: { value: "128" } });
    fireEvent.click(screen.getByText("Advanced settings"));
    fireEvent.change(screen.getByLabelText("Target context length (tokens)"), { target: { value: "4096" } });
    fireEvent.change(screen.getByLabelText("Backend/device path"), { target: { value: "cuda" } });
    fireEvent.change(screen.getByLabelText("Execution preference"), { target: { value: "full-gpu" } });
    fireEvent.click(screen.getByRole("button", { name: /compare catalog GPUs/i }));
    expect(screen.getAllByText(/selected full-GPU preference and explicit CUDA/Vulkan backend/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Estimated cache: .*vram/).length).toBeGreaterThan(0);
    const search = screen.getByLabelText("Filter GPUs");
    fireEvent.change(search, { target: { value: "no-such-gpu" } });
    expect(screen.getByText("No GPUs match that search")).toBeTruthy();
    fireEvent.change(search, { target: { value: "GeForce" } });
    expect(screen.getAllByRole("link", { name: /View .* catalog page/ }).length).toBeGreaterThan(0);
  });

  it("shows field feedback for an empty model and invalid RAM", () => {
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    fireEvent.click(screen.getByRole("button", { name: /compare catalog GPUs/i }));
    expect(screen.getByText("Choose a model from the catalog.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: modelCatalog[0]!.id } });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /compare catalog GPUs/i }));
    expect(screen.getByText("Enter a number greater than 0.")).toBeTruthy();
  });
});
