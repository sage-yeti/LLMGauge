import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { absoluteUrl, getSiteUrl } from "./site";

describe("production configuration", () => {
  it("uses localhost only outside production", () => {
    expect(getSiteUrl(undefined, "development").origin).toBe(
      "http://localhost:3000",
    );
    expect(() => getSiteUrl(undefined, "production")).toThrow(
      "NEXT_PUBLIC_SITE_URL is required",
    );
  });

  it("requires a valid HTTPS production origin and normalizes its path", () => {
    expect(
      getSiteUrl("https://llmgauge.example/catalog/", "production").toString(),
    ).toBe("https://llmgauge.example/");
    expect(() => getSiteUrl("not-a-url", "production")).toThrow(
      "valid absolute URL",
    );
    expect(() => getSiteUrl("http://llmgauge.example", "production")).toThrow(
      "HTTPS in production",
    );
    expect(() =>
      getSiteUrl("https://user:pass@example.com", "production"),
    ).toThrow("must not contain credentials");
  });

  it("uses the configured origin for canonical URLs", () => {
    const configured = getSiteUrl(
      "https://llmgauge.example/base",
      "production",
    );
    expect(absoluteUrl("/sitemap.xml", configured)).toBe(
      "https://llmgauge.example/sitemap.xml",
    );
  });

  it("declares conservative security headers", async () => {
    const headers = await nextConfig.headers?.();
    const values = Object.fromEntries(
      headers?.[0]?.headers?.map((header) => [header.key, header.value]) ?? [],
    );
    expect(values).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "X-Frame-Options": "DENY",
    });
  });
});
