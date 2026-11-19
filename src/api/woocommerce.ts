import type {
  WcAddress,
  WcCart,
  WcCategory,
  WcCheckoutResponse,
  WcProduct,
} from '../types/woocommerce';

const CART_TOKEN_KEY = 'fds_wc_cart_token';
let inMemoryNonce = '';

function getStoredCartToken(): string {
  try {
    return window.localStorage.getItem(CART_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function saveSessionHeaders(res: Response) {
  const nextToken = res.headers.get('x-wc-cart-token');
  const nextNonce = res.headers.get('x-wc-nonce');
  if (nextToken) {
    try {
      window.localStorage.setItem(CART_TOKEN_KEY, nextToken);
    } catch {
      // Ignore storage errors in restricted environments
    }
  }
  if (nextNonce) {
    inMemoryNonce = nextNonce;
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredCartToken();
  if (token) {
    headers.set('x-wc-cart-token', token);
  }
  if (inMemoryNonce) {
    headers.set('x-wc-nonce', inMemoryNonce);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    cache: 'no-store',
  });

  saveSessionHeaders(response);

  const rawText = await response.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(
      `Store API returned an unexpected response (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const message =
      (obj && typeof obj.message === 'string' && obj.message) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export const WC_STORE_ORIGIN = 'https://deeppink-tiger-469250.hostingersite.com';
export const HOT_SELLING_CATEGORY_NAME = 'Hot Selling 50$ Products';
export const HOT_SELLING_CATEGORY_SLUG = 'hot-sale';

export async function fetchWcCategories(): Promise<WcCategory[]> {
  return apiFetch<WcCategory[]>('/api/wc/categories');
}

export async function fetchWcProducts(params: {
  category?: number | string;
  search?: string;
  perPage?: number;
} = {}): Promise<WcProduct[]> {
  const query = new URLSearchParams();
  if (params.category !== undefined && params.category !== '') {
    query.set('category', String(params.category));
  }
  if (params.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  query.set('per_page', String(params.perPage ?? 100));
  return apiFetch<WcProduct[]>(`/api/wc/products?${query.toString()}`);
}

const productDetailCache = new Map<number, WcProduct>();
const productDetailInflight = new Map<number, Promise<WcProduct>>();

export async function fetchWcProductById(id: number): Promise<WcProduct> {
  const fresh = await apiFetch<WcProduct>(`/api/wc/products/${id}`);
  productDetailCache.set(id, fresh);
  return fresh;
}

export async function fetchWcProductByIdCached(id: number): Promise<WcProduct> {
  const cached = productDetailCache.get(id);
  if (cached && cached.variation_details && cached.variation_details.length > 0) {
    return cached;
  }
  const inflight = productDetailInflight.get(id);
  if (inflight) {
    return inflight;
  }
  const req = fetchWcProductById(id).finally(() => {
    productDetailInflight.delete(id);
  });
  productDetailInflight.set(id, req);
  return req;
}

export async function fetchWcCart(): Promise<WcCart> {
  return apiFetch<WcCart>('/api/wc/cart');
}

export async function addWcCartItem(
  productIdOrVariationId: number,
  quantity = 1,
  variation?: Array<{ attribute: string; value: string }>
): Promise<WcCart> {
  const payload: Record<string, unknown> = {
    id: productIdOrVariationId,
    quantity,
  };
  if (variation && variation.length > 0) {
    payload.variation = variation;
  }
  return apiFetch<WcCart>('/api/wc/cart/add-item', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateWcCartItem(
  key: string,
  quantity: number
): Promise<WcCart> {
  return apiFetch<WcCart>('/api/wc/cart/update-item', {
    method: 'POST',
    body: JSON.stringify({ key, quantity }),
  });
}

export async function removeWcCartItem(key: string): Promise<WcCart> {
  return apiFetch<WcCart>('/api/wc/cart/remove-item', {
    method: 'POST',
    body: JSON.stringify({ key }),
  });
}

export async function updateWcCustomer(addresses: {
  billing_address: WcAddress;
  shipping_address: WcAddress;
}): Promise<WcCart> {
  return apiFetch<WcCart>('/api/wc/cart/update-customer', {
    method: 'POST',
    body: JSON.stringify(addresses),
  });
}

export async function submitWcCheckout(payload: {
  billing_address: WcAddress;
  shipping_address: WcAddress;
  payment_method: string;
  customer_note?: string;
}): Promise<WcCheckoutResponse> {
  return apiFetch<WcCheckoutResponse>('/api/wc/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitContactInquiry(payload: {
  name: string;
  email: string;
  orderNumber?: string;
  message: string;
}): Promise<{ ok: boolean; ticketId: string; message: string }> {
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Unable to submit message.');
  }
  return data;
}
