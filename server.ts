import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

interface NonceSession {
  nonce: string;
  cartToken: string;
}

// Lightweight sliding-window rate limiter for API routes
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
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
  const rawUrl = (
    process.env.WC_STORE_URL || 'https://deeppink-tiger-469250.hostingersite.com'
  ).trim();
  let origin = 'https://deeppink-tiger-469250.hostingersite.com';
  try {
    origin = new URL(rawUrl).origin;
  } catch {
    origin = rawUrl.replace(/\/+$/, '');
  }
  const key = (process.env.WC_CONSUMER_KEY || '').trim();
  const secret = (process.env.WC_CONSUMER_SECRET || '').trim();
  return {
    baseUrl: origin,
    v3Api: `${origin}/wp-json/wc/v3`,
    storeApi: `${origin}/wp-json/wc/store/v1`,
    key,
    secret,
  };
}

function getWcV3AuthHeader(): string {
  const { key, secret } = getWcConfig();
  const token = Buffer.from(`${key}:${secret}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function fetchWcV3<T>(endpointPath: string): Promise<{ status: number; data: T }> {
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

async function fetchFreshWcSession(existingToken?: string): Promise<NonceSession> {
  const { storeApi } = getWcConfig();
  const headers: Record<string, string> = {
    Accept: 'application/json',
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
    let cartToken = (req.headers['x-wc-cart-token'] as string | undefined) || '';
    let nonce = (req.headers['x-wc-nonce'] as string | undefined) || '';

    if (method === 'POST' && (!nonce || !cartToken)) {
      const session = await fetchFreshWcSession(cartToken || undefined);
      nonce = session.nonce;
      cartToken = session.cartToken;
    }

    const doFetch = async (activeNonce: string, activeToken: string) => {
      const headers: Record<string, string> = {
        Accept: 'application/json',
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

    if (method === 'POST' && (upstream.status === 401 || upstream.status === 403)) {
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
        code: 'wc_invalid_response',
        message: 'Unexpected response from WooCommerce cart service.',
      });
    }
  } catch {
    return res.status(502).json({
      code: 'wc_proxy_error',
      message: 'Unable to reach WooCommerce cart service.',
    });
  }
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Security headers (iframe-compatible)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use('/api', apiRateLimiter);

  // Live WooCommerce REST API v3 routes (authenticated strictly server-side)
  app.get('/api/wc/categories', async (_req: Request, res: Response) => {
    try {
      const { key, secret } = getWcConfig();
      if (!key || !secret) {
        return res.status(500).json({
          code: 'wc_missing_credentials',
          message: 'Store API credentials are not configured.',
        });
      }
      const { status, data } = await fetchWcV3('/products/categories?per_page=100');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(status).json(data);
    } catch {
      return res.status(502).json({
        code: 'wc_v3_error',
        message: 'Unable to fetch categories from store.',
      });
    }
  });

  app.get('/api/wc/products', async (req: Request, res: Response) => {
    try {
      const { key, secret } = getWcConfig();
      if (!key || !secret) {
        return res.status(500).json({
          code: 'wc_missing_credentials',
          message: 'Store API credentials are not configured.',
        });
      }

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
        const catsResp = await fetchWcV3<Array<{ id: number; name: string; slug: string }>>(
          '/products/categories?per_page=100'
        );
        if (catsResp.status === 200 && Array.isArray(catsResp.data)) {
          const hotCat =
            catsResp.data.find((c) => c.name === 'Hot Selling 50$ Products') ||
            catsResp.data.find((c) => c.slug === 'hot-sale') ||
            catsResp.data.find((c) => c.name.toLowerCase().includes('hot selling'));
          if (hotCat) {
            categoryId = String(hotCat.id);
          }
        }
      }

      const parsedPerPage = Number(req.query.per_page || 100);
      const perPage = Number.isFinite(parsedPerPage)
        ? Math.min(Math.max(Math.trunc(parsedPerPage), 1), 100)
        : 100;

      const params = new URLSearchParams();
      if (categoryId) params.set('category', categoryId);
      params.set('per_page', String(perPage));
      params.set('status', 'publish');

      if (typeof req.query.search === 'string' && req.query.search.trim()) {
        params.set('search', req.query.search.trim().slice(0, 120));
      }

      const { status, data } = await fetchWcV3(`/products?${params.toString()}`);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(status).json(data);
    } catch {
      return res.status(502).json({
        code: 'wc_v3_error',
        message: 'Unable to fetch products from store.',
      });
    }
  });

  app.get('/api/wc/products/:id', async (req: Request, res: Response) => {
    try {
      const { key, secret } = getWcConfig();
      if (!key || !secret) {
        return res.status(500).json({
          code: 'wc_missing_credentials',
          message: 'Store API credentials are not configured.',
        });
      }

      const rawId = String(req.params.id || '');
      if (!/^\d+$/.test(rawId)) {
        return res.status(400).json({
          code: 'invalid_product_id',
          message: 'Product ID must be a valid positive integer.',
        });
      }

      const [productResp, variationsResp] = await Promise.all([
        fetchWcV3<Record<string, unknown>>(`/products/${rawId}`),
        fetchWcV3<unknown[]>(`/products/${rawId}/variations?per_page=100`),
      ]);

      res.setHeader('Cache-Control', 'no-store');
      if (productResp.status !== 200) {
        return res.status(productResp.status).json(productResp.data);
      }

      const enriched = {
        ...productResp.data,
        variation_details:
          variationsResp.status === 200 && Array.isArray(variationsResp.data)
            ? variationsResp.data
            : [],
      };
      return res.status(200).json(enriched);
    } catch {
      return res.status(502).json({
        code: 'wc_v3_error',
        message: 'Unable to fetch product details from store.',
      });
    }
  });

  // Live WooCommerce Store API routes for Cart & Checkout
  app.get('/api/wc/cart', async (req: Request, res: Response) => {
    return proxyStoreApiRequest(req, res, '/cart', 'GET');
  });

  app.post('/api/wc/cart/add-item', async (req: Request, res: Response) => {
    const id = Number(req.body?.id);
    const quantity = Number(req.body?.quantity ?? 1);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(quantity) || quantity <= 0 || quantity > 50) {
      return res.status(400).json({
        code: 'invalid_cart_payload',
        message: 'Valid product ID and quantity (1-50) are required.',
      });
    }
    return proxyStoreApiRequest(req, res, '/cart/add-item', 'POST');
  });

  app.post('/api/wc/cart/update-item', async (req: Request, res: Response) => {
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

  app.post('/api/wc/cart/remove-item', async (req: Request, res: Response) => {
    const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
    if (!key) {
      return res.status(400).json({
        code: 'invalid_cart_remove',
        message: 'Cart item key is required.',
      });
    }
    return proxyStoreApiRequest(req, res, '/cart/remove-item', 'POST');
  });

  app.post('/api/wc/cart/update-customer', async (req: Request, res: Response) => {
    return proxyStoreApiRequest(req, res, '/cart/update-customer', 'POST');
  });

  app.get('/api/wc/checkout', async (req: Request, res: Response) => {
    return proxyStoreApiRequest(req, res, '/checkout', 'GET');
  });

  app.post('/api/wc/checkout', async (req: Request, res: Response) => {
    return proxyStoreApiRequest(req, res, '/checkout', 'POST');
  });

  app.post('/api/contact', (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const orderNumber =
      typeof req.body?.orderNumber === 'string' ? req.body.orderNumber.trim().slice(0, 40) : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        ok: false,
        message: 'Please provide your name, a valid email address, and your message.',
      });
    }
    const ticketId = `FDS-${Date.now().toString().slice(-6)}`;
    return res.json({
      ok: true,
      ticketId,
      message: 'Thanks for reaching out. Our USA support team will reply within 24 hours.',
      receivedAt: new Date().toISOString(),
      orderNumber: orderNumber || null,
    });
  });

  // Ensure unknown /api/* paths always return JSON 404
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ code: 'not_found', message: 'API endpoint not found.' });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FiftyDollarShop server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
