import express from 'express';
import type { NextFunction, Request, Response, Router } from 'express';

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
        return v3Resp;
      }
    } catch {
      // Fall through to public Store API
    }
  }

  const pubResp = await fetchWcStorePublic<StoreApiCategory[]>(
    '/products/categories?per_page=100'
  );
  if (pubResp.status === 200 && Array.isArray(pubResp.data)) {
    return {
      status: 200,
      data: pubResp.data.map(normalizeStoreCategory),
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
  method: 'GET' | 'POST'
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

      if (hasV3Credentials) {
        try {
          const params = new URLSearchParams();
          if (categoryId) params.set('category', categoryId);
          params.set('per_page', String(perPage));
          params.set('status', 'publish');
          if (searchTerm) params.set('search', searchTerm);

          const v3Resp = await fetchWcV3<unknown>(
            `/products?${params.toString()}`
          );
          if (v3Resp.status === 200 && Array.isArray(v3Resp.data)) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).json(v3Resp.data);
          }
        } catch {
          // Fall through to public Store API
        }
      }

      const pubParams = new URLSearchParams();
      if (categoryId) pubParams.set('category', categoryId);
      pubParams.set('per_page', String(perPage));
      if (searchTerm) pubParams.set('search', searchTerm);

      const pubResp = await fetchWcStorePublic<StoreApiProduct[]>(
        `/products?${pubParams.toString()}`
      );
      res.setHeader('Cache-Control', 'no-store');
      if (pubResp.status === 200 && Array.isArray(pubResp.data)) {
        return res.status(200).json(pubResp.data.map(normalizeStoreProduct));
      }
      return res.status(pubResp.status).json(pubResp.data);
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
            const enriched = {
              ...productResp.data,
              variation_details:
                variationsResp.status === 200 &&
                Array.isArray(variationsResp.data)
                  ? variationsResp.data
                  : [],
            };
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
        return res.status(200).json(normalizeStoreProduct(pubResp.data));
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
    return proxyStoreApiRequest(req, res, '/checkout', 'POST');
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
