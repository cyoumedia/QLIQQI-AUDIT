import * as cheerio from "cheerio";
import type { HreflangEntry, PageExtract, StructuredDataBlock } from "./types";
import { validateJsonLdBlock } from "./technical/schema-rules";

export interface ExtractMeta {
  statusCode?: number;
  finalUrl?: string;
  redirectChain?: { url: string; status: number }[];
  canonicalHeader?: string;
}

function extractCanonical(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  canonicalHeader?: string,
): {
  canonicalUrl?: string;
  canonicalSource: "html" | "header" | "both" | "none";
  canonicalErrors: string[];
  hasCanonical: boolean;
} {
  const htmlHrefs: string[] = [];
  $('link[rel="canonical"]').each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (href) htmlHrefs.push(href);
  });

  const canonicalErrors: string[] = [];
  if (htmlHrefs.length > 1) canonicalErrors.push("multiple");

  let htmlCanonical: string | undefined;
  if (htmlHrefs.length > 0) {
    try {
      htmlCanonical = new URL(htmlHrefs[0], pageUrl).href;
    } catch {
      canonicalErrors.push("invalid-html");
    }
  }

  let headerCanonical: string | undefined;
  if (canonicalHeader) {
    try {
      headerCanonical = new URL(canonicalHeader, pageUrl).href;
    } catch {
      canonicalErrors.push("invalid-header");
    }
  }

  let canonicalSource: "html" | "header" | "both" | "none" = "none";
  let canonicalUrl: string | undefined;

  if (htmlCanonical && headerCanonical) {
    canonicalSource = "both";
    canonicalUrl = htmlCanonical;
    if (htmlCanonical !== headerCanonical) {
      canonicalErrors.push("html-header-mismatch");
    }
  } else if (htmlCanonical) {
    canonicalSource = "html";
    canonicalUrl = htmlCanonical;
  } else if (headerCanonical) {
    canonicalSource = "header";
    canonicalUrl = headerCanonical;
  }

  return {
    canonicalUrl,
    canonicalSource,
    canonicalErrors,
    hasCanonical: !!canonicalUrl,
  };
}

function extractHreflang($: cheerio.CheerioAPI, pageUrl: string): HreflangEntry[] {
  const entries: HreflangEntry[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr("hreflang")?.trim();
    const href = $(el).attr("href")?.trim();
    if (!lang || !href) return;
    try {
      entries.push({ lang, url: new URL(href, pageUrl).href });
    } catch {
      // skip invalid
    }
  });
  return entries;
}

function extractStructuredData($: cheerio.CheerioAPI): StructuredDataBlock[] {
  const blocks: StructuredDataBlock[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() ?? "";
    const result = validateJsonLdBlock(raw);
    blocks.push({
      format: "json-ld",
      types: result.types,
      valid: result.valid,
      errors: result.errors,
    });
  });

  $("[itemtype]").each((_, el) => {
    const itemtype = $(el).attr("itemtype")?.trim();
    if (!itemtype) return;
    const typeName = itemtype.split("/").pop() ?? itemtype;
    blocks.push({
      format: "microdata",
      types: [typeName],
      valid: true,
      errors: [],
    });
  });

  return blocks;
}

export function extractPage(url: string, html: string, meta?: ExtractMeta): PageExtract {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean);
  const htmlLength = html.length;
  const textLength = text.length;

  const h1: string[] = [];
  $("h1").each((_, el) => {
    h1.push($(el).text().trim());
  });

  const headings: string[] = [];
  $("h1,h2,h3").each((_, el) => {
    headings.push(String($(el).prop("tagName")) + ": " + $(el).text().trim());
  });

  const images: { src: string; alt: string }[] = [];
  $("img").each((_, el) => {
    images.push({ src: $(el).attr("src") ?? "", alt: $(el).attr("alt") ?? "" });
  });

  const structuredData = extractStructuredData($);
  const jsonLdTypes = [
    ...new Set(structuredData.flatMap((b) => b.types)),
  ];

  const canonical = extractCanonical($, url, meta?.canonicalHeader);

  const landmarks: string[] = [];
  ["header", "nav", "main", "footer", "article", "section"].forEach((tag) => {
    if ($(tag).length) landmarks.push(tag);
  });

  const blocked = htmlLength < 200 || ($("body").children().length === 0 && textLength < 50);
  const thin = words.length < 200;

  return {
    url,
    html,
    title: $("title").first().text().trim(),
    description: $('meta[name="description"]').attr("content")?.trim() ?? "",
    h1,
    headings: headings.slice(0, 20),
    internalLinks: [],
    images,
    jsonLdTypes,
    structuredData,
    hasViewport: !!$('meta[name="viewport"]').attr("content"),
    hasCanonical: canonical.hasCanonical,
    canonicalUrl: canonical.canonicalUrl,
    canonicalSource: canonical.canonicalSource,
    canonicalErrors: canonical.canonicalErrors.length ? canonical.canonicalErrors : undefined,
    hreflang: extractHreflang($, url),
    statusCode: meta?.statusCode ?? 0,
    finalUrl: meta?.finalUrl ?? url,
    redirectChain: meta?.redirectChain ?? [],
    hasOg: !!$('meta[property="og:title"]').attr("content"),
    wordCount: words.length,
    textLength,
    htmlLength,
    landmarks,
    thin,
    blocked,
    incomingLinks: 0,
  };
}

export function extractInternalLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const origin = new URL(pageUrl).origin;
  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:"))
      return;
    try {
      const abs = new URL(href, pageUrl).href;
      if (new URL(abs).origin === origin) links.add(abs.split("#")[0]);
    } catch {
      // skip
    }
  });
  return [...links];
}
