import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Heart,
  Loader2,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  XCircle,
} from 'lucide-react';
import type { WcProduct } from '../types/woocommerce';
import {
  decodeHtmlEntities,
  findMatchingVariationDetail,
  formatWcDecimalPrice,
  getDefaultAttributes,
  getRegularComparePrice,
  parseDescriptionSections,
  stripHtmlToText,
} from '../utils/format';

interface ProductDetailViewProps {
  product: WcProduct;
  isAdding: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: WcProduct) => void;
  onBack: () => void;
  onAddToCart: (
    product: WcProduct,
    quantity: number,
    variationId?: number,
    variationAttrs?: Array<{ attribute: string; value: string }>
  ) => Promise<void>;
  onBuyNow: (
    product: WcProduct,
    quantity: number,
    variationId?: number,
    variationAttrs?: Array<{ attribute: string; value: string }>
  ) => Promise<void>;
}

const easeCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  isAdding,
  isWishlisted = false,
  onToggleWishlist,
  onBack,
  onAddToCart,
  onBuyNow,
}) => {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>(() =>
    getDefaultAttributes(product)
  );
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    setActiveImageIdx(0);
    setImgError(false);
    setQuantity(1);
    setSelectedAttrs(getDefaultAttributes(product));
    setAddedFeedback(false);
  }, [product.id, product.variation_details?.length]);

  const title = decodeHtmlEntities(product.name);
  const categoryName = decodeHtmlEntities(
    product.categories?.[0]?.name || 'Hot Selling 50$ Products'
  );
  const shortDesc = stripHtmlToText(product.short_description);
  const { paragraphs, specs, packingList } = useMemo(
    () => parseDescriptionSections(product.description),
    [product.description]
  );

  const matchedVariation = useMemo(
    () => findMatchingVariationDetail(product, selectedAttrs),
    [product, selectedAttrs]
  );

  const activePriceRaw =
    matchedVariation?.sale_price ||
    matchedVariation?.price ||
    product.sale_price ||
    product.price ||
    '50';
  const priceDisplay = formatWcDecimalPrice(activePriceRaw, true);
  const regularCompare = getRegularComparePrice(product, matchedVariation);
  const activeStock = matchedVariation?.stock_status ?? product.stock_status;
  const inStock = activeStock === 'instock' && product.purchasable !== false;

  const images = product.images || [];
  const mainImage = images[activeImageIdx]?.src || images[0]?.src || '';

  const buildVariationPayload = () => {
    const variationId =
      matchedVariation?.id ?? product.variations?.[0] ?? product.id;
    const attrs =
      matchedVariation?.attributes.map((a) => ({
        attribute: a.name,
        value: a.option,
      })) ??
      Object.entries(selectedAttrs).map(([attribute, value]) => ({
        attribute,
        value,
      }));
    return { variationId, attrs };
  };

  const handleAdd = async () => {
    const { variationId, attrs } = buildVariationPayload();
    await onAddToCart(product, quantity, variationId, attrs);
    setAddedFeedback(true);
    window.setTimeout(() => setAddedFeedback(false), 2000);
  };

  const handleBuy = async () => {
    const { variationId, attrs } = buildVariationPayload();
    await onBuyNow(product, quantity, variationId, attrs);
  };

  return (
    <div className="bg-[#F4F5F8] pb-24 lg:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 text-[13px] sm:text-[14px] text-[#5A6275] mb-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 font-semibold text-[#0B0F19] hover:text-[#E54826] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to {categoryName}</span>
          </button>
          <span aria-hidden="true">/</span>
          <span className="truncate max-w-xs sm:max-w-md text-[#0B0F19]">{title}</span>
        </div>

        {/* Main 2-column PDP module */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Sticky Gallery with smooth image cross-fade */}
          <div className="lg:col-span-6 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl border border-[#E2E5EC] p-4 sm:p-6 shadow-[0_16px_40px_-24px_rgba(14,14,13,0.12)]">
              <div className="aspect-square bg-[#ECEEF2] rounded-2xl overflow-hidden flex items-center justify-center relative">
                <AnimatePresence mode="wait">
                  {mainImage && !imgError ? (
                    <motion.img
                      key={mainImage}
                      src={mainImage}
                      alt={title}
                      referrerPolicy="no-referrer"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: easeCurve }}
                      onError={() => setImgError(true)}
                      className="w-full h-full object-contain p-5 mix-blend-multiply"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8">
                      <Package className="w-12 h-12 text-[#0B0F19]/40 mb-3" aria-hidden="true" />
                      <span className="text-sm text-[#5A6275]">{title}</span>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {images.length > 1 && (
                <div className="grid grid-cols-5 gap-2.5 mt-4">
                  {images.map((img, idx) => (
                    <motion.button
                      key={img.id || idx}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setActiveImageIdx(idx);
                        setImgError(false);
                      }}
                      className={`aspect-square rounded-xl bg-[#ECEEF2] border overflow-hidden p-1.5 cursor-pointer transition-all ${
                        idx === activeImageIdx
                          ? 'border-[#E54826] ring-2 ring-[#E54826]/25'
                          : 'border-[#E2E5EC] hover:border-[#0B0F19]'
                      }`}
                      aria-label={`View product image ${idx + 1}`}
                    >
                      <img
                        src={img.src}
                        alt={`${title} view ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain mix-blend-multiply"
                      />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Contiguous Purchase Module */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 flex flex-col gap-5 shadow-[0_16px_40px_-24px_rgba(14,14,13,0.08)]">
            <div>
              <p className="text-[12px] font-mono text-[#5A6275] mb-2 tabular-nums">
                #{product.id}
                {product.sku ? ` · SKU: ${product.sku}` : ''}
                {` · ${categoryName}`}
              </p>

              <h1 className="type-h1 text-[#0B0F19] mb-3">{title}</h1>

              <div className="flex flex-wrap items-baseline gap-4 mb-4">
                <span className="font-heading font-extrabold text-[30px] sm:text-[34px] text-[#E54826] tabular-nums">
                  {priceDisplay}
                </span>
                <span className="text-[18px] text-[#5A6275]/70 line-through tabular-nums">
                  ${regularCompare}.00
                </span>
                <span className="text-[13px] font-mono font-semibold text-[#16A34A] tabular-nums">
                  Save ${Math.max(regularCompare - Number(activePriceRaw || 50), 15)} vs. US Retail
                </span>
              </div>

              {inStock ? (
                <div className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#16A34A]">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
                  <span>In Stock — Ships Free to All 50 US States</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 text-[14px] font-semibold text-red-600">
                  <XCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Currently Out of Stock</span>
                </div>
              )}
            </div>

            {shortDesc && (
              <p className="type-body text-[#5A6275] border-t border-[#E2E5EC] pt-4">
                {shortDesc}
              </p>
            )}

            {/* WooCommerce Variation Attributes */}
            {product.attributes && product.attributes.length > 0 && (
              <div className="space-y-4 border-t border-[#E2E5EC] pt-4">
                {product.attributes.map((attr) => (
                  <div key={attr.name}>
                    <p className="text-[13px] font-semibold text-[#0B0F19] mb-2">
                      {decodeHtmlEntities(attr.name)}:{' '}
                      <span className="font-normal text-[#5A6275]">
                        {decodeHtmlEntities(selectedAttrs[attr.name] || attr.options?.[0] || '')}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(attr.options || []).map((optionValue) => {
                        const isSelected = selectedAttrs[attr.name] === optionValue;
                        return (
                          <motion.button
                            key={optionValue}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            onClick={() =>
                              setSelectedAttrs((prev) => ({
                                ...prev,
                                [attr.name]: optionValue,
                              }))
                            }
                            className={`px-4 py-2 rounded-full text-[13px] font-medium border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#0B0F19] text-white border-[#0B0F19]'
                                : 'bg-[#F4F5F8] text-[#0B0F19] border-[#E2E5EC] hover:border-[#0B0F19]'
                            }`}
                          >
                            {decodeHtmlEntities(optionValue)}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity & Primary Purchase Buttons */}
            <div className="border-t border-[#E2E5EC] pt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <span className="text-[14px] font-semibold text-[#0B0F19]">Quantity:</span>
                  <div className="inline-flex items-center border border-[#E2E5EC] rounded-full bg-[#F4F5F8] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                      className="w-10 h-10 flex items-center justify-center text-[#0B0F19] hover:bg-[#ECEEF2] cursor-pointer transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-10 text-center font-semibold text-[15px] text-[#0B0F19] tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                      aria-label="Increase quantity"
                      className="w-10 h-10 flex items-center justify-center text-[#0B0F19] hover:bg-[#ECEEF2] cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {onToggleWishlist && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onToggleWishlist(product)}
                    aria-pressed={isWishlisted}
                    className={`h-10 px-4 rounded-full border text-[13px] font-heading font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                      isWishlisted
                        ? 'bg-[#E54826]/10 border-[#E54826] text-[#E54826]'
                        : 'bg-[#F4F5F8] border-[#E2E5EC] text-[#0B0F19] hover:border-[#E54826] hover:text-[#E54826]'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${isWishlisted ? 'fill-[#E54826]' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}</span>
                  </motion.button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <motion.button
                  type="button"
                  whileTap={inStock && !isAdding ? { scale: 0.98 } : undefined}
                  disabled={!inStock || isAdding}
                  onClick={handleAdd}
                  className={`type-button h-12 px-6 rounded-full inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    !inStock
                      ? 'bg-[#E2E5EC] text-[#5A6275] cursor-not-allowed'
                      : addedFeedback
                        ? 'bg-[#16A34A] text-white'
                        : 'bg-[#E54826] hover:bg-[#CC3B1C] text-white shadow-[0_12px_26px_-10px_rgba(229,72,38,0.5)]'
                  }`}
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Adding...</span>
                    </>
                  ) : addedFeedback ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden="true" />
                      <span>Added to Cart</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" aria-hidden="true" />
                      <span>Add to Cart — {formatWcDecimalPrice(activePriceRaw, false)}</span>
                    </>
                  )}
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={inStock && !isAdding ? { scale: 0.98 } : undefined}
                  disabled={!inStock || isAdding}
                  onClick={handleBuy}
                  className="type-button h-12 px-6 rounded-full bg-[#0B0F19] hover:bg-[#232320] text-white inline-flex items-center justify-center transition-colors cursor-pointer disabled:bg-[#E2E5EC] disabled:text-[#5A6275]"
                >
                  Buy Now — Checkout
                </motion.button>
              </div>
            </div>

            {/* Trust Assurances (Clean Hairline Strip) */}
            <div className="border-y border-[#E2E5EC] py-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
              <div className="flex items-center gap-2 text-[#0B0F19] font-medium">
                <Truck className="w-4 h-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                <span>Free USA Shipping</span>
              </div>
              <div className="flex items-center gap-2 text-[#0B0F19] font-medium">
                <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                <span>7–15 Days Delivery</span>
              </div>
              <div className="flex items-center gap-2 text-[#0B0F19] font-medium">
                <RotateCcw className="w-4 h-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                <span>30-Day Easy Returns</span>
              </div>
            </div>

            {/* Full WooCommerce Description, Specs & Packing List */}
            <div className="pt-2 space-y-6">
              {paragraphs.length > 0 && (
                <div>
                  <h2 className="font-heading font-bold text-[18px] text-[#0B0F19] mb-2.5">
                    Product Overview
                  </h2>
                  <div className="space-y-3 type-body text-[#5A6275]">
                    {paragraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>
                </div>
              )}

              {specs.length > 0 && (
                <div className="border-t border-[#E2E5EC] pt-5">
                  <h3 className="font-heading font-bold text-[16px] text-[#0B0F19] mb-3">
                    Specifications
                  </h3>
                  <ul className="space-y-1.5 text-[14px] text-[#5A6275]">
                    {specs.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              {packingList.length > 0 && (
                <div className="border-t border-[#E2E5EC] pt-5">
                  <h3 className="font-heading font-bold text-[16px] text-[#0B0F19] mb-3">
                    What&apos;s Included
                  </h3>
                  <ul className="space-y-1.5 text-[14px] text-[#5A6275]">
                    {packingList.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Mobile Sticky Buy Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E2E5EC] px-4 h-16 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-[#5A6275] leading-none">Flat Price</p>
          <p className="type-price leading-tight">{priceDisplay}</p>
        </div>
        <button
          type="button"
          disabled={!inStock || isAdding}
          onClick={handleAdd}
          className="type-button flex-1 max-w-[220px] h-11 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4" aria-hidden="true" />
          <span>{isAdding ? 'Adding...' : 'Add to Cart'}</span>
        </button>
      </div>
    </div>
  );
};
