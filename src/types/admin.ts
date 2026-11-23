export type AdminSection =
  | 'overview'
  | 'products'
  | 'categories'
  | 'orders'
  | 'settings';

export type AdminOrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface ProductPlacement {
  productId: number;
  featured: boolean;
  hidden: boolean;
  updatedAt: string;
}

export interface StorefrontSettings {
  supportEmail: string;
  announcementText: string;
  instagramUrl: string;
  facebookUrl: string;
  updatedAt: string;
}

export interface StorefrontConfigResponse {
  settings: StorefrontSettings;
  placements: Record<number, ProductPlacement>;
}

export interface AdminOrderLineItem {
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

export interface AdminOrder {
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
  items: AdminOrderLineItem[];
}

export interface AdminAuthStatus {
  authenticated: boolean;
  mode: 'env' | 'claimed' | 'setup';
  needsSetup: boolean;
  expiresAt?: string;
}

export interface AdminDiagnostics {
  checkedAt: string;
  storefrontBaseUrl: string;
  woocommerce: {
    connected: boolean;
    mode: 'v3+store-fallback' | 'store-public';
    storeOrigin: string;
    latencyMs: number;
    categoryCount: number;
    productCount: number;
    error: string | null;
  };
  paymentGateway: {
    stripeConfigured: boolean;
    stripeMode: 'live' | 'test' | 'not_configured';
    woocommerceCheckoutProxyActive: boolean;
  };
  metaCommerce: {
    storefrontBaseUrl: string;
    catalogIdConfigured: boolean;
    accessTokenConfigured: boolean;
    pixelIdConfigured: boolean;
    status: 'ready_to_connect' | 'configured';
  };
}

export interface MetaSyncSummary {
  synced: number;
  pending: number;
  errors: number;
  statusLabel: string;
}
