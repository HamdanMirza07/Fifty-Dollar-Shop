import type {
  AdminAuthStatus,
  AdminDiagnostics,
  AdminOrder,
  AdminOrderStatus,
  ProductPlacement,
  StorefrontConfigResponse,
  StorefrontSettings,
} from '../types/admin';
import type {
  WcCategory,
  WcProduct,
  WcVariationDetail,
} from '../types/woocommerce';

// Held strictly in JS module memory (never written to localStorage or sessionStorage)
let inMemoryAdminToken = '';

export function setAdminBearerToken(token: string) {
  inMemoryAdminToken = token;
}

export function getAdminBearerToken(): string {
  return inMemoryAdminToken;
}

export function clearAdminBearerToken() {
  inMemoryAdminToken = '';
}

async function adminFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryAdminToken) {
    headers.set('Authorization', `Bearer ${inMemoryAdminToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Unexpected response from server (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const obj =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    const msg =
      (obj && typeof obj.message === 'string' && obj.message) ||
      `Request failed (${response.status})`;
    const error = new Error(msg) as Error & { status?: number; code?: string };
    error.status = response.status;
    if (obj && typeof obj.code === 'string') error.code = obj.code;
    throw error;
  }

  return data as T;
}

export async function fetchStorefrontConfig(): Promise<StorefrontConfigResponse> {
  const res = await fetch('/api/storefront-config', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Unable to load storefront configuration.');
  }
  return (await res.json()) as StorefrontConfigResponse;
}

export async function fetchAdminAuthStatus(): Promise<AdminAuthStatus> {
  return adminFetch<AdminAuthStatus>('/api/admin/auth/status');
}

export async function setupAdminPassword(password: string): Promise<{
  authenticated: boolean;
  token: string;
  expiresAt: string;
  mode: 'claimed';
}> {
  const res = await adminFetch<{
    authenticated: boolean;
    token: string;
    expiresAt: string;
    mode: 'claimed';
  }>('/api/admin/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (res.token) setAdminBearerToken(res.token);
  return res;
}

export async function loginAdmin(password: string): Promise<{
  authenticated: boolean;
  token: string;
  expiresAt: string;
  mode: 'env' | 'claimed';
}> {
  const res = await adminFetch<{
    authenticated: boolean;
    token: string;
    expiresAt: string;
    mode: 'env' | 'claimed';
  }>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (res.token) setAdminBearerToken(res.token);
  return res;
}

export async function logoutAdmin(): Promise<void> {
  try {
    await adminFetch('/api/admin/auth/logout', { method: 'POST' });
  } finally {
    clearAdminBearerToken();
  }
}

export async function fetchAdminCatalog(): Promise<{
  syncedAt: string;
  latencyMs: number;
  categories: WcCategory[];
  products: WcProduct[];
  placements: Record<number, ProductPlacement>;
}> {
  return adminFetch('/api/admin/catalog');
}

export async function fetchAdminProductVariations(productId: number): Promise<{
  product: WcProduct;
  variations: WcVariationDetail[];
  fetchedAt: string;
}> {
  return adminFetch(`/api/admin/products/${productId}/variations`);
}

export async function updateProductPlacement(
  productId: number,
  patch: { featured?: boolean; hidden?: boolean }
): Promise<{
  placement: ProductPlacement;
  placements: Record<number, ProductPlacement>;
}> {
  return adminFetch(`/api/admin/placements/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function bulkUpdateProductPlacements(
  productIds: number[],
  patch: { featured?: boolean; hidden?: boolean }
): Promise<{
  updatedCount: number;
  placements: Record<number, ProductPlacement>;
}> {
  return adminFetch('/api/admin/placements/bulk', {
    method: 'POST',
    body: JSON.stringify({ productIds, ...patch }),
  });
}

export async function fetchAdminOrders(): Promise<{
  orders: AdminOrder[];
  wcOrdersAvailable: boolean;
  fetchedAt: string;
}> {
  return adminFetch('/api/admin/orders');
}

export async function updateAdminOrderStatus(
  orderId: string,
  status: AdminOrderStatus
): Promise<{ ok: boolean; orderId: string; status: AdminOrderStatus }> {
  return adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchAdminSettings(): Promise<{
  settings: StorefrontSettings;
}> {
  return adminFetch('/api/admin/settings');
}

export async function saveAdminSettings(
  patch: Partial<
    Pick<
      StorefrontSettings,
      'supportEmail' | 'announcementText' | 'instagramUrl' | 'facebookUrl'
    >
  >
): Promise<{ settings: StorefrontSettings }> {
  return adminFetch('/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function fetchAdminDiagnostics(): Promise<AdminDiagnostics> {
  return adminFetch('/api/admin/diagnostics');
}
