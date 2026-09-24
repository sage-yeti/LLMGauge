"use client";

import { useEffect, useRef, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "llmgauge-theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export const themeBootstrapScript = `(() => {
  const key = "llmgauge-theme";
  let preference = "system";
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === "system" || stored === "light" || stored === "dark") {
      preference = stored;
    }
  } catch {}
  const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = preference === "system"
    ? (systemIsDark ? "dark" : "light")
    : preference;
})();`;

export function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const preferenceRef = useRef<ThemePreference>("system");

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    const applyPreference = (next: ThemePreference) => {
      preferenceRef.current = next;
      document.documentElement.dataset.theme =
        next === "system" ? (media.matches ? "dark" : "light") : next;
    };

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Keep System usable when storage is unavailable.
    }
    const initial = isThemePreference(stored) ? stored : "system";
    setPreference(initial);
    applyPreference(initial);

    const updateSystemTheme = () => {
      if (preferenceRef.current === "system") applyPreference("system");
    };
    const syncStoredPreference = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const next = isThemePreference(event.newValue)
        ? event.newValue
        : "system";
      setPreference(next);
      applyPreference(next);
    };

    media.addEventListener("change", updateSystemTheme);
    window.addEventListener("storage", syncStoredPreference);
    return () => {
      media.removeEventListener("change", updateSystemTheme);
      window.removeEventListener("storage", syncStoredPreference);
    };
  }, []);

  function handleChange(next: ThemePreference) {
    setPreference(next);
    preferenceRef.current = next;
    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    document.documentElement.dataset.theme =
      next === "system" ? (media.matches ? "dark" : "light") : next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // The selected theme still applies for this page load.
    }
  }

  return (
    <div className="theme-control">
      <label htmlFor="theme-preference">Theme</label>
      <select
        id="theme-preference"
        value={preference}
        onChange={(event) =>
          handleChange(event.currentTarget.value as ThemePreference)
        }
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}
