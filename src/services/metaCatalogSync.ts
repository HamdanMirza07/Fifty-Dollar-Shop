import { getAdminBearerToken } from '../api/admin';
import { fetchWcProductById } from '../api/woocommerce';
import type { MetaProductSyncStatusRecord } from '../types/admin';
import type { WcProduct, WcVariationDetail } from '../types/woocommerce';
import { decodeHtmlEntities } from '../utils/format';

const META_SYNC_STORAGE_KEY = 'fds_meta_catalog_sync_v1';
const MAX_VARIANTS_PER_PRODUCT = 150;
const WC_VARIATION_FETCH_BATCH_SIZE = 6;

export interface MetaClientVariantPayload {
  id: string;
  wcVariationId?: number;
  sku?: string;
  title?: string;
  description?: string;
  price: number | string;
  salePrice?: number | string | null;
  currency: string;
  inStock: boolean;
  stockQuantity?: number | null;
  imageUrl?: string;
  additionalImageUrls?: string[];
  color?: string;
  size?: string;
  attributes: Array<{ name: string; value: string }>;
  slug?: string;
}

export interface MetaClientSyncProductInput {
  id: string | number;
  wcProductId?: number;
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
  variants?: MetaClientVariantPayload[];
}

export interface MetaSyncApiResponse {
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

export interface MetaBulkSyncApiResponse {
  ok: boolean;
  results: MetaSyncApiResponse[];
  errors: Array<{
    productId: string;
    productName: string;
    message: string;
  }>;
  batchCallsMade: number;
  syncedAt: string;
}

export interface MetaRemoveApiResponse {
  ok: boolean;
  productId: string;
  removedRetailerIds: string[];
  removedCatalogItemIds: string[];
  removedCount: number;
  warnings: string[];
  removedAt: string;
}

export interface MetaApiClientError extends Error {
  status?: number;
  code?: string;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
}

// In-memory cache of fresh WooCommerce product details (with variation_details)
const wcLiveProductCache = new Map<number, WcProduct>();

export function clearWcLiveSyncCache() {
  wcLiveProductCache.clear();
}

export function loadMetaSyncStatuses(): Record<string, MetaProductSyncStatusRecord> {
  try {
    const raw = window.localStorage.getItem(META_SYNC_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MetaProductSyncStatusRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMetaSyncStatuses(
  statuses: Record<string, MetaProductSyncStatusRecord>
): void {
  try {
    window.localStorage.setItem(META_SYNC_STORAGE_KEY, JSON.stringify(statuses));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function upsertMetaSyncStatus(
  record: MetaProductSyncStatusRecord
): Record<string, MetaProductSyncStatusRecord> {
  const current = loadMetaSyncStatuses();
  const next = { ...current, [record.productId]: record };
  saveMetaSyncStatuses(next);
  return next;
}

function sanitizeSlugToken(raw: string): string {
  return decodeHtmlEntities(raw || '')
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeRetailerId(raw: string, maxLen = 100): string {
  return raw
    .trim()
    .replace(/_/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '-')
    .replace(/-{3,}/g, '--')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

function parsePriceNumber(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isColorAttributeName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('color') || n.includes('colour') || n.includes('shade') || n.includes('style');
}

function isSizeAttributeName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('size') || n.includes('length') || n.includes('capacity');
}

function cartesianProduct<T>(arrays: T[][], maxTotal: number): T[][] {
  let result: T[][] = [[]];
  for (const list of arrays) {
    if (list.length === 0) continue;
    const next: T[][] = [];
    for (const prefix of result) {
      for (const item of list) {
        next.push([...prefix, item]);
        if (next.length >= maxTotal) break;
      }
      if (next.length >= maxTotal) break;
    }
    result = next;
    if (result.length >= maxTotal) break;
  }
  return result;
}

/**
 * Fetches fresh live WooCommerce product + variation details via `/api/wc/*` Store API proxy.
 * Processes multiple products in parallel batches of 6, with in-memory caching + force refresh on sync.
 */
export async function fetchFreshWcProductForMetaSync(
  product: WcProduct,
  forceRefresh = true
): Promise<WcProduct> {
  if (!forceRefresh) {
    const cached = wcLiveProductCache.get(product.id);
    if (cached) return cached;
  }
  try {
    const fresh = await fetchWcProductById(product.id);
    const merged: WcProduct = {
      ...product,
      ...fresh,
      categories:
        fresh.categories && fresh.categories.length > 0
          ? fresh.categories
          : product.categories,
      images:
        fresh.images && fresh.images.length > 0 ? fresh.images : product.images,
    };
    wcLiveProductCache.set(product.id, merged);
    return merged;
  } catch {
    return product;
  }
}

export async function prefetchFreshWcProductsInBatches(
  products: WcProduct[],
  forceRefresh = true
): Promise<Map<number, WcProduct>> {
  const result = new Map<number, WcProduct>();
  for (let i = 0; i < products.length; i += WC_VARIATION_FETCH_BATCH_SIZE) {
    const batch = products.slice(i, i + WC_VARIATION_FETCH_BATCH_SIZE);
    const settled = await Promise.all(
      batch.map(async (p) => [p.id, await fetchFreshWcProductForMetaSync(p, forceRefresh)] as const)
    );
    for (const [id, fresh] of settled) {
      result.set(id, fresh);
    }
  }
  return result;
}

/**
 * Builds clean, deduplicated multi-variant payloads for Meta Commerce Catalog,
 * including Cartesian wildcard expansion (when a WooCommerce variation attribute value is `""`
 * meaning "Any Size" / "Any Color"), capped at 150 variants per product.
 */
export function buildMetaVariantPayloads(
  product: WcProduct,
  existingGroupId?: string
): MetaClientVariantPayload[] {
  const baseTitle = decodeHtmlEntities(product.name);
  const baseDesc = product.description || product.short_description || baseTitle;
  const baseGroupId = sanitizeRetailerId(
    existingGroupId || `wc-${product.id}`,
    65
  );
  const allProductImages = (product.images || [])
    .map((img) => img.src)
    .filter(Boolean);
  const baseRegularPrice =
    parsePriceNumber(product.regular_price) ||
    parsePriceNumber(product.price) ||
    50;
  const baseSalePrice = parsePriceNumber(product.sale_price);
  const baseHasSale = baseSalePrice > 0 && baseSalePrice < baseRegularPrice;

  // Build attribute lookup map for wildcard ("") expansion
  const variationAttributes = (product.attributes || []).filter(
    (attr) => attr.variation !== false && Array.isArray(attr.options) && attr.options.length > 0
  );
  const termsByAttrKey = new Map<string, { name: string; terms: string[] }>();
  for (const attr of variationAttributes) {
    const key = attr.name.trim().toLowerCase();
    const terms = (attr.options || [])
      .map((opt) => decodeHtmlEntities(String(opt || '')).trim())
      .filter(Boolean);
    if (key && terms.length > 0) {
      termsByAttrKey.set(key, { name: decodeHtmlEntities(attr.name), terms });
    }
  }

  const productInStock = product.stock_status !== 'outofstock';

  const variationDetails: WcVariationDetail[] =
    Array.isArray(product.variation_details) && product.variation_details.length > 0
      ? product.variation_details
      : (product.variations || []).map((variationId) => ({
          id: variationId,
          sku: product.sku || '',
          price: product.price || '50',
          regular_price: product.regular_price || product.price || '50',
          sale_price: product.sale_price || '',
          on_sale: product.on_sale,
          stock_status: product.stock_status,
          stock_quantity: product.stock_quantity ?? null,
          image: product.images?.[0],
          attributes: [],
        }));

  // Simple product (no variations and no variation attributes)
  if (variationDetails.length === 0 && variationAttributes.length === 0) {
    return [
      {
        id: sanitizeRetailerId(`wc-${product.id}`, 100),
        sku: product.sku || undefined,
        title: baseTitle,
        description: baseDesc,
        price: baseRegularPrice,
        salePrice: baseHasSale ? baseSalePrice : null,
        currency: 'USD',
        inStock: productInStock,
        stockQuantity: product.stock_quantity ?? null,
        imageUrl: allProductImages[0],
        additionalImageUrls: allProductImages.slice(1, 11),
        attributes: [],
        slug: product.slug,
      },
    ];
  }

  // Variable product with variation details (or attribute-only expansion)
  const variants: MetaClientVariantPayload[] = [];
  const seenSignatures = new Set<string>();
  const seenIds = new Set<string>();

  const pushVariant = (
    sourceVar: WcVariationDetail | null,
    resolvedAttrs: Array<{ name: string; value: string }>,
    isWildcardExpanded: boolean
  ) => {
    if (variants.length >= MAX_VARIANTS_PER_PRODUCT) return;

    const sortedSig = resolvedAttrs
      .map(
        (a) =>
          `${a.name.trim().toLowerCase()}=${decodeHtmlEntities(a.value).trim().toLowerCase()}`
      )
      .sort()
      .join('|');
    const sigKey = sortedSig || `var-${sourceVar?.id ?? variants.length}`;
    if (seenSignatures.has(sigKey)) return;
    seenSignatures.add(sigKey);

    let color: string | undefined;
    let size: string | undefined;
    for (const attr of resolvedAttrs) {
      const cleanVal = decodeHtmlEntities(attr.value).trim();
      if (!cleanVal) continue;
      if (!color && isColorAttributeName(attr.name)) {
        color = cleanVal;
      } else if (!size && isSizeAttributeName(attr.name)) {
        size = cleanVal;
      }
    }

    const colorSlug = color ? sanitizeSlugToken(color) : '';
    const sizeSlug = size ? sanitizeSlugToken(size) : '';
    const otherSlugs = resolvedAttrs
      .filter(
        (a) => !isColorAttributeName(a.name) && !isSizeAttributeName(a.name)
      )
      .map((a) => sanitizeSlugToken(a.value))
      .filter(Boolean);
    const attrSlugChain = [colorSlug, sizeSlug, ...otherSlugs].filter(Boolean);

    let retailerId = '';
    if (sourceVar && sourceVar.id) {
      if (isWildcardExpanded && attrSlugChain.length > 0) {
        retailerId = sanitizeRetailerId(
          `${sourceVar.id}--${attrSlugChain.join('--')}`,
          100
        );
      } else if (attrSlugChain.length > 0) {
        retailerId = sanitizeRetailerId(
          `${sourceVar.id}--${attrSlugChain.join('--')}`,
          100
        );
      } else {
        retailerId = sanitizeRetailerId(`${sourceVar.id}`, 100);
      }
    } else if (attrSlugChain.length > 0) {
      retailerId = sanitizeRetailerId(
        `${baseGroupId}--${attrSlugChain.join('--')}`,
        100
      );
    } else {
      retailerId = sanitizeRetailerId(
        `${baseGroupId}--v${variants.length + 1}`,
        100
      );
    }

    if (seenIds.has(retailerId)) {
      retailerId = sanitizeRetailerId(
        `${retailerId}-${variants.length + 1}`,
        100
      );
    }
    seenIds.add(retailerId);

    const varRegPrice = sourceVar
      ? parsePriceNumber(sourceVar.regular_price) ||
        parsePriceNumber(sourceVar.price) ||
        baseRegularPrice
      : baseRegularPrice;
    const varSalePrice = sourceVar
      ? parsePriceNumber(sourceVar.sale_price)
      : baseSalePrice;
    const varHasSale = varSalePrice > 0 && varSalePrice < varRegPrice;

    const varInStock = sourceVar
      ? sourceVar.stock_status !== 'outofstock'
      : productInStock;

    const varImg = sourceVar?.image?.src || allProductImages[0];
    const addlImages = allProductImages.filter((url) => url !== varImg).slice(0, 10);

    const attrLabelSuffix = [color, size].filter(Boolean).join(' / ');
    const variantTitle = attrLabelSuffix
      ? `${baseTitle} - ${attrLabelSuffix}`
      : baseTitle;

    variants.push({
      id: retailerId,
      wcVariationId: sourceVar?.id,
      sku: sourceVar?.sku || product.sku || undefined,
      title: variantTitle.slice(0, 200),
      description: baseDesc,
      price: varRegPrice,
      salePrice: varHasSale ? varSalePrice : null,
      currency: 'USD',
      inStock: varInStock,
      stockQuantity: sourceVar?.stock_quantity ?? product.stock_quantity ?? null,
      imageUrl: varImg,
      additionalImageUrls: addlImages,
      color,
      size,
      attributes: resolvedAttrs.map((a) => ({
        name: decodeHtmlEntities(a.name),
        value: decodeHtmlEntities(a.value),
      })),
      slug: product.slug,
    });
  };

  if (variationDetails.length > 0) {
    for (const vDetail of variationDetails) {
      if (variants.length >= MAX_VARIANTS_PER_PRODUCT) break;

      const rawAttrs = Array.isArray(vDetail.attributes) ? vDetail.attributes : [];
      const attrMap = new Map<string, string>();
      for (const a of rawAttrs) {
        attrMap.set(a.name.trim().toLowerCase(), (a.option || '').trim());
      }

      // Collect dimensions: fixed values + wildcard ("") dimensions expanded from product attributes
      const dimensions: Array<Array<{ name: string; value: string }>> = [];
      let hasWildcard = false;

      const allAttrKeys = new Set<string>([
        ...Array.from(termsByAttrKey.keys()),
        ...Array.from(attrMap.keys()),
      ]);

      for (const key of allAttrKeys) {
        const val = attrMap.get(key) || '';
        const meta = termsByAttrKey.get(key);
        const displayName =
          meta?.name ||
          rawAttrs.find((a) => a.name.trim().toLowerCase() === key)?.name ||
          key;

        if (val) {
          dimensions.push([{ name: displayName, value: val }]);
        } else if (meta && meta.terms.length > 0) {
          hasWildcard = true;
          dimensions.push(
            meta.terms.map((term) => ({ name: displayName, value: term }))
          );
        }
      }

      if (dimensions.length === 0) {
        pushVariant(vDetail, [], false);
      } else {
        const remaining = MAX_VARIANTS_PER_PRODUCT - variants.length;
        const combos = cartesianProduct(dimensions, remaining);
        for (const combo of combos) {
          pushVariant(vDetail, combo, hasWildcard);
        }
      }
    }
  } else {
    const dims: Array<Array<{ name: string; value: string }>> =
      variationAttributes.map((attr) =>
        (attr.options || [])
          .map((opt) => ({
            name: decodeHtmlEntities(attr.name),
            value: decodeHtmlEntities(String(opt || '')).trim(),
          }))
          .filter((x) => x.value.length > 0)
      );
    const combos = cartesianProduct(dims, MAX_VARIANTS_PER_PRODUCT);
    for (const combo of combos) {
      pushVariant(null, combo, true);
    }
  }

  return variants.length > 0
    ? variants
    : [
        {
          id: sanitizeRetailerId(`wc-${product.id}`, 100),
          sku: product.sku || undefined,
          title: baseTitle,
          description: baseDesc,
          price: baseRegularPrice,
          salePrice: baseHasSale ? baseSalePrice : null,
          currency: 'USD',
          inStock: productInStock,
          stockQuantity: product.stock_quantity ?? null,
          imageUrl: allProductImages[0],
          additionalImageUrls: allProductImages.slice(1, 11),
          attributes: [],
          slug: product.slug,
        },
      ];
}

function isMetaRateLimitMessage(msg: string): boolean {
  return /too many calls|rate limit|wait a bit|request limit|temporarily blocked|throttl/i.test(
    msg
  );
}

function sleepInterruptible(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Sync cancelled by user.'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new Error('Sync cancelled by user.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function metaApiFetch<T>(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  });
  const bearer = getAdminBearerToken();
  if (bearer) {
    headers.set('Authorization', `Bearer ${bearer}`);
  }

  const response = await fetch(path, {
    method: 'POST',
    headers,
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify(body),
    signal,
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Meta API returned unexpected response (HTTP ${response.status}).`);
  }

  if (!response.ok || parsed.ok === false) {
    const msg =
      (typeof parsed.message === 'string' && parsed.message) ||
      `Meta request failed (HTTP ${response.status})`;
    const error = new Error(msg) as MetaApiClientError;
    error.status = response.status;
    error.code = typeof parsed.code === 'string' ? parsed.code : undefined;
    error.rateLimited =
      response.status === 429 ||
      parsed.rateLimited === true ||
      parsed.code === 'meta_rate_limited' ||
      isMetaRateLimitMessage(msg);
    const retryAfterBody =
      typeof parsed.retryAfterSeconds === 'number' &&
      Number.isFinite(parsed.retryAfterSeconds)
        ? parsed.retryAfterSeconds
        : undefined;
    const retryHeader = response.headers.get('retry-after');
    const retryHeaderNum = retryHeader ? Number.parseInt(retryHeader, 10) : NaN;
    error.retryAfterSeconds =
      retryAfterBody ||
      (Number.isFinite(retryHeaderNum) && retryHeaderNum > 0
        ? retryHeaderNum
        : undefined);
    throw error;
  }

  return parsed as T;
}

export function buildClientSyncProductPayload(
  freshProduct: WcProduct,
  existingStatus?: MetaProductSyncStatusRecord
): MetaClientSyncProductInput {
  const variants = buildMetaVariantPayloads(
    freshProduct,
    existingStatus?.itemGroupId
  );

  return {
    id: freshProduct.id,
    wcProductId: freshProduct.id,
    isWooCommerce: true,
    name: decodeHtmlEntities(freshProduct.name),
    slug: freshProduct.slug,
    sku: freshProduct.sku || undefined,
    description: freshProduct.description,
    shortDescription: freshProduct.short_description,
    price: freshProduct.regular_price || freshProduct.price || '50',
    salePrice: freshProduct.sale_price || null,
    currency: 'USD',
    inStock: freshProduct.stock_status !== 'outofstock',
    stockQuantity: freshProduct.stock_quantity ?? null,
    brand: 'Fifty Dollar Shop',
    categories: (freshProduct.categories || []).map((c) => ({
      id: c.id,
      name: decodeHtmlEntities(c.name),
      slug: c.slug,
    })),
    imageUrl: freshProduct.images?.[0]?.src,
    images: (freshProduct.images || []).map((img) => img.src).filter(Boolean),
    metaRetailerId: existingStatus?.retailerId,
    metaItemGroupId: existingStatus?.itemGroupId,
    variants,
  };
}

function responseToStatusRecord(
  productKey: string,
  response: MetaSyncApiResponse
): MetaProductSyncStatusRecord {
  return {
    productId: productKey,
    status: 'synced',
    updatedAt: response.syncedAt || new Date().toISOString(),
    variantCount: response.variantCount,
    retailerId: response.primaryRetailerId,
    itemGroupId: response.itemGroupId,
    syncedRetailerIds: response.syncedRetailerIds,
    categorySetName: response.categoryName,
    productSetId: response.productSetId,
    shopPublished: response.shopPublished,
    shopIds: response.shopIds,
    warnings: response.warnings,
  };
}

/**
 * Syncs a live WooCommerce (or local) product to Meta Commerce Catalog & Meta Shop.
 * Always fetches fresh live WooCommerce product & variation data before POSTing.
 */
export async function syncProductToMeta(
  product: WcProduct,
  existingStatus?: MetaProductSyncStatusRecord
): Promise<{
  response: MetaSyncApiResponse;
  statusRecord: MetaProductSyncStatusRecord;
}> {
  const productKey = String(product.id);
  try {
    const freshProduct = await fetchFreshWcProductForMetaSync(product, true);
    const payload = buildClientSyncProductPayload(freshProduct, existingStatus);

    const response = await metaApiFetch<MetaSyncApiResponse>(
      '/api/meta/sync-product',
      { product: payload }
    );

    const statusRecord = responseToStatusRecord(productKey, response);
    upsertMetaSyncStatus(statusRecord);
    return { response, statusRecord };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unable to sync product to Meta.';
    const errorRecord: MetaProductSyncStatusRecord = {
      productId: productKey,
      status: 'error',
      updatedAt: new Date().toISOString(),
      variantCount: existingStatus?.variantCount || 0,
      retailerId: existingStatus?.retailerId,
      itemGroupId: existingStatus?.itemGroupId,
      syncedRetailerIds: existingStatus?.syncedRetailerIds,
      categorySetName: existingStatus?.categorySetName,
      shopPublished: false,
      errorMessage: message,
    };
    upsertMetaSyncStatus(errorRecord);
    throw err;
  }
}

export interface BulkMetaSyncCallbacks {
  signal?: AbortSignal;
  onPhaseChange?: (info: {
    completed: number;
    succeeded: number;
    failed: number;
    currentProductName: string;
    statusNote?: string;
    activeProductIds: number[];
    errors: Array<{ productId: number; productName: string; message: string }>;
  }) => void;
  onStatusesUpdated?: (
    statuses: Record<string, MetaProductSyncStatusRecord>
  ) => void;
}

const BULK_CHUNK_MAX_PRODUCTS = 12;
const BULK_CHUNK_MAX_VARIANTS = 120;
const INTER_CHUNK_COOLDOWN_MS = 4_000;
const MAX_RATE_LIMIT_CHUNK_RETRIES = 3;

function buildOptimalBulkChunks(
  entries: Array<{ product: WcProduct; payload: MetaClientSyncProductInput }>
): Array<Array<{ product: WcProduct; payload: MetaClientSyncProductInput }>> {
  const chunks: Array<
    Array<{ product: WcProduct; payload: MetaClientSyncProductInput }>
  > = [];
  let current: Array<{ product: WcProduct; payload: MetaClientSyncProductInput }> =
    [];
  let currentVariants = 0;

  for (const entry of entries) {
    const vCount = Math.max(1, entry.payload.variants?.length || 1);
    const wouldOverflow =
      current.length >= BULK_CHUNK_MAX_PRODUCTS ||
      (current.length > 0 && currentVariants + vCount > BULK_CHUNK_MAX_VARIANTS);

    if (wouldOverflow) {
      chunks.push(current);
      current = [];
      currentVariants = 0;
    }

    current.push(entry);
    currentVariants += vCount;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

/**
 * Bulk-syncs multiple WooCommerce products into Meta Catalog using true multi-product
 * batching (packing up to 12 products / 120 variants into ONE items_batch call),
 * polite inter-batch pacing, and automatic rate-limit cooldown + countdown retries.
 */
export async function syncProductsBulkToMeta(
  productsToSync: WcProduct[],
  callbacks: BulkMetaSyncCallbacks = {}
): Promise<{
  succeeded: number;
  failed: number;
  cancelled: boolean;
  unauthorized: boolean;
  errors: Array<{ productId: number; productName: string; message: string }>;
}> {
  const { signal, onPhaseChange, onStatusesUpdated } = callbacks;
  let completed = 0;
  let succeeded = 0;
  let failed = 0;
  let cancelled = false;
  let unauthorized = false;
  const errors: Array<{ productId: number; productName: string; message: string }> =
    [];

  onPhaseChange?.({
    completed: 0,
    succeeded: 0,
    failed: 0,
    currentProductName: `Fetching fresh live WooCommerce data for ${productsToSync.length} products...`,
    statusNote: 'Prefetching variations in batches of 6 before packing into Meta batches.',
    activeProductIds: [],
    errors: [],
  });

  const freshMap = await prefetchFreshWcProductsInBatches(productsToSync, true);
  if (signal?.aborted) {
    return { succeeded, failed, cancelled: true, unauthorized: false, errors };
  }

  const storedStatuses = loadMetaSyncStatuses();
  const preparedEntries = productsToSync.map((raw) => {
    const fresh = freshMap.get(raw.id) || raw;
    const existing = storedStatuses[String(fresh.id)];
    const payload = buildClientSyncProductPayload(fresh, existing);
    return { product: fresh, payload };
  });

  const chunks = buildOptimalBulkChunks(preparedEntries);

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx += 1) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }

    const chunk = chunks[chunkIdx];
    const chunkIds = chunk.map((c) => c.product.id);
    const chunkLabel =
      chunk.length === 1
        ? decodeHtmlEntities(chunk[0].product.name)
        : `Batch ${chunkIdx + 1}/${chunks.length} (${chunk.length} products bundled)`;

    // Polite cooldown between consecutive Meta batch requests
    if (chunkIdx > 0) {
      const pauseSec = Math.ceil(INTER_CHUNK_COOLDOWN_MS / 1000);
      for (let sec = pauseSec; sec > 0; sec -= 1) {
        onPhaseChange?.({
          completed,
          succeeded,
          failed,
          currentProductName: chunkLabel,
          statusNote: `Pacing Meta API calls — starting batch ${chunkIdx + 1}/${chunks.length} in ${sec}s...`,
          activeProductIds: [],
          errors: [...errors],
        });
        try {
          await sleepInterruptible(1_000, signal);
        } catch {
          cancelled = true;
          break;
        }
      }
      if (cancelled) break;
    }

    let chunkSuccess: MetaBulkSyncApiResponse | null = null;
    let lastChunkErr: MetaApiClientError | null = null;

    for (let retry = 0; retry <= MAX_RATE_LIMIT_CHUNK_RETRIES; retry += 1) {
      if (signal?.aborted) {
        cancelled = true;
        break;
      }

      onPhaseChange?.({
        completed,
        succeeded,
        failed,
        currentProductName: chunkLabel,
        statusNote:
          retry > 0
            ? `Retrying batch ${chunkIdx + 1}/${chunks.length} (attempt ${retry + 1}/${MAX_RATE_LIMIT_CHUNK_RETRIES + 1})...`
            : `Uploading ${chunk.reduce((sum, c) => sum + (c.payload.variants?.length || 1), 0)} items in 1 Meta batch call...`,
        activeProductIds: chunkIds,
        errors: [...errors],
      });

      try {
        chunkSuccess = await metaApiFetch<MetaBulkSyncApiResponse>(
          '/api/meta/sync-product',
          {
            products: chunk.map((c) => c.payload),
          },
          signal
        );
        lastChunkErr = null;
        break;
      } catch (err) {
        if (signal?.aborted) {
          cancelled = true;
          break;
        }

        const apiErr = err as MetaApiClientError;
        if (apiErr.status === 401) {
          unauthorized = true;
          return { succeeded, failed, cancelled: false, unauthorized: true, errors };
        }

        lastChunkErr = apiErr;
        const isRateLimited =
          apiErr.rateLimited === true ||
          apiErr.status === 429 ||
          isMetaRateLimitMessage(apiErr.message || '');

        if (isRateLimited && retry < MAX_RATE_LIMIT_CHUNK_RETRIES) {
          const baseWait = apiErr.retryAfterSeconds || 25;
          const waitSec = Math.min(baseWait + retry * 20, 90);
          for (let sec = waitSec; sec > 0; sec -= 1) {
            onPhaseChange?.({
              completed,
              succeeded,
              failed,
              currentProductName: chunkLabel,
              statusNote: `Meta Catalog rate limit active — waiting ${sec}s before auto-retry (${retry + 1}/${MAX_RATE_LIMIT_CHUNK_RETRIES})...`,
              activeProductIds: [],
              errors: [...errors],
            });
            try {
              await sleepInterruptible(1_000, signal);
            } catch {
              cancelled = true;
              break;
            }
          }
          if (cancelled) break;
          continue;
        }

        break;
      }
    }

    if (cancelled) break;

    const nextStatuses = { ...loadMetaSyncStatuses() };

    if (chunkSuccess) {
      const successById = new Map<string, MetaSyncApiResponse>();
      for (const resItem of chunkSuccess.results || []) {
        successById.set(String(resItem.productId), resItem);
      }
      const errorById = new Map<string, string>();
      for (const errItem of chunkSuccess.errors || []) {
        errorById.set(String(errItem.productId), errItem.message);
      }

      for (const entry of chunk) {
        const key = String(entry.product.id);
        const resItem = successById.get(key);
        const existing = nextStatuses[key];
        if (resItem) {
          nextStatuses[key] = responseToStatusRecord(key, resItem);
          succeeded += 1;
        } else {
          const msg =
            errorById.get(key) ||
            'Product did not complete Meta Catalog validation.';
          nextStatuses[key] = {
            productId: key,
            status: 'error',
            updatedAt: new Date().toISOString(),
            variantCount: existing?.variantCount || 0,
            retailerId: existing?.retailerId,
            itemGroupId: existing?.itemGroupId,
            syncedRetailerIds: existing?.syncedRetailerIds,
            categorySetName: existing?.categorySetName,
            shopPublished: false,
            errorMessage: msg,
          };
          failed += 1;
          errors.push({
            productId: entry.product.id,
            productName: decodeHtmlEntities(entry.product.name),
            message: msg,
          });
        }
        completed += 1;
      }
    } else if (lastChunkErr) {
      const msg = lastChunkErr.message || 'Meta batch sync failed.';
      for (const entry of chunk) {
        const key = String(entry.product.id);
        const existing = nextStatuses[key];
        nextStatuses[key] = {
          productId: key,
          status: 'error',
          updatedAt: new Date().toISOString(),
          variantCount: existing?.variantCount || 0,
          retailerId: existing?.retailerId,
          itemGroupId: existing?.itemGroupId,
          syncedRetailerIds: existing?.syncedRetailerIds,
          categorySetName: existing?.categorySetName,
          shopPublished: false,
          errorMessage: msg,
        };
        failed += 1;
        completed += 1;
        errors.push({
          productId: entry.product.id,
          productName: decodeHtmlEntities(entry.product.name),
          message: msg,
        });
      }
    }

    saveMetaSyncStatuses(nextStatuses);
    onStatusesUpdated?.(nextStatuses);
    onPhaseChange?.({
      completed,
      succeeded,
      failed,
      currentProductName: chunkLabel,
      statusNote: undefined,
      activeProductIds: [],
      errors: [...errors],
    });
  }

  return { succeeded, failed, cancelled, unauthorized, errors };
}

/**
 * Removes a product (and all sibling variants) ONLY from Meta Catalog,
 * leaving WooCommerce and storefront completely untouched.
 */
export async function removeProductFromMeta(
  product: WcProduct,
  existingStatus?: MetaProductSyncStatusRecord
): Promise<{
  response: MetaRemoveApiResponse;
  statusRecord: MetaProductSyncStatusRecord;
}> {
  const productKey = String(product.id);
  const response = await metaApiFetch<MetaRemoveApiResponse>(
    '/api/meta/remove-product',
    {
      product: {
        id: product.id,
        wcProductId: product.id,
        sku: product.sku || undefined,
        slug: product.slug,
        name: decodeHtmlEntities(product.name),
        metaRetailerId: existingStatus?.retailerId,
        metaItemGroupId: existingStatus?.itemGroupId,
        retailerIds: existingStatus?.syncedRetailerIds || [],
      },
    }
  );

  const statusRecord: MetaProductSyncStatusRecord = {
    productId: productKey,
    status: 'removed',
    updatedAt: response.removedAt || new Date().toISOString(),
    variantCount: 0,
    warnings: response.warnings,
  };
  upsertMetaSyncStatus(statusRecord);
  return { response, statusRecord };
}
