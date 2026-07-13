export function isCloudflareChallengeBody(body: string): boolean {
  const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim().toLowerCase() ?? "";
  if (title.includes("just a moment")) return true;
  if (/cf-browser-verification|checking your browser before accessing/i.test(body)) return true;
  return false;
}

export function isCloudflareChallengeFailure(status: number, body: string): boolean {
  return status === 403 && isCloudflareChallengeBody(body);
}

export function isCloudflareChallengeDetail(detail?: string): boolean {
  return detail?.includes("Cloudflare challenge") ?? false;
}
