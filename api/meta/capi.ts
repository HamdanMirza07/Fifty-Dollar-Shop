import crypto from 'crypto';

// Self-contained zero-relative-import Vercel serverless handler for /api/meta/capi
// Supports GET (public Pixel ID config) and POST (server-side Meta Conversions API forwarding).

const DEFAULT_GRAPH_API_VERSION = 'v22.0';
const CAPI_TIMEOUT_MS = 6000;

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
  'Search',
  'AddToWishlist',
]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const ipRateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip || 'unknown';
  const existing = ipRateBuckets.get(key);
  if (!existing || now >= existing.resetAt) {
    ipRateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (ipRateBuckets.size > 2000) {
      for (const [bucketKey, bucket] of ipRateBuckets.entries()) {
        if (now >= bucket.resetAt) ipRateBuckets.delete(bucketKey);
      }
    }
    return true;
  }
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  existing.count += 1;
  return true;
}

interface MetaCapiConfig {
  pixelId: string;
  accessToken: string;
  graphVersion: string;
  testEventCode: string;
}

function getMetaCapiConfig(): MetaCapiConfig {
  const rawPixelId = (process.env.META_PIXEL_ID || '').trim();
  const pixelId = /^\d{5,30}$/.test(rawPixelId) ? rawPixelId : '';
  const accessToken = (
    process.env.META_CAPI_TOKEN ||
    process.env.META_ACCESS_TOKEN ||
    ''
  ).trim();
  const rawVersion = (
    process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION
  ).trim();
  const graphVersion = /^v\d+\.\d+$/.test(rawVersion)
    ? rawVersion
    : DEFAULT_GRAPH_API_VERSION;
  const testEventCode = (process.env.META_TEST_EVENT_CODE || '').trim().slice(0, 64);

  return {
    pixelId,
    accessToken,
    graphVersion,
    testEventCode,
  };
}

function sha256Hex(normalized: string): string {
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function hashTrimLower(value: unknown, maxLen = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().toLowerCase().slice(0, maxLen);
  if (!cleaned) return undefined;
  return sha256Hex(cleaned);
}

function hashPhone(value: unknown, country?: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let digits = value.trim().replace(/\D+/g, '');
  if (!digits) return undefined;
  const countryCode =
    typeof country === 'string' ? country.trim().toLowerCase() : '';
  if (digits.length === 10 && (!countryCode || countryCode === 'us' || countryCode === 'usa')) {
    digits = `1${digits}`;
  }
  if (digits.length < 7 || digits.length > 20) return undefined;
  return sha256Hex(digits);
}

function hashPostcode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().toLowerCase().replace(/[\s-]+/g, '').slice(0, 24);
  if (!cleaned) return undefined;
  return sha256Hex(cleaned);
}

function hashCountry(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim().toLowerCase();
  if (!raw) return undefined;
  const iso = raw === 'usa' || raw === 'united states' ? 'us' : raw.slice(0, 2);
  if (!/^[a-z]{2}$/.test(iso)) return undefined;
  return sha256Hex(iso);
}

