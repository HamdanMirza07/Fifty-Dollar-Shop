import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Self-contained, zero-relative-import Vercel Serverless handler:
 * POST /api/meta/sync-product
 *
 * Syncs a product (and all variants) to Meta Commerce Catalog + Category Product Sets + Meta Shop.
 */

const DEFAULT_BRAND_NAME = 'Fifty Dollar Shop';
const DEFAULT_STOREFRONT_BASE_URL = 'https://www.fiftydollarshop.com';
const DEFAULT_GRAPH_API_VERSION = 'v22.0';
const WEBSITE_CATEGORIES_ORDER = [
  'Hot Selling 50$ Products',
  'New Arrival',
] as const;

const ADMIN_COOKIE_NAME = 'fds_admin_session';
const STORE_FILE = path.join(os.tmpdir(), 'fds-admin-state-v1.json');
const MAX_BATCH_SIZE = 200;
const MAX_CATALOG_PAGES = 4;
const MAX_ADDITIONAL_IMAGES = 10;

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

interface VercelResponse extends ServerResponse {
  status?: (code: number) => VercelResponse;
  json?: (data: unknown) => void;
}

interface MetaVariantInput {
  id: string;
  wcVariationId?: number | string;
  sku?: string;
  title?: string;
  description?: string;
  price: number | string;
  salePrice?: number | string | null;
  currency?: string;
  inStock: boolean;
  stockQuantity?: number | null;
  imageUrl?: string;
  additionalImageUrls?: string[];
  color?: string;
  size?: string;
  attributes?: Array<{ name: string; value: string }>;
  slug?: string;
}

interface MetaSyncProductInput {
  id: string | number;
  wcProductId?: number | string;
  isWooCommerce?: boolean;
  name: string;
  slug?: string;
  sku?: string;
  description?: string;
  shortDescription?: string;
  price: number | string;
  salePrice?: number | string | null;
  currency?: string;
  inStock?: boolean;
  stockQuantity?: number | null;
  brand?: string;
  category?: string;
  categories?: Array<{ id?: number; name: string; slug?: string }>;
  imageUrl?: string;
  images?: string[];
  metaRetailerId?: string;
  metaItemGroupId?: string;
  variants?: MetaVariantInput[];
}

interface ExistingMetaCatalogItem {
  id: string;
  retailer_id: string;
  retailer_product_group_id?: string;
  name?: string;
  url?: string;
}

interface MetaValidationStatusEntry {
  retailer_id?: string;
  errors?: Array<{ message?: string; code?: number }>;
  warnings?: Array<{ message?: string; code?: number }>;
}

interface MetaEnvConfig {
  accessToken: string;
  catalogId: string;
  businessId: string;
  commerceAccountId: string;
  storefrontId: string;
  storefrontBaseUrl: string;
  graphVersion: string;
}

const META_RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80001, 80004]);

function isMetaRateLimitFailure(
  status: number,
  code: number | undefined,
  message: string
): boolean {
  if (status === 429) return true;
  if (code !== undefined && META_RATE_LIMIT_CODES.has(code)) return true;
  return /too many calls|rate limit|wait a bit|request limit|temporarily blocked|throttl/i.test(
    message
  );
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterSeconds(headerValue: string | null): number {
  if (!headerValue) return 25;
  const trimmed = headerValue.trim();
  const numeric = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.min(Math.max(numeric, 10), 120);
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    const deltaSec = Math.ceil((dateMs - Date.now()) / 1000);
    if (deltaSec > 0) return Math.min(Math.max(deltaSec, 10), 120);
  }
  return 25;
}

