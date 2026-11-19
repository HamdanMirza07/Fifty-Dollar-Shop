import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import type { WcCart } from '../types/woocommerce';
import { decodeHtmlEntities, formatMinorPrice } from '../utils/format';

interface CartDrawerProps {
  open: boolean;
  cart: WcCart | null;
  updatingKey: string | null;
  onClose: () => void;
  onUpdateQuantity: (key: string, quantity: number) => void;
  onRemoveItem: (key: string) => void;
  onViewCart: () => void;
  onProceedToCheckout: () => void;
  onShopNow: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  cart,
  updatingKey,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onViewCart,
  onProceedToCheckout,
  onShopNow,
}) => {
  const items = cart?.items ?? [];
  const minorUnit = cart?.totals?.currency_minor_unit ?? 2;
  const subtotal = formatMinorPrice(cart?.totals?.total_items ?? '0', minorUnit, true);
  const total = formatMinorPrice(cart?.totals?.total_price ?? '0', minorUnit, true);
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const estimatedRetailSavings = totalQty * 45;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Shopping cart"
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
            {/* Drawer Header */}
            <div className="px-5 py-4 bg-[#0B0F19] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-[#E54826]" aria-hidden="true" />
                <h2 className="font-heading font-bold text-[18px]">
                  Your Cart ({cart?.items_count ?? 0})
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart drawer"
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Free Shipping & Retail Savings Notice */}
            <div className="px-5 py-2.5 bg-[#F4F5F8] border-b border-[#E2E5EC] flex items-center justify-between gap-2 text-[12.5px] font-medium text-[#0B0F19]">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                <span>Free Tracked USA Shipping</span>
              </div>
              {estimatedRetailSavings > 0 && (
                <span className="font-mono text-[#16A34A] font-semibold tabular-nums">
                  Est. Saved ~${estimatedRetailSavings}
                </span>
              )}
            </div>

            {/* Hairline-Separated Cart Items */}
            <div className="flex-1 overflow-y-auto px-5 divide-y divide-[#E2E5EC] bg-white">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-[#ECEEF2] flex items-center justify-center mb-4">
                    <ShoppingBag className="w-7 h-7 text-[#0B0F19]/45" aria-hidden="true" />
                  </div>
                  <p className="font-heading font-bold text-[19px] text-[#0B0F19] mb-1">
                    Your cart is empty
                  </p>
                  <p className="type-body text-[#5A6275] mb-6 max-w-xs">
                    Explore our trending USA products — every item in Hot Selling is $50 flat with free shipping.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onShopNow();
                    }}
                    className="type-button px-7 py-3 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white cursor-pointer transition-colors"
                  >
                    Shop $50 Deals
                  </button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {items.map((item) => {
                    const isBusy = updatingKey === item.key;
                    const imgSrc =
                      item.images?.[0]?.thumbnail || item.images?.[0]?.src || '';
                    const lineTotal = formatMinorPrice(
                      item.totals?.line_total ?? item.prices?.price ?? '5000',
                      item.totals?.currency_minor_unit ?? 2,
                      true
                    );

                    return (
                      <motion.div
                        key={item.key}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 28 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="py-4 flex gap-3.5"
                      >
                        <div className="w-20 h-20 rounded-xl bg-[#ECEEF2] overflow-hidden shrink-0 flex items-center justify-center">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={decodeHtmlEntities(item.name)}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain p-1.5 mix-blend-multiply"
                            />
                          ) : (
                            <ShoppingBag
                              className="w-6 h-6 text-[#5A6275]/40"
                              aria-hidden="true"
                            />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-heading font-semibold text-[14px] text-[#0B0F19] leading-snug line-clamp-2">
                                {decodeHtmlEntities(item.name)}
                              </p>
                              {item.variation && item.variation.length > 0 && (
                                <p className="text-[12px] text-[#5A6275] mt-0.5">
                                  {item.variation
                                    .map(
                                      (v) =>
                                        `${decodeHtmlEntities(v.attribute)}: ${decodeHtmlEntities(v.value)}`
                                    )
                                    .join(' · ')}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onRemoveItem(item.key)}
                              aria-label={`Remove ${decodeHtmlEntities(item.name)}`}
                              className="text-[#5A6275] hover:text-red-600 p-1 cursor-pointer disabled:opacity-40 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-3">
                            <div className="inline-flex items-center bg-[#F4F5F8] border border-[#E2E5EC] rounded-full overflow-hidden">
                              <button
                                type="button"
                                disabled={isBusy || item.quantity <= 1}
                                onClick={() =>
                                  onUpdateQuantity(item.key, item.quantity - 1)
                                }
                                aria-label="Decrease quantity"
                                className="w-8 h-8 flex items-center justify-center text-[#0B0F19] hover:bg-[#ECEEF2] disabled:opacity-40 cursor-pointer transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-[13px] font-semibold text-[#0B0F19] tabular-nums">
                                {isBusy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                                ) : (
                                  item.quantity
                                )}
                              </span>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  onUpdateQuantity(item.key, item.quantity + 1)
                                }
                                aria-label="Increase quantity"
                                className="w-8 h-8 flex items-center justify-center text-[#0B0F19] hover:bg-[#ECEEF2] disabled:opacity-40 cursor-pointer transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <span className="font-heading font-extrabold text-[16px] text-[#E54826] tabular-nums">
                              {lineTotal}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Drawer Footer */}
            {items.length > 0 && (
              <div className="border-t border-[#E2E5EC] p-5 bg-[#F4F5F8] space-y-3">
                <div className="space-y-1.5 text-[14px]">
                  <div className="flex justify-between text-[#5A6275]">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-medium text-[#0B0F19]">{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-[#5A6275]">
                    <span>USA Shipping</span>
                    <span className="font-semibold text-[#16A34A]">FREE</span>
                  </div>
                  <div className="flex justify-between font-heading font-bold text-[17px] text-[#0B0F19] pt-2 border-t border-[#E2E5EC]">
                    <span>Total</span>
                    <span className="text-[#E54826] tabular-nums">{total}</span>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={onProceedToCheckout}
                  className="type-button w-full py-3.5 px-6 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[0_10px_24px_-8px_rgba(229,72,38,0.45)]"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </motion.button>

                <button
                  type="button"
                  onClick={onViewCart}
                  className="w-full py-2.5 px-4 rounded-full border border-[#E2E5EC] bg-white text-[#0B0F19] hover:bg-[#ECEEF2] font-heading font-semibold text-[14px] transition-colors cursor-pointer"
                >
                  View Full Cart Page
                </button>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
