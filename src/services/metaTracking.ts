import type { WcAddress, WcCart, WcProduct } from '../types/woocommerce';
import { decodeHtmlEntities } from '../utils/format';

export type MetaStandardEventName =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase';

export interface MetaCustomerPii {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  external_id?: string;
}

export interface MetaContentItem {
  id: string;
  quantity: number;
  item_price?: number;
}

export interface MetaCustomDataPayload {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_name?: string;
  content_category?: string;
  content_type?: 'product' | 'product_group';
  contents?: MetaContentItem[];
  num_items?: number;
  order_id?: string;
}

interface FbqFunction {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
}

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

const CAPI_ENDPOINT = '/api/meta/capi';
const FBEVENTS_SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

let initPromise: Promise<string | null> | null = null;
let initializedPixelId: string | null = null;
let pendingPixelQueue: Array<{
  eventName: MetaStandardEventName;
  payload: MetaCustomDataPayload;
  eventId: string;
}> = [];
const firedPurchaseOrderIds = new Set<string>();

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined' || !document.cookie) return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  if (!match || !match[1]) return undefined;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  try {
    const secureFlag =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? '; Secure'
        : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`;
  } catch {
    // Ignore cookie write errors in restricted iframe environments
  }
}

/**
 * Ensures _fbc is captured when arriving with Meta's ?fbclid=... click parameter,
 * then returns current _fbp and _fbc values for high Event Match Quality.
 */
export function getMetaBrowserCookies(): { fbp?: string; fbc?: string } {
  const fbp = readCookie('_fbp');
  let fbc = readCookie('_fbc');

  if (!fbc && typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const fbclid = (params.get('fbclid') || '').trim();
      if (fbclid && /^[\w.-]{6,200}$/.test(fbclid)) {
        // Meta's standard _fbc format: fb.1.<creation_time_ms>.<fbclid>
        fbc = `fb.1.${Date.now()}.${fbclid}`;
        writeCookie('_fbc', fbc, 60 * 60 * 24 * 90);
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  return { fbp, fbc };
}

/**
 * Generates a unique shared event_id used by both browser Pixel and server CAPI
 * so Meta deduplicates them automatically.
 */
export function generateMetaEventId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'evt';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${cleanPrefix}_${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${cleanPrefix}_${Date.now()}_${rand}`;
}

export function buildPurchaseEventId(orderId: string | number): string {
  const normalized = String(orderId).trim().replace(/[^\w-]/g, '');
  return normalized ? `purchase_${normalized}` : generateMetaEventId('purchase');
}

function parseDecimalPrice(raw: string | number | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Number(n.toFixed(2));
}

function parseMinorAmount(raw: string | number | undefined, minorUnit = 2): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  const divisor = Math.pow(10, minorUnit);
  return Number((n / divisor).toFixed(2));
}

function ensureFbqLoaded(pixelId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!/^\d{5,30}$/.test(pixelId)) return;

  if (!window.fbq) {
    const fbqShim: FbqFunction = function (...args: unknown[]) {
      if (fbqShim.callMethod) {
        fbqShim.callMethod(...args);
      } else {
        fbqShim.queue = fbqShim.queue || [];
        fbqShim.queue.push(args);
      }
    };
    fbqShim.push = fbqShim;
    fbqShim.loaded = true;
    fbqShim.version = '2.0';
    fbqShim.queue = [];
    window.fbq = fbqShim;
    if (!window._fbq) window._fbq = fbqShim;

    const existingScript = document.querySelector(
      `script[src="${FBEVENTS_SCRIPT_SRC}"]`
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.async = true;
      script.src = FBEVENTS_SCRIPT_SRC;
      document.head.appendChild(script);
    }
  }

  if (initializedPixelId !== pixelId) {
    initializedPixelId = pixelId;
    window.fbq('init', pixelId);

    // Flush any queued events captured while Pixel config was loading
    const queued = pendingPixelQueue;
    pendingPixelQueue = [];
    for (const item of queued) {
      try {
        window.fbq('track', item.eventName, item.payload, {
          eventID: item.eventId,
        });
      } catch {
        // Never break storefront UI on Pixel errors
      }
    }
  }
}

/**
 * Dynamically initializes Meta Pixel from the server's public META_PIXEL_ID config
 * (tokens stay strictly on the server) and records an initial deduplicated PageView.
 */
