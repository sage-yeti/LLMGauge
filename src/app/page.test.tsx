import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "./page";
import { SiteNavigation } from "./site-header";

describe("homepage orientation", () => {
  afterEach(cleanup);

  it("explains both workflows and links to recommendations and guides", () => {
    render(
      <>
        <SiteNavigation />
        <HomePage />
      </>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Can your computer run this local LLM?",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "Choose the question you want to answer",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/CPU, system RAM, GPU/i)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "What can my PC run?" })
        .getAttribute("href"),
    ).toBe("/recommendations");
    expect(
      screen.getByRole("link", { name: "Compare GPUs" }).getAttribute("href"),
    ).toBe("/gpu-compatibility");
    expect(
      screen
        .getByRole("link", { name: "Which GPUs can run this model?" })
        .getAttribute("href"),
    ).toBe("/gpu-compatibility");
    expect(
      screen
        .getByRole("link", { name: "Learn the basics" })
        .getAttribute("href"),
    ).toBe("/guides");
    expect(
      screen.getByRole("link", { name: "Models" }).getAttribute("href"),
    ).toBe("/models");
    expect(
      screen.getByRole("link", { name: "GPUs" }).getAttribute("href"),
    ).toBe("/gpus");
  });
});
