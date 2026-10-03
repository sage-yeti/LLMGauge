import { gpuCatalog, modelCatalog } from "@/data/catalog";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GpuCompatibility } from "./gpu-compatibility";

describe("GPU compatibility workflow", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/gpu-compatibility");
    delete (navigator as Navigator & { clipboard?: Clipboard }).clipboard;
    delete (document as Document & { execCommand?: (command: string) => boolean }).execCommand;
  });

  it("starts without RAM or context and lists catalog GPU pages after submit", () => {
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    expect(
      (screen.getByLabelText("System RAM (GiB)") as HTMLInputElement).value,
    ).toBe("");
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "meta-llama-3-2-1b-instruct" },
    });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "128" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /compare catalog GPUs/i }),
    );
    expect(
      screen.getByRole("heading", { name: "Discrete GPU results" }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: /View .* catalog page/ }).length,
    ).toBeGreaterThan(1);
    expect(
      screen.getByText(
        /representative quantization follows LLMGauge’s existing fit and metadata policy/i,
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Advanced settings"));
    const context = screen.getByLabelText(
      "Target context length (tokens)",
    ) as HTMLInputElement;
    expect(context.value).toBe("");
    for (const tokens of ["4,096", "8,192", "16,384", "32,768"]) {
      expect(
        screen
          .getByRole("button", {
            name: `Set target context to ${tokens} tokens`,
          })
          .getAttribute("aria-pressed"),
      ).toBe("false");
    }
  });

  it("uses an explicit context preset and renders filter and catalog links", () => {
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "meta-llama-3-2-1b-instruct" },
    });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "128" },
    });
    fireEvent.click(screen.getByText("Advanced settings"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Set target context to 4,096 tokens",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Ready when you are." }),
    ).toBeTruthy();
    expect(
      (
        screen.getByLabelText(
          "Target context length (tokens)",
        ) as HTMLInputElement
      ).value,
    ).toBe("4096");
    fireEvent.change(screen.getByLabelText("Backend/device path"), {
      target: { value: "cuda" },
    });
    fireEvent.change(screen.getByLabelText("Execution preference"), {
      target: { value: "full-gpu" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /compare catalog GPUs/i }),
    );
    expect(
      screen.getAllByText(
        /selected full-GPU preference and explicit CUDA\/Vulkan backend/,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Estimated cache: .*vram/).length,
    ).toBeGreaterThan(0);

    const search = screen.getByLabelText("Filter GPUs");
    fireEvent.change(search, { target: { value: "no-such-gpu" } });
    expect(screen.getByText("No GPUs match that search")).toBeTruthy();
    fireEvent.change(search, { target: { value: "GeForce" } });
    expect(
      screen.getAllByRole("link", { name: /View .* catalog page/ }).length,
    ).toBeGreaterThan(0);
  });

  it("shows field feedback for an empty model and invalid RAM", () => {
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    fireEvent.click(
      screen.getByRole("button", { name: /compare catalog GPUs/i }),
    );
    expect(screen.getByText("Choose a model from the catalog.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: modelCatalog[0]!.id },
    });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "0" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /compare catalog GPUs/i }),
    );
    expect(screen.getByText("Enter a number greater than 0.")).toBeTruthy();
  });

  it("restores a valid shared comparison automatically and leaves omitted settings unset", async () => {
    window.history.replaceState(
      {},
      "",
      "/gpu-compatibility?v=1&model=meta-llama-3-2-1b-instruct&ram=64",
    );
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    expect(
      await screen.findByRole("heading", { name: "Discrete GPU results" }),
    ).toBeTruthy();
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
      "meta-llama-3-2-1b-instruct",
    );
    expect(
      (screen.getByLabelText("System RAM (GiB)") as HTMLInputElement).value,
    ).toBe("64");
    expect(window.location.search).toContain("ram=64");
    fireEvent.click(screen.getByText("Advanced settings"));
    expect(
      (
        screen.getByLabelText(
          "Target context length (tokens)",
        ) as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("restores selected settings and a custom context from a shared link", async () => {
    window.history.replaceState(
      {},
      "",
      "/gpu-compatibility?v=1&model=meta-llama-3-2-1b-instruct&ram=128&runtime=llama.cpp&backend=cuda&execution=full-gpu&context=12345",
    );
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    expect(
      await screen.findByRole("heading", { name: "Discrete GPU results" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByText("Advanced settings"));
    expect(
      (screen.getByLabelText("Backend/device path") as HTMLSelectElement).value,
    ).toBe("cuda");
    expect(
      (screen.getByLabelText("Execution preference") as HTMLSelectElement)
        .value,
    ).toBe("full-gpu");
    expect(
      (
        screen.getByLabelText(
          "Target context length (tokens)",
        ) as HTMLInputElement
      ).value,
    ).toBe("12345");
  });

  it("rejects invalid shared state without partially applying or evaluating it", async () => {
    window.history.replaceState(
      {},
      "",
      "/gpu-compatibility?v=1&model=stale-model&ram=128&backend=cuda",
    );
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /unavailable model or invalid setting/i,
    );
    expect(screen.getByRole("heading", { name: "Ready when you are." })).toBeTruthy();
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
      "",
    );
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "meta-llama-3-2-1b-instruct" },
    });
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
      "meta-llama-3-2-1b-instruct",
    );
  });

  it("offers sharing only after evaluation and copies only after the user activates it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    expect(
      screen.queryByRole("button", { name: "Copy comparison link" }),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "meta-llama-3-2-1b-instruct" },
    });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "128" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /compare catalog GPUs/i }),
    );
    expect(
      screen.getByText(/anyone who has the link can see these values/i),
    ).toBeTruthy();
    expect(writeText).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    fireEvent.click(
      screen.getByRole("button", { name: "Copy comparison link" }),
    );
    expect((await screen.findByRole("status")).textContent).toContain(
      "Comparison link copied.",
    );
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/gpu-compatibility?v=1&model=meta-llama-3-2-1b-instruct&ram=128`,
    );
    expect(window.location.search).toBe("");
  });

  it("shows a selectable manual link when clipboard and fallback copying fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
    render(<GpuCompatibility models={modelCatalog} gpus={gpuCatalog} />);
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "meta-llama-3-2-1b-instruct" },
    });
    fireEvent.change(screen.getByLabelText("System RAM (GiB)"), {
      target: { value: "128" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /compare catalog GPUs/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Copy comparison link" }),
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /select and copy the comparison link below/i,
    );
    expect(
      (screen.getByLabelText("Comparison link") as HTMLInputElement).value,
    ).toContain("model=meta-llama-3-2-1b-instruct");
  });
});
