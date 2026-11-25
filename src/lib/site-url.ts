function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProto).origin;
  } catch {
    return null;
  }
}

/**
 * Resolves the canonical public application origin from the incoming HTTP request and environment variables.
 * Never returns a localhost URL in deployed production/preview environments when a public host is available.
 */
export function getAppUrl(request?: Request): string {
  const isProdRuntime = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      const host = forwardedHost.split(",")[0].trim();
      const candidate = normalizeOrigin(`${forwardedProto}://${host}`);
      if (candidate && (!isProdRuntime || !isLocalhostUrl(candidate))) {
        return candidate;
      }
    }

    const hostHeader = request.headers.get("host");
    if (hostHeader) {
      const proto = hostHeader.startsWith("localhost") || hostHeader.startsWith("127.0.0.1") ? "http" : "https";
      const candidate = normalizeOrigin(`${proto}://${hostHeader}`);
      if (candidate && (!isProdRuntime || !isLocalhostUrl(candidate))) {
        return candidate;
      }
    }

    try {
      const reqOrigin = new URL(request.url).origin;
      if (!isProdRuntime || !isLocalhostUrl(reqOrigin)) {
        return reqOrigin;
      }
    } catch {
      // ignore invalid request.url
    }
  }

  const envCandidates = [
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    normalizeOrigin(process.env.VERCEL_URL),
  ];

  for (const candidate of envCandidates) {
    if (!candidate) continue;
    if (isProdRuntime && isLocalhostUrl(candidate)) continue;
    return candidate;
  }

  return normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) || "http://localhost:3000";
}

/**
 * Browser-safe origin helper for Supabase auth email redirects (never falls back to localhost when on a deployed origin).
 */
export function getBrowserOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const envSite =
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  return envSite || "";
}
