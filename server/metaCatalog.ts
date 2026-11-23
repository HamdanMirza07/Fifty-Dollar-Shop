import crypto from 'crypto';
import type { Request, Response } from 'express';
import {
  ADMIN_COOKIE_NAME,
  getEnvAdminSecret,
  parseCookieHeader,
  verifyAdminSessionToken,
} from '../api/_adminStore.ts';

export const DEFAULT_BRAND_NAME = 'Fifty Dollar Shop';
export const DEFAULT_STOREFRONT_BASE_URL = 'https://www.fiftydollarshop.com';
export const DEFAULT_GRAPH_API_VERSION = 'v22.0';
export const WEBSITE_CATEGORIES_ORDER = [
  'Hot Selling 50$ Products',
  'New Arrival',
] as const;

const MAX_BATCH_SIZE = 200;
const MAX_CATALOG_PAGES = 4;
const MAX_ADDITIONAL_IMAGES = 10;

export interface MetaVariantInput {
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
  link?: string;
  checkoutUrl?: string;
}

export interface MetaSyncProductInput {
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

export interface MetaRemoveProductInput {
  id?: string | number;
  wcProductId?: number | string;
  sku?: string;
  slug?: string;
  name?: string;
  metaRetailerId?: string;
  metaItemGroupId?: string;
  retailerIds?: string[];
}

export interface MetaSyncResult {
  ok: boolean;
  productId: string;
  itemGroupId: string;
  primaryRetailerId: string;
  syncedRetailerIds: string[];
  deletedStaleIds: string[];
  variantCount: number;
  categoryName: string;
  productSetId: string | null;
  shopPublished: boolean;
  shopIds: string[];
  checkoutUrlConfigured: boolean;
  cleanedEmptySets: number;
  warnings: string[];
  syncedAt: string;
}

export interface MetaBulkSyncProductError {
  productId: string;
  productName: string;
  message: string;
}

export interface MetaBulkSyncResult {
  ok: boolean;
  results: MetaSyncResult[];
  errors: MetaBulkSyncProductError[];
  batchCallsMade: number;
  syncedAt: string;
}

export interface MetaRemoveResult {
  ok: boolean;
  productId: string;
  removedRetailerIds: string[];
  removedCatalogItemIds: string[];
  removedCount: number;
  warnings: string[];
  removedAt: string;
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

function sha256Buffer(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function safeTimingCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  return crypto.timingSafeEqual(sha256Buffer(a), sha256Buffer(b));
}

function verifySameOriginOrHeader(req: Request): boolean {
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

/**
 * Verifies admin authorization for Meta endpoints.
 * Accepts:
 *  1. Direct ADMIN_SECRET_TOKEN via `Authorization: Bearer <token>` or `x-admin-auth` header
 *  2. Server-signed Admin Session token via `Authorization: Bearer <session>`, `x-admin-auth`, or `fds_admin_session` HttpOnly cookie
 */
export function verifyMetaAdminAuth(req: Request): {
  authorized: boolean;
  status: number;
  message?: string;
} {
  const envAdminSecret = getEnvAdminSecret();
  const authHeader = String(req.headers.authorization || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const headerToken = String(req.headers['x-admin-auth'] || '').trim();

  // Check direct ADMIN_SECRET_TOKEN first (for server-to-server or explicit token calls)
  if (envAdminSecret.length > 0) {
    if (
      (bearerToken && safeTimingCompare(bearerToken, envAdminSecret)) ||
      (headerToken && safeTimingCompare(headerToken, envAdminSecret))
    ) {
      return { authorized: true, status: 200 };
    }
  }

  // Check signed Admin Session token in Bearer or x-admin-auth header
  if (bearerToken && verifyAdminSessionToken(bearerToken)) {
    return { authorized: true, status: 200 };
  }
  if (headerToken && verifyAdminSessionToken(headerToken)) {
    return { authorized: true, status: 200 };
  }

  // Check signed Admin Session HttpOnly cookie (with same-origin/header CSRF verification)
  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieToken = cookies[ADMIN_COOKIE_NAME];
  if (cookieToken && verifyAdminSessionToken(cookieToken)) {
    if (!verifySameOriginOrHeader(req)) {
      return {
        authorized: false,
        status: 403,
        message: 'Invalid request origin.',
      };
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
  if (!trimmed) return '';
  return /^[A-Za-z0-9_.-]+$/.test(trimmed) ? trimmed : '';
}

function getMetaEnvConfig(): MetaEnvConfig {
  const accessToken = (process.env.META_ACCESS_TOKEN || '').trim();
  const catalogId = sanitizeGraphId(process.env.META_CATALOG_ID || '');
  const businessId = sanitizeGraphId(process.env.META_BUSINESS_ID || '');
  const commerceAccountId = sanitizeGraphId(
    process.env.META_COMMERCE_ACCOUNT_ID || ''
  );
  const storefrontId = sanitizeGraphId(process.env.META_STOREFRONT_ID || '');

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
    accessToken,
    catalogId,
    businessId,
    commerceAccountId,
    storefrontId,
    storefrontBaseUrl,
    graphVersion,
  };
}

export function getMetaConfigStatus() {
  const cfg = getMetaEnvConfig();
  return {
    storefrontBaseUrl: `${cfg.storefrontBaseUrl}/`,
    graphApiVersion: cfg.graphVersion,
    catalogIdConfigured: Boolean(cfg.catalogId),
    accessTokenConfigured: Boolean(cfg.accessToken),
    businessIdConfigured: Boolean(cfg.businessId),
    commerceAccountIdConfigured: Boolean(cfg.commerceAccountId),
    storefrontIdConfigured: Boolean(cfg.storefrontId),
    pixelIdConfigured: Boolean((process.env.META_PIXEL_ID || '').trim()),
    status:
      cfg.catalogId && cfg.accessToken
        ? ('configured' as const)
        : ('ready_to_connect' as const),
  };
}

function stripHtml(input: string | undefined | null, maxLen: number): string {
  if (!input || typeof input !== 'string') return '';
  const decoded = input
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
    .trim();
  return decoded.slice(0, maxLen);
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
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parsed = Number.parseFloat(cleaned);
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
  return /-\d{2,4}x\d{2,4}(?=\.[a-zA-Z0-9]+(?:$|\?))/.test(url) ||
    /[?&](?:w|width)=(?:[1-4]\d{2}|\d{1,2})(?:&|$)/i.test(url);
}

/**
 * Validates and upgrades product/variant image URLs to public full-resolution HTTPS URLs.
 * Rejects inline `data:` and `blob:` URLs as well as unsafe schemes.
 */
export function normalizeHdImageUrl(
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

  if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') {
    return null;
  }

  // Always enforce HTTPS for Meta Catalog
  resolved.protocol = 'https:';

  // Strip WordPress / WooCommerce thumbnail dimension suffixes (e.g. -300x300.jpg -> .jpg)
  resolved.pathname = resolved.pathname.replace(
    /-\d{2,4}x\d{2,4}(?=\.[a-zA-Z0-9]+$)/,
    ''
  );

  // Upscale small width query parameters so Meta receives full-resolution HD imagery
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
  const candidates: Array<{ raw: string; normalized: string; thumb: boolean }> =
    [];
  const seen = new Set<string>();

  const pushCandidate = (raw: string | undefined | null) => {
    if (!raw || typeof raw !== 'string') return;
    const normalized = normalizeHdImageUrl(raw, storefrontBaseUrl);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({
      raw,
      normalized,
      thumb: isThumbnailLikeUrl(raw),
    });
  };

  pushCandidate(preferredUrl);
  for (const item of fallbackList) {
    pushCandidate(item);
  }

  if (candidates.length === 0) {
    return { primary: null, additional: [] };
  }

  // Prefer non-thumbnail originals first while respecting preferred variant image
  const nonThumb = candidates.filter((c) => !c.thumb);
  const thumbOnly = candidates.filter((c) => c.thumb);
  const ordered = [...nonThumb, ...thumbOnly].map((c) => c.normalized);

  return {
    primary: ordered[0] || null,
    additional: ordered.slice(1, 1 + MAX_ADDITIONAL_IMAGES),
  };
}

/**
 * Resolves the exact website category display name matching WEBSITE_CATEGORIES_ORDER
 * while skipping WooCommerce's "Uncategorized".
 */
export function resolveWebsiteCategoryName(
  product: MetaSyncProductInput
): string {
  const rawNames: Array<{ name: string; slug: string }> = [];
  if (Array.isArray(product.categories)) {
    for (const cat of product.categories) {
      if (cat && typeof cat.name === 'string') {
        rawNames.push({
          name: stripHtml(cat.name, 100),
          slug: (cat.slug || '').trim().toLowerCase(),
        });
      }
    }
  }
  if (product.category && typeof product.category === 'string') {
    rawNames.push({
      name: stripHtml(product.category, 100),
      slug: product.category.trim().toLowerCase(),
    });
  }

  const filtered = rawNames.filter(
    (c) =>
      c.name.length > 0 &&
      c.slug !== 'uncategorized' &&
      c.name.toLowerCase() !== 'uncategorized'
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
    if (
      s === 'new-arrival' ||
      s === 'new-arrivals' ||
      n.includes('new arrival')
    ) {
      return 'New Arrival';
    }
  }

  if (filtered.length > 0) {
    return filtered[0].name;
  }

  return WEBSITE_CATEGORIES_ORDER[0];
}

function getCategoryOrderIndex(categoryName: string): number {
  const idx = WEBSITE_CATEGORIES_ORDER.findIndex(
    (c) => c.toLowerCase() === categoryName.trim().toLowerCase()
  );
  return idx >= 0 ? idx : WEBSITE_CATEGORIES_ORDER.length;
}

function slugifyPathSegment(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildCanonicalProductLink(
  storefrontBaseUrl: string,
  product: MetaSyncProductInput,
  variant?: MetaVariantInput
): string {
  const slug =
    (variant?.slug || product.slug || '').trim() ||
    slugifyPathSegment(stripHtml(product.name, 80)) ||
    String(product.wcProductId || product.id);
  const url = new URL(
    `/product/${encodeURIComponent(slug)}/`,
    storefrontBaseUrl
  );

  if (variant?.color) {
    url.searchParams.set('color', variant.color.trim());
  }
  if (variant?.size) {
    url.searchParams.set('size', variant.size.trim());
  }
  if (Array.isArray(variant?.attributes)) {
    for (const attr of variant.attributes) {
      const k = attr.name.trim().toLowerCase();
      const v = attr.value.trim();
      if (!k || !v) continue;
      if (k.includes('color') || k.includes('colour')) {
        if (!url.searchParams.has('color')) url.searchParams.set('color', v);
      } else if (k.includes('size')) {
        if (!url.searchParams.has('size')) url.searchParams.set('size', v);
      } else {
        url.searchParams.set(slugifyPathSegment(k), v);
      }
    }
  }

  return url.toString();
}

function buildCheckoutUrl(
  storefrontBaseUrl: string,
  retailerId: string
): string {
  return `${storefrontBaseUrl}/checkout/?products=${encodeURIComponent(retailerId)}:1`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

class MetaGraphApiError extends Error {
  status: number;
  metaCode?: number;
  metaSubcode?: number;
  isRateLimit: boolean;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    status = 502,
    metaCode?: number,
    metaSubcode?: number,
    isRateLimit = false,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'MetaGraphApiError';
    this.status = status;
    this.metaCode = metaCode;
    this.metaSubcode = metaSubcode;
    this.isRateLimit = isRateLimit;
    this.retryAfterSeconds = retryAfterSeconds;
  }
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
  const cleanPath = endpointPath.startsWith('/')
    ? endpointPath
    : `/${endpointPath}`;
  const url = new URL(
    `https://graph.facebook.com/${cfg.graphVersion}${cleanPath}`
  );
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
          (errObj &&
            typeof errObj.error_user_msg === 'string' &&
            errObj.error_user_msg) ||
          (errObj && typeof errObj.message === 'string' && errObj.message) ||
          `Meta Graph API request failed (HTTP ${response.status})`;
        const code =
          errObj && typeof errObj.code === 'number' ? errObj.code : undefined;
        const subcode =
          errObj && typeof errObj.error_subcode === 'number'
            ? errObj.error_subcode
            : undefined;
        const rateLimited = isMetaRateLimitFailure(
          response.status,
          code,
          errMsg
        );
        const retryAfterSeconds = rateLimited
          ? parseRetryAfterSeconds(response.headers.get('retry-after'))
          : undefined;

        if (rateLimited && attempt < maxRetries) {
          await sleepMs(2_500 * (attempt + 1));
          continue;
        }

        throw new MetaGraphApiError(
          errMsg,
          rateLimited
            ? 429
            : response.status >= 400 && response.status < 600
              ? response.status
              : 502,
          code,
          subcode,
          rateLimited,
          retryAfterSeconds
        );
      }

      return parsed as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new MetaGraphApiError('Meta Graph API request failed.', 502);
}

async function fetchExistingCatalogItems(
  cfg: MetaEnvConfig
): Promise<ExistingMetaCatalogItem[]> {
  const items: ExistingMetaCatalogItem[] = [];
  let afterCursor: string | undefined;

  for (let page = 0; page < MAX_CATALOG_PAGES; page += 1) {
    const query: Record<string, string> = {
      fields: 'id,retailer_id,retailer_product_group_id,name,url',
      limit: '250',
    };
    if (afterCursor) {
      query.after = afterCursor;
    }

    const res = await metaGraphRequest<{
      data?: ExistingMetaCatalogItem[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(cfg, `/${cfg.catalogId}/products`, { query });

    if (Array.isArray(res.data)) {
      items.push(...res.data);
    }
    const nextAfter = res.paging?.cursors?.after;
    if (!res.paging?.next || !nextAfter) {
      break;
    }
    afterCursor = nextAfter;
  }

  return items;
}

function buildProductMatchKeys(
  product: {
    id?: string | number;
    wcProductId?: number | string;
    sku?: string;
    slug?: string;
    name?: string;
    metaRetailerId?: string;
    metaItemGroupId?: string;
    retailerIds?: string[];
  },
  storefrontBaseUrl: string
) {
  const idCandidates = new Set<string>();
  const addId = (val?: string | number | null) => {
    if (val === undefined || val === null) return;
    const raw = String(val).trim();
    if (!raw) return;
    idCandidates.add(raw.toLowerCase());
    const sanitized = sanitizeRetailerToken(raw);
    if (sanitized) idCandidates.add(sanitized.toLowerCase());
  };

  const wcId =
    product.wcProductId !== undefined && product.wcProductId !== null
      ? String(product.wcProductId).trim()
      : String(product.id || '').trim();
  const sku = (product.sku || '').trim();

  addId(product.id);
  addId(product.wcProductId);
  addId(product.metaRetailerId);
  addId(product.metaItemGroupId);
  addId(sku);

  if (wcId) {
    addId(`wc-${wcId}`);
    addId(`wc_${wcId}`);
    addId(`fds-${wcId}`);
    if (sku) {
      addId(`${sku}_${wcId}`);
      addId(`${sku}-${wcId}`);
    }
  }

  if (Array.isArray(product.retailerIds)) {
    for (const rId of product.retailerIds) addId(rId);
  }

  const canonicalUrlPath = product.slug
    ? `/product/${encodeURIComponent(product.slug.trim())}`.toLowerCase()
    : '';
  const canonicalUrlFull = canonicalUrlPath
    ? `${storefrontBaseUrl.toLowerCase()}${canonicalUrlPath}`
    : '';
  const normalizedTitle = normalizeTitleKey(product.name);

  return {
    idCandidates,
    canonicalUrlPath,
    canonicalUrlFull,
    normalizedTitle,
  };
}

function findMatchingCatalogItems(
  existingItems: ExistingMetaCatalogItem[],
  product: {
    id?: string | number;
    wcProductId?: number | string;
    sku?: string;
    slug?: string;
    name?: string;
    metaRetailerId?: string;
    metaItemGroupId?: string;
    retailerIds?: string[];
  },
  storefrontBaseUrl: string
): ExistingMetaCatalogItem[] {
  const keys = buildProductMatchKeys(product, storefrontBaseUrl);
  const matched = new Map<string, ExistingMetaCatalogItem>();
  const matchedGroupIds = new Set<string>();

  const matchesDirect = (item: ExistingMetaCatalogItem): boolean => {
    const rId = (item.retailer_id || '').trim().toLowerCase();
    const gId = (item.retailer_product_group_id || '').trim().toLowerCase();

    if (rId && keys.idCandidates.has(rId)) return true;
    if (gId && keys.idCandidates.has(gId)) return true;

    // Match composite variant IDs like `<groupId>--<slug>`
    if (rId) {
      for (const candidate of keys.idCandidates) {
        if (
          candidate.length >= 2 &&
          (rId.startsWith(`${candidate}--`) || rId.startsWith(`${candidate}__`))
        ) {
          return true;
        }
      }
    }

    if (item.url && keys.canonicalUrlPath) {
      const itemUrlLower = item.url.toLowerCase();
      if (
        itemUrlLower.includes(keys.canonicalUrlPath) ||
        (keys.canonicalUrlFull && itemUrlLower.startsWith(keys.canonicalUrlFull))
      ) {
        return true;
      }
    }

    if (
      keys.normalizedTitle &&
      keys.normalizedTitle.length >= 5 &&
      item.name &&
      normalizeTitleKey(item.name) === keys.normalizedTitle
    ) {
      return true;
    }

    return false;
  };

  for (const item of existingItems) {
    if (matchesDirect(item)) {
      matched.set(item.id, item);
      if (item.retailer_product_group_id) {
        matchedGroupIds.add(item.retailer_product_group_id.trim());
      }
    }
  }

  // Pull in all sibling variants sharing any matched retailer_product_group_id
  if (matchedGroupIds.size > 0) {
    for (const item of existingItems) {
      const gId = (item.retailer_product_group_id || '').trim();
      if (gId && matchedGroupIds.has(gId)) {
        matched.set(item.id, item);
      }
    }
  }

  return Array.from(matched.values());
}

function parseBatchValidationStatus(
  validationStatus: MetaValidationStatusEntry[] | undefined
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(validationStatus)) return { errors, warnings };

  for (const entry of validationStatus) {
    const prefix = entry.retailer_id ? `[${entry.retailer_id}] ` : '';
    if (Array.isArray(entry.errors)) {
      for (const err of entry.errors) {
        if (err?.message) errors.push(`${prefix}${err.message}`);
      }
    }
    if (Array.isArray(entry.warnings)) {
      for (const warn of entry.warnings) {
        if (warn?.message) warnings.push(`${prefix}${warn.message}`);
      }
    }
  }
  return { errors, warnings };
}

async function discoverMetaShopIds(
  cfg: MetaEnvConfig,
  warnings: string[]
): Promise<string[]> {
  const found = new Set<string>();
  if (cfg.storefrontId) {
    found.add(cfg.storefrontId);
  }

  // 1. Commerce Account shops
  if (cfg.commerceAccountId) {
    try {
      const res = await metaGraphRequest<{
        data?: Array<{ id?: string; fb_page?: { id?: string } }>;
      }>(cfg, `/${cfg.commerceAccountId}/shops`, {
        query: { fields: 'id,shop_status' },
      });
      for (const s of res.data || []) {
        if (s.id) found.add(String(s.id));
      }
    } catch (err) {
      warnings.push(
        `Shop discovery via commerce account skipped: ${err instanceof Error ? err.message : 'unavailable'}`
      );
    }
  }

  // 2. Catalog commerce_merchant_settings
  try {
    const res = await metaGraphRequest<{
      data?: Array<{
        id?: string;
        shops?: { data?: Array<{ id?: string }> };
      }>;
    }>(cfg, `/${cfg.catalogId}/commerce_merchant_settings`, {
      query: { fields: 'id,shops{id}' },
    });
    for (const cms of res.data || []) {
      for (const s of cms.shops?.data || []) {
        if (s.id) found.add(String(s.id));
      }
    }
  } catch {
    // Non-fatal fallback
  }

  // 3. Business commerce_merchant_settings
  if (cfg.businessId) {
    try {
      const res = await metaGraphRequest<{
        data?: Array<{
          id?: string;
          shops?: { data?: Array<{ id?: string }> };
        }>;
      }>(cfg, `/${cfg.businessId}/commerce_merchant_settings`, {
        query: { fields: 'id,shops{id}' },
      });
      for (const cms of res.data || []) {
        for (const s of cms.shops?.data || []) {
          if (s.id) found.add(String(s.id));
        }
      }
    } catch {
      // Non-fatal fallback
    }
  }

  return Array.from(found);
}

interface MetaProductSetRecord {
  id: string;
  name?: string;
  filter?: string;
  product_count?: number;
}

function extractRetailerIdsFromSetFilter(filterRaw: string | undefined): string[] {
  if (!filterRaw) return [];
  try {
    const parsed = JSON.parse(filterRaw) as Record<string, unknown>;
    const ids = new Set<string>();

    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const child of node) walk(child);
        return;
      }
      const obj = node as Record<string, unknown>;
      const retailerObj = obj.retailer_id as Record<string, unknown> | undefined;
      if (retailerObj && typeof retailerObj === 'object') {
        if (typeof retailerObj.eq === 'string') ids.add(retailerObj.eq);
        if (typeof retailerObj.i_contains === 'string') {
          ids.add(retailerObj.i_contains);
        }
        if (Array.isArray(retailerObj.is_any)) {
          for (const val of retailerObj.is_any) {
            if (typeof val === 'string') ids.add(val);
          }
        }
      }
      for (const val of Object.values(obj)) {
        walk(val);
      }
    };

    walk(parsed);
    return Array.from(ids);
  } catch {
    return [];
  }
}

async function ensureCategoryProductSetAndPublish(
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
  let productSets: MetaProductSetRecord[] = [];
  try {
    const res = await metaGraphRequest<{ data?: MetaProductSetRecord[] }>(
      cfg,
      `/${cfg.catalogId}/product_sets`,
      {
        query: {
          fields: 'id,name,filter,product_count',
          limit: '100',
        },
      }
    );
    productSets = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    warnings.push(
      `Category Product Set lookup failed: ${err instanceof Error ? err.message : 'unknown error'}`
    );
    return {
      productSetId: null,
      shopPublished: false,
      shopIds: [],
      cleanedEmptySets: 0,
    };
  }

  const targetLower = categoryName.trim().toLowerCase();
  const matchingSets = productSets.filter(
    (s) => (s.name || '').trim().toLowerCase() === targetLower
  );

  let targetSet = matchingSets[0] || null;
  const existingRetailerIds = targetSet
    ? extractRetailerIdsFromSetFilter(targetSet.filter)
    : [];

  const mergedRetailerIds = Array.from(
    new Set([...existingRetailerIds, ...syncedRetailerIds])
  );
  const filterPayload = JSON.stringify({
    retailer_id: { is_any: mergedRetailerIds },
  });

  let productSetId: string | null = targetSet ? targetSet.id : null;
  try {
    if (!targetSet) {
      const created = await metaGraphRequest<{ id?: string }>(
        cfg,
        `/${cfg.catalogId}/product_sets`,
        {
          method: 'POST',
          body: {
            name: categoryName,
            filter: filterPayload,
          },
        }
      );
      productSetId = created.id ? String(created.id) : null;
    } else {
      await metaGraphRequest(cfg, `/${targetSet.id}`, {
        method: 'POST',
        body: {
          name: categoryName,
          filter: filterPayload,
        },
      });
    }
  } catch (err) {
    warnings.push(
      `Category Product Set update warning: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }

  const shopIds = await discoverMetaShopIds(cfg, warnings);
  let shopPublished = false;

  if (productSetId && shopIds.length > 0) {
    const categorySlug = slugifyPathSegment(categoryName);
    const externalUrl = `${cfg.storefrontBaseUrl}/category/${encodeURIComponent(categorySlug)}`;
    const orderingIndex = getCategoryOrderIndex(categoryName);
    try {
      await metaGraphRequest(cfg, `/${productSetId}`, {
        method: 'POST',
        body: {
          metadata: {
            description: `${categoryName} — Curated Flat $50 USA Deals at Fifty Dollar Shop`,
            external_url: externalUrl,
            cover_image_url: coverImageUrl,
          },
          publish_to_shops: shopIds.map((shopId) => ({
            id: shopId,
            ordering_index: orderingIndex,
          })),
        },
      });
      shopPublished = true;
    } catch (err) {
      warnings.push(
        `Meta Shop collection publishing warning: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }

  // Clean up extra, duplicate, or empty Product Sets that do NOT match valid website categories
  // IMPORTANT: Deletes product sets ONLY — NEVER deletes products!
  const validSetNames = new Set(
    [...WEBSITE_CATEGORIES_ORDER, categoryName].map((c) =>
      c.trim().toLowerCase()
    )
  );
  const keptNames = new Set<string>();
  if (productSetId) {
    keptNames.add(targetLower);
  }

  let cleanedEmptySets = 0;
  for (const ps of productSets) {
    if (!ps.id || ps.id === productSetId) continue;
    const psName = (ps.name || '').trim();
    const psLower = psName.toLowerCase();

    // Never touch Meta's default "All Products" set
    if (psLower === 'all products' || psLower === 'all items') continue;

    const isDuplicateOfKept = keptNames.has(psLower);
    const isInvalidCategory = !validSetNames.has(psLower);
    const isEmpty = typeof ps.product_count === 'number' && ps.product_count === 0;

    if (isDuplicateOfKept || isInvalidCategory || isEmpty) {
      try {
        await metaGraphRequest(cfg, `/${ps.id}`, { method: 'DELETE' });
        cleanedEmptySets += 1;
      } catch {
        // Non-fatal set cleanup
      }
    } else {
      keptNames.add(psLower);
    }
  }

  return { productSetId, shopPublished, shopIds, cleanedEmptySets };
}

async function configureCommerceCheckoutUrlBestEffort(
  cfg: MetaEnvConfig
): Promise<boolean> {
  if (!cfg.commerceAccountId) return false;
  try {
    await metaGraphRequest(cfg, `/${cfg.commerceAccountId}`, {
      method: 'POST',
      body: {
        checkout_config: {
          checkout_url: `${cfg.storefrontBaseUrl}/checkout/`,
        },
      },
    });
    return true;
  } catch {
    // Strictly non-fatal per architecture specification
    return false;
  }
}

interface PreparedProductBatchPlan {
  productIdStr: string;
  productName: string;
  itemGroupId: string;
  categoryName: string;
  coverImageUrl: string;
  syncedRetailerIds: string[];
  deletedStaleIds: string[];
  requests: Array<Record<string, unknown>>;
}

function prepareProductBatchPlan(
  cfg: MetaEnvConfig,
  input: MetaSyncProductInput,
  existingItems: ExistingMetaCatalogItem[]
): PreparedProductBatchPlan {
  if (!input || (!input.id && !input.wcProductId) || !input.name) {
    throw new MetaGraphApiError(
      'Invalid product payload: product ID and title are required.',
      400
    );
  }

  const productIdStr = String(input.wcProductId ?? input.id).trim();
  const baseTitle = stripHtml(input.name, 200);
  if (!baseTitle) {
    throw new MetaGraphApiError('Product title cannot be empty.', 400);
  }

  const baseDescription =
    stripHtml(input.description, 9999) ||
    stripHtml(input.shortDescription, 9999) ||
    `${baseTitle} — Available at Fifty Dollar Shop with Free Tracked USA Shipping.`;

  const currency = (input.currency || 'USD').trim().toUpperCase();
  const brand =
    stripHtml(input.brand || DEFAULT_BRAND_NAME, 100) || DEFAULT_BRAND_NAME;
  const categoryName = resolveWebsiteCategoryName(input);

  const productFallbackImages = [
    input.imageUrl,
    ...(Array.isArray(input.images) ? input.images : []),
  ];
  const primaryProductImages = collectOrderedHdImages(
    input.imageUrl,
    productFallbackImages,
    cfg.storefrontBaseUrl
  );

  if (!primaryProductImages.primary) {
    throw new MetaGraphApiError(
      'No valid public HTTPS product image found. Inline data: and blob: URLs cannot be synced to Meta Catalog.',
      400
    );
  }

  const matchedExisting = findMatchingCatalogItems(
    existingItems,
    input,
    cfg.storefrontBaseUrl
  );

  const existingGroupId =
    matchedExisting.find((m) => m.retailer_product_group_id)
      ?.retailer_product_group_id ||
    (input.metaItemGroupId ? sanitizeRetailerToken(input.metaItemGroupId, 100) : '');

  const defaultGroupId =
    sanitizeRetailerToken(
      input.isWooCommerce || input.wcProductId
        ? `wc-${productIdStr}`
        : `fds-${productIdStr}`,
      70
    ) || `fds-${Date.now()}`;

  const itemGroupId = existingGroupId || defaultGroupId;

  const rawVariants: MetaVariantInput[] =
    Array.isArray(input.variants) && input.variants.length > 0
      ? input.variants.slice(0, 150)
      : [
          {
            id: sanitizeRetailerToken(
              input.metaRetailerId || defaultGroupId,
              100
            ),
            sku: input.sku,
            title: baseTitle,
            description: baseDescription,
            price: input.price,
            salePrice: input.salePrice,
            currency,
            inStock: input.inStock !== false,
            stockQuantity: input.stockQuantity,
            imageUrl: primaryProductImages.primary,
            additionalImageUrls: primaryProductImages.additional,
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
  const seenRetailerIds = new Set<string>();

  for (let i = 0; i < rawVariants.length; i += 1) {
    const variant = rawVariants[i];
    let retailerId = sanitizeRetailerToken(variant.id || '', 100);
    if (!retailerId) {
      retailerId = sanitizeRetailerToken(`${itemGroupId}--v${i + 1}`, 100);
    }
    if (seenRetailerIds.has(retailerId)) {
      retailerId = sanitizeRetailerToken(`${retailerId}-${i + 1}`, 100);
    }
    seenRetailerIds.add(retailerId);
    syncedRetailerIds.push(retailerId);

    const variantImages = collectOrderedHdImages(
      variant.imageUrl,
      [
        ...(Array.isArray(variant.additionalImageUrls)
          ? variant.additionalImageUrls
          : []),
        primaryProductImages.primary,
        ...primaryProductImages.additional,
      ],
      cfg.storefrontBaseUrl
    );

    const imageLink = variantImages.primary || primaryProductImages.primary;
    if (!imageLink) {
      throw new MetaGraphApiError(
        `Variant "${retailerId}" has no valid public HTTPS image URL.`,
        400
      );
    }

    const basePriceNum =
      parseNumericPrice(variant.price) || parseNumericPrice(input.price) || 50;
    const salePriceNum = parseNumericPrice(variant.salePrice);
    const hasValidSale = salePriceNum > 0 && salePriceNum < basePriceNum;

    const variantInStock = variant.inStock !== false;
    const explicitStock =
      typeof variant.stockQuantity === 'number' &&
      Number.isFinite(variant.stockQuantity)
        ? Math.max(0, Math.floor(variant.stockQuantity))
        : null;
    const quantityToSell = !variantInStock
      ? 0
      : explicitStock !== null
        ? explicitStock
        : 50;

    const variantTitle = stripHtml(variant.title || baseTitle, 200) || baseTitle;
    const variantDescription =
      stripHtml(variant.description || baseDescription, 9999) ||
      baseDescription;

    const canonicalLink = buildCanonicalProductLink(
      cfg.storefrontBaseUrl,
      input,
      variant
    );
    const checkoutUrl = buildCheckoutUrl(cfg.storefrontBaseUrl, retailerId);

    const additionalAttrs: string[] = [];
    if (Array.isArray(variant.attributes)) {
      for (const attr of variant.attributes) {
        const attrName = stripHtml(attr.name, 60);
        const attrVal = stripHtml(attr.value, 100);
        if (!attrName || !attrVal) continue;
        const lowerName = attrName.toLowerCase();
        if (lowerName === 'color' || lowerName === 'colour' || lowerName === 'size') {
          continue;
        }
        additionalAttrs.push(`${attrName}:${attrVal}`);
      }
    }

    const data: Record<string, unknown> = {
      id: retailerId,
      title: variantTitle,
      description: variantDescription,
      availability: variantInStock ? 'in stock' : 'out of stock',
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

    if (isMultiVariant) {
      data.item_group_id = itemGroupId;
    }
    if (hasValidSale) {
      data.sale_price = formatMetaPrice(
        salePriceNum,
        variant.currency || currency
      );
    }
    if (variantImages.additional.length > 0) {
      data.additional_image_link = variantImages.additional;
    }
    if (variant.color && variant.color.trim()) {
      data.color = stripHtml(variant.color, 100);
    }
    if (variant.size && variant.size.trim()) {
      data.size = stripHtml(variant.size, 100);
    }
    if (additionalAttrs.length > 0) {
      data.additional_variant_attribute = additionalAttrs.join(', ').slice(0, 500);
    }

    requests.push({
      method: 'UPDATE',
      retailer_id: retailerId,
      data,
    });
  }

  const deletedStaleIds: string[] = [];
  for (const existing of matchedExisting) {
    const existingRid = (existing.retailer_id || '').trim();
    if (existingRid && !seenRetailerIds.has(existingRid)) {
      deletedStaleIds.push(existingRid);
      requests.push({
        method: 'DELETE',
        retailer_id: existingRid,
      });
    }
  }

  return {
    productIdStr,
    productName: baseTitle,
    itemGroupId,
    categoryName,
    coverImageUrl: primaryProductImages.primary,
    syncedRetailerIds,
    deletedStaleIds,
    requests,
  };
}

export async function syncProductToMetaCatalog(
  input: MetaSyncProductInput
): Promise<MetaSyncResult> {
  const cfg = getMetaEnvConfig();
  if (!cfg.accessToken || !cfg.catalogId) {
    throw new MetaGraphApiError(
      'Meta Commerce is not configured on the server yet. Set META_ACCESS_TOKEN and META_CATALOG_ID in your server environment variables.',
      503
    );
  }

  const warnings: string[] = [];

  // 1. Discover existing items in Meta catalog for in-place re-sync & stale variant cleanup
  let existingItems: ExistingMetaCatalogItem[] = [];
  try {
    existingItems = await fetchExistingCatalogItems(cfg);
  } catch (err) {
    warnings.push(
      `Catalog lookup before upsert fell back to fresh upsert: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }

  const plan = prepareProductBatchPlan(cfg, input, existingItems);

  // 2. Submit chunked items_batch upserts (max 200 per batch)
  const batchErrors: string[] = [];
  const chunks = chunkArray(plan.requests, MAX_BATCH_SIZE);

  for (let i = 0; i < chunks.length; i += 1) {
    if (i > 0) await sleepMs(2_000);
    const res = await metaGraphRequest<{
      handles?: string[];
      validation_status?: MetaValidationStatusEntry[];
    }>(cfg, `/${cfg.catalogId}/items_batch`, {
      method: 'POST',
      body: {
        allow_upsert: true,
        item_type: 'PRODUCT_ITEM',
        requests: chunks[i],
      },
    });

    const parsed = parseBatchValidationStatus(res.validation_status);
    batchErrors.push(...parsed.errors);
    warnings.push(...parsed.warnings);
  }

  if (batchErrors.length > 0) {
    throw new MetaGraphApiError(
      `Meta Catalog validation rejected one or more variants: ${batchErrors.slice(0, 3).join(' | ')}`,
      422
    );
  }

  // 3. Category Product Set & Meta Shop Collection Publishing
  const setResult = await ensureCategoryProductSetAndPublish(cfg, {
    categoryName: plan.categoryName,
    syncedRetailerIds: plan.syncedRetailerIds,
    coverImageUrl: plan.coverImageUrl,
    warnings,
  });

  // 4. Best-effort website checkout URL configuration on Commerce Account (non-fatal)
  const checkoutUrlConfigured =
    await configureCommerceCheckoutUrlBestEffort(cfg);

  return {
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
  };
}

/**
 * Syncs multiple products in ONE combined Meta items_batch call (chunked only if >200 variant requests)
 * and updates Category Product Sets & Meta Shop Collections ONCE per category — cutting Meta
 * Catalog API call volume by >90% during bulk syncs to avoid Meta's batch upload rate limits.
 */
export async function syncProductsBatchToMetaCatalog(
  inputs: MetaSyncProductInput[],
  options: { skipCollections?: boolean } = {}
): Promise<MetaBulkSyncResult> {
  const cfg = getMetaEnvConfig();
  if (!cfg.accessToken || !cfg.catalogId) {
    throw new MetaGraphApiError(
      'Meta Commerce is not configured on the server yet. Set META_ACCESS_TOKEN and META_CATALOG_ID in your server environment variables.',
      503
    );
  }

  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new MetaGraphApiError(
      'At least one product is required for bulk Meta sync.',
      400
    );
  }

  const sharedWarnings: string[] = [];
  let existingItems: ExistingMetaCatalogItem[] = [];
  try {
    existingItems = await fetchExistingCatalogItems(cfg);
  } catch (err) {
    sharedWarnings.push(
      `Catalog lookup before bulk upsert fell back to fresh upsert: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }

  const plans: PreparedProductBatchPlan[] = [];
  const productErrors: MetaBulkSyncProductError[] = [];

  for (const input of inputs) {
    try {
      plans.push(prepareProductBatchPlan(cfg, input, existingItems));
    } catch (err) {
      productErrors.push({
        productId: String(input?.wcProductId ?? input?.id ?? 'unknown'),
        productName: stripHtml(input?.name || 'Product', 160) || 'Product',
        message:
          err instanceof Error ? err.message : 'Invalid product payload.',
      });
    }
  }

  const retailerToPlan = new Map<string, PreparedProductBatchPlan>();
  const combinedRequests: Array<Record<string, unknown>> = [];
  for (const plan of plans) {
    for (const rid of plan.syncedRetailerIds) {
      retailerToPlan.set(rid, plan);
    }
    for (const delId of plan.deletedStaleIds) {
      if (!retailerToPlan.has(delId)) {
        retailerToPlan.set(delId, plan);
      }
    }
    combinedRequests.push(...plan.requests);
  }

  const errorsByProductId = new Map<string, string[]>();
  const warningsByProductId = new Map<string, string[]>();
  const chunks = chunkArray(combinedRequests, MAX_BATCH_SIZE);
  let batchCallsMade = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    if (i > 0) await sleepMs(2_000);
    const res = await metaGraphRequest<{
      handles?: string[];
      validation_status?: MetaValidationStatusEntry[];
    }>(cfg, `/${cfg.catalogId}/items_batch`, {
      method: 'POST',
      body: {
        allow_upsert: true,
        item_type: 'PRODUCT_ITEM',
        requests: chunks[i],
      },
    });
    batchCallsMade += 1;

    if (Array.isArray(res.validation_status)) {
      for (const entry of res.validation_status) {
        const rid = (entry.retailer_id || '').trim();
        const ownerPlan = rid ? retailerToPlan.get(rid) : undefined;
        const targetPid = ownerPlan?.productIdStr || '';
        const pfx = rid ? `[${rid}] ` : '';

        if (Array.isArray(entry.errors)) {
          for (const e of entry.errors) {
            if (!e?.message) continue;
            if (targetPid) {
              const list = errorsByProductId.get(targetPid) || [];
              list.push(`${pfx}${e.message}`);
              errorsByProductId.set(targetPid, list);
            } else {
              sharedWarnings.push(`${pfx}${e.message}`);
            }
          }
        }
        if (Array.isArray(entry.warnings)) {
          for (const w of entry.warnings) {
            if (!w?.message) continue;
            if (targetPid) {
              const list = warningsByProductId.get(targetPid) || [];
              list.push(`${pfx}${w.message}`);
              warningsByProductId.set(targetPid, list);
            } else {
              sharedWarnings.push(`${pfx}${w.message}`);
            }
          }
        }
      }
    }
  }

  const successfulPlans: PreparedProductBatchPlan[] = [];
  for (const plan of plans) {
    const pErrs = errorsByProductId.get(plan.productIdStr) || [];
    if (pErrs.length > 0) {
      productErrors.push({
        productId: plan.productIdStr,
        productName: plan.productName,
        message: `Meta Catalog validation rejected one or more variants: ${pErrs.slice(0, 3).join(' | ')}`,
      });
    } else {
      successfulPlans.push(plan);
    }
  }

  // Publish Category Product Sets & Meta Shop Collections ONCE per unique category in this chunk
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

  if (!options.skipCollections && successfulPlans.length > 0) {
    const byCategory = new Map<
      string,
      { retailerIds: string[]; coverImageUrl: string }
    >();
    for (const plan of successfulPlans) {
      const existing = byCategory.get(plan.categoryName);
      if (existing) {
        existing.retailerIds.push(...plan.syncedRetailerIds);
      } else {
        byCategory.set(plan.categoryName, {
          retailerIds: [...plan.syncedRetailerIds],
          coverImageUrl: plan.coverImageUrl,
        });
      }
    }

    for (const [catName, info] of byCategory.entries()) {
      const setRes = await ensureCategoryProductSetAndPublish(cfg, {
        categoryName: catName,
        syncedRetailerIds: Array.from(new Set(info.retailerIds)),
        coverImageUrl: info.coverImageUrl,
        warnings: sharedWarnings,
      });
      categorySetInfo.set(catName, setRes);
    }

    checkoutUrlConfigured = await configureCommerceCheckoutUrlBestEffort(cfg);
  }

  const syncedAt = new Date().toISOString();
  const results: MetaSyncResult[] = successfulPlans.map((plan) => {
    const setRes = categorySetInfo.get(plan.categoryName);
    const pWarnings = [
      ...sharedWarnings,
      ...(warningsByProductId.get(plan.productIdStr) || []),
    ];
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
      warnings: pWarnings,
      syncedAt,
    };
  });

  return {
    ok: true,
    results,
    errors: productErrors,
    batchCallsMade,
    syncedAt,
  };
}

export async function removeProductFromMetaCatalog(
  input: MetaRemoveProductInput
): Promise<MetaRemoveResult> {
  const cfg = getMetaEnvConfig();
  if (!cfg.accessToken || !cfg.catalogId) {
    throw new MetaGraphApiError(
      'Meta Commerce is not configured on the server yet. Set META_ACCESS_TOKEN and META_CATALOG_ID in your server environment variables.',
      503
    );
  }

  const productIdStr = String(
    input?.wcProductId ?? input?.id ?? input?.metaRetailerId ?? ''
  ).trim();
  if (!productIdStr && (!input?.retailerIds || input.retailerIds.length === 0)) {
    throw new MetaGraphApiError(
      'Product identifier or retailer IDs are required to remove from Meta Catalog.',
      400
    );
  }

  const warnings: string[] = [];
  const existingItems = await fetchExistingCatalogItems(cfg);
  const matched = findMatchingCatalogItems(
    existingItems,
    input,
    cfg.storefrontBaseUrl
  );

  const retailerIdsToDelete = new Set<string>();
  const catalogItemIdsToDelete = new Set<string>();

  for (const item of matched) {
    if (item.retailer_id) retailerIdsToDelete.add(item.retailer_id.trim());
    if (item.id) catalogItemIdsToDelete.add(String(item.id).trim());
  }

  if (input.metaRetailerId && input.metaRetailerId.trim()) {
    retailerIdsToDelete.add(input.metaRetailerId.trim());
  }
  if (Array.isArray(input.retailerIds)) {
    for (const rid of input.retailerIds) {
      if (typeof rid === 'string' && rid.trim()) {
        retailerIdsToDelete.add(rid.trim());
      }
    }
  }

  const retailerList = Array.from(retailerIdsToDelete);
  const itemIdList = Array.from(catalogItemIdsToDelete);

  let batchFailed = false;
  if (retailerList.length > 0) {
    const deleteChunks = chunkArray(
      retailerList.map((rid) => ({
        method: 'DELETE',
        retailer_id: rid,
      })),
      MAX_BATCH_SIZE
    );
    for (const chunk of deleteChunks) {
      try {
        const res = await metaGraphRequest<{
          validation_status?: MetaValidationStatusEntry[];
        }>(cfg, `/${cfg.catalogId}/items_batch`, {
          method: 'POST',
          body: {
            item_type: 'PRODUCT_ITEM',
            requests: chunk,
          },
        });
        const parsed = parseBatchValidationStatus(res.validation_status);
        warnings.push(...parsed.warnings);
        if (parsed.errors.length > 0) {
          batchFailed = true;
          warnings.push(...parsed.errors);
        }
      } catch (err) {
        batchFailed = true;
        warnings.push(
          `Batch delete fallback triggered: ${err instanceof Error ? err.message : 'unknown error'}`
        );
      }
    }
  }

  // Direct DELETE /{catalogItemId} fallback if items_batch failed or had no retailer_id matches
  if ((batchFailed || retailerList.length === 0) && itemIdList.length > 0) {
    for (const catalogItemId of itemIdList) {
      const safeId = sanitizeGraphId(catalogItemId);
      if (!safeId) continue;
      try {
        await metaGraphRequest(cfg, `/${safeId}`, { method: 'DELETE' });
      } catch (err) {
        warnings.push(
          `Direct delete for item ${safeId}: ${err instanceof Error ? err.message : 'failed'}`
        );
      }
    }
  }

  return {
    ok: true,
    productId: productIdStr,
    removedRetailerIds: retailerList,
    removedCatalogItemIds: itemIdList,
    removedCount: Math.max(retailerList.length, itemIdList.length),
    warnings,
    removedAt: new Date().toISOString(),
  };
}

export async function handleMetaSyncProductRequest(
  req: Request,
  res: Response
): Promise<Response> {
  res.setHeader('Cache-Control', 'no-store');
  const auth = verifyMetaAdminAuth(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({
      ok: false,
      code: auth.status === 403 ? 'csrf_check_failed' : 'admin_unauthorized',
      message: auth.message || 'Admin authentication required.',
    });
  }

  try {
    if (Array.isArray(req.body?.products)) {
      const bulkResult = await syncProductsBatchToMetaCatalog(
        req.body.products as MetaSyncProductInput[],
        { skipCollections: Boolean(req.body?.skipCollections) }
      );
      return res.status(200).json(bulkResult);
    }

    const payload = (req.body?.product || req.body) as MetaSyncProductInput;
    const result = await syncProductToMetaCatalog(payload);
    return res.status(200).json(result);
  } catch (err) {
    const isMetaErr = err instanceof MetaGraphApiError;
    const isRateLimit = isMetaErr && err.isRateLimit;
    const status = isMetaErr && err.status ? err.status : 500;
    const message =
      err instanceof Error
        ? err.message
        : 'Unable to sync product to Meta Catalog.';
    if (isRateLimit && err.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }
    return res.status(status).json({
      ok: false,
      code: isRateLimit ? 'meta_rate_limited' : 'meta_sync_failed',
      rateLimited: isRateLimit,
      retryAfterSeconds: isRateLimit ? err.retryAfterSeconds || 25 : undefined,
      message,
    });
  }
}

export async function handleMetaRemoveProductRequest(
  req: Request,
  res: Response
): Promise<Response> {
  res.setHeader('Cache-Control', 'no-store');
  const auth = verifyMetaAdminAuth(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({
      ok: false,
      code: auth.status === 403 ? 'csrf_check_failed' : 'admin_unauthorized',
      message: auth.message || 'Admin authentication required.',
    });
  }

  try {
    const payload = (req.body?.product || req.body) as MetaRemoveProductInput;
    const result = await removeProductFromMetaCatalog(payload);
    return res.status(200).json(result);
  } catch (err) {
    const status =
      err instanceof MetaGraphApiError && err.status ? err.status : 500;
    const message =
      err instanceof Error
        ? err.message
        : 'Unable to remove product from Meta Catalog.';
    return res.status(status).json({
      ok: false,
      code: 'meta_remove_failed',
      message,
    });
  }
}
