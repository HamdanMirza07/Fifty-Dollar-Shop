import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Heart,
  Loader2,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  X,
  XCircle,
} from 'lucide-react';
import type { WcProduct } from '../types/woocommerce';
import { fetchWcProductById } from '../api/woocommerce';
import {
  decodeHtmlEntities,
  findMatchingVariationDetail,
  formatWcDecimalPrice,
  getDefaultAttributes,
  getRegularComparePrice,
  stripHtmlToText,
} from '../utils/format';

interface QuickViewModalProps {
  product: WcProduct | null;
  isAdding: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: WcProduct) => void;
  onClose: () => void;
  onAddToCart: (
    product: WcProduct,
    quantity: number,
    variationId?: number,
    variationAttrs?: Array<{ attribute: string; value: string }>
  ) => Promise<void>;
  onViewFullDetails: (product: WcProduct) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  isAdding,
  isWishlisted = false,
  onToggleWishlist,
  onClose,
  onAddToCart,
  onViewFullDetails,
}) => {
  const [detailedProduct, setDetailedProduct] = useState<WcProduct | null>(product);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [addedDone, setAddedDone] = useState(false);

  useEffect(() => {
    setDetailedProduct(product);
    setActiveImgIdx(0);
    setQuantity(1);
    setAddedDone(false);
    if (product) {
      setSelectedAttrs(getDefaultAttributes(product));
      fetchWcProductById(product.id)
        .then((fresh) => {
          setDetailedProduct(fresh);
          setSelectedAttrs(getDefaultAttributes(fresh));
        })
        .catch(() => {});
    }
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  const activeProduct = detailedProduct || product;

  const matchedVariation = useMemo(() => {
    if (!activeProduct) return undefined;
    return findMatchingVariationDetail(activeProduct, selectedAttrs);
  }, [activeProduct, selectedAttrs]);

  if (!activeProduct) return null;

  const title = decodeHtmlEntities(activeProduct.name);
  const images = activeProduct.images || [];
  const mainImg = images[activeImgIdx]?.src || images[0]?.src || '';
  const activePriceRaw =
    matchedVariation?.sale_price ||
    matchedVariation?.price ||
    activeProduct.sale_price ||
    activeProduct.price ||
    '50';
  const priceDisplay = formatWcDecimalPrice(activePriceRaw, true);
  const regularCompare = getRegularComparePrice(activeProduct, matchedVariation);
  const inStock =
    (matchedVariation?.stock_status ?? activeProduct.stock_status) === 'instock' &&
    activeProduct.purchasable !== false;
  const shortText =
    stripHtmlToText(activeProduct.short_description) ||
    stripHtmlToText(activeProduct.description).slice(0, 180);

  const handleQuickAdd = async () => {
    const variationId =
      matchedVariation?.id ?? activeProduct.variations?.[0] ?? activeProduct.id;
    const attrs =
      matchedVariation?.attributes.map((a) => ({
        attribute: a.name,
        value: a.option,
      })) ??
      Object.entries(selectedAttrs).map(([attribute, value]) => ({
        attribute,
        value,
      }));
    await onAddToCart(activeProduct, quantity, variationId, attrs);
    setAddedDone(true);
    window.setTimeout(() => {
      setAddedDone(false);
      onClose();
    }, 650);
  };

  return (
    <AnimatePresence>
      {product && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Quick view for ${title}`}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B0F19]/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-3xl bg-white rounded-3xl border border-[#E2E5EC] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quick view"
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/90 border border-[#E2E5EC] hover:bg-[#ECEEF2] text-[#0B0F19] flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-12 overflow-y-auto">
              {/* Studio Gallery */}
              <div className="md:col-span-6 bg-[#ECEEF2] p-5 sm:p-6 flex flex-col justify-between">
                <div className="aspect-square flex items-center justify-center overflow-hidden">
                  {mainImg ? (
                    <img
                      src={mainImg}
                      alt={title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain p-3 mix-blend-multiply"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-[#5A6275]" aria-hidden="true" />
                  )}
                </div>

                {images.length > 1 && (
                  <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
                    {images.slice(0, 5).map((img, i) => (
                      <button
                        key={img.id || i}
                        type="button"
                        onClick={() => setActiveImgIdx(i)}
                        className={`w-12 h-12 rounded-xl bg-white border p-1 shrink-0 cursor-pointer transition-colors ${
                          i === activeImgIdx
                            ? 'border-[#E54826]'
                            : 'border-[#E2E5EC] hover:border-[#0B0F19]'
                        }`}
                      >
                        <img
                          src={img.src}
                          alt={`${title} thumbnail ${i + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Purchase Controls */}
              <div className="md:col-span-6 p-6 sm:p-7 flex flex-col justify-between gap-5">
                <div className="space-y-3.5">
                  <p className="text-[12px] font-mono text-[#5A6275] tabular-nums">
                    #{activeProduct.id} ·{' '}
                    {decodeHtmlEntities(
                      activeProduct.categories?.[0]?.name || 'Hot Selling 50$ Products'
                    )}
                  </p>

                  <h2 className="font-heading font-bold text-[22px] sm:text-[24px] leading-tight text-[#0B0F19]">
                    {title}
                  </h2>

                  <div className="flex items-baseline gap-3">
                    <span className="font-heading font-extrabold text-[26px] text-[#E54826] tabular-nums">
                      {priceDisplay}
                    </span>
                    <span className="text-[16px] text-[#5A6275]/70 line-through tabular-nums">
                      ${regularCompare}.00
                    </span>
                    <span className="text-[12px] font-mono font-medium text-[#16A34A]">
                      Save ${Math.max(regularCompare - Number(activePriceRaw || 50), 15)}
                    </span>
                  </div>

                  {inStock ? (
                    <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#16A34A]">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>In Stock · Free USA Delivery</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-red-600">
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                      <span>Out of Stock</span>
                    </div>
                  )}

                  {shortText && (
                    <p className="text-[13.5px] text-[#5A6275] leading-relaxed line-clamp-3">
                      {shortText}
                    </p>
                  )}

                  {activeProduct.attributes && activeProduct.attributes.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-[#E2E5EC]">
                      {activeProduct.attributes.map((attr) => (
                        <div key={attr.name}>
                          <p className="text-[12px] font-semibold text-[#0B0F19] mb-1.5">
                            {decodeHtmlEntities(attr.name)}:{' '}
                            <span className="font-normal text-[#5A6275]">
                              {decodeHtmlEntities(
                                selectedAttrs[attr.name] || attr.options?.[0] || ''
                              )}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(attr.options || []).map((opt) => {
                              const active = selectedAttrs[attr.name] === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    setSelectedAttrs((prev) => ({
                                      ...prev,
                                      [attr.name]: opt,
                                    }))
                                  }
                                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium border cursor-pointer transition-colors ${
                                    active
                                      ? 'bg-[#0B0F19] text-white border-[#0B0F19]'
                                      : 'bg-[#F4F5F8] text-[#0B0F19] border-[#E2E5EC] hover:border-[#0B0F19]'
                                  }`}
                                >
                                  {decodeHtmlEntities(opt)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-4 border-t border-[#E2E5EC]">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center border border-[#E2E5EC] rounded-full bg-[#F4F5F8]">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        aria-label="Decrease quantity"
                        className="w-9 h-10 flex items-center justify-center text-[#0B0F19] cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-[13.5px] font-semibold tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                        aria-label="Increase quantity"
                        className="w-9 h-10 flex items-center justify-center text-[#0B0F19] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!inStock || isAdding}
                      onClick={handleQuickAdd}
                      className={`type-button flex-1 h-11 px-5 rounded-full inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        !inStock
                          ? 'bg-[#E2E5EC] text-[#5A6275] cursor-not-allowed'
                          : addedDone
                            ? 'bg-[#16A34A] text-white'
                            : 'bg-[#E54826] hover:bg-[#CC3B1C] text-white'
                      }`}
                    >
                      {isAdding ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          <span>Adding...</span>
                        </>
                      ) : addedDone ? (
                        <>
                          <Check className="w-4 h-4" aria-hidden="true" />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                          <span>Add to Bag — {formatWcDecimalPrice(activePriceRaw, false)}</span>
                        </>
                      )}
                    </button>

                    {onToggleWishlist && (
                      <button
                        type="button"
                        onClick={() => onToggleWishlist(activeProduct)}
                        aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                        aria-pressed={isWishlisted}
                        title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                        className={`w-11 h-11 shrink-0 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                          isWishlisted
                            ? 'bg-[#E54826] border-[#E54826] text-white'
                            : 'bg-[#F4F5F8] border-[#E2E5EC] text-[#0B0F19] hover:border-[#E54826] hover:text-[#E54826]'
                        }`}
                      >
                        <Heart
                          className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewFullDetails(activeProduct);
                    }}
                    className="w-full py-2 text-[13px] font-heading font-semibold text-[#0B0F19] hover:text-[#E54826] inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>View Full Specifications & Details</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
