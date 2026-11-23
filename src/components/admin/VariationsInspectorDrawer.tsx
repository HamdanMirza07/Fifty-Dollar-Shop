import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ExternalLink,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  X,
} from 'lucide-react';
import { fetchAdminProductVariations } from '../../api/admin';
import type { WcProduct, WcVariationDetail } from '../../types/woocommerce';
import { decodeHtmlEntities, formatWcDecimalPrice } from '../../utils/format';

interface VariationsInspectorDrawerProps {
  product: WcProduct | null;
  onClose: () => void;
}

function stockBadgeStyle(status: string): {
  label: string;
  classes: string;
} {
  if (status === 'instock') {
    return {
      label: 'In Stock',
      classes: 'bg-[#16A34A]/10 text-[#15803D] border-[#16A34A]/25',
    };
  }
  if (status === 'onbackorder') {
    return {
      label: 'On Backorder',
      classes: 'bg-[#D97706]/10 text-[#B45309] border-[#D97706]/25',
    };
  }
  return {
    label: 'Out of Stock',
    classes: 'bg-[#DC2626]/10 text-[#B91C1C] border-[#DC2626]/25',
  };
}

export const VariationsInspectorDrawer: React.FC<
  VariationsInspectorDrawerProps
> = ({ product, onClose }) => {
  const [variations, setVariations] = useState<WcVariationDetail[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVariations = async (target: WcProduct) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminProductVariations(target.id);
      setVariations(res.variations || []);
      setFetchedAt(res.fetchedAt);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch live WooCommerce variations.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!product) {
      setVariations([]);
      setError(null);
      setFetchedAt(null);
      return;
    }
    if (product.variation_details && product.variation_details.length > 0) {
      setVariations(product.variation_details);
    } else {
      setVariations([]);
    }
    void loadVariations(product);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  const liveUrl = product
    ? `https://www.fiftydollarshop.com/product/${encodeURIComponent(product.slug)}/`
    : '#';

  return (
    <AnimatePresence>
      {product && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="WooCommerce Variations Inspector"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B0F19]/45 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-2xl bg-white h-full border-l border-[#E2E5EC] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#E2E5EC] flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] overflow-hidden flex items-center justify-center shrink-0">
                  {product.images?.[0]?.src ? (
                    <img
                      src={product.images[0].src}
                      alt={decodeHtmlEntities(product.name)}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <Package className="w-5 h-5 text-[#5A6275]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-mono text-[#5A6275] tabular-nums">
                    WooCommerce #{product.id} ·{' '}
                    {product.sku ? `SKU ${product.sku}` : 'No parent SKU'}
                  </p>
                  <h2 className="font-heading font-bold text-[17px] text-[#0B0F19] leading-snug line-clamp-2">
                    {decodeHtmlEntities(product.name)}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close variations inspector"
                className="w-9 h-9 rounded-lg border border-[#E2E5EC] hover:bg-[#F4F5F8] flex items-center justify-center text-[#0B0F19] shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-toolbar */}
            <div className="px-6 py-3 bg-[#F4F5F8] border-b border-[#E2E5EC] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12.5px] text-[#5A6275] font-mono tabular-nums">
                <Layers className="w-3.5 h-3.5 text-[#122B5C]" aria-hidden="true" />
                <span>
                  {variations.length}{' '}
                  {variations.length === 1 ? 'variation' : 'variations'}
                </span>
                {fetchedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Fetched {new Date(fetchedAt).toLocaleTimeString()}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadVariations(product)}
                  disabled={loading}
                  className="h-8 px-3 rounded-lg bg-white border border-[#E2E5EC] hover:border-[#0B0F19] text-[12.5px] font-semibold text-[#0B0F19] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>Re-Fetch Live</span>
                </button>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-3 rounded-lg bg-[#0B0F19] hover:bg-[#E54826] text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>View Live</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading && variations.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-[#5A6275]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0B0F19]" />
                  <p className="text-[13.5px]">
                    Loading live WooCommerce variations...
                  </p>
                </div>
              ) : error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-start gap-3 text-[13.5px] text-red-700">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <p className="font-semibold mb-1">
                      Unable to load variations
                    </p>
                    <p>{error}</p>
                  </div>
                </div>
              ) : variations.length === 0 ? (
                <div className="rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] p-8 text-center">
                  <Package className="w-8 h-8 text-[#5A6275] mx-auto mb-2.5" />
                  <p className="font-heading font-semibold text-[15px] text-[#0B0F19] mb-1">
                    Simple Product — No Child Variations
                  </p>
                  <p className="text-[13px] text-[#5A6275]">
                    This WooCommerce product has no separate variations. Parent
                    price is{' '}
                    <span className="font-mono font-semibold text-[#0B0F19]">
                      {formatWcDecimalPrice(
                        product.sale_price ||
                          product.price ||
                          product.regular_price ||
                          '50'
                      )}
                    </span>
                    .
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {variations.map((v) => {
                    const stock = stockBadgeStyle(v.stock_status);
                    const regularPrice = v.regular_price
                      ? formatWcDecimalPrice(v.regular_price)
                      : '—';
                    const salePrice = v.sale_price
                      ? formatWcDecimalPrice(v.sale_price)
                      : null;
                    const activePrice = formatWcDecimalPrice(
                      v.sale_price || v.price || v.regular_price || product.price || '50'
                    );
                    const imgSrc =
                      v.image?.src || product.images?.[0]?.src || '';

                    return (
                      <div
                        key={v.id}
                        className="rounded-xl border border-[#E2E5EC] bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#0B0F19]/25 transition-colors"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="w-14 h-14 rounded-lg bg-[#F4F5F8] border border-[#E2E5EC] overflow-hidden flex items-center justify-center shrink-0">
                            {imgSrc ? (
                              <img
                                src={imgSrc}
                                alt={`Variation #${v.id}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-[#5A6275]" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[12px] font-mono text-[#5A6275] tabular-nums mb-1">
                              <span className="font-semibold text-[#0B0F19]">
                                Var #{v.id}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>SKU: {v.sku || '—'}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px]">
                              {v.attributes && v.attributes.length > 0 ? (
                                v.attributes.map((attr, idx) => (
                                  <span
                                    key={`${v.id}-${attr.name}-${idx}`}
                                    className="text-[#0B0F19]"
                                  >
                                    <span className="text-[#5A6275]">
                                      {decodeHtmlEntities(attr.name)}:
                                    </span>{' '}
                                    <span className="font-semibold">
                                      {decodeHtmlEntities(attr.option)}
                                    </span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-[#5A6275]">
                                  Default option
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0">
                          <div className="text-right font-mono tabular-nums">
                            {salePrice ? (
                              <div className="flex items-baseline gap-2">
                                <span className="text-[12px] text-[#5A6275] line-through">
                                  {regularPrice}
                                </span>
                                <span className="text-[14.5px] font-bold text-[#0B0F19]">
                                  {salePrice}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[14.5px] font-bold text-[#0B0F19]">
                                {activePrice}
                              </span>
                            )}
                          </div>

                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11.5px] font-semibold ${stock.classes}`}
                          >
                            {stock.label}
                            {typeof v.stock_quantity === 'number'
                              ? ` (${v.stock_quantity})`
                              : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