function hashState(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
  if (!cleaned) return undefined;
  return sha256Hex(cleaned);
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key && val) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function sanitizeMetaCookie(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, 256);
  if (!trimmed || !/^fb\.\d+\.\d+\.[\w.-]+$/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function sanitizeSourceUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().slice(0, 1024);
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

interface IncomingUserData {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  postcode?: string;
  zip?: string;
  country?: string;
  external_id?: string;
  fbp?: string;
  fbc?: string;
}

interface IncomingContentItem {
  id?: string | number;
  quantity?: number;
  item_price?: number;
}

interface IncomingCustomData {
  value?: number | string;
  currency?: string;
  content_ids?: Array<string | number>;
  content_name?: string;
  content_category?: string;
  content_type?: string;
  contents?: IncomingContentItem[];
  num_items?: number;
  order_id?: string | number;
  search_string?: string;
}

function sanitizeCustomData(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const input = raw as IncomingCustomData;
  const out: Record<string, unknown> = {};

  if (input.value !== undefined && input.value !== null && input.value !== '') {
    const num = Number(input.value);
    if (Number.isFinite(num) && num >= 0 && num <= 1_000_000) {
      out.value = Number(num.toFixed(2));
    }
  }

  if (typeof input.currency === 'string') {
    const cur = input.currency.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(cur)) {
      out.currency = cur;
    }
  }
  if (out.value !== undefined && !out.currency) {
    out.currency = 'USD';
  }

  if (Array.isArray(input.content_ids)) {
    const ids = input.content_ids
      .map((item) => String(item ?? '').trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 50);
    if (ids.length > 0) {
      out.content_ids = ids;
    }
  }

  if (typeof input.content_name === 'string' && input.content_name.trim()) {
    out.content_name = input.content_name.trim().slice(0, 250);
  }

  if (typeof input.content_category === 'string' && input.content_category.trim()) {
    out.content_category = input.content_category.trim().slice(0, 150);
  }

  if (
    input.content_type === 'product' ||
    input.content_type === 'product_group'
  ) {
    out.content_type = input.content_type;
  }

  if (Array.isArray(input.contents)) {
    const sanitizedContents = input.contents
      .slice(0, 50)
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const id = String(entry.id ?? '').trim().slice(0, 100);
        if (!id) return null;
        const qtyNum = Number(entry.quantity ?? 1);
        const quantity =
          Number.isFinite(qtyNum) && qtyNum > 0
            ? Math.min(Math.round(qtyNum), 999)
            : 1;
        const item: Record<string, unknown> = { id, quantity };
        if (entry.item_price !== undefined) {
          const priceNum = Number(entry.item_price);
          if (Number.isFinite(priceNum) && priceNum >= 0 && priceNum <= 1_000_000) {
            item.item_price = Number(priceNum.toFixed(2));
          }
        }
        return item;
      })
      .filter((x): x is Record<string, unknown> => x !== null);
    if (sanitizedContents.length > 0) {
      out.contents = sanitizedContents;
    }
  }

  if (input.num_items !== undefined) {
    const n = Number(input.num_items);
    if (Number.isFinite(n) && n >= 0 && n <= 9999) {
      out.num_items = Math.round(n);
    }
  }

  if (input.order_id !== undefined && input.order_id !== null) {
    const oid = String(input.order_id).trim().slice(0, 100);
    if (oid) {
      out.order_id = oid;
    }
  }

  if (typeof input.search_string === 'string' && input.search_string.trim()) {
    out.search_string = input.search_string.trim().slice(0, 200);
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

interface ServerlessReq {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
}

interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  setHeader: (name: string, value: string) => void;
  json: (payload: unknown) => void;
}

function getHeaderString(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const val = headers[name] ?? headers[name.toLowerCase()];
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) return val[0];
  return undefined;
}

function extractClientIp(req: ServerlessReq): string | undefined {
  const candidates: string[] = [];
  const xff = getHeaderString(req.headers, 'x-forwarded-for');
  if (xff) {
    candidates.push(...xff.split(',').map((s) => s.trim()));
  }
  const cfIp = getHeaderString(req.headers, 'cf-connecting-ip');
  if (cfIp) candidates.push(cfIp.trim());
  const realIp = getHeaderString(req.headers, 'x-real-ip');
  if (realIp) candidates.push(realIp.trim());
  if (req.socket?.remoteAddress) candidates.push(req.socket.remoteAddress.trim());

  for (const raw of candidates) {
    const cleaned = raw.replace(/^::ffff:/i, '').trim();
    if (cleaned && /^[0-9a-fA-F:.]{3,45}$/.test(cleaned)) {
      return cleaned;
    }
  }
  return undefined;
}