export function initMetaPixel(): void {
  if (typeof window === 'undefined') return;
  // Capture fbclid -> _fbc immediately on entry
  getMetaBrowserCookies();

  if (initPromise) return;
  initPromise = fetch(CAPI_ENDPOINT, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as { pixelId?: string | null };
      const pixelId =
        typeof data.pixelId === 'string' && /^\d{5,30}$/.test(data.pixelId)
          ? data.pixelId
          : null;
      if (pixelId) {
        ensureFbqLoaded(pixelId);
        // Fire deduplicated initial PageView
        dispatchMetaEvent('PageView', {}, undefined, generateMetaEventId('pv'));
      }
      return pixelId;
    })
    .catch(() => null);
}

function sendBrowserPixelEvent(
  eventName: MetaStandardEventName,
  payload: MetaCustomDataPayload,
  eventId: string
): void {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq === 'function') {
    try {
      window.fbq('track', eventName, payload, { eventID: eventId });
    } catch {
      // Non-blocking safeguard
    }
    return;
  }

  // If Pixel config is still bootstrapping, queue so fbq fires with the exact same eventID once ready
  if (pendingPixelQueue.length < 20) {
    pendingPixelQueue.push({ eventName, payload, eventId });
  }
}

function sendServerCapiEvent(
  eventName: MetaStandardEventName,
  customData: MetaCustomDataPayload,
  customerPii: MetaCustomerPii | undefined,
  eventId: string
): void {
  if (typeof window === 'undefined') return;

  const { fbp, fbc } = getMetaBrowserCookies();
  const userData: Record<string, string> = {};
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  if (customerPii) {
    if (customerPii.email) userData.email = customerPii.email;
    if (customerPii.phone) userData.phone = customerPii.phone;
    if (customerPii.first_name) userData.first_name = customerPii.first_name;
    if (customerPii.last_name) userData.last_name = customerPii.last_name;
    if (customerPii.city) userData.city = customerPii.city;
    if (customerPii.state) userData.state = customerPii.state;
    if (customerPii.postcode) userData.postcode = customerPii.postcode;
    if (customerPii.country) userData.country = customerPii.country;
    if (customerPii.external_id) userData.external_id = customerPii.external_id;
  }

  const body = JSON.stringify({
    event_name: eventName,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: window.location.href,
    user_data: userData,
    custom_data: customData,
  });

  // Strictly non-blocking fire-and-forget with keepalive so checkout never slows down
  try {
    void fetch(CAPI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Never interrupt storefront flows if tracking network fails
  }
}

/**
 * Dispatches an event to BOTH Browser Pixel and Server CAPI using the exact same event_id
 * for automatic Meta deduplication. Completely non-blocking.
 */
export function dispatchMetaEvent(
  eventName: MetaStandardEventName,
  customData: MetaCustomDataPayload,
  customerPii?: MetaCustomerPii,
  explicitEventId?: string
): string {
  const eventId = explicitEventId || generateMetaEventId(eventName);
  sendBrowserPixelEvent(eventName, customData, eventId);
  sendServerCapiEvent(eventName, customData, customerPii, eventId);
  return eventId;
}

/**
 * 1. ViewContent — fired when a shopper opens a Product Detail page.
 */
export function trackViewContent(product: WcProduct): string {
  const unitPrice = parseDecimalPrice(product.sale_price || product.price) || 50;
  const retailerId = `wc-${product.id}`;
  const isVariable =
    product.type === 'variable' || (product.variations?.length ?? 0) > 1;
  const primaryCategory = product.categories?.[0]?.name
    ? decodeHtmlEntities(product.categories[0].name)
    : undefined;

  const payload: MetaCustomDataPayload = {
    content_ids: [retailerId],
    content_name: decodeHtmlEntities(product.name || ''),
    content_type: isVariable ? 'product_group' : 'product',
    value: unitPrice,
    currency: 'USD',
    contents: [
      {
        id: retailerId,
        quantity: 1,
        item_price: unitPrice,
      },
    ],
  };
  if (primaryCategory) {
    payload.content_category = primaryCategory;
  }

  return dispatchMetaEvent('ViewContent', payload, undefined, generateMetaEventId('vc'));
}

/**
 * 2. AddToCart — fired when a shopper adds a product to their cart (or clicks Buy Now).
 */
export function trackAddToCart(
  product: WcProduct,
  quantity = 1,
  variationId?: number
): string {
  const safeQty = Math.max(1, Math.round(quantity));
  const matchedVariation = variationId
    ? product.variation_details?.find((v) => v.id === variationId)
    : undefined;
  const unitPrice =
    parseDecimalPrice(
      matchedVariation?.sale_price ||
        matchedVariation?.price ||
        product.sale_price ||
        product.price
    ) || 50;
  const contentId = variationId ? `wc-${variationId}` : `wc-${product.id}`;
  const primaryCategory = product.categories?.[0]?.name
    ? decodeHtmlEntities(product.categories[0].name)
    : undefined;

  const payload: MetaCustomDataPayload = {
    content_ids: [contentId],
    content_name: decodeHtmlEntities(product.name || ''),
    content_type: 'product',
    value: Number((unitPrice * safeQty).toFixed(2)),
    currency: 'USD',
    num_items: safeQty,
    contents: [
      {
        id: contentId,
        quantity: safeQty,
        item_price: unitPrice,
      },
    ],
  };
  if (primaryCategory) {
    payload.content_category = primaryCategory;
  }

  return dispatchMetaEvent('AddToCart', payload, undefined, generateMetaEventId('atc'));
}

function buildCartCustomData(cart: WcCart | null): MetaCustomDataPayload {
  const items = cart?.items ?? [];
  const minorUnit = cart?.totals?.currency_minor_unit ?? 2;
  const currency = (cart?.totals?.currency_code || 'USD').toUpperCase();

  const contents: MetaContentItem[] = items.map((item) => {
    const itemMinor = item.prices?.currency_minor_unit ?? minorUnit;
    const itemPrice = parseMinorAmount(
      item.prices?.sale_price || item.prices?.price,
      itemMinor
    );
    return {
      id: `wc-${item.id}`,
      quantity: Math.max(1, item.quantity || 1),
      item_price: itemPrice || 50,
    };
  });

  const contentIds = contents.map((c) => c.id);
  const numItems =
    cart?.items_count ??
    contents.reduce((sum, item) => sum + item.quantity, 0);
  const totalFromCart = parseMinorAmount(cart?.totals?.total_price, minorUnit);
  const fallbackTotal = contents.reduce(
    (sum, item) => sum + (item.item_price ?? 50) * item.quantity,
    0
  );

  return {
    content_ids: contentIds,
    content_type: 'product',
    value: Number((totalFromCart > 0 ? totalFromCart : fallbackTotal).toFixed(2)),
    currency,
    num_items: numItems,
    contents,
  };
}

/**
 * 3. InitiateCheckout — fired when a shopper enters the Checkout flow.
 */
export function trackInitiateCheckout(
  cart: WcCart | null,
  customer?: Partial<WcAddress>
): string {
  const payload = buildCartCustomData(cart);
  const customerPii: MetaCustomerPii | undefined = customer
    ? {
        email: customer.email,
        phone: customer.phone,
        first_name: customer.first_name,
        last_name: customer.last_name,
        city: customer.city,
        state: customer.state,
        postcode: customer.postcode,
        country: customer.country,
      }
    : undefined;

  return dispatchMetaEvent(
    'InitiateCheckout',
    payload,
    customerPii,
    generateMetaEventId('ic')
  );
}

/**
 * 4. Purchase — fired on order confirmation using deterministic orderId-based event_id
 * for exact Browser Pixel + Server CAPI deduplication. Strictly non-blocking.
 */
export function trackPurchase(params: {
  orderId: string | number;
  cart: WcCart | null;
  customer?: Partial<WcAddress>;
  currency?: string;
}): string {
  const orderKey = String(params.orderId).trim();
  const eventId = buildPurchaseEventId(orderKey);

  // Prevent duplicate Purchase firing for the same order in the same session
  if (orderKey && firedPurchaseOrderIds.has(orderKey)) {
    return eventId;
  }
  if (orderKey) {
    firedPurchaseOrderIds.add(orderKey);
  }

  const payload = buildCartCustomData(params.cart);
  if (params.currency) {
    payload.currency = params.currency.toUpperCase();
  }
  if (orderKey) {
    payload.order_id = orderKey;
  }

  const customerPii: MetaCustomerPii | undefined = params.customer
    ? {
        email: params.customer.email,
        phone: params.customer.phone,
        first_name: params.customer.first_name,
        last_name: params.customer.last_name,
        city: params.customer.city,
        state: params.customer.state,
        postcode: params.customer.postcode,
        country: params.customer.country || 'US',
      }
    : undefined;

  return dispatchMetaEvent('Purchase', payload, customerPii, eventId);
}
