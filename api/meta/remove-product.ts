import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Self-contained, zero-relative-import Vercel Serverless handler:
 * POST /api/meta/remove-product
 *
 * Removes a product (and all sibling variants) ONLY from Meta Commerce Catalog,
 * leaving WooCommerce and website records completely untouched.
 */

const DEFAULT_STOREFRONT_BASE_URL = 'https://www.fiftydollarshop.com';
const DEFAULT_GRAPH_API_VERSION = 'v22.0';
const ADMIN_COOKIE_NAME = 'fds_admin_session';
const STORE_FILE = path.join(os.tmpdir(), 'fds-admin-state-v1.json');
const MAX_BATCH_SIZE = 200;
const MAX_CATALOG_PAGES = 4;

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

interface VercelResponse extends ServerResponse {
  status?: (code: number) => VercelResponse;
  json?: (data: unknown) => void;
}

interface MetaRemoveProductInput {
  id?: string | number;
  wcProductId?: number | string;
  sku?: string;
  slug?: string;
  name?: string;
  metaRetailerId?: string;
  metaItemGroupId?: string;
  retailerIds?: string[];
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
  storefrontBaseUrl: string;
  graphVersion: string;
}

class MetaApiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status;
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
    storefrontBaseUrl,
    graphVersion,
  };
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
  if (!input) return '';
  return input
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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
      throw new MetaApiError(
        errMsg,
        response.status >= 400 && response.status < 600 ? response.status : 502
      );
    }
    return parsed as T;
  } finally {
    clearTimeout(timeout);
  }
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
    const input = (rawBody.product || rawBody) as MetaRemoveProductInput;
    const productIdStr = String(
      input?.wcProductId ?? input?.id ?? input?.metaRetailerId ?? ''
    ).trim();
    if (!productIdStr && (!input?.retailerIds || input.retailerIds.length === 0)) {
      return sendJson(res, 400, {
        ok: false,
        code: 'invalid_product',
        message:
          'Product identifier or retailer IDs are required to remove from Meta Catalog.',
      });
    }

    const warnings: string[] = [];
    const existingItems: ExistingMetaCatalogItem[] = [];
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
    if (productIdStr) {
      addCandidate(`wc-${productIdStr}`);
      addCandidate(`wc_${productIdStr}`);
      addCandidate(`fds-${productIdStr}`);
      if (input.sku) {
        addCandidate(`${input.sku}_${productIdStr}`);
        addCandidate(`${input.sku}-${productIdStr}`);
      }
    }
    if (Array.isArray(input.retailerIds)) {
      for (const r of input.retailerIds) addCandidate(r);
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

    const retailerIdsToDelete = new Set<string>();
    const catalogItemIdsToDelete = new Set<string>();
    for (const item of matchedMap.values()) {
      if (item.retailer_id) retailerIdsToDelete.add(item.retailer_id.trim());
      if (item.id) catalogItemIdsToDelete.add(String(item.id).trim());
    }
    if (input.metaRetailerId?.trim()) retailerIdsToDelete.add(input.metaRetailerId.trim());
    if (Array.isArray(input.retailerIds)) {
      for (const rid of input.retailerIds) {
        if (typeof rid === 'string' && rid.trim()) retailerIdsToDelete.add(rid.trim());
      }
    }

    const retailerList = Array.from(retailerIdsToDelete);
    const itemIdList = Array.from(catalogItemIdsToDelete);

    let batchFailed = false;
    if (retailerList.length > 0) {
      for (const chunk of chunkArray(
        retailerList.map((rid) => ({ method: 'DELETE', retailer_id: rid })),
        MAX_BATCH_SIZE
      )) {
        try {
          const batchRes = await metaGraphRequest<{
            validation_status?: MetaValidationStatusEntry[];
          }>(cfg, `/${cfg.catalogId}/items_batch`, {
            method: 'POST',
            body: { item_type: 'PRODUCT_ITEM', requests: chunk },
          });
          for (const entry of batchRes.validation_status || []) {
            const pfx = entry.retailer_id ? `[${entry.retailer_id}] ` : '';
            for (const w of entry.warnings || []) {
              if (w?.message) warnings.push(`${pfx}${w.message}`);
            }
            for (const e of entry.errors || []) {
              if (e?.message) {
                batchFailed = true;
                warnings.push(`${pfx}${e.message}`);
              }
            }
          }
        } catch (err) {
          batchFailed = true;
          warnings.push(
            `Batch delete fallback triggered: ${err instanceof Error ? err.message : 'failed'}`
          );
        }
      }
    }

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

    return sendJson(res, 200, {
      ok: true,
      productId: productIdStr,
      removedRetailerIds: retailerList,
      removedCatalogItemIds: itemIdList,
      removedCount: Math.max(retailerList.length, itemIdList.length),
      warnings,
      removedAt: new Date().toISOString(),
    });
  } catch (err) {
    const status = err instanceof MetaApiError ? err.status : 500;
    return sendJson(res, status, {
      ok: false,
      code: 'meta_remove_failed',
      message:
        err instanceof Error
          ? err.message
          : 'Unable to remove product from Meta Catalog.',
    });
  }
}
