import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react';
import type { WcCart } from '../types/woocommerce';
import { decodeHtmlEntities, formatMinorPrice } from '../utils/format';

interface CartViewProps {
  cart: WcCart | null;
  updatingKey: string | null;
  onUpdateQuantity: (key: string, quantity: number) => void;
  onRemoveItem: (key: string) => void;
  onProceedToCheckout: () => void;
  onContinueShopping: () => void;
}

export const CartView: React.FC<CartViewProps> = ({
  cart,
  updatingKey,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
  onContinueShopping,
}) => {
  const items = cart?.items ?? [];
  const minorUnit = cart?.totals?.currency_minor_unit ?? 2;
  const subtotal = formatMinorPrice(cart?.totals?.total_items ?? '0', minorUnit, true);
  const total = formatMinorPrice(cart?.totals?.total_price ?? '0', minorUnit, true);

  return (
    <section className="bg-[#F4F5F8] py-8 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onContinueShopping}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0B0F19] hover:text-[#E54826] mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Continue Shopping $50 Deals</span>
        </button>

        <h1 className="type-h1 text-[#0B0F19] mb-8">
          Shopping Cart ({cart?.items_count ?? 0})
        </h1>

        {items.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#E2E5EC] p-10 text-center max-w-xl mx-auto shadow-[0_12px_32px_-20px_rgba(14,14,13,0.1)]">
            <div className="w-16 h-16 rounded-full bg-[#ECEEF2] flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-7 h-7 text-[#0B0F19]/45" aria-hidden="true" />
            </div>
            <h2 className="font-heading font-bold text-[20px] text-[#0B0F19] mb-2">
              Your Shopping Cart Is Empty
            </h2>
            <p className="type-body text-[#5A6275] mb-6">
              Browse our 20 trending USA products — every item is $50 flat with Free Shipping across the United States.
            </p>
            <button
              type="button"
              onClick={onContinueShopping}
              className="type-button px-7 py-3.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white cursor-pointer transition-colors"
            >
              Shop Hot Selling 50$ Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Cart Line Items */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-[#E2E5EC] divide-y divide-[#E2E5EC] px-5 sm:px-7">
              {items.map((item) => {
                const isBusy = updatingKey === item.key;
                const imgSrc = item.images?.[0]?.thumbnail || item.images?.[0]?.src || '';
                const unitPrice = formatMinorPrice(
                  item.prices?.price ?? '5000',
                  item.prices?.currency_minor_unit ?? 2,
                  true
                );
                const lineTotal = formatMinorPrice(
                  item.totals?.line_total ?? item.prices?.price ?? '5000',
                  item.totals?.currency_minor_unit ?? 2,
                  true
                );

                return (
                  <div
                    key={item.key}
                    className="py-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="w-24 h-24 rounded-xl bg-[#ECEEF2] overflow-hidden shrink-0 flex items-center justify-center">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={decodeHtmlEntities(item.name)}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-2 mix-blend-multiply"
                        />
                      ) : (
                        <ShoppingBag className="w-7 h-7 text-[#5A6275]/40" aria-hidden="true" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-semibold text-[16px] text-[#0B0F19] leading-snug">
                        {decodeHtmlEntities(item.name)}
                      </p>
                      <p className="text-[13px] text-[#5A6275] mt-1">
                        {unitPrice} each
                        {item.variation && item.variation.length > 0
                          ? ` · ${item.variation
                              .map((v) => `${decodeHtmlEntities(v.attribute)}: ${decodeHtmlEntities(v.value)}`)
                              .join(' · ')}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="inline-flex items-center bg-[#F4F5F8] border border-[#E2E5EC] rounded-full overflow-hidden">
                        <button
                          type="button"
                          disabled={isBusy || item.quantity <= 1}
                          onClick={() => onUpdateQuantity(item.key, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="w-9 h-9 flex items-center justify-center text-[#0B0F19] hover:bg-[#ECEEF2] disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-9 text-center text-[14px] font-semibold text-[#0B0F19] tabular-nums">
                          {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          ) : (
                            item.quantity
                          )}
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onUpdateQuantity(item.key, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="w-9 h-9 flex items-center justify-center text-[#0B0F19] hover:bg-[#ECEEF2] disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <span className="font-heading font-extrabold text-[18px] text-[#E54826] tabular-nums min-w-[72px] text-right">
                        {lineTotal}
                      </span>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onRemoveItem(item.key)}
                        aria-label={`Remove ${decodeHtmlEntities(item.name)}`}
                        className="text-[#5A6275] hover:text-red-600 p-2 cursor-pointer disabled:opacity-40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Column */}
            <aside className="lg:col-span-4 bg-white rounded-3xl border border-[#E2E5EC] p-6 space-y-5 shadow-[0_14px_34px_-22px_rgba(14,14,13,0.12)]">
              <h2 className="font-heading font-bold text-[19px] text-[#0B0F19]">
                Cart Summary
              </h2>

              <div className="space-y-2.5 text-[14px]">
                <div className="flex justify-between text-[#5A6275]">
                  <span>Subtotal</span>
                  <span className="font-medium text-[#0B0F19] tabular-nums">{subtotal}</span>
                </div>
                <div className="flex justify-between text-[#5A6275]">
                  <span>USA Shipping (7–15 Days)</span>
                  <span className="font-semibold text-[#16A34A]">FREE</span>
                </div>
                <div className="flex justify-between font-heading font-bold text-[20px] text-[#0B0F19] pt-3 border-t border-[#E2E5EC]">
                  <span>Total</span>
                  <span className="text-[#E54826] tabular-nums">{total}</span>
                </div>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={onProceedToCheckout}
                className="type-button w-full h-12 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[0_12px_24px_-8px_rgba(229,72,38,0.45)]"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </motion.button>

              <div className="space-y-2 text-[13px] text-[#5A6275] pt-2 border-t border-[#E2E5EC]">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                  <span>Free Tracked USA Delivery</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                  <span>30-Day Easy Returns</span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
};
