import { Recommendations } from "./recommendations";
import { gpuCatalog, modelCatalog } from "@/data/catalog";

export default function RecommendationsPage() {
  return <Recommendations models={modelCatalog} gpus={gpuCatalog} />;
}
