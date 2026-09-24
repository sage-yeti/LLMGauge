import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";
import { ThemeControl, themeBootstrapScript } from "./theme-control";

type MockMediaQueryList = MediaQueryList & {
  setMatches: (matches: boolean) => void;
};

let systemPreference: MockMediaQueryList;

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  systemPreference = {
    media: "(prefers-color-scheme: dark)",
    get matches() {
      return matches;
    },
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((type, listener) => {
      if (type === "change")
        listeners.add(listener as (event: MediaQueryListEvent) => void);
    }),
    removeEventListener: vi.fn((type, listener) => {
      if (type === "change")
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
    }),
    dispatchEvent: vi.fn(() => true),
    setMatches(next: boolean) {
      matches = next;
      const event = { matches, media: this.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => systemPreference),
  );
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => systemPreference),
  });
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  installMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("site theme preference", () => {
  it("defaults to System and updates with the operating system while open", () => {
    render(<ThemeControl />);
    expect(
      (screen.getByRole("combobox", { name: "Theme" }) as HTMLSelectElement)
        .value,
    ).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => systemPreference.setMatches(true));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("applies and persists an explicit override despite system changes", () => {
    render(<ThemeControl />);
    fireEvent.change(screen.getByRole("combobox", { name: "Theme" }), {
      target: { value: "dark" },
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("llmgauge-theme")).toBe("dark");

    act(() => systemPreference.setMatches(false));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("restores a saved choice and persists System selection", () => {
    window.localStorage.setItem("llmgauge-theme", "light");
    const { unmount } = render(<ThemeControl />);
    expect(
      (screen.getByRole("combobox", { name: "Theme" }) as HTMLSelectElement)
        .value,
    ).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    unmount();

    render(<ThemeControl />);
    fireEvent.change(screen.getByRole("combobox", { name: "Theme" }), {
      target: { value: "system" },
    });
    expect(window.localStorage.getItem("llmgauge-theme")).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("light");
    act(() => systemPreference.setMatches(true));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("runs a pre-hydration bootstrap to set the saved or system theme", () => {
    window.localStorage.setItem("llmgauge-theme", "dark");
    expect(themeBootstrapScript).toContain('const key = "llmgauge-theme"');
    new Function(themeBootstrapScript)();
    expect(document.documentElement.dataset.theme).toBe("dark");

    window.localStorage.removeItem("llmgauge-theme");
    systemPreference.setMatches(true);
    new Function(themeBootstrapScript)();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("emits the bootstrap synchronously in the document head before the body", () => {
    const markup = renderToStaticMarkup(
      RootLayout({ children: <main>Page content</main> }),
    );
    const bootstrapPosition = markup.indexOf(themeBootstrapScript);
    const bodyPosition = markup.indexOf("<body>");
    expect(bootstrapPosition).toBeGreaterThanOrEqual(0);
    expect(bodyPosition).toBeGreaterThan(bootstrapPosition);
  });

  it("provides an accessible, keyboard-focusable native theme control", () => {
    render(<ThemeControl />);
    const control = screen.getByRole("combobox", { name: "Theme" });
    expect(control.querySelectorAll("option")).toHaveLength(3);
    control.focus();
    expect(document.activeElement).toBe(control);
  });
});
