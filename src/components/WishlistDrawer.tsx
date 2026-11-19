import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Heart,
  Loader2,
  Package,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import type { WcProduct } from '../types/woocommerce';
import {
  decodeHtmlEntities,
  formatWcDecimalPrice,
  getRegularComparePrice,
} from '../utils/format';

interface WishlistDrawerProps {
  open: boolean;
  items: WcProduct[];
  addingProductId: number | null;
  onClose: () => void;
  onRemoveItem: (productId: number) => void;
  onClearAll: () => void;
  onMoveToCart: (product: WcProduct) => void;
  onSelectProduct: (product: WcProduct) => void;
  onViewWishlistPage: () => void;
  onShopNow: () => void;
}

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  open,
  items,
  addingProductId,
  onClose,
  onRemoveItem,
  onClearAll,
  onMoveToCart,
  onSelectProduct,
  onViewWishlistPage,
  onShopNow,
}) => {
  const totalSavings = items.reduce((sum, item) => {
    const activePrice = Number(item.sale_price || item.price || 50) || 50;
    const compare = getRegularComparePrice(item);
    return sum + Math.max(Math.round(compare - activePrice), 15);
  }, 0);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Saved wishlist"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#0B0F19]/55 backdrop-blur-[3px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Spring Slide-Over Drawer Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="relative z-10 w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-l border-[#E2E5EC]"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-[#0B0F19] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Heart
                  className="w-5 h-5 text-[#E54826] fill-[#E54826]"
                  aria-hidden="true"
                />
                <h2 className="font-heading font-bold text-[18px]">
                  Your Wishlist ({items.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close wishlist drawer"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Savings Summary Notice */}
            <div className="px-5 py-2.5 bg-[#F4F5F8] border-b border-[#E2E5EC] flex items-center justify-between gap-2 text-[12.5px] font-medium text-[#0B0F19]">
              <span>Saved locally for your next visit</span>
              {totalSavings > 0 && (
                <span className="font-mono text-[#16A34A] font-semibold tabular-nums">
                  Save ~${totalSavings} vs US Retail
                </span>
              )}
            </div>

            {/* Saved Items */}
            <div className="flex-1 overflow-y-auto px-5 divide-y divide-[#E2E5EC] bg-white">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#ECEEF2] flex items-center justify-center mb-4">
                    <Heart className="w-7 h-7 text-[#0B0F19]/40" aria-hidden="true" />
                  </div>
                  <p className="font-heading font-bold text-[19px] text-[#0B0F19] mb-1">
                    Your wishlist is empty
                  </p>
                  <p className="type-body text-[#5A6275] mb-6 max-w-xs">
                    Tap the heart icon on any product to save your favorites for later.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onShopNow();
                    }}
                    className="type-button px-7 py-3 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white cursor-pointer transition-colors"
                  >
                    Explore $50 Deals
                  </button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {items.map((item) => {
                    const title = decodeHtmlEntities(item.name);
                    const imgSrc = item.images?.[0]?.src || '';
                    const rawPrice = item.sale_price || item.price || '50';
                    const comparePrice = getRegularComparePrice(item);
                    const inStock =
                      item.stock_status === 'instock' && item.purchasable !== false;
                    const isAdding = addingProductId === item.id;

                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 28 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="py-4 flex gap-3.5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectProduct(item);
                          }}
                          className="w-20 h-20 rounded-xl bg-[#ECEEF2] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer"
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain p-1.5 mix-blend-multiply"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-[#5A6275]/45" aria-hidden="true" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onSelectProduct(item);
                              }}
                              className="text-left font-heading font-semibold text-[14px] text-[#0B0F19] hover:text-[#E54826] leading-snug line-clamp-2 cursor-pointer transition-colors"
                            >
                              {title}
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.id)}
                              aria-label={`Remove ${title} from wishlist`}
                              className="text-[#5A6275] hover:text-red-600 p-1 cursor-pointer transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-2">
                            <div className="flex items-baseline gap-2">
                              <span className="font-heading font-extrabold text-[16px] text-[#E54826] tabular-nums">
                                {formatWcDecimalPrice(rawPrice, false)}
                              </span>
                              <span className="text-[12px] text-[#5A6275] line-through tabular-nums">
                                ${comparePrice}
                              </span>
                            </div>

                            {inStock && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
                                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                In Stock
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={!inStock || isAdding}
                            onClick={() => onMoveToCart(item)}
                            className="mt-2.5 w-full py-2 px-3 rounded-full bg-[#0B0F19] hover:bg-[#E54826] disabled:bg-[#E2E5EC] disabled:text-[#5A6275] text-white font-heading font-semibold text-[12.5px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            {isAdding ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                <span>Adding...</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{inStock ? 'Add to Cart' : 'Out of Stock'}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-[#E2E5EC] p-5 bg-[#F4F5F8] space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onViewWishlistPage();
                  }}
                  className="type-button w-full py-3.5 px-6 rounded-full bg-[#0B0F19] hover:bg-[#E54826] text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Open Full Wishlist Page</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="w-full py-2 px-4 rounded-full border border-[#E2E5EC] bg-white text-[#5A6275] hover:text-red-600 hover:border-red-200 font-heading font-semibold text-[13px] transition-colors cursor-pointer"
                >
                  Clear Saved Items
                </button>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
