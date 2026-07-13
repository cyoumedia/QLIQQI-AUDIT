import { chromium, type Browser, type Page } from "playwright-core";
import { auditConfig } from "./config";
import { isCloudflareChallengeBody } from "./cloudflare";

export interface BrowserFetchOptions {
  /** Wait for hydrated body text (JS SPAs), not just DOM ready. */
  waitForContent?: boolean;
}

export interface BrowserFetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
}

type BrowserMode = "headless" | "hidden-headed" | "visible-headed";

let sharedBrowser: Browser | null = null;
let sharedBrowserPromise: Promise<Browser | null> | null = null;
let sharedPage: Page | null = null;
let currentMode: BrowserMode | null = null;
let activeFetches = 0;
let browserQueue: Promise<unknown> = Promise.resolve();

const AUDIT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = browserQueue.then(fn, fn);
  browserQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function launchOptionsForMode(mode: BrowserMode): { headless: boolean; args: string[] } {
  const base = ["--disable-blink-features=AutomationControlled"];
  if (mode === "hidden-headed") {
    return {
      headless: false,
      args: [...base, "--window-position=-24000,-24000", "--window-size=800,600"],
    };
  }
  if (mode === "visible-headed") {
    return { headless: false, args: base };
  }
  return { headless: true, args: base };
}

async function launchBrowser(mode: BrowserMode): Promise<Browser | null> {
  const options = launchOptionsForMode(mode);
  try {
    try {
      return await chromium.launch({ ...options, channel: "chrome" });
    } catch {
      return await chromium.launch(options);
    }
  } catch {
    return null;
  }
}

async function resetBrowser(): Promise<void> {
  await sharedPage?.close().catch(() => {});
  sharedPage = null;
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
    sharedBrowser = null;
    sharedBrowserPromise = null;
  }
  currentMode = null;
}

async function ensureBrowser(mode: BrowserMode): Promise<Browser | null> {
  if (sharedBrowser?.isConnected() && currentMode === mode) return sharedBrowser;

  await resetBrowser();
  currentMode = mode;
  sharedBrowserPromise = launchBrowser(mode);
  sharedBrowser = await sharedBrowserPromise;
  return sharedBrowser;
}

async function getSharedPage(browser: Browser): Promise<Page> {
  if (sharedPage && !sharedPage.isClosed()) return sharedPage;

  sharedPage = await browser.newPage({
    userAgent: AUDIT_USER_AGENT,
    extraHTTPHeaders: {
      "Accept-Language": "en-GB,en;q=0.9",
      "X-QLIQQI-Audit": "1.0 (+https://qliqqi.com)",
    },
  });
  await sharedPage.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return sharedPage;
}

async function waitForRealPage(page: Page, signal?: AbortSignal): Promise<void> {
  try {
    await page.waitForFunction(
      () => !document.title.toLowerCase().includes("just a moment"),
      { timeout: 25_000 },
    );
  } catch {
    // fall through to polling
  }

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const html = await page.content();
    if (!isCloudflareChallengeBody(html) && html.length >= 500) return;
    await page.waitForTimeout(750);
  }
}

async function waitForRenderedContent(page: Page, signal?: AbortSignal): Promise<void> {
  const minWords = auditConfig.browserShellMinWords();
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const wordCount = await page.evaluate(() => {
      const text = document.body?.innerText?.replace(/\s+/g, " ").trim() ?? "";
      return text.split(" ").filter(Boolean).length;
    });
    if (wordCount >= minWords) return;
    await page.waitForTimeout(500);
  }
}

async function fetchPage(
  browser: Browser,
  url: string,
  signal?: AbortSignal,
  options?: BrowserFetchOptions,
): Promise<BrowserFetchResult | null> {
  const page = await getSharedPage(browser);
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  await waitForRealPage(page, signal);
  if (options?.waitForContent) {
    await waitForRenderedContent(page, signal);
  }

  const html = await page.content();
  if (isCloudflareChallengeBody(html)) return null;
  if (!options?.waitForContent && html.length < 500) return null;

  return {
    html,
    finalUrl: page.url(),
    statusCode: response?.status() && response.status() >= 200 && response.status() < 400
      ? response.status()
      : 200,
  };
}

async function browserFetchHtmlInner(
  url: string,
  signal?: AbortSignal,
  options?: BrowserFetchOptions,
): Promise<BrowserFetchResult | null> {
  activeFetches += 1;
  try {
    const headedMode: BrowserMode = auditConfig.browserHeaded()
      ? "visible-headed"
      : "hidden-headed";

    const headlessBrowser = await ensureBrowser("headless");
    if (headlessBrowser) {
      const headlessResult = await fetchPage(headlessBrowser, url, signal, options);
      if (headlessResult) return headlessResult;
    }

    const headedBrowser = await ensureBrowser(headedMode);
    if (!headedBrowser) return null;
    return fetchPage(headedBrowser, url, signal, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  } finally {
    activeFetches -= 1;
  }
}

export async function browserFetchHtml(
  url: string,
  signal?: AbortSignal,
  options?: BrowserFetchOptions,
): Promise<BrowserFetchResult | null> {
  if (!auditConfig.browserFallbackEnabled()) return null;
  return runExclusive(() => browserFetchHtmlInner(url, signal, options));
}

export async function closeBrowserFetcher(): Promise<void> {
  if (activeFetches > 0) return;
  await resetBrowser();
  browserQueue = Promise.resolve();
}
