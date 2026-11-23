import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface ProductPlacementRecord {
  productId: number;
  featured: boolean;
  hidden: boolean;
  updatedAt: string;
}

export interface StorefrontSettingsRecord {
  supportEmail: string;
  announcementText: string;
  instagramUrl: string;
  facebookUrl: string;
  updatedAt: string;
}

export type AdminOrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface StoredOrderLineItem {
  productId: number;
  variationId?: number;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  total: string;
  attributes: Array<{ name: string; value: string }>;
  image?: string;
}

export interface StoredOrderRecord {
  id: string;
  orderNumber: string;
  source: 'woocommerce' | 'storefront';
  createdAt: string;
  status: AdminOrderStatus;
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  paymentMethod: string;
  paymentMethodTitle: string;
  currency: string;
  total: string;
  customerNote?: string;
  items: StoredOrderLineItem[];
}

interface AdminPersistenceData {
  sessionSecret?: string;
  claimedPasswordHash?: string;
  claimedPasswordSalt?: string;
  claimedAt?: string;
  placements: Record<string, ProductPlacementRecord>;
  settings: StorefrontSettingsRecord;
  orders: StoredOrderRecord[];
  orderStatusOverrides: Record<string, AdminOrderStatus>;
}

const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/fifty_dollar_shop/';
const DEFAULT_FACEBOOK_URL = 'https://www.facebook.com/fiftydollarshop';

const DEFAULT_SETTINGS: StorefrontSettingsRecord = {
  supportEmail: 'support@fiftydollarshop.com',
  announcementText:
    'All-America Flat $50 Drop · Free Tracked USA Shipping · 30-Day Guarantee',
  instagramUrl: DEFAULT_INSTAGRAM_URL,
  facebookUrl: DEFAULT_FACEBOOK_URL,
  updatedAt: new Date().toISOString(),
};

const STORE_FILE = path.join(os.tmpdir(), 'fds-admin-state-v1.json');

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
export const ADMIN_COOKIE_NAME = 'fds_admin_session';

let memoryState: AdminPersistenceData | null = null;
let cachedSessionSigningKey: string | null = null;

function deriveDeterministicSigningKey(label: string, parts: string[]): string {
  return crypto
    .createHash('sha256')
    .update(`${label}:${parts.join('|')}`, 'utf8')
    .digest('hex');
}

/**
 * Resolves a consistent 256-bit HMAC signing key across all concurrent
 * serverless instances (e.g., Vercel Functions) and local Node restarts.
 * Never hardcoded and never exposed to the browser.
 */
function getSessionSigningSecret(): string {
  const explicitSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();
  if (explicitSecret.length > 0) {
    return deriveDeterministicSigningKey('fds-admin-session-explicit-v1', [
      explicitSecret,
    ]);
  }

  // Primary server-side secrets & Vercel project identity (shared across all instances)
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

  // Fallback for Vercel deployments without custom env vars configured yet
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

  // Pure local Node dev with zero env vars: persist once in local temp state
  if (cachedSessionSigningKey) return cachedSessionSigningKey;
  const state = loadState();
  if (state.sessionSecret && state.sessionSecret.length >= 32) {
    cachedSessionSigningKey = state.sessionSecret;
    return cachedSessionSigningKey;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  state.sessionSecret = generated;
  saveState(state);
  cachedSessionSigningKey = generated;
  return generated;
}

function createDefaultState(): AdminPersistenceData {
  return {
    placements: {},
    settings: { ...DEFAULT_SETTINGS },
    orders: [],
    orderStatusOverrides: {},
  };
}

function loadState(): AdminPersistenceData {
  if (memoryState) return memoryState;
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AdminPersistenceData>;
      memoryState = {
        sessionSecret:
          typeof parsed.sessionSecret === 'string'
            ? parsed.sessionSecret
            : undefined,
        claimedPasswordHash:
          typeof parsed.claimedPasswordHash === 'string'
            ? parsed.claimedPasswordHash
            : undefined,
        claimedPasswordSalt:
          typeof parsed.claimedPasswordSalt === 'string'
            ? parsed.claimedPasswordSalt
            : undefined,
        claimedAt:
          typeof parsed.claimedAt === 'string' ? parsed.claimedAt : undefined,
        placements:
          parsed.placements && typeof parsed.placements === 'object'
            ? parsed.placements
            : {},
        settings: {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings && typeof parsed.settings === 'object'
            ? parsed.settings
            : {}),
          instagramUrl:
            parsed.settings?.instagramUrl &&
            parsed.settings.instagramUrl !== 'https://www.instagram.com/'
              ? parsed.settings.instagramUrl
              : DEFAULT_INSTAGRAM_URL,
          facebookUrl:
            parsed.settings?.facebookUrl &&
            parsed.settings.facebookUrl !== 'https://www.facebook.com/'
              ? parsed.settings.facebookUrl
              : DEFAULT_FACEBOOK_URL,
        },
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        orderStatusOverrides:
          parsed.orderStatusOverrides &&
          typeof parsed.orderStatusOverrides === 'object'
            ? parsed.orderStatusOverrides
            : {},
      };
      return memoryState;
    }
  } catch {
    // Fall back to clean state if tmp file is unreadable
  }
  memoryState = createDefaultState();
  return memoryState;
}

function saveState(state: AdminPersistenceData): void {
  memoryState = state;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    // Serverless read-only fallback stays cleanly in memory
  }
}

