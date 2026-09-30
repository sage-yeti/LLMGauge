"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

export interface SearchableOption {
  value: string;
  label: string;
  searchText?: string;
}

interface SearchableComboboxProps {
  id: string;
  value: string;
  options: readonly SearchableOption[];
  onChange: (value: string) => void;
  placeholder: string;
  emptyMessage: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

export function SearchableCombobox({
  id,
  value,
  options,
  onChange,
  placeholder,
  emptyMessage,
  required = false,
  invalid = false,
  describedBy,
}: SearchableComboboxProps) {
  const generatedId = useId();
  const listboxId = `${id}-${generatedId}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeOptionRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const needles = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (needles.length === 0) return options;
    return options.filter((option) => {
      const haystack =
        `${option.label} ${option.searchText ?? ""}`.toLowerCase();
      return needles.every((needle) => haystack.includes(needle));
    });
  }, [options, query]);

  useEffect(() => {
    if (typeof activeOptionRef.current?.scrollIntoView === "function")
      activeOptionRef.current.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, query]);

  function openList() {
    setQuery("");
    setActiveIndex(options.findIndex((option) => option.value === value));
    setOpen(true);
  }

  function choose(option: SearchableOption) {
    onChange(option.value);
    setQuery("");
    setActiveIndex(-1);
    setOpen(false);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setActiveIndex(-1);
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((current) =>
        current < 0 ? 0 : Math.min(current + 1, filteredOptions.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((current) =>
        current < 0 ? filteredOptions.length - 1 : Math.max(current - 1, 0),
      );
    } else if (event.key === "Home" && open && filteredOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && open && filteredOptions.length > 0) {
      event.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const activeOption = filteredOptions[activeIndex];
      const soleOption =
        filteredOptions.length === 1 ? filteredOptions[0] : undefined;
      if (activeOption ?? soleOption) choose(activeOption ?? soleOption!);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setQuery("");
      setActiveIndex(-1);
      setOpen(false);
    }
  }

  const activeOptionId =
    open && activeIndex >= 0 && filteredOptions[activeIndex]
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  return (
    <div className="searchable-combobox">
      <input
        id={id}
        className="searchable-combobox-input"
        type="text"
        role="combobox"
        value={open ? query : (selectedOption?.label ?? "")}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        aria-required={required || undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        required={required}
        onFocus={openList}
        onClick={() => {
          if (!open) openList();
        }}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setQuery("");
          setActiveIndex(-1);
          setOpen(false);
        }}
      />
      {open && (
        <>
          <div
            className="searchable-combobox-listbox"
            id={listboxId}
            role="listbox"
            aria-label={`${id} options`}
          >
            {filteredOptions.map((option, index) => (
              <div
                className="searchable-combobox-option"
                id={`${listboxId}-option-${index}`}
                key={option.value}
                role="option"
                ref={index === activeIndex ? activeOptionRef : undefined}
                aria-selected={option.value === value}
                data-active={index === activeIndex || undefined}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <span className="searchable-combobox-selected">Selected</span>
                )}
              </div>
            ))}
          </div>
          {filteredOptions.length === 0 && (
            <p className="searchable-combobox-empty" role="status">
              {emptyMessage}
            </p>
          )}
        </>
      )}
    </div>
  );
}
