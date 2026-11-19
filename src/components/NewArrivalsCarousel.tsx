import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const visibleArrivals = products;
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
    const maxScroll = Math.max(el.scrollWidth - el.clientWidth, 0);
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < maxScroll - 8);
    setScrollProgress(maxScroll > 0 ? Math.min(el.scrollLeft / maxScroll, 1) : 0);
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [updateScrollState, visibleArrivals.length]);

  const scrollTrack = (direction: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.78, 300);
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });
  };

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
                'Freshly added arrivals curated for USA shoppers. Scroll or step through the row.'}
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

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollTrack('left')}
                disabled={!canScrollLeft}
                aria-label="Scroll New Arrivals left"
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                  canScrollLeft
                    ? 'bg-white border-[#E2E5EC] text-[#0B0F19] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19]'
                    : 'bg-[#F4F5F8] border-[#E2E5EC] text-[#5A6275]/40 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollTrack('right')}
                disabled={!canScrollRight}
                aria-label="Scroll New Arrivals right"
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                  canScrollRight
                    ? 'bg-white border-[#E2E5EC] text-[#0B0F19] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19]'
                    : 'bg-[#F4F5F8] border-[#E2E5EC] text-[#5A6275]/40 cursor-not-allowed'
                }`}
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
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
            {/* Strictly One Single Horizontal Row */}
            <div
              ref={trackRef}
              onScroll={updateScrollState}
              className="flex flex-nowrap gap-5 sm:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar pb-2"
            >
              {visibleArrivals.map((product, idx) => (
                <div
                  key={product.id}
                  className="snap-start shrink-0 w-[82%] sm:w-[calc((100%-24px)/2)] lg:w-[calc((100%-72px)/4)]"
                >
                  <ProductCard
                    product={product}
                    index={idx}
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

            {/* Subtle Scroll Progress Track */}
            {visibleArrivals.length > 4 && (
              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="flex-1 h-1 rounded-full bg-[#ECEEF2] overflow-hidden">
                  <div
                    className="h-full bg-[#0B0F19] rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.max(25, Math.round((4 / visibleArrivals.length) * 100))}%`,
                      marginLeft: `${Math.round(
                        scrollProgress * (100 - Math.max(25, Math.round((4 / visibleArrivals.length) * 100)))
                      )}%`,
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
