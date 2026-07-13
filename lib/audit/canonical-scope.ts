export type CrawlScopeMode = "requested-origin" | "url-variant" | "canonical-primary";

export interface CanonicalPromotionDecision {
  promote: boolean;
  primarySeedUrl?: string;
  primaryDomain?: string;
  reason?: string;
}

/** Strip www. for hostname comparison (does not collapse apex ↔ www). */
export function normalizeScopeHostname(hostname: string): string {
  const h = hostname.toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

export function scopeHostnamesMatch(a: string, b: string): boolean {
  return normalizeScopeHostname(a) === normalizeScopeHostname(b);
}

function canonicalOrigin(canonicalUrl: string, pageUrl: string): string | undefined {
  try {
    return new URL(canonicalUrl, pageUrl).origin;
  } catch {
    return undefined;
  }
}

function primarySeedUrlFrom(canonicalOriginUrl: string): string {
  return canonicalOriginUrl.endsWith("/") ? canonicalOriginUrl : `${canonicalOriginUrl}/`;
}

function buildPromotion(
  primaryDomain: string,
  primarySeedUrl: string,
  reason?: string,
): CanonicalPromotionDecision {
  return {
    promote: true,
    primarySeedUrl,
    primaryDomain,
    reason:
      reason ??
      `Staging URL declares canonical primary domain ${primaryDomain}; crawled production site instead of requested origin.`,
  };
}

/**
 * Decide whether to re-root the crawl to a declared canonical primary domain.
 * Used when the requested origin looks like a thin staging mirror.
 */
export function evaluateCanonicalPromotion(params: {
  requestedOrigin: string;
  seedCanonicalUrl?: string;
  sameOriginSitemapCount: number;
  sitemapSkippedOffOrigin: number;
  offOriginDomains: string[];
  seedInternalLinkCount: number;
  /** Staging shells with this many same-origin nav links are crawled locally instead. */
  minInternalLinksToSkipPromotion?: number;
}): CanonicalPromotionDecision {
  const minLinks = params.minInternalLinksToSkipPromotion ?? 3;

  if (params.sameOriginSitemapCount > 1) {
    return { promote: false };
  }
  if (params.seedInternalLinkCount >= minLinks) {
    return { promote: false };
  }
  if (!params.seedCanonicalUrl) {
    return { promote: false };
  }

  const canonicalOriginUrl = canonicalOrigin(params.seedCanonicalUrl, params.requestedOrigin);
  if (!canonicalOriginUrl || canonicalOriginUrl === params.requestedOrigin) {
    return { promote: false };
  }

  let canonicalHost: string;
  try {
    canonicalHost = new URL(canonicalOriginUrl).hostname;
  } catch {
    return { promote: false };
  }

  let requestedHost: string;
  try {
    requestedHost = new URL(params.requestedOrigin).hostname;
  } catch {
    return { promote: false };
  }

  if (scopeHostnamesMatch(canonicalHost, requestedHost)) {
    return { promote: false };
  }

  const primarySeedUrl = primarySeedUrlFrom(canonicalOriginUrl);

  // Sitemap lists a single off-origin domain matching the seed canonical
  if (
    params.sitemapSkippedOffOrigin > 0 &&
    params.offOriginDomains.length === 1 &&
    scopeHostnamesMatch(canonicalHost, params.offOriginDomains[0])
  ) {
    return buildPromotion(params.offOriginDomains[0], primarySeedUrl);
  }

  // Thin site with canonical pointing at production (no mixed sitemap required)
  if (params.sameOriginSitemapCount <= 1) {
    return buildPromotion(
      canonicalHost,
      primarySeedUrl,
      `Seed page declares canonical primary domain ${canonicalHost}; crawled production site instead of requested origin.`,
    );
  }

  return { promote: false };
}
