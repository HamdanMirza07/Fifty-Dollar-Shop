import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { WcCategory, WcProduct } from '../types/woocommerce';
import { decodeHtmlEntities, stripHtmlToText } from '../utils/format';
import { ProductCard } from './ProductCard';

interface NewArrivalsCarouselProps {
  category?: WcCategory;
  products: WcProduct[];
  loading: boolean;
  addingProductId: number | null;
  justAddedProductId: number | null;
  wishlistIds?: number[];
  onToggleWishlist?: (product: WcProduct) => void;
  compareIds: number[];
  onToggleCompare: (product: WcProduct) => void;
  onSelectProduct: (product: WcProduct) => void;
  onQuickView?: (product: WcProduct) => void;
  onSelectCategoryId?: (categoryId: number) => void;
  onViewAllArrivals: () => void;
  onAddToCart: (
    product: WcProduct,
    variationId?: number,
    variationAttrs?: Array<{ attribute: string; value: string }>,
    selectedAttrsMap?: Record<string, string>
  ) => void;
}

const easeCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const NewArrivalsCarousel: React.FC<NewArrivalsCarouselProps> = ({
  category,
  products,
  loading,
  addingProductId,
  justAddedProductId,
  wishlistIds = [],
  onToggleWishlist,
  compareIds,
  onToggleCompare,
  onSelectProduct,
  onQuickView,
  onSelectCategoryId,
  onViewAllArrivals,
  onAddToCart,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const visibleArrivals = products;
  const shouldLoop = visibleArrivals.length > 1;

  // Build one seamless half so even small collections (2-4 items) overflow cleanly on wide desktops
  const halfTrackProducts = useMemo(() => {
    if (!shouldLoop) return visibleArrivals;
    if (visibleArrivals.length <= 4) {
      return [...visibleArrivals, ...visibleArrivals];
    }
    return visibleArrivals;
  }, [shouldLoop, visibleArrivals]);

  const catDescription = category
    ? stripHtmlToText(category.description)
    : '';
  const eyebrowText = category
    ? `Curated Collection #${category.id} · ${products.length} ${products.length === 1 ? 'Product' : 'Products'}`
    : 'Just Dropped · Latest Store Arrivals';
  const headingText = category
    ? `${decodeHtmlEntities(category.name)}s`.replace(/ss$/i, 's')
    : 'New Arrivals';

  const updateScrollState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    if (shouldLoop) {
      const halfWidth = el.scrollWidth / 2;
      if (halfWidth > 0) {
        const normalized = ((el.scrollLeft % halfWidth) + halfWidth) % halfWidth;
        setScrollProgress(Math.min(normalized / halfWidth, 1));
      }
      return;
    }
    const maxScroll = Math.max(el.scrollWidth - el.clientWidth, 0);
    setScrollProgress(maxScroll > 0 ? Math.min(el.scrollLeft / maxScroll, 1) : 0);
  }, [shouldLoop]);

  const scheduleResume = useCallback((delayMs: number) => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
      resumeTimerRef.current = null;
    }, delayMs);
  }, []);

  // Continuous, buttery-smooth horizontal auto-scroll using requestAnimationFrame
  useEffect(() => {
    const container = trackRef.current;
    if (!container || !shouldLoop) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let rafId = 0;
    let lastTime = performance.now();
    let subPixelCarry = 0;
    const speedPxPerSec = 44;

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
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };
  }, [shouldLoop, halfTrackProducts.length]);

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [updateScrollState, visibleArrivals.length]);

  const scrollTrack = (direction: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;

    pausedRef.current = true;
    const halfWidth = shouldLoop ? el.scrollWidth / 2 : 0;
    if (direction === 'left' && shouldLoop && el.scrollLeft <= 12 && halfWidth > 0) {
      el.scrollLeft += halfWidth;
    }

    const step = Math.max(Math.min(el.clientWidth * 0.65, 640), 280);
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });

    scheduleResume(1800);
  };

  const renderCardGroup = (copyIndex: number) => (
    <div
      key={`group-${copyIndex}`}
      className={`flex flex-nowrap shrink-0 gap-5 sm:gap-6 ${
        shouldLoop ? 'pr-5 sm:pr-6' : ''
      }`}
    >
      {halfTrackProducts.map((product, idx) => (
        <div
          key={`${copyIndex}-${idx}-${product.id}`}
          className="shrink-0 w-[268px] sm:w-[290px] lg:w-[292px]"
        >
          <ProductCard
            product={product}
            index={idx}
            disableReveal
            isAdding={addingProductId === product.id}
            justAdded={justAddedProductId === product.id}
            isWishlisted={wishlistIds.includes(product.id)}
            onToggleWishlist={onToggleWishlist}
            isCompared={compareIds.includes(product.id)}
            onToggleCompare={onToggleCompare}
            onSelectProduct={onSelectProduct}
            onQuickView={onQuickView}
            onSelectCategoryId={onSelectCategoryId}
            onAddToCart={onAddToCart}
          />
        </div>
      ))}
    </div>
  );

  return (
    <section id="new-arrivals-section" className="bg-white py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Left / Right Arrow Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.45, ease: easeCurve }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7"
        >
          <div>
            <p className="text-[12.5px] font-mono font-semibold text-[#122B5C] mb-1.5">
              {eyebrowText}
            </p>
            <h2 className="type-h2 text-[#0B0F19]">{headingText}</h2>
            <p className="type-body text-[#5A6275] mt-1 max-w-xl">
              {catDescription ||
                'Freshly added arrivals curated for USA shoppers. Hover to pause or step through the row.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onViewAllArrivals}
              className="h-10 px-4 rounded-full border border-[#E2E5EC] bg-white hover:bg-[#0B0F19] hover:text-white text-[#0B0F19] text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            {shouldLoop && (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => scrollTrack('left')}
                  aria-label="Scroll New Arrivals left"
                  className="w-10 h-10 rounded-full border bg-white border-[#E2E5EC] text-[#0B0F19] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollTrack('right')}
                  aria-label="Scroll New Arrivals right"
                  className="w-10 h-10 rounded-full border bg-white border-[#E2E5EC] text-[#0B0F19] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Loading State (Single Horizontal Row of 4) */}
        {loading && visibleArrivals.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#E2E5EC] p-3.5 animate-pulse"
              >
                <div className="aspect-[4/4.2] bg-[#F4F5F8] rounded-xl mb-3" />
                <div className="h-3 w-1/2 bg-[#F4F5F8] rounded mb-2" />
                <div className="h-4 w-4/5 bg-[#F4F5F8] rounded mb-3" />
                <div className="h-9 w-full bg-[#F4F5F8] rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Continuous Seamless Horizontal Auto-Scroll Track */}
            <div
              ref={trackRef}
              onScroll={updateScrollState}
              onMouseEnter={() => {
                if (resumeTimerRef.current !== null) {
                  window.clearTimeout(resumeTimerRef.current);
                  resumeTimerRef.current = null;
                }
                pausedRef.current = true;
              }}
              onMouseLeave={() => {
                pausedRef.current = false;
              }}
              onTouchStart={() => {
                if (resumeTimerRef.current !== null) {
                  window.clearTimeout(resumeTimerRef.current);
                  resumeTimerRef.current = null;
                }
                pausedRef.current = true;
              }}
              onTouchEnd={() => {
                scheduleResume(1400);
              }}
              onFocusCapture={() => {
                pausedRef.current = true;
              }}
              onBlurCapture={() => {
                pausedRef.current = false;
              }}
              className="flex flex-nowrap overflow-x-auto no-scrollbar py-2"
            >
              {renderCardGroup(0)}
              {shouldLoop && renderCardGroup(1)}
            </div>

            {/* Subtle Scroll Progress Track */}
            {visibleArrivals.length > 1 && (
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex-1 h-1 rounded-full bg-[#ECEEF2] overflow-hidden">
                  <div
                    className="h-full bg-[#0B0F19] rounded-full"
                    style={{
                      width: '28%',
                      transform: `translateX(${Math.round(scrollProgress * 257)}%)`,
                    }}
                  />
                </div>
                <span className="text-[11.5px] font-mono text-[#5A6275] tabular-nums shrink-0">
                  {visibleArrivals.length} newest drops
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
