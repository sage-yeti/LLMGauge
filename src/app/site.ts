const localDevelopmentUrl = "http://localhost:3000";

/**
 * Resolve the canonical site origin. Development and tests may use the local
 * fallback, but production builds must be given the real HTTPS origin.
 */
export function getSiteUrl(
  value = process.env.NEXT_PUBLIC_SITE_URL,
  environment = process.env.NODE_ENV,
): URL {
  const configuredSiteUrl = value?.trim();
  if (!configuredSiteUrl) {
    if (environment === "production") {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL is required for production builds and must be the public HTTPS origin.",
      );
    }
    return new URL(localDevelopmentUrl);
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredSiteUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use http or https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("NEXT_PUBLIC_SITE_URL must not contain credentials.");
  }
  if (environment === "production" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }

  // Canonicals and sitemap entries represent the origin, not an arbitrary
  // path supplied through configuration.
  return new URL(parsed.origin);
}

export const siteUrl = getSiteUrl();

export function absoluteUrl(path: string, origin: URL = siteUrl): string {
  return new URL(path, origin).toString();
}
