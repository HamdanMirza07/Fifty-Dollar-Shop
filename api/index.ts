import express from 'express';
import type { NextFunction, Request, Response, Router } from 'express';
import {
  ADMIN_COOKIE_NAME,
  bulkUpsertPlacements,
  claimFirstRunAdminPassword,
  createAdminSessionToken,
  getAdminAuthMode,
  getOrderStatusOverrides,
  getPlacements,
  getStoredOrders,
  getStorefrontSettings,
  parseCookieHeader,
  recordStorefrontOrder,
  setOrderStatusOverride,
  updateStorefrontSettings,
  upsertProductPlacement,
  verifyAdminCredential,
  verifyAdminSessionToken,
} from './_adminStore.ts';
import type {
  AdminOrderStatus,
  StoredOrderLineItem,
  StoredOrderRecord,
} from './_adminStore.ts';

interface NonceSession {
  nonce: string;
  cartToken: string;
}

interface StoreApiCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parent?: number;
  count?: number;
  image?: {
    id: number;
    src: string;
    thumbnail?: string;
    name?: string;
    alt?: string;
  } | null;
}

interface StoreApiProduct {
  id: number;
  name: string;
  slug: string;
  permalink?: string;
  type?: string;
  sku?: string;
  short_description?: string;
  description?: string;
  on_sale?: boolean;
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  prices?: {
    price?: string;
    regular_price?: string;
    sale_price?: string;
    currency_minor_unit?: number;
  };
  categories?: Array<{ id: number; name: string; slug: string }>;
  images?: Array<{
    id: number;
    src: string;
    thumbnail?: string;
    name?: string;
    alt?: string;
  }>;
  attributes?: Array<{
    id?: number;
    name: string;
    taxonomy?: string | null;
    has_variations?: boolean;
    terms?: Array<{ id?: number; name: string; slug?: string }>;
  }>;
  variations?: Array<{
    id: number;
    attributes?: Array<{ name: string; value: string }>;
  }>;
}

const DEFAULT_STORE_ORIGIN = 'https://deeppink-tiger-469250.hostingersite.com';

// Lightweight sliding-window rate limiter for API routes
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : '') ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > 240) {
    return res.status(429).json({
      code: 'rate_limit_exceeded',
      message: 'Too many requests. Please try again in a moment.',
    });
  }
  return next();
}

function getWcConfig() {
  const rawUrl = (process.env.WC_STORE_URL || DEFAULT_STORE_ORIGIN).trim();
  let origin = DEFAULT_STORE_ORIGIN;
  try {
    origin = new URL(rawUrl).origin;
  } catch {
    origin = rawUrl.replace(/\/+$/, '') || DEFAULT_STORE_ORIGIN;
  }
  const key = (process.env.WC_CONSUMER_KEY || '').trim();
  const secret = (process.env.WC_CONSUMER_SECRET || '').trim();
  return {
    baseUrl: origin,
    v3Api: `${origin}/wp-json/wc/v3`,
    storeApi: `${origin}/wp-json/wc/store/v1`,
    key,
    secret,
    hasV3Credentials: Boolean(key && secret),
  };
}

