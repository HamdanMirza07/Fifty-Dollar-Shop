import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  GitCompareArrows,
  Package,
  ShoppingBag,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type { WcProduct } from '../types/woocommerce';
import {
  decodeHtmlEntities,
  findColorAttribute,
  findWearableSizeAttribute,
  formatWcDecimalPrice,
  getRegularComparePrice,
  stripHtmlToText,
} from '../utils/format';

interface CompareFloatingBarProps {
  items: WcProduct[];
  onOpenModal: () => void;
  onRemoveItem: (id: number) => void;
  onClearAll: () => void;
}

export const CompareFloatingBar: React.FC<CompareFloatingBarProps> = ({
  items,
  onOpenModal,
  onRemoveItem,
  onClearAll,
}) => {
  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-24px)] max-w-2xl bg-[#0B0F19] text-white rounded-2xl border border-white/15 shadow-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <GitCompareArrows className="w-4 h-4 text-[#E54826] shrink-0" aria-hidden="true" />
            <span className="font-heading font-semibold text-[13px] whitespace-nowrap">
              Compare ({items.length}/4)
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="relative w-9 h-9 rounded-lg bg-white p-0.5 shrink-0 group"
                >
                  {item.images?.[0]?.src ? (
                    <img
                      src={item.images[0].src}
                      alt={decodeHtmlEntities(item.name)}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Package className="w-4 h-4 text-[#5A6275] m-auto" />
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    aria-label={`Remove ${decodeHtmlEntities(item.name)} from compare`}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#E54826] text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              type="button"
              onClick={onClearAll}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium text-white/70 hover:text-white inline-flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onClick={onOpenModal}
              className="px-4 py-2 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white font-heading font-semibold text-[12.5px] cursor-pointer transition-colors whitespace-nowrap"
            >
              Compare Side by Side
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface CompareModalProps {
  open: boolean;
  items: WcProduct[];
  addingProductId: number | null;
  onClose: () => void;
  onRemoveItem: (id: number) => void;
  onSelectProduct: (product: WcProduct) => void;
  onAddToCart: (product: WcProduct) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  open,
  items,
  addingProductId,
  onClose,
  onRemoveItem,
  onSelectProduct,
  onAddToCart,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && items.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Compare selected products"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B0F19]/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-5xl bg-white rounded-3xl border border-[#E2E5EC] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-[#E2E5EC] flex items-center justify-between gap-4 bg-[#F4F5F8]">
              <div className="flex items-center gap-2.5">
                <GitCompareArrows className="w-5 h-5 text-[#E54826]" aria-hidden="true" />
                <h2 className="font-heading font-bold text-[19px] text-[#0B0F19]">
                  Compare Live Products ({items.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close product comparison"
                className="w-9 h-9 rounded-full bg-white border border-[#E2E5EC] hover:bg-[#0B0F19] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-auto p-6">
              <div className="min-w-[640px]">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#E2E5EC]">
                      <th className="w-36 py-3 pr-4 text-[12px] font-mono uppercase tracking-wider text-[#5A6275] align-top">
                        Product
                      </th>
                      {items.map((product) => {
                        const title = decodeHtmlEntities(product.name);
                        return (
                          <th key={product.id} className="p-3 align-top min-w-[180px]">
                            <div className="relative bg-[#ECEEF2] rounded-xl aspect-square p-3 mb-2.5 flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => onRemoveItem(product.id)}
                                aria-label={`Remove ${title}`}
                                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white border border-[#E2E5EC] hover:bg-[#E54826] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              {product.images?.[0]?.src ? (
                                <img
                                  src={product.images[0].src}
                                  alt={title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain mix-blend-multiply"
                                />
                              ) : (
                                <Package className="w-8 h-8 text-[#5A6275]" />
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onSelectProduct(product);
                              }}
                              className="font-heading font-semibold text-[14px] text-[#0B0F19] hover:text-[#E54826] text-left line-clamp-2 cursor-pointer"
                            >
                              {title}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E5EC] text-[13.5px]">
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-[#5A6275]">Our Price</td>
                      {items.map((product) => {
                        const rawPrice = product.sale_price || product.price || '50';
                        const numPrice = Number(rawPrice) || 50;
                        const regularCompare = getRegularComparePrice(product);
                        return (
                          <td key={product.id} className="p-3.5">
                            <div className="flex items-baseline gap-2">
                              <span className="font-heading font-extrabold text-[18px] text-[#E54826] tabular-nums">
                                {formatWcDecimalPrice(rawPrice, false)}
                              </span>
                              <span className="text-[13px] text-[#5A6275] line-through tabular-nums">
                                ${regularCompare}
                              </span>
                            </div>
                            <p className="text-[11.5px] font-mono font-semibold text-[#16A34A] mt-0.5">
                              Save ${Math.max(Math.round(regularCompare - numPrice), 15)}
                            </p>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-[#5A6275]">Category</td>
                      {items.map((product) => (
                        <td key={product.id} className="p-3.5 text-[#0B0F19]">
                          {decodeHtmlEntities(product.categories?.[0]?.name || 'Hot Selling')}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-[#5A6275]">Availability</td>
                      {items.map((product) => {
                        const inStock =
                          product.stock_status === 'instock' && product.purchasable !== false;
                        return (
                          <td key={product.id} className="p-3.5">
                            {inStock ? (
                              <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#16A34A]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                In Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-red-600">
                                <XCircle className="w-3.5 h-3.5" />
                                Out of Stock
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-[#5A6275]">Colors</td>
                      {items.map((product) => {
                        const colorAttr = findColorAttribute(product);
                        return (
                          <td key={product.id} className="p-3.5 text-[#0B0F19]">
                            {colorAttr?.options?.length
                              ? colorAttr.options.map((o) => decodeHtmlEntities(o)).join(', ')
                              : 'Standard'}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-[#5A6275]">Sizes</td>
                      {items.map((product) => {
                        const sizeAttr = findWearableSizeAttribute(product);
                        return (
                          <td key={product.id} className="p-3.5 text-[#0B0F19]">
                            {sizeAttr?.options?.length
                              ? sizeAttr.options.map((o) => decodeHtmlEntities(o)).join(', ')
                              : '—'}
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-semibold text-[#5A6275]">Overview</td>
                      {items.map((product) => {
                        const text =
                          stripHtmlToText(product.short_description) ||
                          stripHtmlToText(product.description);
                        return (
                          <td key={product.id} className="p-3.5 text-[12.5px] text-[#5A6275] leading-relaxed">
                            <p className="line-clamp-3">{text || 'USA-curated flat-price item.'}</p>
                          </td>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="py-4 pr-4" />
                      {items.map((product) => {
                        const inStock =
                          product.stock_status === 'instock' && product.purchasable !== false;
                        return (
                          <td key={product.id} className="p-3.5">
                            <button
                              type="button"
                              disabled={!inStock || addingProductId === product.id}
                              onClick={() => onAddToCart(product)}
                              className="w-full py-2.5 px-4 rounded-full bg-[#0B0F19] hover:bg-[#E54826] disabled:bg-[#E2E5EC] text-white font-heading font-semibold text-[13px] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Add to Cart</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
