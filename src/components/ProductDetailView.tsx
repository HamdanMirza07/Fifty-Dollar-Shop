import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
import type { WcImage, WcProduct } from '../types/woocommerce';
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
  allProducts?: WcProduct[];
  isAdding: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: WcProduct) => void;
  onSelectProduct?: (product: WcProduct) => void;
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

function appendRetryParam(url: string, attempt: number): string {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set('img_retry', String(attempt));
    return parsed.toString();
  } catch {
    return `${url}${url.includes('?') ? '&' : '?'}img_retry=${attempt}`;
  }
}

/**
 * Resilient product image component that gracefully recovers from transient
 * origin HTTP/2 stream drops or thumbnail throttling by falling back between
 * `primarySrc` and `fallbackSrc` and retrying with a short backoff.
 */
const ResilientProductImage: React.FC<{
  primarySrc: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  iconClassName?: string;
  eager?: boolean;
}> = ({
  primarySrc,
  fallbackSrc,
  alt,
  className = 'w-full h-full object-contain',
  iconClassName = 'w-6 h-6 text-[#0B0F19]/35',
  eager = false,
}) => {
  const candidates = useMemo(() => {
    const list: string[] = [];
    const pushUnique = (u?: string) => {
      const clean = (u || '').trim();
      if (clean && !list.includes(clean)) list.push(clean);
    };
    pushUnique(primarySrc);
    pushUnique(fallbackSrc);
    return list;
  }, [primarySrc, fallbackSrc]);

  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setStep(0);
    setLoaded(false);
    setFailed(false);
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, [primarySrc, fallbackSrc]);

  // Candidate sequence: [primary, fallback, primary?retry=1, fallback?retry=2, primary?retry=3]
  const resolvedSrc = useMemo(() => {
    if (candidates.length === 0) return '';
    if (step < candidates.length) {
      return candidates[step];
    }
    const retryIndex = step - candidates.length;
    if (retryIndex >= 3) return '';
    const base = candidates[retryIndex % candidates.length];
    return appendRetryParam(base, retryIndex + 1);
  }, [candidates, step]);

  const handleError = () => {
    const maxSteps = candidates.length + 3;
    const nextStep = step + 1;
    if (nextStep < maxSteps) {
      const delayMs = nextStep < candidates.length ? 120 : 500 * (nextStep - candidates.length + 1);
      retryTimerRef.current = window.setTimeout(() => {
        setStep(nextStep);
      }, delayMs);
    } else {
      setFailed(true);
    }
  };

  if (!resolvedSrc || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Package className={iconClassName} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[#E2E5EC]/60 animate-pulse rounded-lg"
        />
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
};

/**
 * Seamless auto-scrolling horizontal product slider at the bottom of the Product Detail Page.
 * Glides continuously left-to-right, pauses on hover/touch/focus, respects reduced-motion,
 * and allows manual swipe or arrow nudges.
 */
const RelatedProductsAutoSlider: React.FC<{
  products: WcProduct[];
  onSelectProduct: (product: WcProduct) => void;
}> = ({ products, onSelectProduct }) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const pauseTimeoutRef = useRef<number | null>(null);

  const loopedProducts = useMemo(() => {
    if (products.length <= 1) return products;
    // Duplicate list so horizontal scroll loops seamlessly with zero jump
    return [...products, ...products];
  }, [products]);

  useEffect(() => {
    const container = scrollerRef.current;
    if (!container || products.length <= 1) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let rafId = 0;
    let lastTime = performance.now();
    let subPixelCarry = 0;
    const speedPxPerSec = 42;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (!pausedRef.current) {
        const halfWidth = container.scrollWidth / 2;
        if (halfWidth > 0) {
          subPixelCarry += speedPxPerSec * dt;
          if (subPixelCarry >= 0.5) {
            const step = Math.floor(subPixelCarry);
            subPixelCarry -= step;
            container.scrollLeft += step;
            if (container.scrollLeft >= halfWidth) {
              container.scrollLeft -= halfWidth;
            }
          }
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      if (pauseTimeoutRef.current !== null) {
        window.clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [products.length]);

  const handleManualNudge = (direction: -1 | 1) => {
    const container = scrollerRef.current;
    if (!container) return;
    pausedRef.current = true;
    if (pauseTimeoutRef.current !== null) {
      window.clearTimeout(pauseTimeoutRef.current);
    }
    const halfWidth = container.scrollWidth / 2;
    if (direction < 0 && container.scrollLeft <= 10 && halfWidth > 0) {
      container.scrollLeft += halfWidth;
    }
    container.scrollBy({ left: direction * 300, behavior: 'smooth' });
    pauseTimeoutRef.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, 1800);
  };

  if (products.length === 0) return null;

  return (
    <section
      aria-label="More products you may like"
      className="mt-14 pt-10 border-t border-[#E2E5EC]"
    >
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-[12px] font-mono uppercase tracking-[0.12em] text-[#E54826] font-semibold mb-1">
            More $50 Finds
          </p>
          <h2 className="font-heading font-bold text-[22px] sm:text-[26px] text-[#0B0F19] leading-tight">
            Explore More Products
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleManualNudge(-1)}
            aria-label="Scroll products left"
            className="w-9 h-9 rounded-full bg-white border border-[#E2E5EC] hover:border-[#0B0F19] text-[#0B0F19] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleManualNudge(1)}
            aria-label="Scroll products right"
            className="w-9 h-9 rounded-full bg-white border border-[#E2E5EC] hover:border-[#0B0F19] text-[#0B0F19] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onTouchStart={() => {
          pausedRef.current = true;
        }}
        onTouchEnd={() => {
          if (pauseTimeoutRef.current !== null) {
            window.clearTimeout(pauseTimeoutRef.current);
          }
          pauseTimeoutRef.current = window.setTimeout(() => {
            pausedRef.current = false;
          }, 2000);
        }}
        onFocusCapture={() => {
          pausedRef.current = true;
        }}
        onBlurCapture={() => {
          pausedRef.current = false;
        }}
        className="flex gap-4 overflow-x-auto no-scrollbar pb-2 select-none"
      >
        {loopedProducts.map((item, idx) => {
          const itemTitle = decodeHtmlEntities(item.name);
          const itemCat = decodeHtmlEntities(
            item.categories?.[0]?.name || 'Hot Selling 50$ Products'
          );
          const itemPrice = formatWcDecimalPrice(
            item.sale_price || item.price || item.regular_price || '50',
            false
          );
          const itemCompare = getRegularComparePrice(item);
          const firstImg = item.images?.[0];

          return (
            <button
              key={`${item.id}-${idx}`}
              type="button"
              onClick={() => onSelectProduct(item)}
              className="group text-left shrink-0 w-[210px] sm:w-[235px] lg:w-[250px] bg-white rounded-2xl border border-[#E2E5EC] hover:border-[#0B0F19]/40 p-3 flex flex-col gap-3 transition-all hover:shadow-[0_14px_30px_-18px_rgba(11,15,25,0.22)] cursor-pointer"
            >
              <div className="aspect-square w-full rounded-xl bg-[#ECEEF2] overflow-hidden p-3 flex items-center justify-center">
                <ResilientProductImage
                  primarySrc={firstImg?.thumbnail || firstImg?.src || ''}
                  fallbackSrc={firstImg?.src || ''}
                  alt={itemTitle}
                  className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="flex-1 flex flex-col justify-between gap-2 min-w-0">
                <div>
                  <p className="text-[11px] font-mono text-[#5A6275] truncate mb-1">
                    {itemCat}
                  </p>
                  <h3 className="font-heading font-semibold text-[14px] leading-snug text-[#0B0F19] group-hover:text-[#E54826] transition-colors line-clamp-2">
                    {itemTitle}
                  </h3>
                </div>

                <div className="flex items-baseline gap-2 pt-1 border-t border-[#E2E5EC]/70">
                  <span className="font-heading font-extrabold text-[17px] text-[#E54826] tabular-nums">
                    {itemPrice}
                  </span>
                  <span className="text-[12.5px] text-[#5A6275]/75 line-through tabular-nums">
                    ${itemCompare}
                  </span>
                  <span className="ml-auto text-[11px] font-medium text-[#16A34A]">
                    Free Ship
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  allProducts = [],
  isAdding,
  isWishlisted = false,
  onToggleWishlist,
  onSelectProduct,
  onBack,
  onAddToCart,
  onBuyNow,
}) => {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>(() =>
    getDefaultAttributes(product)
  );
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Merge product gallery images + any unique variation images (deduplicated by src)
  const images = useMemo<WcImage[]>(() => {
    const out: WcImage[] = [];
    const seen = new Set<string>();
    const addImg = (img?: WcImage | null) => {
      if (!img || !img.src) return;
      const key = img.src.trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(img);
    };
    for (const img of product.images || []) addImg(img);
    for (const v of product.variation_details || []) addImg(v.image);
    return out;
  }, [product.images, product.variation_details]);

  useEffect(() => {
    setActiveImageIdx(0);
    setQuantity(1);
    const defaults = getDefaultAttributes(product);
    // Support Meta Shop / deep-link attribute pre-selection (?color=...&size=...)
    try {
      const params = new URLSearchParams(window.location.search);
      for (const attr of product.attributes || []) {
        const lowerName = attr.name.trim().toLowerCase();
        const paramVal =
          params.get(lowerName) ||
          (lowerName.includes('color') || lowerName.includes('colour')
            ? params.get('color')
            : null) ||
          (lowerName.includes('size') ? params.get('size') : null);
        if (paramVal && Array.isArray(attr.options)) {
          const matchedOpt = attr.options.find(
            (opt) => opt.trim().toLowerCase() === paramVal.trim().toLowerCase()
          );
          if (matchedOpt) defaults[attr.name] = matchedOpt;
        }
      }
    } catch {
      // Ignore query parse issues
    }
    setSelectedAttrs(defaults);
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

  // Sync gallery to matched variation image when user switches color/style
  useEffect(() => {
    const varSrc = matchedVariation?.image?.src?.trim();
    if (!varSrc) return;
    const idx = images.findIndex((img) => img.src.trim() === varSrc);
    if (idx >= 0) {
      setActiveImageIdx(idx);
    }
  }, [matchedVariation?.id, matchedVariation?.image?.src, images]);

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

  const activeImageObj = images[activeImageIdx] || images[0];

  const relatedProducts = useMemo(
    () => allProducts.filter((p) => p.id !== product.id),
    [allProducts, product.id]
  );

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
          <span className="truncate max-w-[220px] sm:max-w-md text-[#0B0F19]">
            {title}
          </span>
        </div>

        {/* Main 2-column PDP module */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Sticky Gallery with resilient image loading */}
          <div className="lg:col-span-6 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl border border-[#E2E5EC] p-4 sm:p-6 shadow-[0_16px_40px_-24px_rgba(14,14,13,0.12)]">
              <div className="aspect-square bg-[#ECEEF2] rounded-2xl overflow-hidden flex items-center justify-center relative">
                <AnimatePresence mode="wait">
                  {activeImageObj?.src ? (
                    <motion.div
                      key={activeImageObj.src}
                      initial={{ opacity: 0, scale: 0.985 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: easeCurve }}
                      className="w-full h-full p-4 sm:p-6"
                    >
                      <ResilientProductImage
                        primarySrc={activeImageObj.src}
                        fallbackSrc={activeImageObj.thumbnail}
                        alt={title}
                        eager
                        className="w-full h-full object-contain mix-blend-multiply"
                        iconClassName="w-12 h-12 text-[#0B0F19]/40"
                      />
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-8">
                      <Package
                        className="w-12 h-12 text-[#0B0F19]/40 mb-3"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-[#5A6275]">{title}</span>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {images.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 mt-4">
                  {images.map((img, idx) => (
                    <motion.button
                      key={`${img.id || idx}-${img.src}`}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`aspect-square rounded-xl bg-[#ECEEF2] border overflow-hidden p-1.5 cursor-pointer transition-all ${
                        idx === activeImageIdx
                          ? 'border-[#E54826] ring-2 ring-[#E54826]/25'
                          : 'border-[#E2E5EC] hover:border-[#0B0F19]'
                      }`}
                      aria-label={`View product image ${idx + 1}`}
                    >
                      <ResilientProductImage
                        primarySrc={img.thumbnail || img.src}
                        fallbackSrc={img.src}
                        alt={`${title} view ${idx + 1}`}
                        eager
                        className="w-full h-full object-contain mix-blend-multiply"
                        iconClassName="w-5 h-5 text-[#5A6275]/50"
                      />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Contiguous Purchase Module */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-[#E2E5EC] p-5 sm:p-7 flex flex-col gap-5 shadow-[0_16px_40px_-24px_rgba(14,14,13,0.08)]">
            <div>
              <p className="text-[12px] font-mono text-[#5A6275] mb-2 tabular-nums">
                #{product.id}
                {product.sku ? ` · SKU: ${product.sku}` : ''}
                {` · ${categoryName}`}
              </p>

              <h1 className="font-heading font-bold text-[20px] sm:text-[23px] md:text-[26px] lg:text-[28px] leading-[1.24] tracking-[-0.02em] text-[#0B0F19] break-words mb-3">
                {title}
              </h1>

              <div className="flex flex-wrap items-baseline gap-3.5 mb-3.5">
                <span className="font-heading font-extrabold text-[26px] sm:text-[30px] text-[#E54826] tabular-nums">
                  {priceDisplay}
                </span>
                <span className="text-[16px] sm:text-[18px] text-[#5A6275]/70 line-through tabular-nums">
                  ${regularCompare}.00
                </span>
                <span className="text-[12.5px] sm:text-[13px] font-mono font-semibold text-[#16A34A] tabular-nums">
                  Save ${Math.max(regularCompare - Number(activePriceRaw || 50), 15)} vs. US Retail
                </span>
              </div>

              {inStock ? (
                <div className="inline-flex items-center gap-2 text-[13.5px] sm:text-[14px] font-semibold text-[#16A34A]">
                  <CheckCircle2
                    className="w-4 h-4 text-[#16A34A] shrink-0"
                    aria-hidden="true"
                  />
                  <span>In Stock — Ships Free to All 50 US States</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 text-[13.5px] sm:text-[14px] font-semibold text-red-600">
                  <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
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
                        {decodeHtmlEntities(
                          selectedAttrs[attr.name] || attr.options?.[0] || ''
                        )}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(attr.options || []).map((optionValue) => {
                        const isSelected =
                          selectedAttrs[attr.name] === optionValue;
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
                  <span className="text-[14px] font-semibold text-[#0B0F19]">
                    Quantity:
                  </span>
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
                    <span>
                      {isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                    </span>
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
                      <Loader2
                        className="w-4 h-4 animate-spin"
                        aria-hidden="true"
                      />
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
                      <span>
                        Add to Cart — {formatWcDecimalPrice(activePriceRaw, false)}
                      </span>
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
                <Truck
                  className="w-4 h-4 text-[#16A34A] shrink-0"
                  aria-hidden="true"
                />
                <span>Free USA Shipping</span>
              </div>
              <div className="flex items-center gap-2 text-[#0B0F19] font-medium">
                <ShieldCheck
                  className="w-4 h-4 text-[#16A34A] shrink-0"
                  aria-hidden="true"
                />
                <span>7–15 Days Delivery</span>
              </div>
              <div className="flex items-center gap-2 text-[#0B0F19] font-medium">
                <RotateCcw
                  className="w-4 h-4 text-[#16A34A] shrink-0"
                  aria-hidden="true"
                />
                <span>30-Day Easy Returns</span>
              </div>
            </div>

            {/* Full WooCommerce Description, Specs & Packing List */}
            <div className="pt-2 space-y-6">
              {paragraphs.length > 0 && (
                <div>
                  <h2 className="font-heading font-bold text-[17px] text-[#0B0F19] mb-2.5">
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

        {/* Auto Smooth Horizontal Scrolling Slider for Remaining Products */}
        {onSelectProduct && relatedProducts.length > 0 && (
          <RelatedProductsAutoSlider
            products={relatedProducts}
            onSelectProduct={onSelectProduct}
          />
        )}
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
