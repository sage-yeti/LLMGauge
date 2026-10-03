import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GpuCompatibilityPage, { metadata } from "./page";
import { absoluteUrl } from "../site";

describe("GPU compatibility route", () => {
  afterEach(cleanup);
  it("sets canonical metadata and renders the focused comparison workflow", () => {
    expect(metadata.alternates?.canonical).toBe(absoluteUrl("/gpu-compatibility"));
    expect(metadata.openGraph?.url).toBe(absoluteUrl("/gpu-compatibility"));
    expect(metadata.title).toBe("Which GPUs Can Run This Model? | LLMGauge");
    render(<GpuCompatibilityPage />);
    expect(screen.getByRole("heading", { name: "Which GPUs can run this model?" })).toBeTruthy();
  });
});