export default async function handler(
  req: ServerlessReq,
  res: ServerlessRes
): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const cfg = getMetaCapiConfig();
    res.setHeader(
      'Cache-Control',
      cfg.pixelId ? 'public, max-age=300' : 'no-store'
    );
    res.status(200).json({
      configured: Boolean(cfg.pixelId && cfg.accessToken),
      pixelId: cfg.pixelId || null,
    });
    return;
  }

  if (method !== 'POST') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');

  const clientIp = extractClientIp(req);
  if (!checkRateLimit(clientIp || 'unknown')) {
    res.status(429).json({ ok: false, error: 'Too many tracking requests.' });
    return;
  }

  let parsedBody: Record<string, unknown> | null = null;
  if (typeof req.body === 'string') {
    try {
      const json = JSON.parse(req.body) as unknown;
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        parsedBody = json as Record<string, unknown>;
      }
    } catch {
      parsedBody = null;
    }
  } else if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    parsedBody = req.body as Record<string, unknown>;
  }

  if (!parsedBody) {
    res.status(400).json({ ok: false, error: 'Invalid JSON payload.' });
    return;
  }

  const eventName =
    typeof parsedBody.event_name === 'string' ? parsedBody.event_name.trim() : '';
  if (!ALLOWED_EVENTS.has(eventName)) {
    res.status(400).json({ ok: false, error: 'Unsupported event_name.' });
    return;
  }

  const eventId =
    typeof parsedBody.event_id === 'string'
      ? parsedBody.event_id.trim().slice(0, 128)
      : '';
  if (!eventId) {
    res
      .status(400)
      .json({ ok: false, error: 'event_id is required for deduplication.' });
    return;
  }

  const cfg = getMetaCapiConfig();
  if (!cfg.pixelId || !cfg.accessToken) {
    res.status(200).json({
      ok: true,
      skipped: true,
      event_id: eventId,
      reason: 'Meta Pixel ID or CAPI access token is not configured on the server.',
    });
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const rawEventTime = Number(parsedBody.event_time);
  const eventTime =
    Number.isFinite(rawEventTime) &&
    rawEventTime > nowSec - 7 * 86400 &&
    rawEventTime <= nowSec + 300
      ? Math.floor(rawEventTime)
      : nowSec;

  const eventSourceUrl =
    sanitizeSourceUrl(parsedBody.event_source_url) ||
    sanitizeSourceUrl(getHeaderString(req.headers, 'referer'));

  const cookies = parseCookieHeader(getHeaderString(req.headers, 'cookie'));
  const incomingUser =
    parsedBody.user_data &&
    typeof parsedBody.user_data === 'object' &&
    !Array.isArray(parsedBody.user_data)
      ? (parsedBody.user_data as IncomingUserData)
      : {};

  const userData: Record<string, unknown> = {};

  if (clientIp) {
    userData.client_ip_address = clientIp;
  }
  const userAgent = (getHeaderString(req.headers, 'user-agent') || '')
    .trim()
    .slice(0, 512);
  if (userAgent) {
    userData.client_user_agent = userAgent;
  }

  const fbp =
    sanitizeMetaCookie(incomingUser.fbp) || sanitizeMetaCookie(cookies._fbp);
  if (fbp) userData.fbp = fbp;

  const fbc =
    sanitizeMetaCookie(incomingUser.fbc) || sanitizeMetaCookie(cookies._fbc);
  if (fbc) userData.fbc = fbc;

  const em = hashTrimLower(incomingUser.email, 254);
  if (em) userData.em = [em];

  const ph = hashPhone(incomingUser.phone, incomingUser.country);
  if (ph) userData.ph = [ph];

  const fn = hashTrimLower(incomingUser.first_name, 100);
  if (fn) userData.fn = [fn];

  const ln = hashTrimLower(incomingUser.last_name, 100);
  if (ln) userData.ln = [ln];

  const ct = hashTrimLower(incomingUser.city, 120);
  if (ct) userData.ct = [ct];

  const st = hashState(incomingUser.state);
  if (st) userData.st = [st];

  const zp = hashPostcode(incomingUser.postcode ?? incomingUser.zip);
  if (zp) userData.zp = [zp];

  const country = hashCountry(incomingUser.country);
  if (country) userData.country = [country];

  const externalId = hashTrimLower(incomingUser.external_id, 128);
  if (externalId) userData.external_id = [externalId];

  const customData = sanitizeCustomData(parsedBody.custom_data);

  const capiEvent: Record<string, unknown> = {
    event_name: eventName,
    event_time: eventTime,
    event_id: eventId,
    action_source: 'website',
    user_data: userData,
  };
  if (eventSourceUrl) capiEvent.event_source_url = eventSourceUrl;
  if (customData) capiEvent.custom_data = customData;

  const graphPayload: Record<string, unknown> = {
    data: [capiEvent],
  };
  if (cfg.testEventCode) {
    graphPayload.test_event_code = cfg.testEventCode;
  }

  const endpoint = `https://graph.facebook.com/${cfg.graphVersion}/${cfg.pixelId}/events`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CAPI_TIMEOUT_MS);

  try {
    const metaRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.accessToken}`,
      },
      body: JSON.stringify(graphPayload),
      signal: controller.signal,
    });

    const parsed = (await metaRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!metaRes.ok) {
      const errObj =
        parsed.error && typeof parsed.error === 'object'
          ? (parsed.error as Record<string, unknown>)
          : null;
      const errMsg =
        typeof errObj?.message === 'string'
          ? errObj.message
          : `Meta CAPI returned HTTP ${metaRes.status}`;
      res.status(502).json({
        ok: false,
        event_id: eventId,
        error: errMsg,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      event_id: eventId,
      events_received:
        typeof parsed.events_received === 'number' ? parsed.events_received : 1,
      fbtrace_id:
        typeof parsed.fbtrace_id === 'string' ? parsed.fbtrace_id : undefined,
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    res.status(isTimeout ? 504 : 502).json({
      ok: false,
      event_id: eventId,
      error: isTimeout
        ? 'Meta Conversions API timed out.'
        : 'Unable to reach Meta Conversions API.',
    });
  } finally {
    clearTimeout(timeout);
  }
}
