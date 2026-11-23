import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  ExternalLink,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Star,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import type {
  MetaProductSyncStatusRecord,
  ProductPlacement,
} from '../../types/admin';
import type { WcCategory, WcProduct } from '../../types/woocommerce';
import {
  decodeHtmlEntities,
  formatWcDecimalPrice,
  getRegularComparePrice,
} from '../../utils/format';

export interface BulkMetaSyncProgress {
  active: boolean;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  currentProductName: string;
  errors: Array<{ productName: string; message: string }>;
}

interface AdminProductsTabProps {
  products: WcProduct[];
  categories: WcCategory[];
  placements: Record<number, ProductPlacement>;
  metaSyncStatuses: Record<string, MetaProductSyncStatusRecord>;
  syncingMetaIds: Set<number>;
  removingMetaIds: Set<number>;
  bulkMetaProgress: BulkMetaSyncProgress | null;
  syncedAt: string | null;
  loading: boolean;
  error: string | null;
  initialCategoryFilter: number | 'all';
  savingProductId: number | null;
  bulkSaving: boolean;
  onRefreshCatalog: () => void;
  onInspectVariations: (product: WcProduct) => void;
  onTogglePlacement: (
    productId: number,
    patch: { featured?: boolean; hidden?: boolean }
  ) => void;
  onBulkPlacement: (
    productIds: number[],
    patch: { featured?: boolean; hidden?: boolean }
  ) => void;
  onSyncProductToMeta: (product: WcProduct) => void;
  onRemoveProductFromMeta: (product: WcProduct) => void;
  onBulkSyncToMeta: (productsToSync: WcProduct[]) => void;
  onDismissBulkMetaProgress: () => void;
}

type StockFilter = 'all' | 'instock' | 'outofstock' | 'onbackorder';
type TypeFilter = 'all' | 'variable' | 'simple';
type PlacementFilter = 'all' | 'featured' | 'visible' | 'hidden';
type MetaFilter = 'all' | 'synced' | 'unsynced' | 'error';

