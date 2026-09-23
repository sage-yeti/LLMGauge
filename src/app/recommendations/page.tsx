import type { Metadata } from "next";
import RecommendationsPage from "../recommendations-page";
import { absoluteUrl } from "../site";

export const metadata: Metadata = {
  title: "What Can My PC Run?",
  description:
    "Find local language models that fit your computer's approximate memory limits.",
  alternates: { canonical: absoluteUrl("/recommendations") },
  openGraph: { url: absoluteUrl("/recommendations") },
};

export default RecommendationsPage;
