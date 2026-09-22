import type { MetadataRoute } from "next";
import { gpuCatalog, modelCatalog } from "@/data/catalog";
import { absoluteUrl } from "./site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    {
      url: absoluteUrl("/recommendations"),
      changeFrequency: "monthly",
      priority: 0.9,
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
  ];
}
