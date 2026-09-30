import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SearchableCombobox,
  type SearchableOption,
} from "./searchable-combobox";

const options: SearchableOption[] = [
  {
    value: "gemma-4-12b",
    label: "Gemma 4 12B IT",
    searchText: "google gemma family 12b",
  },
  {
    value: "qwen-3-5-4b",
    label: "Qwen3.5 4B",
    searchText: "alibaba qwen family 4b",
  },
  {
    value: "rtx-4050-laptop",
    label: "GeForce RTX 4050 Laptop GPU 6GB",
    searchText: "nvidia ada 6 gib gddr6",
  },
];

function renderCombobox({
  value = "gemma-4-12b",
  onChange = vi.fn(),
}: {
  value?: string;
  onChange?: (value: string) => void;
} = {}) {
  render(
    <>
      <label htmlFor="test-selector">Catalog item</label>
      <SearchableCombobox
        id="test-selector"
        value={value}
        options={options}
        onChange={onChange}
        placeholder="Type to search…"
        emptyMessage="No catalog items match that search."
        required
      />
    </>,
  );
  return screen.getByRole("combobox", { name: "Catalog item" });
}

describe("searchable catalog combobox", () => {
  afterEach(cleanup);

  it("filters on useful identifiers and selects the matching stable value", () => {
    const onChange = vi.fn();
    const input = renderCombobox({ onChange });

    expect((input as HTMLInputElement).required).toBe(true);
    expect((input as HTMLInputElement).value).toBe("Gemma 4 12B IT");
    expect(input.getAttribute("aria-required")).toBe("true");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "NVIDIA 6GB" } });

    expect(
      screen.getByRole("option", { name: /GeForce RTX 4050 Laptop GPU 6GB/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Qwen3.5/ })).toBeNull();
    fireEvent.click(
      screen.getByRole("option", {
        name: /GeForce RTX 4050 Laptop GPU 6GB/,
      }),
    );

    expect(onChange).toHaveBeenCalledWith("rtx-4050-laptop");
  });

  it("supports typing, arrow navigation, Enter selection, and Escape", () => {
    const onChange = vi.fn();
    const input = renderCombobox({ onChange });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "family" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toContain("option-1");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("qwen-3-5-4b");

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("announces an empty result set without changing the selection", () => {
    const onChange = vi.fn();
    const input = renderCombobox({ onChange });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "not in the catalog" } });

    expect(screen.getByRole("status").textContent).toBe(
      "No catalog items match that search.",
    );
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });
});