function stockPill(status: string): { label: string; classes: string } {
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

export const AdminProductsTab: React.FC<AdminProductsTabProps> = ({
  products,
  categories,
  placements,
  metaSyncStatuses,
  syncingMetaIds,
  removingMetaIds,
  bulkMetaProgress,
  syncedAt,
  loading,
  error,
  initialCategoryFilter,
  savingProductId,
  bulkSaving,
  onRefreshCatalog,
  onInspectVariations,
  onTogglePlacement,
  onBulkPlacement,
  onSyncProductToMeta,
  onRemoveProductFromMeta,
  onBulkSyncToMeta,
  onDismissBulkMetaProgress,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>(
    initialCategoryFilter
  );
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [placementFilter, setPlacementFilter] =
    useState<PlacementFilter>('all');
  const [metaFilter, setMetaFilter] = useState<MetaFilter>('all');
  const [pageSize, setPageSize] = useState<25 | 50>(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmRemoveProduct, setConfirmRemoveProduct] =
    useState<WcProduct | null>(null);

  useEffect(() => {
    setCategoryFilter(initialCategoryFilter);
    setCurrentPage(1);
  }, [initialCategoryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchQuery,
    categoryFilter,
    stockFilter,
    typeFilter,
    placementFilter,
    metaFilter,
    pageSize,
  ]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all') {
        const inCat = (p.categories || []).some((c) => c.id === categoryFilter);
        if (!inCat) return false;
      }

      if (stockFilter !== 'all' && p.stock_status !== stockFilter) {
        return false;
      }

      const isVar =
        p.type === 'variable' || (p.variations && p.variations.length > 0);
      if (typeFilter === 'variable' && !isVar) return false;
      if (typeFilter === 'simple' && isVar) return false;

      const pl = placements[p.id];
      const isFeatured = Boolean(pl?.featured);
      const isHidden = Boolean(pl?.hidden);
      if (placementFilter === 'featured' && !isFeatured) return false;
      if (placementFilter === 'hidden' && !isHidden) return false;
      if (placementFilter === 'visible' && isHidden) return false;

      const metaRec = metaSyncStatuses[String(p.id)];
      if (metaFilter === 'synced' && metaRec?.status !== 'synced') return false;
      if (metaFilter === 'error' && metaRec?.status !== 'error') return false;
      if (metaFilter === 'unsynced' && metaRec?.status === 'synced') return false;

      if (q) {
        const title = decodeHtmlEntities(p.name).toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const idStr = String(p.id);
        const strippedQ = q.startsWith('#') ? q.slice(1) : q;
        if (
          !title.includes(q) &&
          !sku.includes(q) &&
          !idStr.includes(strippedQ)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    products,
    categoryFilter,
    stockFilter,
    typeFilter,
    placementFilter,
    metaFilter,
    placements,
    metaSyncStatuses,
    searchQuery,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, safePage, pageSize]);

  const allFilteredIds = useMemo(
    () => filteredProducts.map((p) => p.id),
    [filteredProducts]
  );

  const allPageSelected =
    pageProducts.length > 0 &&
    pageProducts.every((p) => selectedIds.has(p.id));

  const allFilteredSelected =
    allFilteredIds.length > 0 &&
    allFilteredIds.every((id) => selectedIds.has(id));

  const toggleRowSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageSelect = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const p of pageProducts) next.delete(p.id);
      } else {
        for (const p of pageProducts) next.add(p.id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.has(p.id)),
    [products, selectedIds]
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    categoryFilter !== 'all' ||
    stockFilter !== 'all' ||
    typeFilter !== 'all' ||
    placementFilter !== 'all' ||
    metaFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setStockFilter('all');
    setTypeFilter('all');
    setPlacementFilter('all');
    setMetaFilter('all');
  };

  const formattedSync = syncedAt
    ? new Date(syncedAt).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Syncing...';

  const isBulkMetaActive = Boolean(bulkMetaProgress?.active);

  return (
    <div className="space-y-5">
      {/* Live Sync Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#E2E5EC]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[12px] font-mono text-[#5A6275] mb-1 tabular-nums">
            <span className="font-semibold text-[#122B5C]">
              100% Live WooCommerce Catalog
            </span>
            <span aria-hidden="true">·</span>
            <span>{products.length} Products Loaded</span>
            <span aria-hidden="true">·</span>
            <span>Last Synced {formattedSync}</span>
          </div>
          <h1 className="font-heading font-bold text-[26px] sm:text-[30px] text-[#0B0F19] leading-tight">
            WooCommerce Products
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={toggleSelectAllFiltered}
            disabled={filteredProducts.length === 0}
            className="h-10 px-3.5 rounded-xl bg-white hover:bg-[#F4F5F8] border border-[#E2E5EC] disabled:opacity-50 text-[#0B0F19] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {allFilteredSelected
              ? 'Clear Selection'
              : `Select All Filtered (${filteredProducts.length})`}
          </button>

          <button
            type="button"
            onClick={() => onBulkSyncToMeta(filteredProducts)}
            disabled={filteredProducts.length === 0 || isBulkMetaActive}
            className="h-10 px-4 rounded-xl bg-[#122B5C] hover:bg-[#0B0F19] disabled:opacity-55 text-white text-[13px] font-heading font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isBulkMetaActive ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CloudUpload className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {isBulkMetaActive
                ? `Syncing ${bulkMetaProgress?.completed}/${bulkMetaProgress?.total}...`
                : `Bulk Sync All (${filteredProducts.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={onRefreshCatalog}
            disabled={loading}
            className="h-10 px-4 rounded-xl bg-[#0B0F19] hover:bg-[#E54826] disabled:opacity-60 text-white text-[13.5px] font-heading font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh from WooCommerce</span>
          </button>
        </div>
      </div>

      {/* Bulk Meta Sync Progress & Summary Banner */}
      {bulkMetaProgress && (
        <div className="rounded-2xl bg-white border border-[#E2E5EC] p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {bulkMetaProgress.active ? (
                <Loader2
                  className="w-4 h-4 animate-spin text-[#122B5C] shrink-0"
                  aria-hidden="true"
                />
              ) : bulkMetaProgress.failed > 0 ? (
                <AlertCircle
                  className="w-4 h-4 text-[#D97706] shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  className="w-4 h-4 text-[#16A34A] shrink-0"
                  aria-hidden="true"
                />
              )}
              <p className="text-[13.5px] font-semibold text-[#0B0F19]">
                {bulkMetaProgress.active
                  ? `Bulk Syncing to Meta Catalog (${bulkMetaProgress.completed} of ${bulkMetaProgress.total}): ${bulkMetaProgress.currentProductName}`
                  : `Bulk Meta Sync Complete — ${bulkMetaProgress.succeeded} succeeded, ${bulkMetaProgress.failed} failed`}
              </p>
            </div>

            {!bulkMetaProgress.active && (
              <button
                type="button"
                onClick={onDismissBulkMetaProgress}
                className="text-[12.5px] font-semibold text-[#5A6275] hover:text-[#0B0F19] cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>

          <div className="w-full h-2 rounded-full bg-[#ECEEF2] overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                bulkMetaProgress.failed > 0 && !bulkMetaProgress.active
                  ? 'bg-[#D97706]'
                  : 'bg-[#16A34A]'
              }`}
              style={{
                width: `${
                  bulkMetaProgress.total > 0
                    ? Math.round(
                        (bulkMetaProgress.completed / bulkMetaProgress.total) *
                          100
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          {bulkMetaProgress.errors.length > 0 && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-[12.5px] text-red-700 space-y-1 max-h-32 overflow-y-auto">
              {bulkMetaProgress.errors.slice(0, 6).map((errItem, idx) => (
                <p key={`${errItem.productName}-${idx}`}>
                  <span className="font-semibold">{errItem.productName}:</span>{' '}
                  {errItem.message}
                </p>
              ))}
              {bulkMetaProgress.errors.length > 6 && (
                <p className="font-mono text-[11.5px]">
                  + {bulkMetaProgress.errors.length - 6} more errors
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedArray.length > 0 && (
        <div className="rounded-2xl bg-[#0B0F19] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[13.5px]">
            <span className="font-mono font-bold tabular-nums">
              {selectedArray.length} selected
            </span>
            <span className="text-white/40" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-white/75 hover:text-white underline underline-offset-4 text-[13px] cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkSaving}
              onClick={() =>
                onBulkPlacement(selectedArray, { featured: true })
              }
              className="h-9 px-3.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Star className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Mark Featured</span>
            </button>
            <button
              type="button"
              disabled={bulkSaving}
              onClick={() =>
                onBulkPlacement(selectedArray, { hidden: false })
              }
              className="h-9 px-3.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Show on Storefront</span>
            </button>
            <button
              type="button"
              disabled={bulkSaving}
              onClick={() =>
                onBulkPlacement(selectedArray, { hidden: true })
              }
              className="h-9 px-3.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Hide from Storefront</span>
            </button>
            <button
              type="button"
              disabled={isBulkMetaActive || selectedProducts.length === 0}
              onClick={() => onBulkSyncToMeta(selectedProducts)}
              className="h-9 px-3.5 rounded-lg bg-[#E54826] hover:bg-[#CC3B1C] disabled:opacity-60 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sync Selected to Meta ({selectedProducts.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-[#E2E5EC] p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search
              className="w-4 h-4 text-[#5A6275] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Title, SKU, or #ID..."
              aria-label="Search WooCommerce products"
              className="w-full h-10 pl-10 pr-9 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] focus:bg-white text-[13.5px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A6275] hover:text-[#0B0F19] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="sr-only" htmlFor="admin-cat-filter">
              Filter by WooCommerce Category
            </label>
            <select
              id="admin-cat-filter"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value === 'all' ? 'all' : Number(e.target.value)
                )
              }
              className="w-full h-10 px-3 rounded-xl border border-[#E2E5EC] bg-white text-[13px] font-medium text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {decodeHtmlEntities(cat.name)} ({cat.count})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="sr-only" htmlFor="admin-stock-filter">
              Filter by Stock Status
            </label>
            <select
              id="admin-stock-filter"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as StockFilter)}
              className="w-full h-10 px-3 rounded-xl border border-[#E2E5EC] bg-white text-[13px] font-medium text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
            >
              <option value="all">Stock: All</option>
              <option value="instock">In Stock</option>
              <option value="outofstock">Out of Stock</option>
              <option value="onbackorder">On Backorder</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="sr-only" htmlFor="admin-type-filter">
              Filter by Product Type
            </label>
            <select
              id="admin-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="w-full h-10 px-3 rounded-xl border border-[#E2E5EC] bg-white text-[13px] font-medium text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
            >
              <option value="all">Type: All</option>
              <option value="variable">Variable</option>
              <option value="simple">Simple</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="sr-only" htmlFor="admin-meta-filter">
              Filter by Meta Sync Status
            </label>
            <select
              id="admin-meta-filter"
              value={metaFilter}
              onChange={(e) => setMetaFilter(e.target.value as MetaFilter)}
              className="w-full h-10 px-3 rounded-xl border border-[#E2E5EC] bg-white text-[13px] font-medium text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
            >
              <option value="all">Meta: All</option>
              <option value="synced">Meta Synced</option>
              <option value="unsynced">Not Synced</option>
              <option value="error">Sync Errors</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E5EC] text-[12.5px] text-[#5A6275]">
          <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
            <span>
              Showing {pageProducts.length} of {filteredProducts.length}{' '}
              matching products
            </span>
            <select
              aria-label="Filter by storefront placement"
              value={placementFilter}
              onChange={(e) =>
                setPlacementFilter(e.target.value as PlacementFilter)
              }
              className="h-7 px-2 rounded-lg border border-[#E2E5EC] bg-[#F4F5F8] font-sans text-[12px] text-[#0B0F19]"
            >
              <option value="all">Placement: All</option>
              <option value="visible">Visible on Store</option>
              <option value="featured">Featured Only</option>
              <option value="hidden">Hidden Only</option>
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="font-sans font-semibold text-[#E54826] hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="admin-page-size" className="text-[#5A6275]">
              Rows per page:
            </label>
            <select
              id="admin-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as 25 | 50)}
              className="h-8 px-2.5 rounded-lg border border-[#E2E5EC] bg-[#F4F5F8] text-[12.5px] font-mono text-[#0B0F19]"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3 text-[13.5px] text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold">WooCommerce Sync Error</p>
              <p>{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefreshCatalog}
            className="h-9 px-4 rounded-lg bg-[#0B0F19] text-white text-[13px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* High-Density Product Table */}
      <div className="bg-white rounded-2xl border border-[#E2E5EC] overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-14 rounded-xl bg-[#F4F5F8] animate-pulse"
              />
            ))}
          </div>
        ) : pageProducts.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-9 h-9 text-[#5A6275] mx-auto mb-3" />
            <p className="font-heading font-semibold text-[16px] text-[#0B0F19] mb-1">
              No WooCommerce products match these filters
            </p>
            <p className="text-[13.5px] text-[#5A6275] mb-4">
              Try adjusting your search query or clearing your active filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 px-4 rounded-xl bg-[#0B0F19] hover:bg-[#E54826] text-white text-[13px] font-semibold cursor-pointer transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1220px]">
              <thead>
                <tr className="border-b border-[#E2E5EC] bg-[#F4F5F8] text-[12px] font-semibold text-[#5A6275]">
                  <th className="py-3 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={togglePageSelect}
                      aria-label="Select all products on this page"
                      className="w-4 h-4 rounded border-[#CBD5E1] accent-[#0B0F19] cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Categories</th>
                  <th className="py-3 px-3 text-right">Price</th>
                  <th className="py-3 px-3">Stock</th>
                  <th className="py-3 px-3">Variations</th>
                  <th className="py-3 px-3">Meta Catalog Status</th>
                  <th className="py-3 px-3">Placement</th>
                  <th className="py-3 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5EC] text-[13.5px]">
                {pageProducts.map((p) => {
                  const title = decodeHtmlEntities(p.name);
                  const liveUrl = `https://www.fiftydollarshop.com/product/${encodeURIComponent(p.slug)}/`;
                  const imgSrc = p.images?.[0]?.src || '';
                  const stock = stockPill(p.stock_status);
                  const variationCount = p.variations?.length ?? 0;
                  const isVariable =
                    p.type === 'variable' || variationCount > 0;
                  const pl = placements[p.id];
                  const isFeatured = Boolean(pl?.featured);
                  const isHidden = Boolean(pl?.hidden);
                  const isSavingRow = savingProductId === p.id;
                  const checked = selectedIds.has(p.id);

                  const metaStatus = metaSyncStatuses[String(p.id)];
                  const isSyncingMeta = syncingMetaIds.has(p.id);
                  const isRemovingMeta = removingMetaIds.has(p.id);
                  const isMetaSynced = metaStatus?.status === 'synced';
                  const isMetaError = metaStatus?.status === 'error';

                  const activeSalePrice = p.sale_price
                    ? formatWcDecimalPrice(p.sale_price)
                    : null;
                  const displayPrice = formatWcDecimalPrice(
                    p.sale_price || p.price || p.regular_price || '50'
                  );
                  const regularCompare = getRegularComparePrice(p);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#F4F5F8]/70 transition-colors ${
                        isHidden ? 'bg-[#F4F5F8]/50 opacity-75' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-4 pr-2 align-middle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRowSelect(p.id)}
                          aria-label={`Select ${title}`}
                          className="w-4 h-4 rounded border-[#CBD5E1] accent-[#0B0F19] cursor-pointer"
                        />
                      </td>

                      {/* Product Thumbnail + Title + #ID + SKU + Live Link */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] overflow-hidden flex items-center justify-center shrink-0">
                            {imgSrc ? (
                              <img
                                src={imgSrc}
                                alt={title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-[#5A6275]" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-[260px]">
                            <a
                              href={liveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-heading font-semibold text-[13.5px] text-[#0B0F19] hover:text-[#E54826] transition-colors line-clamp-1 inline-flex items-center gap-1"
                              title={title}
                            >
                              <span className="truncate">{title}</span>
                              <ExternalLink
                                className="w-3 h-3 shrink-0 text-[#5A6275]"
                                aria-hidden="true"
                              />
                            </a>
                            <div className="flex items-center gap-1.5 text-[11.5px] font-mono text-[#5A6275] tabular-nums mt-0.5">
                              <span>#{p.id}</span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">
                                SKU: {p.sku || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* WooCommerce Categories */}
                      <td className="py-3.5 px-3 align-middle">
                        <div className="text-[12.5px] text-[#0B0F19] max-w-[160px]">
                          {p.categories && p.categories.length > 0
                            ? p.categories
                                .map((c) => decodeHtmlEntities(c.name))
                                .join(' · ')
                            : '—'}
                        </div>
                      </td>

                      {/* Exact Storefront Price Formatting */}
                      <td className="py-3.5 px-3 align-middle text-right font-mono tabular-nums whitespace-nowrap">
                        <p className="font-bold text-[14px] text-[#0B0F19]">
                          {activeSalePrice || displayPrice}
                        </p>
                        {regularCompare ? (
                          <p className="text-[11.5px] text-[#5A6275] line-through">
                            {regularCompare}
                          </p>
                        ) : p.regular_price ? (
                          <p className="text-[11.5px] text-[#5A6275]">
                            Reg {formatWcDecimalPrice(p.regular_price)}
                          </p>
                        ) : null}
                      </td>

                      {/* Stock Status Pill + Qty */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11.5px] font-semibold ${stock.classes}`}
                        >
                          {stock.label}
                        </span>
                        {typeof p.stock_quantity === 'number' && (
                          <p className="text-[11px] font-mono text-[#5A6275] mt-1 tabular-nums">
                            Qty: {p.stock_quantity}
                          </p>
                        )}
                      </td>

                      {/* Variations Trigger Badge */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onInspectVariations(p)}
                          className={`h-8 px-2.5 rounded-lg border text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer tabular-nums ${
                            isVariable
                              ? 'border-[#122B5C]/25 bg-[#122B5C]/5 text-[#122B5C] hover:bg-[#122B5C] hover:text-white'
                              : 'border-[#E2E5EC] bg-[#F4F5F8] text-[#5A6275] hover:border-[#0B0F19] hover:text-[#0B0F19]'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {isVariable
                              ? `${variationCount || '1+'} ${variationCount === 1 ? 'variant' : 'variants'}`
                              : 'Simple'}
                          </span>
                        </button>
                      </td>

                      {/* Meta Catalog & Shop Sync Status Badge */}
                      <td className="py-3.5 px-3 align-middle">
                        {isMetaSynced ? (
                          <div className="space-y-0.5 max-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#16A34A]/25 bg-[#16A34A]/10 text-[#15803D] text-[11px] font-semibold whitespace-nowrap">
                                <CheckCircle2
                                  className="w-3 h-3"
                                  aria-hidden="true"
                                />
                                <span>
                                  Synced ({metaStatus.variantCount}{' '}
                                  {metaStatus.variantCount === 1
                                    ? 'item'
                                    : 'variants'}
                                  )
                                </span>
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-[#5A6275] truncate">
                              {new Date(metaStatus.updatedAt).toLocaleString(
                                [],
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )}
                              {metaStatus.categorySetName
                                ? ` · ${metaStatus.categorySetName}`
                                : ''}
                            </p>
                            {metaStatus.shopPublished && (
                              <p className="text-[11px] font-semibold text-[#122B5C] inline-flex items-center gap-1">
                                <Store
                                  className="w-3 h-3"
                                  aria-hidden="true"
                                />
                                <span>Published to Meta Shop</span>
                              </p>
                            )}
                          </div>
                        ) : isMetaError ? (
                          <div
                            className="space-y-0.5 max-w-[210px]"
                            title={metaStatus.errorMessage}
                          >
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#DC2626]/25 bg-[#DC2626]/10 text-[#B91C1C] text-[11px] font-semibold">
                              <AlertCircle
                                className="w-3 h-3"
                                aria-hidden="true"
                              />
                              <span>Sync Error</span>
                            </span>
                            <p className="text-[11px] text-[#B91C1C] line-clamp-2">
                              {metaStatus.errorMessage || 'Check Meta settings'}
                            </p>
                          </div>
                        ) : metaStatus?.status === 'removed' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-[#E2E5EC] bg-[#F4F5F8] text-[#5A6275] text-[11px] font-semibold">
                              Removed from Meta
                            </span>
                            <p className="text-[11px] font-mono text-[#5A6275]">
                              Ready to re-sync
                            </p>
                          </div>
                        ) : (
                          <span className="text-[12px] font-mono text-[#5A6275]">
                            Not Synced
                          </span>
                        )}
                      </td>

                      {/* Non-destructive Storefront Placement Toggles */}
                      <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isSavingRow}
                            onClick={() =>
                              onTogglePlacement(p.id, { featured: !isFeatured })
                            }
                            title={
                              isFeatured
                                ? 'Remove Featured pin'
                                : 'Pin as Featured on Storefront'
                            }
                            aria-label={
                              isFeatured
                                ? `Unfeature ${title}`
                                : `Feature ${title}`
                            }
                            className={`h-8 px-2 rounded-lg border text-[12px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                              isFeatured
                                ? 'bg-[#D97706]/10 border-[#D97706]/35 text-[#B45309]'
                                : 'bg-white border-[#E2E5EC] text-[#5A6275] hover:text-[#0B0F19]'
                            }`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${isFeatured ? 'fill-[#D97706] text-[#D97706]' : ''}`}
                              aria-hidden="true"
                            />
                          </button>

                          <button
                            type="button"
                            disabled={isSavingRow}
                            onClick={() =>
                              onTogglePlacement(p.id, { hidden: !isHidden })
                            }
                            title={
                              isHidden
                                ? 'Restore product to Storefront'
                                : 'Hide product from Storefront (non-destructive)'
                            }
                            aria-label={
                              isHidden ? `Show ${title}` : `Hide ${title}`
                            }
                            className={`h-8 px-2.5 rounded-lg border text-[12px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                              isHidden
                                ? 'bg-[#DC2626]/10 border-[#DC2626]/30 text-[#B91C1C]'
                                : 'bg-white border-[#E2E5EC] text-[#5A6275] hover:text-[#0B0F19]'
                            }`}
                          >
                            {isHidden ? (
                              <EyeOff
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                            ) : (
                              <Eye
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                            )}
                            <span>{isHidden ? 'Hidden' : 'Live'}</span>
                          </button>
                        </div>
                      </td>

                      {/* Dedicated Meta Sync + Remove + Variations + View Live Actions */}
                      <td className="py-3.5 pl-3 pr-5 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isSyncingMeta || isRemovingMeta || isBulkMetaActive}
                            onClick={() => onSyncProductToMeta(p)}
                            className={`h-8 px-3 rounded-lg text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${
                              isMetaSynced
                                ? 'border border-[#122B5C]/30 bg-[#122B5C]/8 text-[#122B5C] hover:bg-[#122B5C] hover:text-white'
                                : 'bg-[#0B0F19] hover:bg-[#E54826] text-white'
                            }`}
                          >
                            {isSyncingMeta ? (
                              <Loader2
                                className="w-3.5 h-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <CloudUpload
                                className="w-3.5 h-3.5"
                                aria-hidden="true"
                              />
                            )}
                            <span>
                              {isSyncingMeta
                                ? 'Syncing...'
                                : isMetaSynced
                                  ? 'Re-Sync'
                                  : 'Sync to Meta'}
                            </span>
                          </button>

                          {isMetaSynced && (
                            <button
                              type="button"
                              disabled={isRemovingMeta || isSyncingMeta || isBulkMetaActive}
                              onClick={() => setConfirmRemoveProduct(p)}
                              title="Remove from Meta Catalog only (keeps website & WooCommerce untouched)"
                              aria-label={`Remove ${title} from Meta Catalog`}
                              className="h-8 px-2.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 text-[12px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-60"
                            >
                              {isRemovingMeta ? (
                                <Loader2
                                  className="w-3.5 h-3.5 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Trash2
                                  className="w-3.5 h-3.5"
                                  aria-hidden="true"
                                />
                              )}
                              <span>Remove</span>
                            </button>
                          )}

                          <a
                            href={liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View Live Product Page"
                            aria-label={`View ${title} live on storefront`}
                            className="h-8 px-2.5 rounded-lg border border-[#E2E5EC] bg-[#F4F5F8] hover:border-[#0B0F19] text-[#0B0F19] text-[12px] font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <ExternalLink
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredProducts.length > 0 && (
          <div className="px-5 py-3.5 border-t border-[#E2E5EC] bg-[#F4F5F8] flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#5A6275]">
            <span className="font-mono tabular-nums">
              Page {safePage} of {totalPages} · {filteredProducts.length} total
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 rounded-lg border border-[#E2E5EC] bg-white hover:border-[#0B0F19] disabled:opacity-45 text-[#0B0F19] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="h-8 px-3 rounded-lg border border-[#E2E5EC] bg-white hover:border-[#0B0F19] disabled:opacity-45 text-[#0B0F19] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clean In-App Remove-from-Meta Confirmation Dialog */}
      {confirmRemoveProduct && (
        <div
          className="fixed inset-0 z-50 bg-[#0B0F19]/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-meta-remove-title"
        >
          <div className="bg-white rounded-2xl border border-[#E2E5EC] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11.5px] font-mono text-[#DC2626] font-semibold mb-1">
                  Meta Catalog Removal Only
                </p>
                <h2
                  id="confirm-meta-remove-title"
                  className="font-heading font-bold text-[18px] text-[#0B0F19]"
                >
                  Remove product from Meta Catalog?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRemoveProduct(null)}
                aria-label="Cancel removal"
                className="w-8 h-8 rounded-lg hover:bg-[#F4F5F8] flex items-center justify-center text-[#5A6275] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[13.5px] text-[#5A6275] leading-relaxed">
              This will delete{' '}
              <span className="font-semibold text-[#0B0F19]">
                {decodeHtmlEntities(confirmRemoveProduct.name)}
              </span>{' '}
              and all of its synced variants from your Meta Commerce Catalog and
              Meta Shop. Your live website and WooCommerce catalog will remain
              completely untouched, and you can re-sync it anytime.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveProduct(null)}
                className="h-9 px-4 rounded-xl border border-[#E2E5EC] bg-white hover:bg-[#F4F5F8] text-[#0B0F19] text-[13px] font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmRemoveProduct;
                  setConfirmRemoveProduct(null);
                  onRemoveProductFromMeta(target);
                }}
                className="h-9 px-4 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Remove from Meta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
