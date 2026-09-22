import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "./page";

describe("homepage orientation", () => {
  afterEach(cleanup);

  it("explains both workflows and links to recommendations and guides", () => {
    render(<HomePage />);

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
      screen
        .getByRole("link", { name: "Learn the basics" })
        .getAttribute("href"),
    ).toBe("/guides");
  });
});