function sha256Buffer(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

export function getEnvAdminSecret(): string {
  return (process.env.ADMIN_SECRET_TOKEN || '').trim();
}

export function getAdminAuthMode(): {
  mode: 'env' | 'claimed' | 'setup';
  needsSetup: boolean;
} {
  if (getEnvAdminSecret().length > 0) {
    return { mode: 'env', needsSetup: false };
  }
  const state = loadState();
  if (state.claimedPasswordHash && state.claimedPasswordSalt) {
    return { mode: 'claimed', needsSetup: false };
  }
  return { mode: 'setup', needsSetup: true };
}

export function claimFirstRunAdminPassword(password: string): {
  ok: boolean;
  error?: string;
} {
  if (getEnvAdminSecret().length > 0) {
    return {
      ok: false,
      error: 'Admin access is already configured via server environment.',
    };
  }
  const state = loadState();
  if (state.claimedPasswordHash && state.claimedPasswordSalt) {
    return {
      ok: false,
      error: 'Admin password has already been claimed. Please sign in.',
    };
  }
  const trimmed = password.trim();
  if (trimmed.length < 8 || trimmed.length > 128) {
    return {
      ok: false,
      error: 'Password must be between 8 and 128 characters.',
    };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(trimmed, salt, 64).toString('hex');
  state.claimedPasswordHash = hash;
  state.claimedPasswordSalt = salt;
  state.claimedAt = new Date().toISOString();
  saveState(state);
  return { ok: true };
}

export function verifyAdminCredential(candidate: string): boolean {
  const input = candidate.trim();
  if (!input) return false;

  const envSecret = getEnvAdminSecret();
  if (envSecret.length > 0) {
    return crypto.timingSafeEqual(sha256Buffer(input), sha256Buffer(envSecret));
  }

  const state = loadState();
  if (!state.claimedPasswordHash || !state.claimedPasswordSalt) {
    return false;
  }
  const derived = crypto.scryptSync(input, state.claimedPasswordSalt, 64);
  const stored = Buffer.from(state.claimedPasswordHash, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

interface SessionPayload {
  sub: 'admin';
  iat: number;
  exp: number;
  jti: string;
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac('sha256', getSessionSigningSecret())
    .update(payloadB64)
    .digest('base64url');
}

export function createAdminSessionToken(): {
  token: string;
  expiresAt: string;
} {
  const now = Date.now();
  const exp = now + SESSION_TTL_MS;
  const payload: SessionPayload = {
    sub: 'admin',
    iat: now,
    exp,
    jti: crypto.randomBytes(12).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  const sig = signPayload(payloadB64);
  return {
    token: `${payloadB64}.${sig}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function verifyAdminSessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = signPayload(payloadB64);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (
      parsed.sub !== 'admin' ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookieHeader(
  cookieHeader: string | undefined
): Record<string, string> {
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

export function getPlacements(): Record<number, ProductPlacementRecord> {
  const state = loadState();
  const out: Record<number, ProductPlacementRecord> = {};
  for (const [k, v] of Object.entries(state.placements)) {
    const id = Number(k);
    if (Number.isInteger(id) && id > 0) {
      out[id] = v;
    }
  }
  return out;
}

export function upsertProductPlacement(
  productId: number,
  patch: { featured?: boolean; hidden?: boolean }
): ProductPlacementRecord {
  const state = loadState();
  const key = String(productId);
  const existing = state.placements[key] || {
    productId,
    featured: false,
    hidden: false,
    updatedAt: new Date().toISOString(),
  };
  const updated: ProductPlacementRecord = {
    productId,
    featured:
      typeof patch.featured === 'boolean' ? patch.featured : existing.featured,
    hidden: typeof patch.hidden === 'boolean' ? patch.hidden : existing.hidden,
    updatedAt: new Date().toISOString(),
  };
  state.placements[key] = updated;
  saveState(state);
  return updated;
}

export function bulkUpsertPlacements(
  productIds: number[],
  patch: { featured?: boolean; hidden?: boolean }
): Record<number, ProductPlacementRecord> {
  const state = loadState();
  const now = new Date().toISOString();
  for (const id of productIds) {
    if (!Number.isInteger(id) || id <= 0) continue;
    const key = String(id);
    const existing = state.placements[key] || {
      productId: id,
      featured: false,
      hidden: false,
      updatedAt: now,
    };
    state.placements[key] = {
      productId: id,
      featured:
        typeof patch.featured === 'boolean'
          ? patch.featured
          : existing.featured,
      hidden:
        typeof patch.hidden === 'boolean' ? patch.hidden : existing.hidden,
      updatedAt: now,
    };
  }
  saveState(state);
  return getPlacements();
}

export function getStorefrontSettings(): StorefrontSettingsRecord {
  return { ...loadState().settings };
}

export function updateStorefrontSettings(
  patch: Partial<
    Pick<
      StorefrontSettingsRecord,
      'supportEmail' | 'announcementText' | 'instagramUrl' | 'facebookUrl'
    >
  >
): StorefrontSettingsRecord {
  const state = loadState();
  state.settings = {
    ...state.settings,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveState(state);
  return { ...state.settings };
}

export function recordStorefrontOrder(order: StoredOrderRecord): void {
  const state = loadState();
  const idx = state.orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) {
    state.orders[idx] = order;
  } else {
    state.orders.unshift(order);
    if (state.orders.length > 200) {
      state.orders = state.orders.slice(0, 200);
    }
  }
  saveState(state);
}

export function getStoredOrders(): StoredOrderRecord[] {
  const state = loadState();
  return state.orders.map((order) => ({
    ...order,
    status: state.orderStatusOverrides[order.id] || order.status,
  }));
}

export function getOrderStatusOverrides(): Record<string, AdminOrderStatus> {
  return { ...loadState().orderStatusOverrides };
}

export function setOrderStatusOverride(
  orderId: string,
  status: AdminOrderStatus
): void {
  const state = loadState();
  state.orderStatusOverrides[orderId] = status;
  const localOrder = state.orders.find((o) => o.id === orderId);
  if (localOrder) {
    localOrder.status = status;
  }
  saveState(state);
}
