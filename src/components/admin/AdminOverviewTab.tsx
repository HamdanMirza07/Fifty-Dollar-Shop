import React, { useMemo } from 'react';
import {
  ArrowRight,
  ExternalLink,
  FolderTree,
  Package,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import type {
  AdminOrder,
  AdminSection,
  MetaProductSyncStatusRecord,
  MetaSyncSummary,
  ProductPlacement,
} from '../../types/admin';
import type { WcCategory, WcProduct } from '../../types/woocommerce';
import { decodeHtmlEntities } from '../../utils/format';

interface AdminOverviewTabProps {
  products: WcProduct[];
  categories: WcCategory[];
  orders: AdminOrder[];
  placements: Record<number, ProductPlacement>;
  metaSyncStatuses: Record<string, MetaProductSyncStatusRecord>;
  syncedAt: string | null;
  loadingCatalog: boolean;
  onRefreshCatalog: () => void;
  onNavigateSection: (section: AdminSection) => void;
  onSelectCategoryFilter: (categoryId: number) => void;
  onOpenOrder: (order: AdminOrder) => void;
  onViewStorefront: () => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  products,
  categories,
  orders,
  placements,
  metaSyncStatuses,
  syncedAt,
  loadingCatalog,
  onRefreshCatalog,
  onNavigateSection,
  onSelectCategoryFilter,
  onOpenOrder,
  onViewStorefront,
}) => {
  const stats = useMemo(() => {
    let inStock = 0;
    let outOfStock = 0;
    let backorder = 0;
    let variableCount = 0;
    let simpleCount = 0;
    let hiddenCount = 0;
    let featuredCount = 0;

    for (const p of products) {
      if (p.stock_status === 'instock') inStock += 1;
      else if (p.stock_status === 'onbackorder') backorder += 1;
      else outOfStock += 1;

      const isVar =
        p.type === 'variable' || (p.variations && p.variations.length > 0);
      if (isVar) variableCount += 1;
      else simpleCount += 1;

      const pl = placements[p.id];
      if (pl?.hidden) hiddenCount += 1;
      if (pl?.featured) featuredCount += 1;
    }

    const totalRevenue = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((acc, o) => acc + (Number(o.total) || 0), 0);

    let syncedMeta = 0;
    let errorMeta = 0;
    let pendingMeta = 0;

    for (const p of products) {
      const rec = metaSyncStatuses[String(p.id)];
      if (rec?.status === 'synced') syncedMeta += 1;
      else if (rec?.status === 'error') errorMeta += 1;
      else if (!placements[p.id]?.hidden) pendingMeta += 1;
    }

    const metaSummary: MetaSyncSummary = {
      synced: syncedMeta,
      pending: pendingMeta,
      errors: errorMeta,
      statusLabel:
        errorMeta > 0
          ? `${errorMeta} Sync Error${errorMeta === 1 ? '' : 's'}`
          : syncedMeta > 0
            ? 'Live Sync Active'
            : 'Ready to Sync',
    };

    return {
      totalProducts: products.length,
      inStock,
      outOfStock,
      backorder,
      variableCount,
      simpleCount,
      hiddenCount,
      featuredCount,
      totalCategories: categories.length,
      totalOrders: orders.length,
      totalRevenue,
      metaSummary,
    };
  }, [products, categories, orders, placements, metaSyncStatuses]);

  const formattedSyncTime = syncedAt
    ? new Date(syncedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Not synced yet';

  return (
    <div className="space-y-8">
      {/* Header + Quick Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-[#E2E5EC]">
        <div>
          <p className="text-[12px] font-mono text-[#5A6275] mb-1">
            Live WooCommerce Operations · Last Synced {formattedSyncTime}
          </p>
          <h1 className="font-heading font-bold text-[26px] sm:text-[30px] text-[#0B0F19] leading-tight">
            Store Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onRefreshCatalog}
            disabled={loadingCatalog}
            className="h-10 px-4 rounded-xl bg-[#0B0F19] hover:bg-[#E54826] disabled:opacity-60 text-white text-[13.5px] font-heading font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingCatalog ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh Live WooCommerce Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateSection('products')}
            className="h-10 px-4 rounded-xl bg-white hover:bg-[#F4F5F8] border border-[#E2E5EC] text-[#0B0F19] text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Package className="w-4 h-4" aria-hidden="true" />
            <span>Go to Products</span>
          </button>

          <button
            type="button"
            onClick={onViewStorefront}
            className="h-10 px-4 rounded-xl bg-white hover:bg-[#F4F5F8] border border-[#E2E5EC] text-[#0B0F19] text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            <span>View Live Storefront</span>
          </button>
        </div>
      </div>

      {/* 6-Card Live KPI Ledger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* KPI 1: Total Live WooCommerce Products */}
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-[#5A6275]">
              Total Live WooCommerce Products
            </span>
            <span className="text-[12px] font-mono text-[#122B5C]">
              100% Live
            </span>
          </div>
          <p className="font-heading font-bold text-[32px] leading-none text-[#0B0F19] tabular-nums mb-2">
            {stats.totalProducts}
          </p>
          <p className="text-[12.5px] text-[#5A6275] tabular-nums">
            {stats.featuredCount} featured · {stats.hiddenCount} hidden from storefront
          </p>
        </div>

        {/* KPI 2: In Stock vs Out of Stock */}
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-[#5A6275]">
              Inventory Stock Health
            </span>
            <span className="text-[12px] font-mono text-[#16A34A] tabular-nums">
              {stats.totalProducts > 0
                ? `${Math.round((stats.inStock / stats.totalProducts) * 100)}% Available`
                : '—'}
            </span>
          </div>
          <div className="flex items-baseline gap-4 mb-2">
            <div>
              <span className="font-heading font-bold text-[32px] leading-none text-[#16A34A] tabular-nums">
                {stats.inStock}
              </span>
              <span className="text-[12.5px] text-[#5A6275] ml-1.5">In Stock</span>
            </div>
            <span className="text-[#E2E5EC]">/</span>
            <div>
              <span className="font-heading font-bold text-[24px] leading-none text-[#DC2626] tabular-nums">
                {stats.outOfStock}
              </span>
              <span className="text-[12.5px] text-[#5A6275] ml-1.5">Out</span>
            </div>
          </div>
          <p className="text-[12.5px] text-[#5A6275] tabular-nums">
            {stats.backorder} on backorder · Synced live from WooCommerce
          </p>
        </div>

        {/* KPI 3: Variable vs Simple Products */}
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-[#5A6275]">
              Catalog Structure (Type)
            </span>
            <span className="text-[12px] font-mono text-[#5A6275]">
              Variations
            </span>
          </div>
          <div className="flex items-baseline gap-4 mb-2">
            <div>
              <span className="font-heading font-bold text-[32px] leading-none text-[#0B0F19] tabular-nums">
                {stats.variableCount}
              </span>
              <span className="text-[12.5px] text-[#5A6275] ml-1.5">Variable</span>
            </div>
            <span className="text-[#E2E5EC]">/</span>
            <div>
              <span className="font-heading font-bold text-[24px] leading-none text-[#5A6275] tabular-nums">
                {stats.simpleCount}
              </span>
              <span className="text-[12.5px] text-[#5A6275] ml-1.5">Simple</span>
            </div>
          </div>
          <p className="text-[12.5px] text-[#5A6275]">
            Click any product&apos;s variations badge to inspect live attributes
          </p>
        </div>

        {/* KPI 4: Total WooCommerce Categories */}
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-[#5A6275]">
              Total WooCommerce Categories
            </span>
            <button
              type="button"
              onClick={() => onNavigateSection('categories')}
              className="text-[12px] font-semibold text-[#122B5C] hover:text-[#E54826] cursor-pointer"
            >
              View All
            </button>
          </div>
          <p className="font-heading font-bold text-[32px] leading-none text-[#0B0F19] tabular-nums mb-2">
            {stats.totalCategories}
          </p>
          <p className="text-[12.5px] text-[#5A6275] truncate">
            {categories.map((c) => decodeHtmlEntities(c.name)).join(' · ') ||
              'Loading store categories...'}
          </p>
        </div>

        {/* KPI 5: Storefront Orders & Total Revenue */}
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-[#5A6275]">
              Storefront Orders &amp; Revenue
            </span>
            <button
              type="button"
              onClick={() => onNavigateSection('orders')}
              className="text-[12px] font-semibold text-[#122B5C] hover:text-[#E54826] cursor-pointer"
            >
              Manage Orders
            </button>
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-heading font-bold text-[32px] leading-none text-[#0B0F19] tabular-nums">
              ${stats.totalRevenue.toFixed(2)}
            </span>
            <span className="text-[13px] font-mono text-[#5A6275] tabular-nums">
              ({stats.totalOrders} {stats.totalOrders === 1 ? 'order' : 'orders'})
            </span>
          </div>
          <p className="text-[12.5px] text-[#5A6275]">
            Live WooCommerce &amp; storefront checkout totals (USD)
          </p>
        </div>

        {/* KPI 6: Meta Catalog Sync Status (Ready for Next Integration) */}
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[13px] font-medium text-[#5A6275]">
              Meta Catalog Sync Status
            </span>
            <span className="text-[12px] font-mono font-semibold text-[#D97706]">
              {stats.metaSummary.statusLabel}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <p className="font-heading font-bold text-[22px] text-[#16A34A] tabular-nums leading-tight">
                {stats.metaSummary.synced}
              </p>
              <p className="text-[11.5px] text-[#5A6275]">Synced</p>
            </div>
            <div>
              <p className="font-heading font-bold text-[22px] text-[#0B0F19] tabular-nums leading-tight">
                {stats.metaSummary.pending}
              </p>
              <p className="text-[11.5px] text-[#5A6275]">Pending</p>
            </div>
            <div>
              <p className="font-heading font-bold text-[22px] text-[#DC2626] tabular-nums leading-tight">
                {stats.metaSummary.errors}
              </p>
              <p className="text-[11.5px] text-[#5A6275]">Errors</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSection('settings')}
            className="text-left text-[12.5px] font-semibold text-[#122B5C] hover:text-[#E54826] inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Open Meta Commerce Readiness</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Bottom Split: Live Categories Breakdown + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E5EC] p-6">
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E2E5EC]">
            <div>
              <h2 className="font-heading font-bold text-[16px] text-[#0B0F19]">
                Live WooCommerce Categories
              </h2>
              <p className="text-[12.5px] text-[#5A6275]">
                Click a category to filter products
              </p>
            </div>
            <FolderTree className="w-4 h-4 text-[#5A6275]" aria-hidden="true" />
          </div>

          {categories.length === 0 ? (
            <p className="text-[13.5px] text-[#5A6275] py-6 text-center">
              No categories loaded yet.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E5EC]">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategoryFilter(cat.id)}
                  className="w-full py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F4F5F8] -mx-2 px-2 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] text-[#0B0F19] truncate">
                      {decodeHtmlEntities(cat.name)}
                    </p>
                    <p className="text-[12px] font-mono text-[#5A6275] truncate">
                      /{cat.slug} · ID #{cat.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold text-[13.5px] text-[#0B0F19] tabular-nums">
                      {cat.count}
                    </span>
                    <ArrowRight
                      className="w-4 h-4 text-[#5A6275]"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E5EC] p-6">
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E2E5EC]">
            <div>
              <h2 className="font-heading font-bold text-[16px] text-[#0B0F19]">
                Recent Storefront Orders
              </h2>
              <p className="text-[12.5px] text-[#5A6275]">
                Latest completed orders from WooCommerce &amp; checkout
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('orders')}
              className="text-[13px] font-semibold text-[#122B5C] hover:text-[#E54826] cursor-pointer whitespace-nowrap"
            >
              All Orders
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="py-10 text-center">
              <ShoppingBag
                className="w-8 h-8 text-[#5A6275]/60 mx-auto mb-2.5"
                aria-hidden="true"
              />
              <p className="font-heading font-semibold text-[14.5px] text-[#0B0F19] mb-1">
                No storefront orders recorded yet
              </p>
              <p className="text-[13px] text-[#5A6275] max-w-sm mx-auto">
                Orders placed through checkout or retrieved from WooCommerce will
                appear here automatically with full shipping and line-item details.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E5EC] text-[12px] font-semibold text-[#5A6275]">
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 px-3">Customer</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 pl-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E5EC] text-[13.5px]">
                  {orders.slice(0, 5).map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => onOpenOrder(order)}
                      className="hover:bg-[#F4F5F8] cursor-pointer transition-colors"
                    >
                      <td className="py-3 pr-3 font-mono font-semibold text-[#0B0F19] tabular-nums whitespace-nowrap">
                        #{order.orderNumber}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-[#0B0F19] truncate max-w-[180px]">
                          {order.customerName}
                        </p>
                        <p className="text-[12px] text-[#5A6275] truncate max-w-[180px]">
                          {order.email || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-3 capitalize text-[12.5px] font-medium text-[#0B0F19]">
                        {order.status}
                      </td>
                      <td className="py-3 pl-3 text-right font-mono font-semibold text-[#0B0F19] tabular-nums whitespace-nowrap">
                        ${Number(order.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
