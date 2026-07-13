import { z } from "zod";
import { browserFetchHtml } from "./browser-fetch";
import { isCloudflareChallengeBody } from "./cloudflare";
import type { FetchErrorCode, RedirectHop } from "./types";

export type { FetchErrorCode };

const PRIVATE_IPV4 = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
];

const urlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .transform((raw) => {
    let u = raw.trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return u;
  })
  .pipe(z.string().url("Invalid URL"));

export function normalizeAuditUrl(input: string): string {
  return urlSchema.parse(input);
}

function isPrivateIpv4(host: string): boolean {
  return PRIVATE_IPV4.some((re) => re.test(host));
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "[::1]" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd"))
    return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return isPrivateIpv4(h);
  return false;
}

export async function assertSafeUrl(url: string): Promise<URL> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Private or local network URLs are not allowed");
  }

  try {
    const { lookup } = await import("dns/promises");
    const results = await lookup(parsed.hostname, { all: true });
    for (const r of results) {
      if (isPrivateHost(r.address)) {
        throw new Error("URL resolves to a private network address");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("private")) throw e;
    // DNS lookup may fail for some hosts; hostname check still applies
  }

  return parsed;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxPerHour: number,
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 3600000 });
    return { allowed: true };
  }
  if (entry.count >= maxPerHour) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count += 1;
  return { allowed: true };
}

export class FetchError extends Error {
  readonly code: FetchErrorCode;
  readonly url: string;
  readonly detail?: string;

  constructor(code: FetchErrorCode, url: string, detail?: string) {
    super(detail ?? code);
    this.name = "FetchError";
    this.code = code;
    this.url = url;
    this.detail = detail;
  }
}

export function classifyFetchError(error: unknown, url: string): FetchError {
  if (error instanceof FetchError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const cause =
    error instanceof Error && error.cause != null ? String(error.cause) : "";
  const combined = `${message} ${cause}`.toLowerCase();

  if (message.includes("Too many redirects")) {
    return new FetchError("TOO_MANY_REDIRECTS", url, message);
  }
  if (
    combined.includes("abort") ||
    combined.includes("timeout") ||
    combined.includes("timed out")
  ) {
    return new FetchError("TIMEOUT", url, message);
  }
  if (
    combined.includes("enotfound") ||
    combined.includes("getaddrinfo") ||
    combined.includes("dns resolution")
  ) {
    return new FetchError("DNS_FAILED", url, message);
  }
  if (
    combined.includes("cert") ||
    combined.includes("tls") ||
    combined.includes("ssl") ||
    combined.includes("hostname") ||
    combined.includes("unable to verify")
  ) {
    return new FetchError("TLS_HOST_MISMATCH", url, message);
  }

  return new FetchError("NETWORK_ERROR", url, message);
}

export interface FetchTraceResult {
  response: Response;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: RedirectHop[];
  canonicalHeader?: string;
}

export interface ProbeResult {
  ok: boolean;
  url: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: RedirectHop[];
  error?: FetchErrorCode;
  errorDetail?: string;
}

function parseLinkCanonical(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?canonical"?/i);
    if (match) return match[1];
  }
  return undefined;
}

/** Browser-like UA so Cloudflare/WAF sites return the same HTML users see in a browser. */
const AUDIT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function auditFetchHeaders(init?: RequestInit["headers"]): Record<string, string> {
  return {
    "User-Agent": AUDIT_USER_AGENT,
    Accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "X-QLIQQI-Audit": "1.0 (+https://qliqqi.com)",
    ...(init as Record<string, string> | undefined),
  };
}

async function describeHttpFailure(status: number, response: Response): Promise<string> {
  if (status === 403) {
    try {
      const body = await response.text();
      if (isCloudflareChallengeBody(body)) {
        return "HTTP 403 — blocked by bot protection (Cloudflare challenge)";
      }
    } catch {
      // fall through
    }
    return "HTTP 403 — access forbidden (may block automated crawlers)";
  }
  return `HTTP ${status}`;
}

