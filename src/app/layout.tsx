import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LLMGauge", template: "%s · LLMGauge" },
  description: "A foundation for evaluating local LLM compatibility.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
