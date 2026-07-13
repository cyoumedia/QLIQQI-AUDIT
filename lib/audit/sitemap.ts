import { XMLParser } from "fast-xml-parser";
import { safeFetch } from "./security";

const NON_HTML_EXT = /\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|gz|mp4|mp3|doc|docx|xls|xlsx|css|js|json|xml)$/i;

export function isHtmlUrl(url: string): boolean {
  try {
    const p = new URL(url).pathname.toLowerCase();
    if (NON_HTML_EXT.test(p)) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "") || "/";
    u.pathname = path;
    return u.href;
  } catch {
    return url;
  }
}

export interface SitemapDiscoveryResult {
  urls: string[];
  present: boolean;
  skippedOffOrigin: number;
  offOriginDomains: string[];
}

function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

export async function discoverSitemapUrls(
  origin: string,
  seedUrl: string,
  maxDepth: number,
  disallowedPaths: string[],
  signal?: AbortSignal,
): Promise<SitemapDiscoveryResult> {
  const seen = new Set<string>();
  const urls = new Set<string>();
  let skippedOffOrigin = 0;
  const offOriginDomainSet = new Set<string>();

  function trackOffOrigin(loc: string) {
    skippedOffOrigin += 1;
    try {
      offOriginDomainSet.add(new URL(loc).hostname);
    } catch {
      // skip invalid URL
    }
  }

  async function parseSitemap(sitemapUrl: string, depth: number) {
    if (depth > maxDepth || seen.has(sitemapUrl)) return;
    if (!isSameOrigin(sitemapUrl, origin)) {
      trackOffOrigin(sitemapUrl);
      return;
    }
    seen.add(sitemapUrl);

    try {
      const res = await safeFetch(sitemapUrl, { signal });
      if (!res.ok) return;
      const xml = await res.text();
      const parser = new XMLParser({ ignoreAttributes: false });
      const doc = parser.parse(xml);

      const urlset = doc.urlset?.url;
      if (urlset) {
        const entries = Array.isArray(urlset) ? urlset : [urlset];
        for (const entry of entries) {
          const loc = entry?.loc;
          if (typeof loc !== "string" || !isHtmlUrl(loc)) continue;
          if (!isSameOrigin(loc, origin)) {
            trackOffOrigin(loc);
            continue;
          }
          const norm = normalizeUrl(loc);
          const path = new URL(norm).pathname;
          if (!disallowedPaths.some((d) => path.startsWith(d))) urls.add(norm);
        }
        return;
      }

      const indexes = doc.sitemapindex?.sitemap;
      if (indexes) {
        const entries = Array.isArray(indexes) ? indexes : [indexes];
        for (const entry of entries) {
          const loc = entry?.loc;
          if (typeof loc !== "string") continue;
          if (!isSameOrigin(loc, origin)) {
            trackOffOrigin(loc);
            continue;
          }
          await parseSitemap(loc, depth + 1);
        }
      }
    } catch {
      // skip failed sitemap
    }
  }

  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];

  let present = false;
  for (const c of candidates) {
    try {
      const head = await safeFetch(c, { method: "GET", signal });
      if (head.ok) {
        present = true;
        await parseSitemap(c, 0);
        break;
      }
    } catch {
      // try next
    }
  }

  const offOriginDomains = [...offOriginDomainSet].sort();

  if (urls.size === 0) {
    urls.add(normalizeUrl(seedUrl));
    return {
      urls: [...urls],
      present,
      skippedOffOrigin,
      offOriginDomains,
    };
  }

  return {
    urls: [...urls],
    present,
    skippedOffOrigin,
    offOriginDomains,
  };
}
