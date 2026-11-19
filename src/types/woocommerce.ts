export interface WcImage {
  id: number;
  src: string;
  thumbnail?: string;
  name?: string;
  alt?: string;
}

export interface WcCategoryRef {
  id: number;
  name: string;
  slug: string;
}

export interface WcCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
  image: WcImage | null;
}

export interface WcAttribute {
  id: number;
  name: string;
  slug?: string;
  position?: number;
  visible?: boolean;
  variation: boolean;
  options: string[];
}

export interface WcVariationDetail {
  id: number;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale?: boolean;
  stock_status: 'instock' | 'outofstock' | 'onbackorder' | string;
  purchasable?: boolean;
  attributes: Array<{
    id: number;
    name: string;
    slug?: string;
    option: string;
  }>;
  image?: WcImage;
}

export interface WcProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created?: string;
  type: 'simple' | 'variable' | 'grouped' | 'external' | string;
  status?: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  price_html?: string;
  on_sale: boolean;
  purchasable: boolean;
  stock_status: 'instock' | 'outofstock' | 'onbackorder' | string;
  stock_quantity: number | null;
  short_description: string;
  description: string;
  categories: WcCategoryRef[];
  images: WcImage[];
  attributes: WcAttribute[];
  variations: number[];
  variation_details?: WcVariationDetail[];
}

export interface WcCartItem {
  key: string;
  id: number;
  quantity: number;
  quantity_limits?: {
    minimum: number;
    maximum: number;
    multiple_of: number;
    editable: boolean;
  };
  name: string;
  short_description: string;
  description: string;
  sku: string;
  low_stock_remaining: number | null;
  images: WcImage[];
  variation: Array<{
    attribute: string;
    value: string;
  }>;
  prices: {
    price: string;
    regular_price: string;
    sale_price: string;
    currency_code: string;
    currency_symbol: string;
    currency_minor_unit: number;
  };
  totals: {
    line_subtotal: string;
    line_total: string;
    currency_code: string;
    currency_symbol: string;
    currency_minor_unit: number;
  };
  permalink: string;
}

export interface WcAddress {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone: string;
}

export interface WcCart {
  items: WcCartItem[];
  coupons: unknown[];
  fees: unknown[];
  totals: {
    total_items: string;
    total_items_tax: string;
    total_fees: string;
    total_fees_tax: string;
    total_discount: string;
    total_discount_tax: string;
    total_shipping: string | null;
    total_shipping_tax: string | null;
    total_price: string;
    total_tax: string;
    currency_code: string;
    currency_symbol: string;
    currency_minor_unit: number;
  };
  shipping_address: WcAddress;
  billing_address: WcAddress;
  needs_payment: boolean;
  needs_shipping: boolean;
  payment_requirements: string[];
  items_count: number;
  items_weight: number;
  errors: Array<{ code: string; message: string }>;
  payment_methods: string[];
}

export interface WcCheckoutResponse {
  order_id: number;
  status: string;
  order_key: string;
  order_number: string;
  customer_note: string;
  billing_address: WcAddress;
  shipping_address: WcAddress;
  payment_method: string;
  payment_result?: {
    payment_status: string;
    payment_details: Array<{ key: string; value: string }>;
    redirect_url?: string;
  } | null;
}

export type AppPage =
  | 'home'
  | 'shop'
  | 'categories'
  | 'category'
  | 'product'
  | 'wishlist'
  | 'cart'
  | 'checkout'
  | 'about'
  | 'contact'
  | 'shipping-policy'
  | 'return-policy'
  | 'privacy-policy';