class MetaApiError extends Error {
  status: number;
  isRateLimit: boolean;
  retryAfterSeconds?: number;
  constructor(
    message: string,
    status = 502,
    isRateLimit = false,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status;
    this.isRateLimit = isRateLimit;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sendJson(res: VercelResponse, statusCode: number, payload: unknown) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    const chained = res.status(statusCode);
    if (typeof chained.json === 'function') {
      chained.json(payload);
      return;
    }
  }
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as Record<string, unknown>;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function sha256Buffer(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  return crypto.timingSafeEqual(sha256Buffer(a), sha256Buffer(b));
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function deriveDeterministicSigningKey(label: string, parts: string[]): string {
  return crypto
    .createHash('sha256')
    .update(`${label}:${parts.join('|')}`, 'utf8')
    .digest('hex');
}

function getSessionSigningSecret(): string {
  const explicitSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (explicitSecret.length > 0) {
    return deriveDeterministicSigningKey('fds-admin-session-explicit-v1', [
      explicitSecret,
    ]);
  }
  const persistentServerParts = [
    process.env.ADMIN_SECRET_TOKEN,
    process.env.WC_CONSUMER_SECRET,
    process.env.WC_CONSUMER_KEY,
    process.env.STRIPE_SECRET_KEY,
    process.env.VERCEL_PROJECT_ID,
    process.env.VERCEL_ORG_ID,
  ]
    .map((v) => (v || '').trim())
    .filter((v) => v.length > 0);

  if (persistentServerParts.length > 0) {
    return deriveDeterministicSigningKey(
      'fds-admin-session-server-v2',
      persistentServerParts
    );
  }
  const runtimeIdentityParts = [
    process.env.VERCEL_DEPLOYMENT_ID,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.AWS_LAMBDA_FUNCTION_NAME,
  ]
    .map((v) => (v || '').trim())
    .filter((v) => v.length > 0);

  if (runtimeIdentityParts.length > 0) {
    return deriveDeterministicSigningKey(
      'fds-admin-session-runtime-v2',
      runtimeIdentityParts
    );
  }
  try {
    if (fs.existsSync(STORE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as {
        sessionSecret?: string;
      };
      if (parsed.sessionSecret && parsed.sessionSecret.length >= 32) {
        return parsed.sessionSecret;
      }
    }
  } catch {
    // ignore
  }
  return '';
}

function verifyAdminSessionToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return false;

  const signingKey = getSessionSigningSecret();
  if (!signingKey) return false;

  const expectedSig = crypto
    .createHmac('sha256', signingKey)
    .update(payloadB64)
    .digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as { sub?: string; exp?: number };
    return (
      parsed.sub === 'admin' &&
      typeof parsed.exp === 'number' &&
      Date.now() <= parsed.exp
    );
  } catch {
    return false;
  }
}

function verifySameOriginOrHeader(req: VercelRequest): boolean {
  if (req.headers['x-requested-with']) return true;
  const origin = String(req.headers.origin || '').trim();
  const host = String(
    req.headers['x-forwarded-host'] || req.headers.host || ''
  ).trim();
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function verifyAdminAuth(req: VercelRequest): {
  authorized: boolean;
  status: number;
  message?: string;
} {
  const envAdminSecret = (process.env.ADMIN_SECRET_TOKEN || '').trim();
  const authHeader = String(req.headers.authorization || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const headerToken = String(req.headers['x-admin-auth'] || '').trim();

  if (envAdminSecret.length > 0) {
    if (
      (bearerToken && safeTimingCompare(bearerToken, envAdminSecret)) ||
      (headerToken && safeTimingCompare(headerToken, envAdminSecret))
    ) {
      return { authorized: true, status: 200 };
    }
  }
  if (bearerToken && verifyAdminSessionToken(bearerToken)) {
    return { authorized: true, status: 200 };
  }
  if (headerToken && verifyAdminSessionToken(headerToken)) {
    return { authorized: true, status: 200 };
  }
  const cookies = parseCookieHeader(
    typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  );
  const cookieToken = cookies[ADMIN_COOKIE_NAME];
  if (cookieToken && verifyAdminSessionToken(cookieToken)) {
    if (!verifySameOriginOrHeader(req)) {
      return { authorized: false, status: 403, message: 'Invalid request origin.' };
    }
    return { authorized: true, status: 200 };
  }
  return {
    authorized: false,
    status: 401,
    message: 'Admin authentication is required for Meta Catalog sync.',
  };
}

function sanitizeGraphId(raw: string): string {
  const trimmed = raw.trim();
  return trimmed && /^[A-Za-z0-9_.-]+$/.test(trimmed) ? trimmed : '';
}

function getMetaConfig(): MetaEnvConfig {
  const rawBase = (
    process.env.META_STOREFRONT_BASE_URL || DEFAULT_STOREFRONT_BASE_URL
  )
    .trim()
    .replace(/\/+$/, '');
  let storefrontBaseUrl = DEFAULT_STOREFRONT_BASE_URL;
  try {
    const parsed = new URL(rawBase);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      storefrontBaseUrl = `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    storefrontBaseUrl = DEFAULT_STOREFRONT_BASE_URL;
  }

  const rawVersion = (
    process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION
  ).trim();
  const graphVersion = /^v\d+\.\d+$/.test(rawVersion)
    ? rawVersion
    : DEFAULT_GRAPH_API_VERSION;

  return {
    accessToken: (process.env.META_ACCESS_TOKEN || '').trim(),
    catalogId: sanitizeGraphId(process.env.META_CATALOG_ID || ''),
    businessId: sanitizeGraphId(process.env.META_BUSINESS_ID || ''),
    commerceAccountId: sanitizeGraphId(
      process.env.META_COMMERCE_ACCOUNT_ID || ''
    ),
    storefrontId: sanitizeGraphId(process.env.META_STOREFRONT_ID || ''),
    storefrontBaseUrl,
    graphVersion,
  };
}

function stripHtml(input: string | undefined | null, maxLen: number): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#039;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeRetailerToken(input: string, maxLen = 100): string {
  return input
    .trim()
    .replace(/_/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '-')
    .replace(/-{3,}/g, '--')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

function slugifySegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTitleKey(input: string | undefined | null): string {
  return stripHtml(input || '', 250)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseNumericPrice(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

function formatMetaPrice(amount: number, currency: string): string {
  const safeCurrency = /^[A-Z]{3}$/.test(currency.toUpperCase())
    ? currency.toUpperCase()
    : 'USD';
  return `${amount.toFixed(2)} ${safeCurrency}`;
}

function isThumbnailLikeUrl(url: string): boolean {
  return (
    /-\d{2,4}x\d{2,4}(?=\.[a-zA-Z0-9]+(?:$|\?))/.test(url) ||
    /[?&](?:w|width)=(?:[1-4]\d{2}|\d{1,2})(?:&|$)/i.test(url)
  );
}

function normalizeHdImageUrl(
  rawUrl: string | undefined | null,
  storefrontBaseUrl: string
): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }
  let resolved: URL;
  try {
    if (trimmed.startsWith('//')) {
      resolved = new URL(`https:${trimmed}`);
    } else if (trimmed.startsWith('/')) {
      resolved = new URL(trimmed, storefrontBaseUrl);
    } else if (/^https?:\/\//i.test(trimmed)) {
      resolved = new URL(trimmed);
    } else {
      resolved = new URL(`/${trimmed.replace(/^\/+/, '')}`, storefrontBaseUrl);
    }
  } catch {
    return null;
  }
  if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return null;
  resolved.protocol = 'https:';
  resolved.pathname = resolved.pathname.replace(
    /-\d{2,4}x\d{2,4}(?=\.[a-zA-Z0-9]+$)/,
    ''
  );
  for (const param of ['w', 'width']) {
    const val = resolved.searchParams.get(param);
    if (val) {
      const numeric = Number.parseInt(val, 10);
      if (Number.isFinite(numeric) && numeric > 0 && numeric < 1200) {
        resolved.searchParams.set(param, '1600');
      }
    }
  }
  return resolved.toString();
}

function collectOrderedHdImages(
  preferredUrl: string | undefined | null,
  fallbackList: Array<string | undefined | null>,
  storefrontBaseUrl: string
): { primary: string | null; additional: string[] } {
  const candidates: Array<{ normalized: string; thumb: boolean }> = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined | null) => {
    if (!raw || typeof raw !== 'string') return;
    const normalized = normalizeHdImageUrl(raw, storefrontBaseUrl);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ normalized, thumb: isThumbnailLikeUrl(raw) });
  };
  push(preferredUrl);
  for (const item of fallbackList) push(item);
  const ordered = [
    ...candidates.filter((c) => !c.thumb),
    ...candidates.filter((c) => c.thumb),
  ].map((c) => c.normalized);
  return {
    primary: ordered[0] || null,
    additional: ordered.slice(1, 1 + MAX_ADDITIONAL_IMAGES),
  };
}

function resolveCategoryName(product: MetaSyncProductInput): string {
  const entries: Array<{ name: string; slug: string }> = [];
  if (Array.isArray(product.categories)) {
    for (const c of product.categories) {
      if (c && typeof c.name === 'string') {
        entries.push({
          name: stripHtml(c.name, 100),
          slug: (c.slug || '').trim().toLowerCase(),
        });
      }
    }
  }
  if (product.category && typeof product.category === 'string') {
    entries.push({
      name: stripHtml(product.category, 100),
      slug: product.category.trim().toLowerCase(),
    });
  }
  const filtered = entries.filter(
    (e) =>
      e.name.length > 0 &&
      e.slug !== 'uncategorized' &&
      e.name.toLowerCase() !== 'uncategorized'
  );
  for (const entry of filtered) {
    const n = entry.name.toLowerCase();
    const s = entry.slug;
    if (
      s === 'hot-sale' ||
      s === 'hot-selling' ||
      s === 'hot-selling-50-products' ||
      n.includes('hot selling') ||
      n.includes('hot sale')
    ) {
      return 'Hot Selling 50$ Products';
    }
    if (s === 'new-arrival' || s === 'new-arrivals' || n.includes('new arrival')) {
      return 'New Arrival';
    }
  }
  return filtered[0]?.name || WEBSITE_CATEGORIES_ORDER[0];
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function metaGraphRequest<T>(
  cfg: MetaEnvConfig,
  endpointPath: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    maxRateLimitRetries?: number;
  } = {}
): Promise<T> {
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const url = new URL(`https://graph.facebook.com/${cfg.graphVersion}${cleanPath}`);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v);
    }
  }
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.accessToken}`,
    Accept: 'application/json',
  };
  let bodyStr: string | undefined;
  if (options.body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    bodyStr = JSON.stringify(options.body);
  }

  const maxRetries = options.maxRateLimitRetries ?? 1;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: bodyStr,
        signal: controller.signal,
      });
      const text = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        parsed = { raw: text.slice(0, 300) };
      }
      if (!response.ok || parsed.error) {
        const errObj =
          parsed.error && typeof parsed.error === 'object'
            ? (parsed.error as Record<string, unknown>)
            : null;
        const errMsg =
          (errObj && typeof errObj.error_user_msg === 'string' && errObj.error_user_msg) ||
          (errObj && typeof errObj.message === 'string' && errObj.message) ||
          `Meta Graph API request failed (HTTP ${response.status})`;
        const code =
          errObj && typeof errObj.code === 'number' ? errObj.code : undefined;
        const rateLimited = isMetaRateLimitFailure(response.status, code, errMsg);
        const retryAfterSeconds = rateLimited
          ? parseRetryAfterSeconds(response.headers.get('retry-after'))
          : undefined;

        if (rateLimited && attempt < maxRetries) {
          await sleepMs(2_500 * (attempt + 1));
          continue;
        }

        throw new MetaApiError(
          errMsg,
          rateLimited
            ? 429
            : response.status >= 400 && response.status < 600
              ? response.status
              : 502,
          rateLimited,
          retryAfterSeconds
        );
      }
      return parsed as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new MetaApiError('Meta Graph API request failed.', 502);
}

interface PreparedPlan {
  productIdStr: string;
  productName: string;
  itemGroupId: string;
  categoryName: string;
  coverImageUrl: string;
  syncedRetailerIds: string[];
  deletedStaleIds: string[];
  requests: Array<Record<string, unknown>>;
}

function buildPreparedPlan(
  cfg: MetaEnvConfig,
  input: MetaSyncProductInput,
  existingItems: ExistingMetaCatalogItem[]
): PreparedPlan {
  if (!input || (!input.id && !input.wcProductId) || !input.name) {
    throw new MetaApiError(
      'Invalid product payload: product ID and title are required.',
      400
    );
  }

  const productIdStr = String(input.wcProductId ?? input.id).trim();
  const baseTitle = stripHtml(input.name, 200);
  if (!baseTitle) {
    throw new MetaApiError('Product title cannot be empty.', 400);
  }
  const baseDescription =
    stripHtml(input.description, 9999) ||
    stripHtml(input.shortDescription, 9999) ||
    `${baseTitle} — Available at Fifty Dollar Shop with Free Tracked USA Shipping.`;
  const currency = (input.currency || 'USD').trim().toUpperCase();
  const brand =
    stripHtml(input.brand || DEFAULT_BRAND_NAME, 100) || DEFAULT_BRAND_NAME;
  const categoryName = resolveCategoryName(input);

  const primaryImages = collectOrderedHdImages(
    input.imageUrl,
    [input.imageUrl, ...(Array.isArray(input.images) ? input.images : [])],
    cfg.storefrontBaseUrl
  );
  if (!primaryImages.primary) {
    throw new MetaApiError(
      'No valid public HTTPS product image found. Inline data: and blob: URLs cannot be synced to Meta Catalog.',
      400
    );
  }

  const idCandidates = new Set<string>();
  const addCandidate = (v?: string | number | null) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (!s) return;
    idCandidates.add(s.toLowerCase());
    const san = sanitizeRetailerToken(s);
    if (san) idCandidates.add(san.toLowerCase());
  };
  addCandidate(input.id);
  addCandidate(input.wcProductId);
  addCandidate(input.metaRetailerId);
  addCandidate(input.metaItemGroupId);
  addCandidate(input.sku);
  addCandidate(`wc-${productIdStr}`);
  addCandidate(`wc_${productIdStr}`);
  addCandidate(`fds-${productIdStr}`);
  if (input.sku) {
    addCandidate(`${input.sku}_${productIdStr}`);
    addCandidate(`${input.sku}-${productIdStr}`);
  }

  const canonicalPath = input.slug
    ? `/product/${encodeURIComponent(input.slug.trim())}`.toLowerCase()
    : '';
  const titleKey = normalizeTitleKey(input.name);
  const matchedMap = new Map<string, ExistingMetaCatalogItem>();
  const matchedGroups = new Set<string>();

  for (const item of existingItems) {
    const rid = (item.retailer_id || '').trim().toLowerCase();
    const gid = (item.retailer_product_group_id || '').trim().toLowerCase();
    let isMatch = Boolean(
      (rid && idCandidates.has(rid)) || (gid && idCandidates.has(gid))
    );
    if (!isMatch && rid) {
      for (const c of idCandidates) {
        if (c.length >= 2 && (rid.startsWith(`${c}--`) || rid.startsWith(`${c}__`))) {
          isMatch = true;
          break;
        }
      }
    }
    if (!isMatch && canonicalPath && item.url?.toLowerCase().includes(canonicalPath)) {
      isMatch = true;
    }
    if (
      !isMatch &&
      titleKey.length >= 5 &&
      item.name &&
      normalizeTitleKey(item.name) === titleKey
    ) {
      isMatch = true;
    }
    if (isMatch) {
      matchedMap.set(item.id, item);
      if (item.retailer_product_group_id) {
        matchedGroups.add(item.retailer_product_group_id.trim());
      }
    }
  }
  if (matchedGroups.size > 0) {
    for (const item of existingItems) {
      if (
        item.retailer_product_group_id &&
        matchedGroups.has(item.retailer_product_group_id.trim())
      ) {
        matchedMap.set(item.id, item);
      }
    }
  }
  const matchedExisting = Array.from(matchedMap.values());

  const defaultGroupId =
    sanitizeRetailerToken(
      input.isWooCommerce || input.wcProductId
        ? `wc-${productIdStr}`
        : `fds-${productIdStr}`,
      70
    ) || `fds-${Date.now()}`;
  const itemGroupId =
    matchedExisting.find((m) => m.retailer_product_group_id)
      ?.retailer_product_group_id ||
    (input.metaItemGroupId ? sanitizeRetailerToken(input.metaItemGroupId, 100) : '') ||
    defaultGroupId;

  const rawVariants: MetaVariantInput[] =
    Array.isArray(input.variants) && input.variants.length > 0
      ? input.variants.slice(0, 150)
      : [
          {
            id: sanitizeRetailerToken(input.metaRetailerId || defaultGroupId, 100),
            sku: input.sku,
            title: baseTitle,
            description: baseDescription,
            price: input.price,
            salePrice: input.salePrice,
            currency,
            inStock: input.inStock !== false,
            stockQuantity: input.stockQuantity,
            imageUrl: primaryImages.primary,
            additionalImageUrls: primaryImages.additional,
            slug: input.slug,
          },
        ];

  const isMultiVariant =
    rawVariants.length > 1 ||
    rawVariants.some(
      (v) =>
        Boolean(v.color) ||
        Boolean(v.size) ||
        (Array.isArray(v.attributes) && v.attributes.length > 0)
    );

  const requests: Array<Record<string, unknown>> = [];
  const syncedRetailerIds: string[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rawVariants.length; i += 1) {
    const variant = rawVariants[i];
    let retailerId = sanitizeRetailerToken(variant.id || '', 100);
    if (!retailerId) retailerId = sanitizeRetailerToken(`${itemGroupId}--v${i + 1}`, 100);
    if (seenIds.has(retailerId)) {
      retailerId = sanitizeRetailerToken(`${retailerId}-${i + 1}`, 100);
    }
    seenIds.add(retailerId);
    syncedRetailerIds.push(retailerId);

    const vImages = collectOrderedHdImages(
      variant.imageUrl,
      [
        ...(Array.isArray(variant.additionalImageUrls)
          ? variant.additionalImageUrls
          : []),
        primaryImages.primary,
        ...primaryImages.additional,
      ],
      cfg.storefrontBaseUrl
    );
    const imageLink = vImages.primary || primaryImages.primary;
    const basePriceNum =
      parseNumericPrice(variant.price) || parseNumericPrice(input.price) || 50;
    const salePriceNum = parseNumericPrice(variant.salePrice);
    const hasValidSale = salePriceNum > 0 && salePriceNum < basePriceNum;
    const inStock = variant.inStock !== false;
    const explicitQty =
      typeof variant.stockQuantity === 'number' &&
      Number.isFinite(variant.stockQuantity)
        ? Math.max(0, Math.floor(variant.stockQuantity))
        : null;
    const quantityToSell = !inStock ? 0 : explicitQty !== null ? explicitQty : 50;

    const slug =
      (variant.slug || input.slug || '').trim() ||
      slugifySegment(baseTitle) ||
      productIdStr;
    const linkUrl = new URL(
      `/product/${encodeURIComponent(slug)}/`,
      cfg.storefrontBaseUrl
    );
    if (variant.color) linkUrl.searchParams.set('color', variant.color.trim());
    if (variant.size) linkUrl.searchParams.set('size', variant.size.trim());

    const additionalAttrs: string[] = [];
    if (Array.isArray(variant.attributes)) {
      for (const attr of variant.attributes) {
        const k = stripHtml(attr.name, 60);
        const v = stripHtml(attr.value, 100);
        if (!k || !v) continue;
        const kl = k.toLowerCase();
        if (kl === 'color' || kl === 'colour') {
          if (!linkUrl.searchParams.has('color')) linkUrl.searchParams.set('color', v);
          continue;
        }
        if (kl === 'size') {
          if (!linkUrl.searchParams.has('size')) linkUrl.searchParams.set('size', v);
          continue;
        }
        linkUrl.searchParams.set(slugifySegment(k), v);
        additionalAttrs.push(`${k}:${v}`);
      }
    }

    const canonicalLink = linkUrl.toString();
    const checkoutUrl = `${cfg.storefrontBaseUrl}/checkout/?products=${encodeURIComponent(retailerId)}:1`;

    const data: Record<string, unknown> = {
      id: retailerId,
      title: stripHtml(variant.title || baseTitle, 200) || baseTitle,
      description:
        stripHtml(variant.description || baseDescription, 9999) || baseDescription,
      availability: inStock ? 'in stock' : 'out of stock',
      quantity_to_sell_on_facebook: quantityToSell,
      condition: 'new',
      price: formatMetaPrice(basePriceNum, variant.currency || currency),
      link: canonicalLink,
      mobile_link: canonicalLink,
      checkout_url: checkoutUrl,
      image_link: imageLink,
      brand,
      visibility: 'published',
      product_type: categoryName,
      custom_label_0: categoryName,
    };
    if (isMultiVariant) data.item_group_id = itemGroupId;
    if (hasValidSale) {
      data.sale_price = formatMetaPrice(salePriceNum, variant.currency || currency);
    }
    if (vImages.additional.length > 0) data.additional_image_link = vImages.additional;
    if (variant.color?.trim()) data.color = stripHtml(variant.color, 100);
    if (variant.size?.trim()) data.size = stripHtml(variant.size, 100);
    if (additionalAttrs.length > 0) {
      data.additional_variant_attribute = additionalAttrs.join(', ').slice(0, 500);
    }

    requests.push({ method: 'UPDATE', retailer_id: retailerId, data });
  }

  const deletedStaleIds: string[] = [];
  for (const existing of matchedExisting) {
    const rid = (existing.retailer_id || '').trim();
    if (rid && !seenIds.has(rid)) {
      deletedStaleIds.push(rid);
      requests.push({ method: 'DELETE', retailer_id: rid });
    }
  }

  return {
    productIdStr,
    productName: baseTitle,
    itemGroupId,
    categoryName,
    coverImageUrl: primaryImages.primary,
    syncedRetailerIds,
    deletedStaleIds,
    requests,
  };
}

async function publishCategorySet(
  cfg: MetaEnvConfig,
  params: {
    categoryName: string;
    syncedRetailerIds: string[];
    coverImageUrl: string;
    warnings: string[];
  }
): Promise<{
  productSetId: string | null;
  shopPublished: boolean;
  shopIds: string[];
  cleanedEmptySets: number;
}> {
  const { categoryName, syncedRetailerIds, coverImageUrl, warnings } = params;
  let productSetId: string | null = null;
  let shopPublished = false;
  const shopIdsSet = new Set<string>();
  let cleanedEmptySets = 0;
  if (cfg.storefrontId) shopIdsSet.add(cfg.storefrontId);

  try {
    const setsRes = await metaGraphRequest<{
      data?: Array<{ id: string; name?: string; filter?: string; product_count?: number }>;
    }>(cfg, `/${cfg.catalogId}/product_sets`, {
      query: { fields: 'id,name,filter,product_count', limit: '100' },
    });
    const productSets = Array.isArray(setsRes.data) ? setsRes.data : [];
    const targetLower = categoryName.toLowerCase();
    const targetSet =
      productSets.find((s) => (s.name || '').trim().toLowerCase() === targetLower) ||
      null;

    const existingSetIds: string[] = [];
    if (targetSet?.filter) {
      try {
        const parsedFilter = JSON.parse(targetSet.filter) as Record<string, unknown>;
        const walk = (node: unknown) => {
          if (!node || typeof node !== 'object') return;
          if (Array.isArray(node)) {
            for (const n of node) walk(n);
            return;
          }
          const o = node as Record<string, unknown>;
          const r = o.retailer_id as Record<string, unknown> | undefined;
          if (r && typeof r === 'object') {
            if (typeof r.eq === 'string') existingSetIds.push(r.eq);
            if (Array.isArray(r.is_any)) {
              for (const val of r.is_any) {
                if (typeof val === 'string') existingSetIds.push(val);
              }
            }
          }
          for (const val of Object.values(o)) walk(val);
        };
        walk(parsedFilter);
      } catch {
        // ignore
      }
    }

    const filterPayload = JSON.stringify({
      retailer_id: {
        is_any: Array.from(new Set([...existingSetIds, ...syncedRetailerIds])),
      },
    });

    if (!targetSet) {
      const created = await metaGraphRequest<{ id?: string }>(
        cfg,
        `/${cfg.catalogId}/product_sets`,
        { method: 'POST', body: { name: categoryName, filter: filterPayload } }
      );
      productSetId = created.id ? String(created.id) : null;
    } else {
      productSetId = targetSet.id;
      await metaGraphRequest(cfg, `/${targetSet.id}`, {
        method: 'POST',
        body: { name: categoryName, filter: filterPayload },
      });
    }

    if (cfg.commerceAccountId) {
      try {
        const sRes = await metaGraphRequest<{ data?: Array<{ id?: string }> }>(
          cfg,
          `/${cfg.commerceAccountId}/shops`,
          { query: { fields: 'id,shop_status' } }
        );
        for (const s of sRes.data || []) if (s.id) shopIdsSet.add(String(s.id));
      } catch {
        // non-fatal
      }
    }
    for (const pathBase of [
      `/${cfg.catalogId}/commerce_merchant_settings`,
      ...(cfg.businessId ? [`/${cfg.businessId}/commerce_merchant_settings`] : []),
    ]) {
      try {
        const cmsRes = await metaGraphRequest<{
          data?: Array<{ shops?: { data?: Array<{ id?: string }> } }>;
        }>(cfg, pathBase, { query: { fields: 'id,shops{id}' } });
        for (const cms of cmsRes.data || []) {
          for (const s of cms.shops?.data || []) if (s.id) shopIdsSet.add(String(s.id));
        }
      } catch {
        // non-fatal
      }
    }

    const shopIds = Array.from(shopIdsSet);
    if (productSetId && shopIds.length > 0) {
      const idx = WEBSITE_CATEGORIES_ORDER.findIndex(
        (c) => c.toLowerCase() === targetLower
      );
      const orderingIndex = idx >= 0 ? idx : WEBSITE_CATEGORIES_ORDER.length;
      try {
        await metaGraphRequest(cfg, `/${productSetId}`, {
          method: 'POST',
          body: {
            metadata: {
              description: `${categoryName} — Curated Flat $50 USA Deals at Fifty Dollar Shop`,
              external_url: `${cfg.storefrontBaseUrl}/category/${encodeURIComponent(slugifySegment(categoryName))}`,
              cover_image_url: coverImageUrl,
            },
            publish_to_shops: shopIds.map((id) => ({ id, ordering_index: orderingIndex })),
          },
        });
        shopPublished = true;
      } catch (err) {
        warnings.push(
          `Meta Shop publish warning: ${err instanceof Error ? err.message : 'unavailable'}`
        );
      }
    }

    const validNames = new Set(
      [...WEBSITE_CATEGORIES_ORDER, categoryName].map((c) => c.toLowerCase())
    );
    const kept = new Set<string>(productSetId ? [targetLower] : []);
    for (const ps of productSets) {
      if (!ps.id || ps.id === productSetId) continue;
      const psLower = (ps.name || '').trim().toLowerCase();
      if (psLower === 'all products' || psLower === 'all items') continue;
      const shouldRemove =
        kept.has(psLower) ||
        !validNames.has(psLower) ||
        (typeof ps.product_count === 'number' && ps.product_count === 0);
      if (shouldRemove) {
        try {
          await metaGraphRequest(cfg, `/${ps.id}`, { method: 'DELETE' });
          cleanedEmptySets += 1;
        } catch {
          // non-fatal
        }
      } else {
        kept.add(psLower);
      }
    }
  } catch (err) {
    warnings.push(
      `Category Product Set warning: ${err instanceof Error ? err.message : 'unavailable'}`
    );
  }

  return {
    productSetId,
    shopPublished,
    shopIds: Array.from(shopIdsSet),
    cleanedEmptySets,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed.' });
  }
  const auth = verifyAdminAuth(req);
  if (!auth.authorized) {
    return sendJson(res, auth.status, {
      ok: false,
      code: auth.status === 403 ? 'csrf_check_failed' : 'admin_unauthorized',
      message: auth.message,
    });
  }

  try {
    const cfg = getMetaConfig();
    if (!cfg.accessToken || !cfg.catalogId) {
      return sendJson(res, 503, {
        ok: false,
        code: 'meta_not_configured',
        message:
          'Meta Commerce is not configured on the server yet. Set META_ACCESS_TOKEN and META_CATALOG_ID in your Vercel Environment Variables.',
      });
    }

    const rawBody = await readJsonBody(req);
    const warnings: string[] = [];

    // Fetch existing catalog items ONCE for the request (single or bulk)
    const existingItems: ExistingMetaCatalogItem[] = [];
    try {
      let afterCursor: string | undefined;
      for (let page = 0; page < MAX_CATALOG_PAGES; page += 1) {
        const query: Record<string, string> = {
          fields: 'id,retailer_id,retailer_product_group_id,name,url',
          limit: '250',
        };
        if (afterCursor) query.after = afterCursor;
        const pageRes = await metaGraphRequest<{
          data?: ExistingMetaCatalogItem[];
          paging?: { cursors?: { after?: string }; next?: string };
        }>(cfg, `/${cfg.catalogId}/products`, { query });
        if (Array.isArray(pageRes.data)) existingItems.push(...pageRes.data);
        if (!pageRes.paging?.next || !pageRes.paging.cursors?.after) break;
        afterCursor = pageRes.paging.cursors.after;
      }
    } catch (err) {
      warnings.push(
        `Catalog lookup fell back to fresh upsert: ${err instanceof Error ? err.message : 'unavailable'}`
      );
    }

    // MULTI-PRODUCT BULK BATCH MODE
    if (Array.isArray(rawBody.products)) {
      const inputs = rawBody.products as MetaSyncProductInput[];
      if (inputs.length === 0) {
        return sendJson(res, 400, {
          ok: false,
          code: 'invalid_product',
          message: 'At least one product is required for bulk Meta sync.',
        });
      }

      const plans: PreparedPlan[] = [];
      const productErrors: Array<{
        productId: string;
        productName: string;
        message: string;
      }> = [];

      for (const item of inputs) {
        try {
          plans.push(buildPreparedPlan(cfg, item, existingItems));
        } catch (err) {
          productErrors.push({
            productId: String(item?.wcProductId ?? item?.id ?? 'unknown'),
            productName: stripHtml(item?.name || 'Product', 160) || 'Product',
            message: err instanceof Error ? err.message : 'Invalid product payload.',
          });
        }
      }

      const retailerToPlan = new Map<string, PreparedPlan>();
      const combinedRequests: Array<Record<string, unknown>> = [];
      for (const plan of plans) {
        for (const rid of plan.syncedRetailerIds) retailerToPlan.set(rid, plan);
        for (const did of plan.deletedStaleIds) {
          if (!retailerToPlan.has(did)) retailerToPlan.set(did, plan);
        }
        combinedRequests.push(...plan.requests);
      }

      const errorsByProductId = new Map<string, string[]>();
      const warningsByProductId = new Map<string, string[]>();
      const chunks = chunkArray(combinedRequests, MAX_BATCH_SIZE);
      let batchCallsMade = 0;

      for (let i = 0; i < chunks.length; i += 1) {
        if (i > 0) await sleepMs(2_000);
        const batchRes = await metaGraphRequest<{
          validation_status?: MetaValidationStatusEntry[];
        }>(cfg, `/${cfg.catalogId}/items_batch`, {
          method: 'POST',
          body: { allow_upsert: true, item_type: 'PRODUCT_ITEM', requests: chunks[i] },
        });
        batchCallsMade += 1;

        if (Array.isArray(batchRes.validation_status)) {
          for (const entry of batchRes.validation_status) {
            const rid = (entry.retailer_id || '').trim();
            const owner = rid ? retailerToPlan.get(rid) : undefined;
            const pid = owner?.productIdStr || '';
            const pfx = rid ? `[${rid}] ` : '';
            for (const e of entry.errors || []) {
              if (!e?.message) continue;
              if (pid) {
                const list = errorsByProductId.get(pid) || [];
                list.push(`${pfx}${e.message}`);
                errorsByProductId.set(pid, list);
              } else {
                warnings.push(`${pfx}${e.message}`);
              }
            }
            for (const w of entry.warnings || []) {
              if (!w?.message) continue;
              if (pid) {
                const list = warningsByProductId.get(pid) || [];
                list.push(`${pfx}${w.message}`);
                warningsByProductId.set(pid, list);
              } else {
                warnings.push(`${pfx}${w.message}`);
              }
            }
          }
        }
      }

      const successfulPlans: PreparedPlan[] = [];
      for (const plan of plans) {
        const errs = errorsByProductId.get(plan.productIdStr) || [];
        if (errs.length > 0) {
          productErrors.push({
            productId: plan.productIdStr,
            productName: plan.productName,
            message: `Meta Catalog validation rejected one or more variants: ${errs.slice(0, 3).join(' | ')}`,
          });
        } else {
          successfulPlans.push(plan);
        }
      }

      const categorySetInfo = new Map<
        string,
        {
          productSetId: string | null;
          shopPublished: boolean;
          shopIds: string[];
          cleanedEmptySets: number;
        }
      >();
      let checkoutUrlConfigured = false;

      if (!rawBody.skipCollections && successfulPlans.length > 0) {
        const byCat = new Map<string, { retailerIds: string[]; coverImageUrl: string }>();
        for (const plan of successfulPlans) {
          const prev = byCat.get(plan.categoryName);
          if (prev) prev.retailerIds.push(...plan.syncedRetailerIds);
          else {
            byCat.set(plan.categoryName, {
              retailerIds: [...plan.syncedRetailerIds],
              coverImageUrl: plan.coverImageUrl,
            });
          }
        }
        for (const [catName, info] of byCat.entries()) {
          const setRes = await publishCategorySet(cfg, {
            categoryName: catName,
            syncedRetailerIds: Array.from(new Set(info.retailerIds)),
            coverImageUrl: info.coverImageUrl,
            warnings,
          });
          categorySetInfo.set(catName, setRes);
        }

        if (cfg.commerceAccountId) {
          try {
            await metaGraphRequest(cfg, `/${cfg.commerceAccountId}`, {
              method: 'POST',
              body: {
                checkout_config: { checkout_url: `${cfg.storefrontBaseUrl}/checkout/` },
              },
            });
            checkoutUrlConfigured = true;
          } catch {
            // non-fatal
          }
        }
      }

      const syncedAt = new Date().toISOString();
      const results = successfulPlans.map((plan) => {
        const setRes = categorySetInfo.get(plan.categoryName);
        return {
          ok: true,
          productId: plan.productIdStr,
          itemGroupId: plan.itemGroupId,
          primaryRetailerId: plan.syncedRetailerIds[0] || plan.itemGroupId,
          syncedRetailerIds: plan.syncedRetailerIds,
          deletedStaleIds: plan.deletedStaleIds,
          variantCount: plan.syncedRetailerIds.length,
          categoryName: plan.categoryName,
          productSetId: setRes?.productSetId ?? null,
          shopPublished: setRes?.shopPublished ?? false,
          shopIds: setRes?.shopIds ?? [],
          checkoutUrlConfigured,
          cleanedEmptySets: setRes?.cleanedEmptySets ?? 0,
          warnings: [
            ...warnings,
            ...(warningsByProductId.get(plan.productIdStr) || []),
          ],
          syncedAt,
        };
      });

      return sendJson(res, 200, {
        ok: true,
        results,
        errors: productErrors,
        batchCallsMade,
        syncedAt,
      });
    }

    // SINGLE PRODUCT MODE
    const input = (rawBody.product || rawBody) as MetaSyncProductInput;
    const plan = buildPreparedPlan(cfg, input, existingItems);

    const batchErrors: string[] = [];
    const singleChunks = chunkArray(plan.requests, MAX_BATCH_SIZE);
    for (let i = 0; i < singleChunks.length; i += 1) {
      if (i > 0) await sleepMs(2_000);
      const batchRes = await metaGraphRequest<{
        validation_status?: MetaValidationStatusEntry[];
      }>(cfg, `/${cfg.catalogId}/items_batch`, {
        method: 'POST',
        body: { allow_upsert: true, item_type: 'PRODUCT_ITEM', requests: singleChunks[i] },
      });
      if (Array.isArray(batchRes.validation_status)) {
        for (const entry of batchRes.validation_status) {
          const pfx = entry.retailer_id ? `[${entry.retailer_id}] ` : '';
          for (const e of entry.errors || []) {
            if (e?.message) batchErrors.push(`${pfx}${e.message}`);
          }
          for (const w of entry.warnings || []) {
            if (w?.message) warnings.push(`${pfx}${w.message}`);
          }
        }
      }
    }

    if (batchErrors.length > 0) {
      return sendJson(res, 422, {
        ok: false,
        code: 'meta_validation_failed',
        message: `Meta Catalog validation rejected one or more variants: ${batchErrors.slice(0, 3).join(' | ')}`,
      });
    }

    const setResult = await publishCategorySet(cfg, {
      categoryName: plan.categoryName,
      syncedRetailerIds: plan.syncedRetailerIds,
      coverImageUrl: plan.coverImageUrl,
      warnings,
    });

    let checkoutUrlConfigured = false;
    if (cfg.commerceAccountId) {
      try {
        await metaGraphRequest(cfg, `/${cfg.commerceAccountId}`, {
          method: 'POST',
          body: {
            checkout_config: { checkout_url: `${cfg.storefrontBaseUrl}/checkout/` },
          },
        });
        checkoutUrlConfigured = true;
      } catch {
        // non-fatal
      }
    }

    return sendJson(res, 200, {
      ok: true,
      productId: plan.productIdStr,
      itemGroupId: plan.itemGroupId,
      primaryRetailerId: plan.syncedRetailerIds[0] || plan.itemGroupId,
      syncedRetailerIds: plan.syncedRetailerIds,
      deletedStaleIds: plan.deletedStaleIds,
      variantCount: plan.syncedRetailerIds.length,
      categoryName: plan.categoryName,
      productSetId: setResult.productSetId,
      shopPublished: setResult.shopPublished,
      shopIds: setResult.shopIds,
      checkoutUrlConfigured,
      cleanedEmptySets: setResult.cleanedEmptySets,
      warnings,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    const isMetaErr = err instanceof MetaApiError;
    const isRateLimit = isMetaErr && err.isRateLimit;
    const status = isMetaErr ? err.status : 500;
    if (isRateLimit && err.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }
    return sendJson(res, status, {
      ok: false,
      code: isRateLimit ? 'meta_rate_limited' : 'meta_sync_failed',
      rateLimited: isRateLimit,
      retryAfterSeconds: isRateLimit ? err.retryAfterSeconds || 25 : undefined,
      message:
        err instanceof Error
          ? err.message
          : 'Unable to sync product to Meta Catalog.',
    });
  }
}
