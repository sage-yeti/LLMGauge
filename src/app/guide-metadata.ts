import type { GuideDefinition } from "@/data/guides";

export function guidePageDescription(guide: GuideDefinition): string {
  return guide.description;
}
