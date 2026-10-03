import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GpuCompatibilityPage, { metadata } from "./page";
import sitemap from "../sitemap";
import { absoluteUrl } from "../site";

describe("GPU compatibility route", () => {
  afterEach(cleanup);

  it("sets canonical metadata and renders the focused comparison workflow", () => {
    expect(metadata.alternates?.canonical).toBe(
      absoluteUrl("/gpu-compatibility"),
    );
    expect(metadata.openGraph?.url).toBe(absoluteUrl("/gpu-compatibility"));
    expect(metadata.title).toBe("Which GPUs Can Run This Model? | LLMGauge");
    expect(
      sitemap().some(
        (entry) => entry.url === absoluteUrl("/gpu-compatibility"),
      ),
    ).toBe(true);
    expect(sitemap().every((entry) => !entry.url.includes("?"))).toBe(true);
    render(<GpuCompatibilityPage />);
    expect(
      screen.getByRole("heading", {
        name: "Which GPUs can run this model?",
      }),
    ).toBeTruthy();
  });
});
