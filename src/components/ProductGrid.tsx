import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, ArrowRight, ChevronDown, RefreshCw, Search, X } from 'lucide-react';
import type { WcCategory, WcProduct } from '../types/woocommerce';
import {
  COLLECTION_TABS,
  type CollectionFilter,
  GOINFOEV_TABS,
  type GoinfoevFilter,
  classifyGoinfoevCollection,
  classifyProductCollection,
  decodeHtmlEntities,
  stripHtmlToText,
} from '../utils/format';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  sectionId?: string;
  sectionBg?: 'white' | 'chalk';
  customEyebrow?: string;
  customTitle?: string;
  customDescription?: string;
  hideSubTabs?: boolean;
  products: WcProduct[];
  categories: WcCategory[];
  selectedCategoryId: number | 'all';
  isCategoryPage?: boolean;
  showCategorySelector?: boolean;
  gridColumns?: 3 | 4 | 5;
  initialVisibleCount?: number;
  loadMoreStep?: number;
  searchQuery: string;
  loading: boolean;
  error: string | null;
  addingProductId: number | null;
  justAddedProductId: number | null;
  wishlistIds?: number[];
  onToggleWishlist?: (product: WcProduct) => void;
  compareIds?: number[];
  onToggleCompare?: (product: WcProduct) => void;
  onSelectCategoryId: (catId: number | 'all') => void;
  onViewAllCategories: () => void;
  onViewFullCategory?: () => void;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  onSelectProduct: (product: WcProduct) => void;
  onQuickView?: (product: WcProduct) => void;
  onAddToCart: (
    product: WcProduct,
    variationId?: number,
    variationAttrs?: Array<{ attribute: string; value: string }>,
    selectedAttrsMap?: Record<string, string>
  ) => void;
}

const easeCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const ProductGrid: React.FC<ProductGridProps> = ({
  sectionId = 'catalog',
  sectionBg = 'white',
  customEyebrow,
  customTitle,
  customDescription,
  hideSubTabs = false,
  products,
  categories,
  selectedCategoryId,
  isCategoryPage = false,
  showCategorySelector = true,
  gridColumns = 4,
  initialVisibleCount = 8,
  loadMoreStep = 8,
  searchQuery,
  loading,
  error,
  addingProductId,
  justAddedProductId,
  wishlistIds = [],
  onToggleWishlist,
  compareIds = [],
  onToggleCompare,
  onSelectCategoryId,
  onViewAllCategories,
  onViewFullCategory,
  onSearchChange,
  onRefresh,
  onSelectProduct,
  onQuickView,
  onAddToCart,
}) => {
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [goinfoevFilter, setGoinfoevFilter] = useState<GoinfoevFilter>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'az' | 'newest'>('featured');
  const [visibleCount, setVisibleCount] = useState<number>(initialVisibleCount);

  useEffect(() => {
    setVisibleCount(initialVisibleCount);
  }, [initialVisibleCount, selectedCategoryId, collectionFilter, goinfoevFilter, searchQuery]);

  const activeCategory = useMemo(() => {
    if (selectedCategoryId === 'all') return null;
    return categories.find((c) => c.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const categoryTitle =
    customTitle ||
    (selectedCategoryId === 'all'
      ? 'All Store Products'
      : activeCategory
        ? decodeHtmlEntities(activeCategory.name)
        : 'Hot Selling 50$ Products');

  const categoryDescription =
    customDescription ??
    (activeCategory ? stripHtmlToText(activeCategory.description) : '');

  const isHotSelling =
    !hideSubTabs &&
    selectedCategoryId !== 'all' &&
    (activeCategory?.slug === 'hot-sale' ||
      categoryTitle.toLowerCase().includes('hot selling'));

  const isGoinfoev =
    !hideSubTabs &&
    selectedCategoryId !== 'all' &&
    (activeCategory?.slug === 'goinfoev' ||
      categoryTitle.toLowerCase().includes('goinfoev'));

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = products.filter((p) => {
      if (
        isHotSelling &&
        collectionFilter !== 'all' &&
        classifyProductCollection(p) !== collectionFilter
      ) {
        return false;
      }
      if (
        isGoinfoev &&
        goinfoevFilter !== 'all' &&
        classifyGoinfoevCollection(p) !== goinfoevFilter
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = `${decodeHtmlEntities(p.name)} ${p.sku || ''} ${p.id}`.toLowerCase();
      return haystack.includes(q);
    });

    if (sortBy === 'az') {
      list = [...list].sort((a, b) =>
        decodeHtmlEntities(a.name).localeCompare(decodeHtmlEntities(b.name))
      );
    } else if (sortBy === 'newest') {
      list = [...list].sort((a, b) => b.id - a.id);
    }
    return list;
  }, [
    products,
    isHotSelling,
    isGoinfoev,
    collectionFilter,
    goinfoevFilter,
    searchQuery,
    sortBy,
  ]);

  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const hasMore = visibleCount < filteredProducts.length;
  const remainingCount = Math.max(filteredProducts.length - visibleCount, 0);

  const handleResetFilters = () => {
    setCollectionFilter('all');
    setGoinfoevFilter('all');
    onSearchChange('');
  };

  const gridClasses =
    gridColumns === 5
      ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 xl:gap-5'
      : gridColumns === 4
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7';

  return (
    <section
      id={sectionId}
      className={`${sectionBg === 'chalk' ? 'bg-[#F4F5F8] border-y border-[#E2E5EC]' : 'bg-white'} py-12 sm:py-16`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {isCategoryPage && (
          <div className="mb-5">
            <button
              type="button"
              onClick={onViewAllCategories}
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0B0F19] hover:text-[#E54826] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>All Categories</span>
            </button>
          </div>
        )}

        {/* Reveal-on-Scroll Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.45, ease: easeCurve }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6"
        >
          <div>
            <p className="text-[12.5px] font-mono font-semibold text-[#122B5C] mb-1.5">
              {customEyebrow ||
                (selectedCategoryId === 'all'
                  ? 'Store Catalog · All Categories'
                  : `Curated Collection #${activeCategory?.id ?? selectedCategoryId}`)}
            </p>
            <h2 className="type-h2 text-[#0B0F19]">{categoryTitle}</h2>
            {categoryDescription && (
              <p className="type-body text-[#5A6275] mt-1.5 max-w-2xl">
                {categoryDescription}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {showCategorySelector && (
              <>
                <label className="sr-only" htmlFor={`wc-category-select-${sectionId}`}>
                  Select Store Category
                </label>
                <select
                  id={`wc-category-select-${sectionId}`}
                  value={selectedCategoryId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCollectionFilter('all');
                    setGoinfoevFilter('all');
                    onSelectCategoryId(val === 'all' ? 'all' : Number(val));
                  }}
                  className="h-10 px-3.5 rounded-full border border-[#E2E5EC] bg-[#F4F5F8] text-[13.5px] text-[#0B0F19] font-medium focus:outline-2 focus:outline-[#0B0F19] transition-colors"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {decodeHtmlEntities(cat.name)} ({cat.count})
                    </option>
                  ))}
                  <option value="all">All Categories</option>
                </select>
              </>
            )}

            <label className="sr-only" htmlFor={`catalog-sort-select-${sectionId}`}>
              Sort products
            </label>
            <select
              id={`catalog-sort-select-${sectionId}`}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'featured' | 'az' | 'newest')}
              className="h-10 px-3.5 rounded-full border border-[#E2E5EC] bg-white text-[13.5px] text-[#0B0F19] font-medium focus:outline-2 focus:outline-[#0B0F19] transition-colors"
            >
              <option value="featured">Sort: Featured</option>
              <option value="az">Sort: Name A–Z</option>
              <option value="newest">Sort: Newest</option>
            </select>

            {onViewFullCategory && (
              <button
                type="button"
                onClick={onViewFullCategory}
                className="h-10 px-4 rounded-full border border-[#E2E5EC] bg-white hover:bg-[#0B0F19] hover:text-white text-[#0B0F19] text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <span>Open Category</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onRefresh}
              disabled={loading}
              className="h-10 px-4 rounded-full border border-[#E2E5EC] bg-white hover:bg-[#F4F5F8] text-[#0B0F19] text-[13px] font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Sync Store</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Segmented Sub-Category Tabs + Inline Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#E2E5EC]">
          {!hideSubTabs ? (
            <div className="flex items-center gap-1 p-1 bg-[#ECEEF2] rounded-full overflow-x-auto">
              {isHotSelling ? (
                COLLECTION_TABS.map((tab) => {
                  const active = collectionFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCollectionFilter(tab.id)}
                      className={`relative px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        active ? 'text-white' : 'text-[#5A6275] hover:text-[#0B0F19]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId={`${sectionId}-hot-tab-bg`}
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          className="absolute inset-0 bg-[#0B0F19] rounded-full"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })
              ) : isGoinfoev ? (
                GOINFOEV_TABS.map((tab) => {
                  const active = goinfoevFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setGoinfoevFilter(tab.id)}
                      className={`relative px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        active ? 'text-white' : 'text-[#5A6275] hover:text-[#0B0F19]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId={`${sectionId}-go-tab-bg`}
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          className="absolute inset-0 bg-[#0B0F19] rounded-full"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })
              ) : (
                categories.map((cat) => {
                  const active = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCollectionFilter('all');
                        setGoinfoevFilter('all');
                        onSelectCategoryId(cat.id);
                      }}
                      className={`relative px-4 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        active ? 'text-white' : 'text-[#5A6275] hover:text-[#0B0F19]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId={`${sectionId}-cat-tab-bg`}
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          className="absolute inset-0 bg-[#0B0F19] rounded-full"
                        />
                      )}
                      <span className="relative z-10">
                        {decodeHtmlEntities(cat.name)} ({cat.count})
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <p className="text-[13.5px] font-medium text-[#5A6275]">
              Sorted by latest store additions
            </p>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="w-4 h-4 text-[#5A6275] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Filter by product name..."
                aria-label="Filter products by name"
                className="w-full h-10 pl-10 pr-8 rounded-full border border-[#E2E5EC] bg-white text-[13.5px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6275] hover:text-[#0B0F19]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="text-[12.5px] font-mono text-[#5A6275] whitespace-nowrap tabular-nums">
              {displayedProducts.length} of {filteredProducts.length}
            </span>
          </div>
        </div>

        {/* Error State */}
        {error && !loading && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center my-6">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" aria-hidden="true" />
            <p className="font-heading font-semibold text-[#0B0F19] mb-1">
              Unable to load store products
            </p>
            <p className="text-[14px] text-[#5A6275] mb-4">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="type-button px-6 py-2.5 rounded-full bg-[#0B0F19] text-white hover:bg-[#1D2433] cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && products.length === 0 && (
          <div className={gridClasses}>
            {Array.from({ length: initialVisibleCount }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#E2E5EC] p-3 animate-pulse"
              >
                <div className="aspect-[4/4.3] bg-[#F4F5F8] rounded-xl mb-3" />
                <div className="h-3 w-1/2 bg-[#F4F5F8] rounded mb-2" />
                <div className="h-4 w-4/5 bg-[#F4F5F8] rounded mb-3" />
                <div className="h-9 w-full bg-[#F4F5F8] rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredProducts.length === 0 && (
          <div className="rounded-2xl border border-[#E2E5EC] bg-white p-12 text-center">
            <p className="font-heading font-semibold text-[18px] text-[#0B0F19] mb-2">
              No products found in this view
            </p>
            <p className="type-body text-[#5A6275] mb-5">
              Try clearing your search filter or browsing another store category.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="type-button px-6 py-2.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* 4-Column Product Grid */}
        {!error && displayedProducts.length > 0 && (
          <>
            <div className={gridClasses}>
              {displayedProducts.map((product, idx) => (
                <ProductCard
                  key={product.id}
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
                  onSelectCategoryId={(catId) => onSelectCategoryId(catId)}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>

            {/* Load More / Show Less Pagination Bar */}
            {filteredProducts.length > initialVisibleCount && (
              <div className="mt-10 flex flex-col items-center gap-3">
                <p className="text-[12.5px] font-mono text-[#5A6275] tabular-nums">
                  Showing {displayedProducts.length} of {filteredProducts.length} live items
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {hasMore ? (
                    <motion.button
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setVisibleCount((prev) =>
                          Math.min(prev + loadMoreStep, filteredProducts.length)
                        )
                      }
                      className="type-button px-8 py-3.5 rounded-full bg-[#0B0F19] hover:bg-[#E54826] text-white inline-flex items-center gap-2 transition-colors cursor-pointer shadow-[0_14px_30px_-12px_rgba(11,15,25,0.35)]"
                    >
                      <span>
                        Load More Products (+{Math.min(loadMoreStep, remainingCount)})
                      </span>
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    </motion.button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setVisibleCount(initialVisibleCount)}
                      className="type-button px-7 py-3 rounded-full border border-[#E2E5EC] bg-white hover:border-[#0B0F19] text-[#0B0F19] transition-colors cursor-pointer"
                    >
                      Show Less
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