function syntheticHtmlResponse(
  url: string,
  html: string,
  status: number,
  init?: RequestInit,
): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}


export async function safeFetchWithTrace(
  url: string,
  init?: RequestInit & { maxRedirects?: number },
): Promise<FetchTraceResult> {
  const maxRedirects = init?.maxRedirects ?? 5;
  let current = url;
  let redirects = 0;
  const redirectChain: RedirectHop[] = [];

  while (redirects <= maxRedirects) {
    await assertSafeUrl(current);
    redirectChain.push({ url: current, status: 0 });

    let res: Response;
    try {
      res = await fetch(current, {
        ...init,
        redirect: "manual",
        headers: auditFetchHeaders(init?.headers),
      });
    } catch (error) {
      throw classifyFetchError(error, current);
    }

    redirectChain[redirectChain.length - 1].status = res.status;

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        return {
          response: res,
          requestedUrl: url,
          finalUrl: current,
          statusCode: res.status,
          redirectChain,
        };
      }
      current = new URL(loc, current).href;
      redirects += 1;
      continue;
    }

    if (res.status === 403) {
      const body = await res.text();
      if (isCloudflareChallengeBody(body)) {
        const fallback = await browserFetchHtml(current, init?.signal ?? undefined);
        if (fallback) {
          return {
            response: syntheticHtmlResponse(current, fallback.html, fallback.statusCode, init),
            requestedUrl: url,
            finalUrl: fallback.finalUrl,
            statusCode: fallback.statusCode,
            redirectChain,
            canonicalHeader: parseLinkCanonical(res.headers.get("link")),
          };
        }
      }

      return {
        response: syntheticHtmlResponse(current, body, res.status, init),
        requestedUrl: url,
        finalUrl: current,
        statusCode: res.status,
        redirectChain,
        canonicalHeader: parseLinkCanonical(res.headers.get("link")),
      };
    }

    return {
      response: res,
      requestedUrl: url,
      finalUrl: current,
      statusCode: res.status,
      redirectChain,
      canonicalHeader: parseLinkCanonical(res.headers.get("link")),
    };
  }

  throw new FetchError("TOO_MANY_REDIRECTS", url);
}

export async function probeUrl(
  url: string,
  signal?: AbortSignal,
): Promise<ProbeResult> {
  try {
    const trace = await safeFetchWithTrace(url, { signal });
    const status = trace.statusCode;

    if (status < 200 || status >= 400) {
      return {
        ok: false,
        url,
        finalUrl: trace.finalUrl,
        statusCode: status,
        redirectChain: trace.redirectChain,
        error: "HTTP_ERROR",
        errorDetail: await describeHttpFailure(status, trace.response),
      };
    }

    const contentType = trace.response.headers.get("content-type") ?? "";
    const html = await trace.response.text();
    const looksHtml =
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml") ||
      (!contentType && /<html/i.test(html));

    if (!looksHtml) {
      return {
        ok: false,
        url,
        finalUrl: trace.finalUrl,
        statusCode: status,
        redirectChain: trace.redirectChain,
        error: "HTTP_ERROR",
        errorDetail: "Response is not HTML",
      };
    }

    if (html.length < 500) {
      return {
        ok: false,
        url,
        finalUrl: trace.finalUrl,
        statusCode: status,
        redirectChain: trace.redirectChain,
        error: "HTTP_ERROR",
        errorDetail: `Body too small (${html.length} bytes)`,
      };
    }

    return {
      ok: true,
      url,
      finalUrl: trace.finalUrl,
      statusCode: status,
      redirectChain: trace.redirectChain,
    };
  } catch (error) {
    const fetchError = classifyFetchError(error, url);
    return {
      ok: false,
      url,
      finalUrl: url,
      statusCode: 0,
      redirectChain: [],
      error: fetchError.code,
      errorDetail: fetchError.detail ?? fetchError.message,
    };
  }
}

export async function safeFetch(
  url: string,
  init?: RequestInit & { maxRedirects?: number },
): Promise<Response> {
  const { response } = await safeFetchWithTrace(url, init);
  return response;
}
