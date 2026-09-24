import type { Metadata } from "next";
import "./globals.css";
import { siteUrl } from "./site";
import { ThemeControl, themeBootstrapScript } from "./theme-control";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: "LLMGauge", template: "%s · LLMGauge" },
  description: "A foundation for evaluating local LLM compatibility.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <ThemeControl />
        {children}
      </body>
    </html>
  );
}
