import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("not-found page", () => {
  afterEach(cleanup);

  it("offers clear paths back into LLMGauge", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { name: "This page isn’t in the catalog." }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Check a model" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen
        .getByRole("link", { name: "Find models for your PC" })
        .getAttribute("href"),
    ).toBe("/recommendations");
    expect(
      screen.getByRole("link", { name: "Browse models" }).getAttribute("href"),
    ).toBe("/models");
    expect(
      screen.getByRole("link", { name: "Browse GPUs" }).getAttribute("href"),
    ).toBe("/gpus");
  });
});
