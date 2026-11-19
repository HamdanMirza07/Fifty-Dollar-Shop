import type { WcProduct } from '../types/woocommerce';

const WISHLIST_STORAGE_KEY = 'fds_wishlist_v1';

export function loadWishlistFromStorage(): WcProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WcProduct =>
        Boolean(item) && typeof item === 'object' && typeof item.id === 'number'
    );
  } catch {
    return [];
  }
}

export function saveWishlistToStorage(items: WcProduct[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota or restricted context errors
  }
}
