import { normalizeAuditUrl, probeUrl, type FetchErrorCode } from "./security";

export interface UrlResolution {
  requestedUrl: string;
  effectiveUrl: string;
  effectiveOrigin: string;
  /** False when every probe candidate failed */
  resolved: boolean;
  note?: string;
  candidatesTried: { url: string; error?: FetchErrorCode; errorDetail?: string }[];
}

function stripWww(url: string): string {
  const parsed = new URL(url);
  if (parsed.hostname.startsWith("www.")) {
    parsed.hostname = parsed.hostname.slice(4);
  }
  return parsed.href;
}

function prependWww(url: string): string {
  const parsed = new URL(url);
  if (!parsed.hostname.startsWith("www.")) {
    parsed.hostname = `www.${parsed.hostname}`;
  }
  return parsed.href;
}

function buildCandidates(inputUrl: string): string[] {
  const normalized = normalizeAuditUrl(inputUrl);
  const hadWww = new URL(normalized).hostname.startsWith("www.");
  const candidates: string[] = [normalized];

  if (hadWww) {
    candidates.push(stripWww(normalized));
  }

  return candidates;
}

export async function resolveAuditUrl(
  input: string,
  signal?: AbortSignal,
): Promise<UrlResolution> {
  const requestedUrl = normalizeAuditUrl(input);
  const hadWww = new URL(requestedUrl).hostname.startsWith("www.");
  const candidates = buildCandidates(requestedUrl);
  const candidatesTried: UrlResolution["candidatesTried"] = [];

  for (const candidate of candidates) {
    const probe = await probeUrl(candidate, signal);
    candidatesTried.push({
      url: candidate,
      error: probe.ok ? undefined : probe.error,
      errorDetail: probe.ok ? undefined : probe.errorDetail,
    });
    if (probe.ok) {
      const effectiveUrl = probe.finalUrl;
      const effectiveOrigin = new URL(effectiveUrl).origin;
      let note: string | undefined;
      if (candidate !== requestedUrl) {
        note = hadWww
          ? `Requested www URL failed; crawled apex ${effectiveOrigin} instead.`
          : `Crawled ${effectiveUrl} after probing URL variants.`;
      } else if (probe.finalUrl !== candidate) {
        note = `Resolved to ${probe.finalUrl} after redirects.`;
      }

      return {
        requestedUrl,
        effectiveUrl,
        effectiveOrigin,
        resolved: true,
        note,
        candidatesTried,
      };
    }
  }

  if (!hadWww) {
    const wwwCandidate = prependWww(requestedUrl);
    const probe = await probeUrl(wwwCandidate, signal);
    candidatesTried.push({
      url: wwwCandidate,
      error: probe.ok ? undefined : probe.error,
      errorDetail: probe.ok ? undefined : probe.errorDetail,
    });
    if (probe.ok) {
      const effectiveUrl = probe.finalUrl;
      return {
        requestedUrl,
        effectiveUrl,
        effectiveOrigin: new URL(effectiveUrl).origin,
        resolved: true,
        note: `Original URL failed; crawled www variant ${effectiveUrl} instead.`,
        candidatesTried,
      };
    }
  }

  const lastCandidate = candidatesTried[candidatesTried.length - 1];
  const lastError = lastCandidate?.error;
  return {
    requestedUrl,
    effectiveUrl: requestedUrl,
    effectiveOrigin: new URL(requestedUrl).origin,
    resolved: false,
    note: lastError
      ? `All URL variants failed (last error: ${lastError}${lastCandidate?.errorDetail ? ` — ${lastCandidate.errorDetail}` : ""}).`
      : "All URL variants failed.",
    candidatesTried,
  };
}
