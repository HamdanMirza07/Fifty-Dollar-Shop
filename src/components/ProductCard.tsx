import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  Eye,
  GitCompareArrows,
  Heart,
  Loader2,
  Package,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import type { WcProduct } from '../types/woocommerce';
import { fetchWcProductByIdCached } from '../api/woocommerce';
import {
  decodeHtmlEntities,
  findColorAttribute,
  findMatchingVariationDetail,
  findWearableSizeAttribute,
  formatWcDecimalPrice,
  getDefaultAttributes,
  getRegularComparePrice,
  resolveSwatchColor,
} from '../utils/format';

interface ProductCardProps {
  product: WcProduct;
  index?: number;
  isAdding: boolean;
  justAdded: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: WcProduct) => void;
  isCompared?: boolean;
  onToggleCompare?: (product: WcProduct) => void;
  onSelectProduct: (product: WcProduct) => void;
  onQuickView?: (product: WcProduct) => void;
  onSelectCategoryId?: (categoryId: number) => void;
  onAddToCart: (
    product: WcProduct,
    variationId?: number,
    variationAttrs?: Array<{ attribute: string; value: string }>,
    selectedAttrsMap?: Record<string, string>
  ) => void;
}

function formatCompactOptionLabel(raw: string): string {
  const decoded = decodeHtmlEntities(raw).trim();
  const stripped = decoded.replace(/^size\s+/i, '').trim();
  return stripped || decoded;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  index = 0,
  isAdding,
  justAdded,
  isWishlisted = false,
  onToggleWishlist,
  isCompared = false,
  onToggleCompare,
  onSelectProduct,
  onQuickView,
  onSelectCategoryId,
  onAddToCart,
}) => {
  const [imgError, setImgError] = useState(false);
  const [resolvedProduct, setResolvedProduct] = useState<WcProduct>(product);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>(() =>
    getDefaultAttributes(product)
  );
  const [loadingVariations, setLoadingVariations] = useState(false);

  useEffect(() => {
    setResolvedProduct(product);
    setSelectedAttrs(getDefaultAttributes(product));
    setImgError(false);
  }, [product]);

  const ensureVariationsLoaded = async () => {
    if (
      resolvedProduct.variations.length <= 1 ||
      (resolvedProduct.variation_details && resolvedProduct.variation_details.length > 0) ||
      loadingVariations
    ) {
      return;
    }
    setLoadingVariations(true);
    try {
      const fresh = await fetchWcProductByIdCached(resolvedProduct.id);
      setResolvedProduct(fresh);
    } catch {
      // Keep parent product attributes if fetch fails
    } finally {
      setLoadingVariations(false);
    }
  };

  const colorAttr = useMemo(
    () => findColorAttribute(resolvedProduct),
    [resolvedProduct]
  );

  const sizeAttr = useMemo(
    () => findWearableSizeAttribute(resolvedProduct),
    [resolvedProduct]
  );

  const matchedVariation = useMemo(
    () => findMatchingVariationDetail(resolvedProduct, selectedAttrs),
    [resolvedProduct, selectedAttrs]
  );

  const handleSelectAttribute = (attrName: string, optionValue: string) => {
    setSelectedAttrs((prev) => ({
      ...prev,
      [attrName]: optionValue,
    }));
    void ensureVariationsLoaded();
  };

  const title = decodeHtmlEntities(resolvedProduct.name);
  const primaryCat = resolvedProduct.categories?.[0];
  const categoryName = decodeHtmlEntities(
    primaryCat?.name || 'Hot Selling 50$ Products'
  );

  const defaultPrimaryImg = resolvedProduct.images?.[0]?.src || '';
  const variationImg = matchedVariation?.image?.src || '';
  const primaryImg = variationImg || defaultPrimaryImg;
  const secondaryImg =
    !variationImg || variationImg === defaultPrimaryImg
      ? resolvedProduct.images?.[1]?.src || ''
      : '';

  const rawPrice =
    matchedVariation?.sale_price ||
    matchedVariation?.price ||
    resolvedProduct.sale_price ||
    resolvedProduct.price ||
    '50';
  const numericPrice = Number(rawPrice) || 50;
  const priceDisplay = formatWcDecimalPrice(rawPrice, false);
  const regularCompare = getRegularComparePrice(resolvedProduct, matchedVariation);
  const savingsAmount = Math.max(Math.round(regularCompare - numericPrice), 15);
  const savingsPct = Math.max(
    Math.round(((regularCompare - numericPrice) / regularCompare) * 100),
    20
  );

  const inStock =
    (matchedVariation?.stock_status ?? resolvedProduct.stock_status) === 'instock' &&
    resolvedProduct.purchasable !== false;

  const colorOptions = colorAttr?.options?.slice(0, 5) || [];
  const selectedColorValue =
    (colorAttr && selectedAttrs[colorAttr.name]) || colorOptions[0] || '';

  const sizeOptions = sizeAttr?.options?.slice(0, 5) || [];
  const hasWearableSize = Boolean(sizeAttr && sizeOptions.length > 0);
  const selectedSizeValue =
    (sizeAttr && selectedAttrs[sizeAttr.name]) || sizeOptions[0] || '';

  const handleCardAddToCart = () => {
    const variationAttrs =
      matchedVariation?.attributes?.map((a) => ({
        attribute: a.name,
        value: a.option,
      })) ??
      Object.entries(selectedAttrs).map(([attribute, value]) => ({
        attribute,
        value,
      }));

    const targetVariationId =
      matchedVariation?.id ??
      (resolvedProduct.variations?.length === 1 ? resolvedProduct.variations[0] : undefined);

    onAddToCart(resolvedProduct, targetVariationId, variationAttrs, selectedAttrs);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: 0.44,
        delay: Math.min((index % 4) * 0.06, 0.18),
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -3 }}
      onMouseEnter={() => {
        if (resolvedProduct.variations.length > 1) {
          void ensureVariationsLoaded();
        }
      }}
      className="group bg-white rounded-2xl border border-[#E2E5EC] hover:border-[#0B0F19]/25 p-3 sm:p-3.5 flex flex-col justify-between transition-all duration-200 hover:shadow-[0_24px_48px_-24px_rgba(11,15,25,0.22)] h-full"
    >
      <div>
        {/* Studio Image Stage */}
        <div className="relative w-full aspect-[4/4.3] bg-[#F4F5F8] rounded-xl overflow-hidden mb-3">
          <button
            type="button"
            onClick={() => onSelectProduct(resolvedProduct)}
            className="w-full h-full flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E54826]"
            aria-label={`View details for ${title}`}
          >
            {primaryImg && !imgError ? (
              <>
                <img
                  src={primaryImg}
                  alt={title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className={`w-full h-full object-contain p-4 mix-blend-multiply transition-all duration-500 ${
                    secondaryImg
                      ? 'group-hover:opacity-0 group-hover:scale-105'
                      : 'group-hover:scale-105'
                  }`}
                />
                {secondaryImg && (
                  <img
                    src={secondaryImg}
                    alt={`${title} alternate view`}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-contain p-4 mix-blend-multiply opacity-0 group-hover:opacity-100 scale-105 group-hover:scale-100 transition-all duration-500"
                  />
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                <Package className="w-9 h-9 text-[#5A6275] mb-2" aria-hidden="true" />
                <span className="text-[12px] text-[#5A6275] line-clamp-2">{title}</span>
              </div>
            )}
          </button>

          {/* Top-Left Savings Percentage */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-3 text-[11px] font-mono font-semibold text-[#E54826] tabular-nums"
          >
            -{savingsPct}%
          </span>

          {/* Top-Right Action Stack: Wishlist Heart & Compare */}
          {(onToggleWishlist || onToggleCompare) && (
            <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1.5">
              {onToggleWishlist && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWishlist(resolvedProduct);
                  }}
                  aria-label={
                    isWishlisted ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`
                  }
                  aria-pressed={isWishlisted}
                  title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer shadow-xs ${
                    isWishlisted
                      ? 'bg-[#E54826] border-[#E54826] text-white'
                      : 'bg-white/95 backdrop-blur-sm border-[#E2E5EC] text-[#0B0F19] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19]'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`}
                    aria-hidden="true"
                  />
                </motion.button>
              )}

              {onToggleCompare && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCompare(resolvedProduct);
                  }}
                  aria-label={isCompared ? `Remove ${title} from compare` : `Compare ${title}`}
                  aria-pressed={isCompared}
                  title={isCompared ? 'Added to Compare' : 'Compare Product'}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-150 cursor-pointer shadow-xs ${
                    isCompared
                      ? 'bg-[#0B0F19] border-[#0B0F19] text-white'
                      : 'bg-white/95 backdrop-blur-sm border-[#E2E5EC] text-[#0B0F19] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19]'
                  }`}
                >
                  <GitCompareArrows className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Hover Quick View Trigger */}
          {onQuickView && (
            <button
              type="button"
              onClick={() => onQuickView(resolvedProduct)}
              className="hidden md:inline-flex items-center gap-1.5 absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#E2E5EC] text-[#0B0F19] hover:bg-[#0B0F19] hover:text-white text-[11.5px] font-heading font-semibold opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 cursor-pointer shadow-sm"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Quick View</span>
            </button>
          )}
        </div>

        {/* Unboxed Quiet Metadata */}
        <div className="flex items-center gap-1.5 text-[11.5px] text-[#5A6275] mb-1 px-0.5 truncate">
          <span className="font-mono tabular-nums">#{resolvedProduct.id}</span>
          <span aria-hidden="true">·</span>
          {primaryCat && onSelectCategoryId ? (
            <button
              type="button"
              onClick={() => onSelectCategoryId(primaryCat.id)}
              className="truncate hover:text-[#E54826] hover:underline cursor-pointer"
            >
              {categoryName}
            </button>
          ) : (
            <span className="truncate">{categoryName}</span>
          )}
        </div>

        {/* Product Title */}
        <h3 className="font-heading font-semibold text-[15px] leading-snug text-[#0B0F19] px-0.5 mb-2.5 line-clamp-2 min-h-[2.7em]">
          <button
            type="button"
            onClick={() => onSelectProduct(resolvedProduct)}
            className="text-left hover:text-[#E54826] transition-colors rounded cursor-pointer"
          >
            {title}
          </button>
        </h3>

        {/* Interactive Color & Size Selectors (Every Product Box) */}
        <div className="space-y-2 px-0.5 mb-3">
          {colorAttr && colorOptions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-[#5A6275] shrink-0">
                Color:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {colorOptions.map((opt) => {
                  const hex = resolveSwatchColor(opt);
                  const isSelected =
                    selectedColorValue.toLowerCase() === opt.toLowerCase();
                  if (hex) {
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectAttribute(colorAttr.name, opt)}
                        title={decodeHtmlEntities(opt)}
                        aria-label={`Select color ${decodeHtmlEntities(opt)}`}
                        aria-pressed={isSelected}
                        className={`w-4 h-4 rounded-full border transition-transform cursor-pointer shrink-0 ${
                          isSelected
                            ? 'ring-2 ring-offset-1 ring-[#0B0F19] scale-105 border-black/25'
                            : 'border-black/15 hover:scale-110'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  }
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSelectAttribute(colorAttr.name, opt)}
                      title={decodeHtmlEntities(opt)}
                      aria-pressed={isSelected}
                      className={`px-1.5 py-0.5 rounded text-[10.5px] font-medium border transition-colors cursor-pointer max-w-[110px] truncate ${
                        isSelected
                          ? 'bg-[#0B0F19] text-white border-[#0B0F19]'
                          : 'bg-[#F4F5F8] text-[#0B0F19] border-[#E2E5EC] hover:border-[#0B0F19]'
                      }`}
                    >
                      {decodeHtmlEntities(opt)}
                    </button>
                  );
                })}
                <span className="text-[11px] text-[#5A6275] truncate max-w-[110px]">
                  {decodeHtmlEntities(selectedColorValue)}
                </span>
              </div>
            </div>
          )}

          {/* Size Selector — rendered only when Small / Medium / Large sizes exist */}
          {hasWearableSize && sizeAttr && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-[#5A6275] shrink-0">
                Size:
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {sizeOptions.map((opt) => {
                  const isSelected =
                    selectedSizeValue.toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSelectAttribute(sizeAttr.name, opt)}
                      title={decodeHtmlEntities(opt)}
                      aria-label={`Select size ${decodeHtmlEntities(opt)}`}
                      aria-pressed={isSelected}
                      className={`min-w-[26px] h-6 px-2 rounded-md text-[11px] font-mono font-semibold border transition-colors cursor-pointer max-w-[130px] truncate ${
                        isSelected
                          ? 'bg-[#0B0F19] text-white border-[#0B0F19]'
                          : 'bg-[#F4F5F8] text-[#0B0F19] border-[#E2E5EC] hover:border-[#0B0F19]'
                      }`}
                    >
                      {formatCompactOptionLabel(opt)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#E2E5EC] px-0.5">
        {/* Price & Original Market Value Comparison Row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-heading font-extrabold text-[19px] text-[#E54826] tabular-nums">
              {priceDisplay}
            </span>
            <span
              className="text-[13.5px] font-medium text-[#5A6275] line-through tabular-nums"
              title={`Original USA market price $${regularCompare}`}
            >
              ${regularCompare}
            </span>
            <span className="text-[11px] font-mono font-semibold text-[#16A34A] tabular-nums">
              Save ${savingsAmount}
            </span>
          </div>

          {inStock ? (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#16A34A] whitespace-nowrap shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>In Stock</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-red-600 whitespace-nowrap shrink-0">
              <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Out of Stock</span>
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <motion.button
          type="button"
          whileTap={inStock && !isAdding ? { scale: 0.98 } : undefined}
          disabled={!inStock || isAdding}
          onClick={handleCardAddToCart}
          className={`w-full py-2.5 px-4 rounded-full font-heading font-semibold text-[13.5px] inline-flex items-center justify-center gap-2 transition-colors duration-150 whitespace-nowrap cursor-pointer ${
            !inStock
              ? 'bg-[#E2E5EC] text-[#5A6275] cursor-not-allowed'
              : justAdded
                ? 'bg-[#16A34A] text-white'
                : 'bg-[#0B0F19] hover:bg-[#E54826] text-white'
          }`}
        >
          {isAdding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              <span>Adding...</span>
            </>
          ) : justAdded ? (
            <>
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Added to Cart</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Add to Cart</span>
            </>
          )}
        </motion.button>
      </div>
    </motion.article>
  );
};
