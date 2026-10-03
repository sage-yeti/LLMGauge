import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareLinkPanel } from "./share-link-panel";

describe("share link clipboard fallback", () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: undefined,
    });
  });

  it("uses the accessible document copy fallback when Clipboard API is absent", async () => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => true),
    });
    render(
      <ShareLinkPanel
        title="Share result"
        buttonLabel="Copy link"
        path="/?v=1"
        disclosure="Anyone with this link can see its settings."
      />,
    );
    expect(screen.getByText(/anyone with this link can see/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Link copied.",
    );
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });
});