function getWcV3AuthHeader(): string {
  const { key, secret } = getWcConfig();
  const token = Buffer.from(`${key}:${secret}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function fetchWcV3<T>(
  endpointPath: string
): Promise<{ status: number; data: T }> {
  const { v3Api } = getWcConfig();
  const targetUrl = `${v3Api}${endpointPath}`;
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FiftyDollarShop/1.0',
      Authorization: getWcV3AuthHeader(),
    },
  });
  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = { message: 'Invalid response from store API.' } as unknown as T;
  }
  return { status: response.status, data };
}

async function fetchWcStorePublic<T>(
  endpointPath: string
): Promise<{ status: number; data: T }> {
  const { storeApi } = getWcConfig();
  const targetUrl = `${storeApi}${endpointPath}`;
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'FiftyDollarShop/1.0',
    },
  });
  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = { message: 'Invalid response from public store API.' } as unknown as T;
  }
  return { status: response.status, data };
}

function minorUnitToDecimal(raw: string | undefined, minorUnit = 2): string {
  if (!raw) return '0';
  const num = Number(raw);
  if (!Number.isFinite(num)) return String(raw);
  const divisor = Math.pow(10, minorUnit);
  const val = num / divisor;
  return Number.isInteger(val) ? String(val) : val.toFixed(minorUnit);
}

function normalizeStoreCategory(c: StoreApiCategory) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description || '',
    parent: c.parent ?? 0,
    count: c.count ?? 0,
    image: c.image
      ? {
          id: c.image.id,
          src: c.image.src,
          thumbnail: c.image.thumbnail,
          name: c.image.name,
          alt: c.image.alt,
        }
      : null,
  };
}

function normalizeStoreProduct(p: StoreApiProduct) {
  const minorUnit = p.prices?.currency_minor_unit ?? 2;
  const price = minorUnitToDecimal(p.prices?.price, minorUnit);
  const regularPrice = minorUnitToDecimal(
    p.prices?.regular_price || p.prices?.price,
    minorUnit
  );
  const salePrice =
    p.on_sale && p.prices?.sale_price
      ? minorUnitToDecimal(p.prices.sale_price, minorUnit)
      : '';
  const stockStatus = p.is_in_stock === false ? 'outofstock' : 'instock';
  const purchasable = p.is_purchasable !== false;

  const variationsList = Array.isArray(p.variations) ? p.variations : [];

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    permalink: p.permalink || '',
    type: p.type || (variationsList.length > 0 ? 'variable' : 'simple'),
    status: 'publish',
    sku: p.sku || '',
    price,
    regular_price: regularPrice,
    sale_price: salePrice,
    on_sale: Boolean(p.on_sale),
    purchasable,
    stock_status: stockStatus,
    stock_quantity: null,
    short_description: p.short_description || '',
    description: p.description || '',
    categories: (p.categories || []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
    })),
    images: (p.images || []).map((img) => ({
      id: img.id,
      src: img.src,
      thumbnail: img.thumbnail,
      name: img.name,
      alt: img.alt,
    })),
    attributes: (p.attributes || []).map((attr) => ({
      id: attr.id ?? 0,
      name: attr.name,
      slug: attr.taxonomy || undefined,
      visible: true,
      variation: Boolean(attr.has_variations),
      options: (attr.terms || []).map((term) => term.name),
    })),
    variations: variationsList.map((v) => v.id),
    variation_details: variationsList.map((v) => ({
      id: v.id,
      price,
      regular_price: regularPrice,
      sale_price: salePrice,
      on_sale: Boolean(p.on_sale),
      stock_status: stockStatus,
      purchasable,
      attributes: (v.attributes || []).map((va) => ({
        id: 0,
        name: va.name,
        option: va.value,
      })),
    })),
  };
}

interface CategoryLike {
  id: number;
  name: string;
  slug: string;
}

function isHotSellingCategory(cat: Pick<CategoryLike, 'name' | 'slug'>): boolean {
  const slug = (cat.slug || '').toLowerCase();
  const name = (cat.name || '').toLowerCase();
  return slug === 'hot-sale' || name.includes('hot selling');
}

function isNewArrivalCategory(cat: Pick<CategoryLike, 'name' | 'slug'>): boolean {
  const slug = (cat.slug || '').toLowerCase();
  const name = (cat.name || '').toLowerCase();
  return (
    slug === 'new-arrival' ||
    slug === 'new-arrivals' ||
    name.includes('new arrival')
  );
}

function isAllowedStoreCategory(cat: Pick<CategoryLike, 'name' | 'slug'>): boolean {
  return isHotSellingCategory(cat) || isNewArrivalCategory(cat);
}

function filterAllowedCategories<T extends CategoryLike>(cats: T[]): T[] {
  const filtered = cats.filter((c) => isAllowedStoreCategory(c));
  return filtered.sort((a, b) => {
    const rankA = isHotSellingCategory(a) ? 0 : 1;
    const rankB = isHotSellingCategory(b) ? 0 : 1;
    return rankA - rankB;
  });
}

function sanitizeProductCategories<T>(product: T): T {
  if (!product || typeof product !== 'object') return product;
  const record = product as Record<string, unknown>;
  if (!Array.isArray(record.categories)) return product;
  const cleaned = (record.categories as CategoryLike[]).filter((c) =>
    isAllowedStoreCategory(c)
  );
  return {
    ...record,
    categories: cleaned,
  } as T;
}

async function fetchCategoriesSmart(): Promise<{
  status: number;
  data: unknown;
}> {
  const { hasV3Credentials } = getWcConfig();
  if (hasV3Credentials) {
    try {
      const v3Resp = await fetchWcV3<unknown>(
        '/products/categories?per_page=100'
      );
      if (v3Resp.status === 200 && Array.isArray(v3Resp.data)) {
        return {
          status: 200,
          data: filterAllowedCategories(v3Resp.data as CategoryLike[]),
        };
      }
    } catch {
      // Fall through to public Store API
    }
  }

  const pubResp = await fetchWcStorePublic<StoreApiCategory[]>(
    '/products/categories?per_page=100'
  );
  if (pubResp.status === 200 && Array.isArray(pubResp.data)) {
    const normalized = pubResp.data.map(normalizeStoreCategory);
    return {
      status: 200,
      data: filterAllowedCategories(normalized),
    };
  }
  return pubResp;
}

async function fetchFreshWcSession(
  existingToken?: string
): Promise<NonceSession> {
  const { storeApi } = getWcConfig();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'FiftyDollarShop/1.0',
  };
  if (existingToken) {
    headers['Cart-Token'] = existingToken;
  }
  const resp = await fetch(`${storeApi}/cart`, { headers });
  const nonce = resp.headers.get('nonce') || '';
  const cartToken = resp.headers.get('cart-token') || existingToken || '';
  return { nonce, cartToken };
}

async function proxyStoreApiRequest(
  req: Request,
  res: Response,
  endpointPath: string,
  method: 'GET' | 'POST',
  onJsonSuccess?: (status: number, json: unknown) => void
) {
  try {
    const { storeApi } = getWcConfig();
    let cartToken =
      (req.headers['x-wc-cart-token'] as string | undefined) || '';
    let nonce = (req.headers['x-wc-nonce'] as string | undefined) || '';

    if (method === 'POST' && (!nonce || !cartToken)) {
      const session = await fetchFreshWcSession(cartToken || undefined);
      nonce = session.nonce;
      cartToken = session.cartToken;
    }

    const doFetch = async (activeNonce: string, activeToken: string) => {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': 'FiftyDollarShop/1.0',
      };
      if (activeToken) headers['Cart-Token'] = activeToken;
      if (activeNonce) headers['Nonce'] = activeNonce;
      if (method === 'POST') {
        headers['Content-Type'] = 'application/json';
      }

      return fetch(`${storeApi}${endpointPath}`, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(req.body ?? {}) : undefined,
      });
    };

    let upstream = await doFetch(nonce, cartToken);

    if (
      method === 'POST' &&
      (upstream.status === 401 || upstream.status === 403)
    ) {
      const refreshed = await fetchFreshWcSession(cartToken || undefined);
      nonce = refreshed.nonce;
      cartToken = refreshed.cartToken;
      upstream = await doFetch(nonce, cartToken);
    }

    const nextNonce = upstream.headers.get('nonce') || nonce;
    const nextToken = upstream.headers.get('cart-token') || cartToken;

    res.setHeader('Cache-Control', 'no-store');
    if (nextNonce) res.setHeader('x-wc-nonce', nextNonce);
    if (nextToken) res.setHeader('x-wc-cart-token', nextToken);

    const text = await upstream.text();
    res.status(upstream.status);
    try {
      const json = JSON.parse(text);
      if (onJsonSuccess) {
        try {
          onJsonSuccess(upstream.status, json);
        } catch {
          // Never interrupt checkout response on admin log failure
        }
      }
      return res.json(json);
    } catch {
      return res.status(502).json({
        code: 'store_invalid_response',
        message: 'Unexpected response from store cart service.',
      });
    }
  } catch {
    return res.status(502).json({
      code: 'store_proxy_error',
      message: 'Unable to reach store cart service.',
    });
  }
}

export function createApiRouter(): Router {
  const router = express.Router();
  router.use(apiRateLimiter);

  router.get('/health', (_req: Request, res: Response) => {
    const { hasV3Credentials, baseUrl } = getWcConfig();
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      mode: hasV3Credentials ? 'v3+store-fallback' : 'store-public',
      storeOrigin: baseUrl,
    });
  });

  // Categories endpoint (authenticated v3 when configured, seamless public Store API fallback)
  router.get('/wc/categories', async (_req: Request, res: Response) => {
    try {
      const { status, data } = await fetchCategoriesSmart();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(status).json(data);
    } catch {
      return res.status(502).json({
        code: 'store_categories_error',
        message: 'Unable to fetch categories from store.',
      });
    }
  });

  // Products endpoint
  router.get('/wc/products', async (req: Request, res: Response) => {
    try {
      const { hasV3Credentials } = getWcConfig();

      const rawCategory =
        typeof req.query.category === 'string' ? req.query.category.trim() : '';

      if (rawCategory && rawCategory !== 'all' && !/^\d+$/.test(rawCategory)) {
        return res.status(400).json({
          code: 'invalid_category',
          message: 'Category parameter must be a numeric ID or "all".',
        });
      }

      let categoryId = rawCategory === 'all' ? '' : rawCategory;

      // Default to "Hot Selling 50$ Products" when no category filter is provided
      if (!rawCategory) {
        const catsResp = await fetchCategoriesSmart();
        if (catsResp.status === 200 && Array.isArray(catsResp.data)) {
          const cats = catsResp.data as Array<{
            id: number;
            name: string;
            slug: string;
          }>;
          const hotCat =
            cats.find((c) => c.name === 'Hot Selling 50$ Products') ||
            cats.find((c) => c.slug === 'hot-sale') ||
            cats.find((c) => c.name.toLowerCase().includes('hot selling'));
          if (hotCat) {
            categoryId = String(hotCat.id);
          }
        }
      }

      const parsedPerPage = Number(req.query.per_page || 100);
      const perPage = Number.isFinite(parsedPerPage)
        ? Math.min(Math.max(Math.trunc(parsedPerPage), 1), 100)
        : 100;

      const searchTerm =
        typeof req.query.search === 'string' && req.query.search.trim()
          ? req.query.search.trim().slice(0, 120)
          : '';

      const fetchBySingleCategory = async (catId: string): Promise<Record<string, unknown>[]> => {
        if (hasV3Credentials) {
          try {
            const params = new URLSearchParams();
            if (catId) params.set('category', catId);
            params.set('per_page', String(perPage));
            params.set('status', 'publish');
            if (searchTerm) params.set('search', searchTerm);

            const v3Resp = await fetchWcV3<unknown>(
              `/products?${params.toString()}`
            );
            if (v3Resp.status === 200 && Array.isArray(v3Resp.data)) {
              return (v3Resp.data as Record<string, unknown>[]).map(
                sanitizeProductCategories
              );
            }
          } catch {
            // Fall through to public Store API
          }
        }

        const pubParams = new URLSearchParams();
        if (catId) pubParams.set('category', catId);
        pubParams.set('per_page', String(perPage));
        if (searchTerm) pubParams.set('search', searchTerm);

        const pubResp = await fetchWcStorePublic<StoreApiProduct[]>(
          `/products?${pubParams.toString()}`
        );
        if (pubResp.status === 200 && Array.isArray(pubResp.data)) {
          return pubResp.data
            .map(normalizeStoreProduct)
            .map(sanitizeProductCategories);
        }
        throw new Error('upstream_products_error');
      };

      // When "all" is requested, fetch strictly from the 2 allowed store categories and deduplicate
      if (rawCategory === 'all') {
        const catsResp = await fetchCategoriesSmart();
        const allowedCats =
          catsResp.status === 200 && Array.isArray(catsResp.data)
            ? (catsResp.data as CategoryLike[])
            : [];

        const lists = await Promise.all(
          allowedCats.map((c) => fetchBySingleCategory(String(c.id)))
        );
        const deduped = new Map<number, Record<string, unknown>>();
        for (const list of lists) {
          for (const item of list) {
            const id = Number(item.id);
            if (Number.isFinite(id) && !deduped.has(id)) {
              deduped.set(id, item);
            }
          }
        }
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(Array.from(deduped.values()));
      }

      const items = await fetchBySingleCategory(categoryId);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(items);
    } catch {
      return res.status(502).json({
        code: 'store_products_error',
        message: 'Unable to fetch products from store.',
      });
    }
  });

  // Single product + variations endpoint
  router.get('/wc/products/:id', async (req: Request, res: Response) => {
    try {
      const { hasV3Credentials } = getWcConfig();

      const rawId = String(req.params.id || '');
      if (!/^\d+$/.test(rawId)) {
        return res.status(400).json({
          code: 'invalid_product_id',
          message: 'Product ID must be a valid positive integer.',
        });
      }

      if (hasV3Credentials) {
        try {
          const [productResp, variationsResp] = await Promise.all([
            fetchWcV3<Record<string, unknown>>(`/products/${rawId}`),
            fetchWcV3<unknown[]>(`/products/${rawId}/variations?per_page=100`),
          ]);

          if (productResp.status === 200) {
            res.setHeader('Cache-Control', 'no-store');
            const enriched = sanitizeProductCategories({
              ...productResp.data,
              variation_details:
                variationsResp.status === 200 &&
                Array.isArray(variationsResp.data)
                  ? variationsResp.data
                  : [],
            });
            return res.status(200).json(enriched);
          }
        } catch {
          // Fall through to public Store API
        }
      }

      const pubResp = await fetchWcStorePublic<StoreApiProduct>(
        `/products/${rawId}`
      );
      res.setHeader('Cache-Control', 'no-store');
      if (pubResp.status === 200 && pubResp.data && typeof pubResp.data === 'object') {
        return res
          .status(200)
          .json(sanitizeProductCategories(normalizeStoreProduct(pubResp.data)));
      }
      return res.status(pubResp.status).json(pubResp.data);
    } catch {
      return res.status(502).json({
        code: 'store_product_detail_error',
        message: 'Unable to fetch product details from store.',
      });
    }
  });

  // Live Store API routes for Cart & Checkout
  router.get('/wc/cart', async (req: Request, res: Response) => {
    return proxyStoreApiRequest(req, res, '/cart', 'GET');
  });

  router.post('/wc/cart/add-item', async (req: Request, res: Response) => {
    const id = Number(req.body?.id);
    const quantity = Number(req.body?.quantity ?? 1);
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > 50
    ) {
      return res.status(400).json({
        code: 'invalid_cart_payload',
        message: 'Valid product ID and quantity (1-50) are required.',
      });
    }
    return proxyStoreApiRequest(req, res, '/cart/add-item', 'POST');
  });

  router.post('/wc/cart/update-item', async (req: Request, res: Response) => {
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    const quantity = Number(req.body?.quantity);
    if (!key || !Number.isInteger(quantity) || quantity < 0 || quantity > 50) {
      return res.status(400).json({
        code: 'invalid_cart_update',
        message: 'Valid cart item key and quantity are required.',
      });
    }
    return proxyStoreApiRequest(req, res, '/cart/update-item', 'POST');
  });

  router.post('/wc/cart/remove-item', async (req: Request, res: Response) => {
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    if (!key) {
      return res.status(400).json({
        code: 'invalid_cart_remove',
        message: 'Cart item key is required.',
      });
    }
    return proxyStoreApiRequest(req, res, '/cart/remove-item', 'POST');
  });

  router.post(
    '/wc/cart/update-customer',
    async (req: Request, res: Response) => {
      return proxyStoreApiRequest(req, res, '/cart/update-customer', 'POST');
    }
  );

  router.get('/wc/checkout', async (req: Request, res: Response) => {
    return proxyStoreApiRequest(req, res, '/checkout', 'GET');
  });

  router.post('/wc/checkout', async (req: Request, res: Response) => {
    return proxyStoreApiRequest(
      req,
      res,
      '/checkout',
      'POST',
      (status, json) => {
        if (status < 200 || status >= 300 || !json || typeof json !== 'object') {
          return;
        }
        const data = json as Record<string, unknown>;
        const orderId = String(data.order_id || data.order_number || '').trim();
        if (!orderId) return;
        const billing = (data.billing_address ||
          req.body?.billing_address ||
          {}) as Record<string, unknown>;
        const shipping = (data.shipping_address ||
          req.body?.shipping_address ||
          billing) as Record<string, unknown>;
        const first = String(
          shipping.first_name || billing.first_name || ''
        ).trim();
        const last = String(
          shipping.last_name || billing.last_name || ''
        ).trim();
        const customerName = `${first} ${last}`.trim() || 'Storefront Customer';
        const rawStatus = String(data.status || 'pending').toLowerCase();
        const mappedStatus: AdminOrderStatus =
          rawStatus === 'completed'
            ? 'delivered'
            : rawStatus === 'processing'
              ? 'processing'
              : rawStatus === 'cancelled' || rawStatus === 'failed'
                ? 'cancelled'
                : 'pending';

        recordStorefrontOrder({
          id: orderId,
          orderNumber: String(data.order_number || orderId),
          source: 'storefront',
          createdAt: new Date().toISOString(),
          status: mappedStatus,
          customerName,
          email: String(billing.email || ''),
          phone: String(billing.phone || shipping.phone || ''),
          shippingAddress: {
            address1: String(shipping.address_1 || ''),
            address2: String(shipping.address_2 || ''),
            city: String(shipping.city || ''),
            state: String(shipping.state || ''),
            postcode: String(shipping.postcode || ''),
            country: String(shipping.country || 'US'),
          },
          paymentMethod: String(
            data.payment_method || req.body?.payment_method || 'card'
          ),
          paymentMethodTitle: String(
            data.payment_method || req.body?.payment_method || 'Storefront Checkout'
          ),
          currency: 'USD',
          total: '50.00',
          customerNote: String(
            data.customer_note || req.body?.customer_note || ''
          ),
          items: [],
        });
      }
    );
  });

  router.post('/contact', (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const orderNumber =
      typeof req.body?.orderNumber === 'string'
        ? req.body.orderNumber.trim().slice(0, 40)
        : '';
    const message =
      typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (
      !name ||
      !email ||
      !message ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        ok: false,
        message:
          'Please provide your name, a valid email address, and your message.',
      });
    }
    const ticketId = `FDS-${Date.now().toString().slice(-6)}`;
    return res.json({
      ok: true,
      ticketId,
      message:
        'Thanks for reaching out. Our USA support team will reply within 24 hours.',
      receivedAt: new Date().toISOString(),
      orderNumber: orderNumber || null,
    });
  });

  // Public read-only storefront settings & placement IDs (zero sensitive data)
  router.get('/storefront-config', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      settings: getStorefrontSettings(),
      placements: getPlacements(),
    });
  });

  // Read-only payment gateway boolean status (zero secrets exposed)
  router.get('/stripe-status', (_req: Request, res: Response) => {
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    const configured = stripeKey.length > 0;
    const mode = !configured
      ? 'not_configured'
      : stripeKey.startsWith('sk_live_')
        ? 'live'
        : 'test';
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      configured,
      mode,
      woocommerceCheckoutProxyActive: true,
    });
  });

  // ---------------------------------------------------------------------------
  // Admin Authentication & Protected Operations Console Routes (/api/admin/*)
  // ---------------------------------------------------------------------------
  const authRateBuckets = new Map<string, { count: number; resetAt: number }>();

  function adminAuthRateLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : '') ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const now = Date.now();
    const bucket = authRateBuckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      authRateBuckets.set(ip, { count: 1, resetAt: now + 15 * 60_000 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > 20) {
      return res.status(429).json({
        code: 'too_many_login_attempts',
        message: 'Too many authentication attempts. Please try again later.',
      });
    }
    return next();
  }

  function isHttpsRequest(req: Request): boolean {
    const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    return req.secure || proto.includes('https');
  }

  function setAdminSessionCookie(req: Request, res: Response, token: string) {
    const secure = isHttpsRequest(req);
    const attrs = [
      `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      'Max-Age=43200',
    ];
    if (secure) {
      attrs.push('Secure', 'SameSite=None', 'Partitioned');
    } else {
      attrs.push('SameSite=Lax');
    }
    res.setHeader('Set-Cookie', attrs.join('; '));
  }

  function clearAdminSessionCookie(req: Request, res: Response) {
    const secure = isHttpsRequest(req);
    const attrs = [
      `${ADMIN_COOKIE_NAME}=`,
      'Path=/',
      'HttpOnly',
      'Max-Age=0',
    ];
    if (secure) {
      attrs.push('Secure', 'SameSite=None', 'Partitioned');
    } else {
      attrs.push('SameSite=Lax');
    }
    res.setHeader('Set-Cookie', attrs.join('; '));
  }

  function extractAdminToken(req: Request): {
    token: string;
    viaCookie: boolean;
  } {
    const authHeader = String(req.headers.authorization || '').trim();
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const bearer = authHeader.slice(7).trim();
      if (bearer) return { token: bearer, viaCookie: false };
    }
    const cookies = parseCookieHeader(req.headers.cookie);
    if (cookies[ADMIN_COOKIE_NAME]) {
      return { token: cookies[ADMIN_COOKIE_NAME], viaCookie: true };
    }
    return { token: '', viaCookie: false };
  }

  function verifySameOriginOrHeader(req: Request): boolean {
    if (req.headers['x-requested-with']) return true;
    const origin = String(req.headers.origin || '').trim();
    const host = String(
      req.headers['x-forwarded-host'] || req.headers.host || ''
    ).trim();
    if (!origin || !host) return false;
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
    const { token, viaCookie } = extractAdminToken(req);
    const session = verifyAdminSessionToken(token);
    if (!session) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(401).json({
        code: 'admin_unauthorized',
        message: 'Admin authentication is required.',
      });
    }
    const isMutation =
      req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
    if (viaCookie && isMutation && !verifySameOriginOrHeader(req)) {
      return res.status(403).json({
        code: 'csrf_check_failed',
        message: 'Invalid request origin.',
      });
    }
    return next();
  }

  router.get('/admin/auth/status', (req: Request, res: Response) => {
    const { mode, needsSetup } = getAdminAuthMode();
    const { token } = extractAdminToken(req);
    const session = verifyAdminSessionToken(token);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      authenticated: Boolean(session),
      mode,
      needsSetup,
      expiresAt: session ? new Date(session.exp).toISOString() : undefined,
    });
  });

  router.post(
    '/admin/auth/setup',
    adminAuthRateLimiter,
    (req: Request, res: Response) => {
      const password =
        typeof req.body?.password === 'string' ? req.body.password : '';
      const result = claimFirstRunAdminPassword(password);
      if (!result.ok) {
        return res.status(400).json({
          code: 'admin_setup_failed',
          message: result.error || 'Unable to configure admin password.',
        });
      }
      const { token, expiresAt } = createAdminSessionToken();
      setAdminSessionCookie(req, res, token);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        authenticated: true,
        token,
        expiresAt,
        mode: 'claimed',
      });
    }
  );

  router.post(
    '/admin/auth/login',
    adminAuthRateLimiter,
    (req: Request, res: Response) => {
      const { needsSetup, mode } = getAdminAuthMode();
      if (needsSetup) {
        return res.status(400).json({
          code: 'admin_setup_required',
          message: 'Please complete first-run admin password setup first.',
        });
      }
      const password =
        typeof req.body?.password === 'string'
          ? req.body.password
          : typeof req.body?.token === 'string'
            ? req.body.token
            : '';

      if (!verifyAdminCredential(password)) {
        return res.status(401).json({
          code: 'invalid_credentials',
          message: 'Invalid admin password or access token.',
        });
      }

      const { token, expiresAt } = createAdminSessionToken();
      setAdminSessionCookie(req, res, token);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        authenticated: true,
        token,
        expiresAt,
        mode,
      });
    }
  );

  router.post('/admin/auth/logout', (req: Request, res: Response) => {
    clearAdminSessionCookie(req, res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, authenticated: false });
  });

  // Live WooCommerce catalog loader for Admin Panel (100% WooCommerce source of truth)
  async function loadAllLiveWcProductsAndCategories() {
    const { hasV3Credentials } = getWcConfig();
    const catsResp = await fetchCategoriesSmart();
    const categories =
      catsResp.status === 200 && Array.isArray(catsResp.data)
        ? (catsResp.data as CategoryLike[])
        : [];

    const fetchCategoryProducts = async (
      catId: string
    ): Promise<Record<string, unknown>[]> => {
      if (hasV3Credentials) {
        try {
          const params = new URLSearchParams({
            category: catId,
            per_page: '100',
            status: 'publish',
          });
          const v3Resp = await fetchWcV3<unknown>(
            `/products?${params.toString()}`
          );
          if (v3Resp.status === 200 && Array.isArray(v3Resp.data)) {
            return (v3Resp.data as Record<string, unknown>[]).map(
              sanitizeProductCategories
            );
          }
        } catch {
          // Fall through to Store API
        }
      }
      const pubParams = new URLSearchParams({
        category: catId,
        per_page: '100',
      });
      const pubResp = await fetchWcStorePublic<StoreApiProduct[]>(
        `/products?${pubParams.toString()}`
      );
      if (pubResp.status === 200 && Array.isArray(pubResp.data)) {
        return pubResp.data
          .map(normalizeStoreProduct)
          .map(sanitizeProductCategories);
      }
      return [];
    };

    const lists = await Promise.all(
      categories.map((c) => fetchCategoryProducts(String(c.id)))
    );
    const deduped = new Map<number, Record<string, unknown>>();
    for (const list of lists) {
      for (const item of list) {
        const id = Number(item.id);
        if (Number.isFinite(id) && !deduped.has(id)) {
          deduped.set(id, item);
        }
      }
    }

    return {
      categories,
      products: Array.from(deduped.values()),
    };
  }

  router.get('/admin/catalog', requireAdminAuth, async (_req, res) => {
    try {
      const startedAt = Date.now();
      const { categories, products } =
        await loadAllLiveWcProductsAndCategories();
      const latencyMs = Date.now() - startedAt;
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        syncedAt: new Date().toISOString(),
        latencyMs,
        categories,
        products,
        placements: getPlacements(),
      });
    } catch {
      return res.status(502).json({
        code: 'admin_catalog_error',
        message: 'Unable to sync live WooCommerce catalog.',
      });
    }
  });

  router.get(
    '/admin/products/:id/variations',
    requireAdminAuth,
    async (req, res) => {
      const rawId = String(req.params.id || '');
      if (!/^\d+$/.test(rawId)) {
        return res.status(400).json({
          code: 'invalid_product_id',
          message: 'Product ID must be a positive integer.',
        });
      }
      try {
        const { hasV3Credentials } = getWcConfig();
        if (hasV3Credentials) {
          try {
            const [prodResp, varResp] = await Promise.all([
              fetchWcV3<Record<string, unknown>>(`/products/${rawId}`),
              fetchWcV3<unknown[]>(`/products/${rawId}/variations?per_page=100`),
            ]);
            if (prodResp.status === 200) {
              res.setHeader('Cache-Control', 'no-store');
              return res.json({
                product: sanitizeProductCategories(prodResp.data),
                variations:
                  varResp.status === 200 && Array.isArray(varResp.data)
                    ? varResp.data
                    : [],
                fetchedAt: new Date().toISOString(),
              });
            }
          } catch {
            // Fall through to public Store API
          }
        }

        const pubResp = await fetchWcStorePublic<StoreApiProduct>(
          `/products/${rawId}`
        );
        if (
          pubResp.status === 200 &&
          pubResp.data &&
          typeof pubResp.data === 'object'
        ) {
          const normalized = sanitizeProductCategories(
            normalizeStoreProduct(pubResp.data)
          );
          res.setHeader('Cache-Control', 'no-store');
          return res.json({
            product: normalized,
            variations: normalized.variation_details || [],
            fetchedAt: new Date().toISOString(),
          });
        }
        return res.status(pubResp.status).json({
          code: 'variations_fetch_failed',
          message: 'Unable to fetch product variations from WooCommerce.',
        });
      } catch {
        return res.status(502).json({
          code: 'variations_proxy_error',
          message: 'Unable to reach WooCommerce variations endpoint.',
        });
      }
    }
  );

  // Non-destructive storefront placement controls (keyed by WooCommerce Product ID)
  router.get('/admin/placements', requireAdminAuth, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ placements: getPlacements() });
  });

  router.patch(
    '/admin/placements/:productId',
    requireAdminAuth,
    (req, res) => {
      const rawId = String(req.params.productId || '');
      if (!/^\d+$/.test(rawId)) {
        return res.status(400).json({
          code: 'invalid_product_id',
          message: 'Valid WooCommerce product ID is required.',
        });
      }
      const featured =
        typeof req.body?.featured === 'boolean' ? req.body.featured : undefined;
      const hidden =
        typeof req.body?.hidden === 'boolean' ? req.body.hidden : undefined;
      if (featured === undefined && hidden === undefined) {
        return res.status(400).json({
          code: 'empty_patch',
          message: 'Specify featured or hidden boolean flag.',
        });
      }
      const record = upsertProductPlacement(Number(rawId), {
        featured,
        hidden,
      });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ placement: record, placements: getPlacements() });
    }
  );

  router.post('/admin/placements/bulk', requireAdminAuth, (req, res) => {
    const rawIds = Array.isArray(req.body?.productIds)
      ? req.body.productIds
      : [];
    const productIds = rawIds
      .map((n: unknown) => Number(n))
      .filter((n: number) => Number.isInteger(n) && n > 0)
      .slice(0, 200);
    if (productIds.length === 0) {
      return res.status(400).json({
        code: 'invalid_product_ids',
        message: 'Provide at least one valid WooCommerce product ID.',
      });
    }
    const featured =
      typeof req.body?.featured === 'boolean' ? req.body.featured : undefined;
    const hidden =
      typeof req.body?.hidden === 'boolean' ? req.body.hidden : undefined;
    if (featured === undefined && hidden === undefined) {
      return res.status(400).json({
        code: 'empty_bulk_patch',
        message: 'Specify featured or hidden flag for bulk update.',
      });
    }
    const placements = bulkUpsertPlacements(productIds, { featured, hidden });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ updatedCount: productIds.length, placements });
  });

  // Live WooCommerce + Storefront Orders
  function mapWcOrderStatus(raw: string): AdminOrderStatus {
    const s = (raw || '').toLowerCase();
    if (s === 'completed' || s === 'delivered') return 'delivered';
    if (s === 'shipped') return 'shipped';
    if (s === 'processing') return 'processing';
    if (s === 'cancelled' || s === 'refunded' || s === 'failed') {
      return 'cancelled';
    }
    return 'pending';
  }

  function normalizeWcV3Order(
    raw: Record<string, unknown>,
    overrides: Record<string, AdminOrderStatus>
  ): StoredOrderRecord {
    const id = String(raw.id || raw.number || '');
    const billing = (raw.billing || {}) as Record<string, unknown>;
    const shipping = (raw.shipping || {}) as Record<string, unknown>;
    const first = String(shipping.first_name || billing.first_name || '').trim();
    const last = String(shipping.last_name || billing.last_name || '').trim();
    const customerName = `${first} ${last}`.trim() || 'Storefront Customer';

    const rawItems = Array.isArray(raw.line_items)
      ? (raw.line_items as Array<Record<string, unknown>>)
      : [];
    const items: StoredOrderLineItem[] = rawItems.map((li) => {
      const meta = Array.isArray(li.meta_data)
        ? (li.meta_data as Array<Record<string, unknown>>)
        : [];
      const attributes = meta
        .filter(
          (m) =>
            typeof m.key === 'string' &&
            !m.key.startsWith('_') &&
            typeof m.value === 'string' &&
            m.value.trim().length > 0
        )
        .map((m) => ({
          name: String(m.display_key || m.key),
          value: String(m.display_value || m.value),
        }));

      const qty = Math.max(Number(li.quantity || 1), 1);
      const totalNum = Number(li.total || 0);
      const unitPrice =
        typeof li.price === 'number' || typeof li.price === 'string'
          ? Number(li.price).toFixed(2)
          : (totalNum / qty).toFixed(2);
      const imgObj =
        li.image && typeof li.image === 'object'
          ? (li.image as Record<string, unknown>)
          : null;

      return {
        productId: Number(li.product_id || 0),
        variationId: Number(li.variation_id || 0) || undefined,
        name: String(li.name || 'Product'),
        sku: String(li.sku || ''),
        quantity: qty,
        unitPrice,
        total: Number(li.total || 0).toFixed(2),
        attributes,
        image:
          imgObj && typeof imgObj.src === 'string' ? imgObj.src : undefined,
      };
    });

    const mappedStatus =
      overrides[id] || mapWcOrderStatus(String(raw.status || 'pending'));

    return {
      id,
      orderNumber: String(raw.number || id),
      source: 'woocommerce',
      createdAt: String(
        raw.date_created_gmt || raw.date_created || new Date().toISOString()
      ),
      status: mappedStatus,
      customerName,
      email: String(billing.email || ''),
      phone: String(billing.phone || shipping.phone || ''),
      shippingAddress: {
        address1: String(shipping.address_1 || billing.address_1 || ''),
        address2: String(shipping.address_2 || billing.address_2 || ''),
        city: String(shipping.city || billing.city || ''),
        state: String(shipping.state || billing.state || ''),
        postcode: String(shipping.postcode || billing.postcode || ''),
        country: String(shipping.country || billing.country || 'US'),
      },
      paymentMethod: String(raw.payment_method || 'card'),
      paymentMethodTitle: String(
        raw.payment_method_title || raw.payment_method || 'Card / Checkout'
      ),
      currency: String(raw.currency || 'USD'),
      total: Number(raw.total || 0).toFixed(2),
      customerNote: String(raw.customer_note || ''),
      items,
    };
  }

  router.get('/admin/orders', requireAdminAuth, async (_req, res) => {
    const overrides = getOrderStatusOverrides();
    const localOrders = getStoredOrders();
    const merged = new Map<string, StoredOrderRecord>();

    const { hasV3Credentials } = getWcConfig();
    let wcOrdersAvailable = false;

    if (hasV3Credentials) {
      try {
        const resp = await fetchWcV3<unknown[]>('/orders?per_page=50');
        if (resp.status === 200 && Array.isArray(resp.data)) {
          wcOrdersAvailable = true;
          for (const raw of resp.data) {
            if (raw && typeof raw === 'object') {
              const norm = normalizeWcV3Order(
                raw as Record<string, unknown>,
                overrides
              );
              if (norm.id) merged.set(norm.id, norm);
            }
          }
        }
      } catch {
        // Gracefully fall back to captured storefront orders
      }
    }

    for (const local of localOrders) {
      if (!merged.has(local.id)) {
        merged.set(local.id, local);
      }
    }

    const orders = Array.from(merged.values()).sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      orders,
      wcOrdersAvailable,
      fetchedAt: new Date().toISOString(),
    });
  });

  const VALID_ORDER_STATUSES = new Set<AdminOrderStatus>([
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ]);

  router.patch(
    '/admin/orders/:orderId/status',
    requireAdminAuth,
    (req, res) => {
      const orderId = String(req.params.orderId || '').trim();
      if (!orderId || !/^[a-zA-Z0-9_-]{1,40}$/.test(orderId)) {
        return res.status(400).json({
          code: 'invalid_order_id',
          message: 'Valid order ID is required.',
        });
      }
      const status = String(req.body?.status || '').trim() as AdminOrderStatus;
      if (!VALID_ORDER_STATUSES.has(status)) {
        return res.status(400).json({
          code: 'invalid_order_status',
          message:
            'Order status must be pending, processing, shipped, delivered, or cancelled.',
        });
      }
      setOrderStatusOverride(orderId, status);
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ ok: true, orderId, status });
    }
  );

  // Settings & Live WooCommerce Diagnostics
  router.get('/admin/settings', requireAdminAuth, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ settings: getStorefrontSettings() });
  });

  function isSafeHttpUrl(val: string): boolean {
    try {
      const parsed = new URL(val);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  router.patch('/admin/settings', requireAdminAuth, (req, res) => {
    const patch: Partial<{
      supportEmail: string;
      announcementText: string;
      instagramUrl: string;
      facebookUrl: string;
    }> = {};

    if (typeof req.body?.supportEmail === 'string') {
      const email = req.body.supportEmail.trim().slice(0, 120);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          code: 'invalid_email',
          message: 'Please enter a valid support email address.',
        });
      }
      patch.supportEmail = email;
    }

    if (typeof req.body?.announcementText === 'string') {
      patch.announcementText = req.body.announcementText.trim().slice(0, 180);
    }

    if (typeof req.body?.instagramUrl === 'string') {
      const url = req.body.instagramUrl.trim().slice(0, 240);
      if (url && !isSafeHttpUrl(url)) {
        return res.status(400).json({
          code: 'invalid_url',
          message: 'Instagram URL must start with https:// or http://.',
        });
      }
      patch.instagramUrl = url;
    }

    if (typeof req.body?.facebookUrl === 'string') {
      const url = req.body.facebookUrl.trim().slice(0, 240);
      if (url && !isSafeHttpUrl(url)) {
        return res.status(400).json({
          code: 'invalid_url',
          message: 'Facebook URL must start with https:// or http://.',
        });
      }
      patch.facebookUrl = url;
    }

    const updated = updateStorefrontSettings(patch);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ settings: updated });
  });

  router.get('/admin/diagnostics', requireAdminAuth, async (_req, res) => {
    const { hasV3Credentials, baseUrl } = getWcConfig();
    const startedAt = Date.now();
    let connected = false;
    let categoryCount = 0;
    let productCount = 0;
    let error: string | null = null;

    try {
      const { categories, products } =
        await loadAllLiveWcProductsAndCategories();
      connected = true;
      categoryCount = categories.length;
      productCount = products.length;
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : 'Unable to reach WooCommerce store endpoint.';
    }

    const latencyMs = Date.now() - startedAt;
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
    const stripeConfigured = stripeKey.length > 0;
    const stripeMode = !stripeConfigured
      ? 'not_configured'
      : stripeKey.startsWith('sk_live_')
        ? 'live'
        : 'test';

    const catalogIdConfigured = Boolean(
      (process.env.META_CATALOG_ID || '').trim()
    );
    const accessTokenConfigured = Boolean(
      (process.env.META_ACCESS_TOKEN || '').trim()
    );
    const pixelIdConfigured = Boolean((process.env.META_PIXEL_ID || '').trim());

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      checkedAt: new Date().toISOString(),
      storefrontBaseUrl: 'https://www.fiftydollarshop.com/',
      woocommerce: {
        connected,
        mode: hasV3Credentials ? 'v3+store-fallback' : 'store-public',
        storeOrigin: baseUrl,
        latencyMs,
        categoryCount,
        productCount,
        error,
      },
      paymentGateway: {
        stripeConfigured,
        stripeMode,
        woocommerceCheckoutProxyActive: true,
      },
      metaCommerce: {
        storefrontBaseUrl: 'https://www.fiftydollarshop.com/',
        catalogIdConfigured,
        accessTokenConfigured,
        pixelIdConfigured,
        status:
          catalogIdConfigured && accessTokenConfigured
            ? 'configured'
            : 'ready_to_connect',
      },
    });
  });

  router.use((_req: Request, res: Response) => {
    res
      .status(404)
      .json({ code: 'not_found', message: 'API endpoint not found.' });
  });

  return router;
}

// Standalone Express app exported for Vercel Serverless Functions (/api/index.ts)
const vercelApp = express();
vercelApp.disable('x-powered-by');
vercelApp.use(express.json({ limit: '64kb' }));
vercelApp.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  next();
});

const sharedApiRouter = createApiRouter();
vercelApp.use('/api', sharedApiRouter);
vercelApp.use('/', sharedApiRouter);

export default vercelApp;
