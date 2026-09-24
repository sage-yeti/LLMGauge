import type { MetadataRoute } from "next";
import { gpuCatalog, modelCatalog } from "@/data/catalog";
import { guideCatalog } from "@/data/guides";
import { absoluteUrl } from "./site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    {
      url: absoluteUrl("/recommendations"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/guides"),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: absoluteUrl("/models"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/gpus"),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    ...modelCatalog.map((model) => ({
      url: absoluteUrl(`/models/${model.slug}`),
      lastModified: new Date(model.provenance.lastVerified),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...gpuCatalog.map((gpu) => ({
      url: absoluteUrl(`/gpus/${gpu.slug}`),
      lastModified: new Date(gpu.provenance.lastVerified),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...guideCatalog.map((guide) => ({
      url: absoluteUrl(`/guides/${guide.slug}`),
      lastModified: new Date(guide.lastReviewed),
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
  ];
}
