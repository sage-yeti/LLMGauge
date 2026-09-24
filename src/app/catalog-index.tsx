"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GpuDefinition, ModelDefinition } from "@/domain/types";

function formatGiB(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)} GiB`;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function resultMessage(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"} found.`;
}

export function ModelCatalogIndex({
  models,
}: {
  models: readonly ModelDefinition[];
}) {
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("");
  const [format, setFormat] = useState("");
  const [sort, setSort] = useState("name");
  const families = uniqueSorted(models.map((model) => model.family));
  const formats = uniqueSorted(
    models.flatMap((model) => model.supportedFormats),
  );
  const visibleModels = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return models
      .filter((model) => {
        const matchesSearch =
          !query ||
          [
            model.displayName,
            model.provider,
            model.family,
            model.architecture,
            ...model.supportedFormats,
          ].some((value) => value.toLocaleLowerCase().includes(query));
        return (
          matchesSearch &&
          (!family || model.family === family) &&
          (!format ||
            model.supportedFormats.some(
              (supportedFormat) => supportedFormat === format,
            ))
        );
      })
      .sort((a, b) => {
        if (sort === "parameters-asc") {
          return (
            a.parameterCountBillions - b.parameterCountBillions ||
            a.displayName.localeCompare(b.displayName) ||
            a.slug.localeCompare(b.slug)
          );
        }
        if (sort === "parameters-desc") {
          return (
            b.parameterCountBillions - a.parameterCountBillions ||
            a.displayName.localeCompare(b.displayName) ||
            a.slug.localeCompare(b.slug)
          );
        }
        return (
          a.displayName.localeCompare(b.displayName) ||
          a.slug.localeCompare(b.slug)
        );
      });
  }, [family, format, models, search, sort]);
  const hasActiveFilters = Boolean(
    search || family || format || sort !== "name",
  );

  function resetFilters() {
    setSearch("");
    setFamily("");
    setFormat("");
    setSort("name");
  }

  return (
    <main className="shell public-page">
      <nav className="page-nav" aria-label="Catalog navigation">
        <Link href="/">Calculator</Link>
        <Link href="/recommendations">Recommendations</Link>
        <Link href="/gpus">GPU catalog</Link>
        <Link href="/guides">Guides</Link>
      </nav>
      <header className="catalog-hero">
        <p className="eyebrow">Curated model catalog</p>
        <h1>Browse local language models</h1>
        <p className="lede">
          Compare cataloged model families, parameter sizes, and recorded
          formats. Open a model for its quantization candidates, sources, and
          compatibility notes.
        </p>
      </header>
      <section className="catalog-browser" aria-label="Find models">
        <div className="catalog-browser-controls">
          <div className="catalog-browser-field">
            <label htmlFor="model-search">Search models</label>
            <input
              id="model-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Name, provider, family, architecture"
              aria-controls="model-results"
            />
          </div>
          <div className="catalog-browser-field">
            <label htmlFor="model-family">Family</label>
            <select
              id="model-family"
              value={family}
              onChange={(event) => setFamily(event.currentTarget.value)}
              aria-controls="model-results"
            >
              <option value="">All families</option>
              {families.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="catalog-browser-field">
            <label htmlFor="model-format">Format</label>
            <select
              id="model-format"
              value={format}
              onChange={(event) => setFormat(event.currentTarget.value)}
              aria-controls="model-results"
            >
              <option value="">All formats</option>
              {formats.map((value) => (
                <option key={value} value={value}>
                  {value.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="catalog-browser-field">
            <label htmlFor="model-sort">Sort models</label>
            <select
              id="model-sort"
              value={sort}
              onChange={(event) => setSort(event.currentTarget.value)}
              aria-controls="model-results"
            >
              <option value="name">Name (A–Z)</option>
              <option value="parameters-asc">
                Parameter count (low to high)
              </option>
              <option value="parameters-desc">
                Parameter count (high to low)
              </option>
            </select>
          </div>
        </div>
        <div className="catalog-browser-status">
          <p role="status" aria-live="polite">
            {resultMessage(visibleModels.length, "model")}
          </p>
          <button
            type="button"
            className="catalog-reset"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            Reset filters
          </button>
        </div>
      </section>
      <section
        id="model-results"
        className="catalog-index-grid"
        aria-label="Models"
      >
        {visibleModels.length ? (
          visibleModels.map((model) => (
            <article className="catalog-index-card" key={model.slug}>
              <h2>
                <Link href={`/models/${model.slug}`}>{model.displayName}</Link>
              </h2>
              <p>{model.summary}</p>
              <dl className="catalog-index-facts">
                <div>
                  <dt>Provider</dt>
                  <dd>{model.provider}</dd>
                </div>
                <div>
                  <dt>Family</dt>
                  <dd>{model.family}</dd>
                </div>
                <div>
                  <dt>Parameters</dt>
                  <dd>{model.parameterCountBillions}B</dd>
                </div>
                <div>
                  <dt>Formats</dt>
                  <dd>{model.supportedFormats.join(", ") || "Not recorded"}</dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <p className="catalog-index-empty">
            {models.length
              ? "No models match these filters."
              : "No models are currently listed."}
            {models.length > 0 && hasActiveFilters && (
              <>
                {" "}
                <button
                  type="button"
                  className="catalog-inline-reset"
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              </>
            )}
          </p>
        )}
      </section>
    </main>
  );
}

export function GpuCatalogIndex({ gpus }: { gpus: readonly GpuDefinition[] }) {
  const [search, setSearch] = useState("");
  const [vendor, setVendor] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("name");
  const vendors = uniqueSorted(gpus.map((gpu) => gpu.vendor));
  const visibleGpus = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return gpus
      .filter((gpu) => {
        const matchesSearch =
          !query ||
          [
            gpu.displayName,
            gpu.vendor,
            gpu.architecture ?? "",
            gpu.memoryType ?? "",
            gpu.kind,
          ].some((value) => value.toLocaleLowerCase().includes(query));
        return (
          matchesSearch &&
          (!vendor || gpu.vendor === vendor) &&
          (!kind || gpu.kind === kind)
        );
      })
      .sort((a, b) => {
        if (sort === "memory-asc") {
          return (
            a.vramGiB - b.vramGiB ||
            a.displayName.localeCompare(b.displayName) ||
            a.slug.localeCompare(b.slug)
          );
        }
        if (sort === "memory-desc") {
          return (
            b.vramGiB - a.vramGiB ||
            a.displayName.localeCompare(b.displayName) ||
            a.slug.localeCompare(b.slug)
          );
        }
        return (
          a.displayName.localeCompare(b.displayName) ||
          a.slug.localeCompare(b.slug)
        );
      });
  }, [gpus, kind, search, sort, vendor]);
  const hasActiveFilters = Boolean(search || vendor || kind || sort !== "name");

  function resetFilters() {
    setSearch("");
    setVendor("");
    setKind("");
    setSort("name");
  }

  return (
    <main className="shell public-page">
      <nav className="page-nav" aria-label="Catalog navigation">
        <Link href="/">Calculator</Link>
        <Link href="/recommendations">Recommendations</Link>
        <Link href="/models">Model catalog</Link>
        <Link href="/guides">Guides</Link>
      </nav>
      <header className="catalog-hero">
        <p className="eyebrow">Curated GPU catalog</p>
        <h1>Browse graphics hardware</h1>
        <p className="lede">
          Compare the catalog’s dedicated memory capacities and documented
          hardware details. Open a GPU for its source and planning notes.
        </p>
      </header>
      <section className="catalog-browser" aria-label="Find GPUs">
        <div className="catalog-browser-controls">
          <div className="catalog-browser-field">
            <label htmlFor="gpu-search">Search GPUs</label>
            <input
              id="gpu-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Name, vendor, architecture, memory"
              aria-controls="gpu-results"
            />
          </div>
          <div className="catalog-browser-field">
            <label htmlFor="gpu-vendor">Vendor</label>
            <select
              id="gpu-vendor"
              value={vendor}
              onChange={(event) => setVendor(event.currentTarget.value)}
              aria-controls="gpu-results"
            >
              <option value="">All vendors</option>
              {vendors.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="catalog-browser-field">
            <label htmlFor="gpu-kind">GPU type</label>
            <select
              id="gpu-kind"
              value={kind}
              onChange={(event) => setKind(event.currentTarget.value)}
              aria-controls="gpu-results"
            >
              <option value="">All types</option>
              <option value="discrete">Discrete</option>
              <option value="integrated">Integrated</option>
            </select>
          </div>
          <div className="catalog-browser-field">
            <label htmlFor="gpu-sort">Sort GPUs</label>
            <select
              id="gpu-sort"
              value={sort}
              onChange={(event) => setSort(event.currentTarget.value)}
              aria-controls="gpu-results"
            >
              <option value="name">Name (A–Z)</option>
              <option value="memory-asc">Dedicated memory (low to high)</option>
              <option value="memory-desc">
                Dedicated memory (high to low)
              </option>
            </select>
          </div>
        </div>
        <div className="catalog-browser-status">
          <p role="status" aria-live="polite">
            {resultMessage(visibleGpus.length, "GPU")}
          </p>
          <button
            type="button"
            className="catalog-reset"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            Reset filters
          </button>
        </div>
      </section>
      <section
        id="gpu-results"
        className="catalog-index-grid"
        aria-label="Graphics hardware"
      >
        {visibleGpus.length ? (
          visibleGpus.map((gpu) => (
            <article className="catalog-index-card" key={gpu.slug}>
              <h2>
                <Link href={`/gpus/${gpu.slug}`}>{gpu.displayName}</Link>
              </h2>
              <p>{gpu.suitabilitySummary}</p>
              <dl className="catalog-index-facts">
                <div>
                  <dt>Vendor</dt>
                  <dd>{gpu.vendor}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>
                    {gpu.kind === "integrated" ? "Integrated" : "Discrete"}
                  </dd>
                </div>
                <div>
                  <dt>Dedicated VRAM</dt>
                  <dd>
                    {gpu.kind === "integrated"
                      ? "0 GiB (integrated)"
                      : formatGiB(gpu.vramGiB)}
                  </dd>
                </div>
                {gpu.memoryType && (
                  <div>
                    <dt>Memory type</dt>
                    <dd>{gpu.memoryType}</dd>
                  </div>
                )}
                {gpu.architecture && (
                  <div>
                    <dt>Architecture</dt>
                    <dd>{gpu.architecture}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))
        ) : (
          <p className="catalog-index-empty">
            {gpus.length
              ? "No GPUs match these filters."
              : "No GPUs are currently listed."}
            {gpus.length > 0 && hasActiveFilters && (
              <>
                {" "}
                <button
                  type="button"
                  className="catalog-inline-reset"
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              </>
            )}
          </p>
        )}
      </section>
    </main>
  );
}
