import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  X,
} from 'lucide-react';
import {
  bulkUpdateProductPlacements,
  clearAdminBearerToken,
  fetchAdminAuthStatus,
  fetchAdminCatalog,
  fetchAdminOrders,
  fetchAdminProductVariations,
  fetchAdminSettings,
  logoutAdmin,
  updateAdminOrderStatus,
  updateProductPlacement,
} from '../api/admin';
import { AdminCategoriesTab } from '../components/admin/AdminCategoriesTab';
import { AdminLoginScreen } from '../components/admin/AdminLoginScreen';
import { AdminOrdersTab } from '../components/admin/AdminOrdersTab';
import { AdminOverviewTab } from '../components/admin/AdminOverviewTab';
import {
  AdminProductsTab,
  type BulkMetaSyncProgress,
} from '../components/admin/AdminProductsTab';
import { AdminSettingsTab } from '../components/admin/AdminSettingsTab';
import { OrderDetailModal } from '../components/admin/OrderDetailModal';
import { VariationsInspectorDrawer } from '../components/admin/VariationsInspectorDrawer';
import {
  loadMetaSyncStatuses,
  removeProductFromMeta,
  syncProductToMeta,
  syncProductsBulkToMeta,
} from '../services/metaCatalogSync';
import type {
  AdminAuthStatus,
  AdminOrder,
  AdminOrderStatus,
  AdminSection,
  MetaProductSyncStatusRecord,
  ProductPlacement,
  StorefrontConfigResponse,
  StorefrontSettings,
} from '../types/admin';
import type { WcCategory, WcProduct } from '../types/woocommerce';
import { decodeHtmlEntities } from '../utils/format';

interface AdminPageProps {
  onExitToStorefront: () => void;
  onStorefrontConfigUpdated?: (config: Partial<StorefrontConfigResponse>) => void;
}

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'WooCommerce Products', icon: Package },
  { id: 'categories', label: 'Categories', icon: FolderTree },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'settings', label: 'Settings & Integrations', icon: Settings },
];

function getInitialAdminSection(): AdminSection {
  const path = (window.location.pathname || '').replace(/\/+$/, '').toLowerCase();
  if (path === '/admin/products') return 'products';
  if (path === '/admin/categories') return 'categories';
  if (path === '/admin/orders') return 'orders';
  if (path === '/admin/settings') return 'settings';
  return 'overview';
}

export const AdminPage: React.FC<AdminPageProps> = ({
  onExitToStorefront,
  onStorefrontConfigUpdated,
}) => {
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [activeSection, setActiveSection] = useState<AdminSection>(() =>
    getInitialAdminSection()
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [products, setProducts] = useState<WcProduct[]>([]);
  const [categories, setCategories] = useState<WcCategory[]>([]);
  const [placements, setPlacements] = useState<
    Record<number, ProductPlacement>
  >({});
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);

  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [productCategoryFilter, setProductCategoryFilter] = useState<
    number | 'all'
  >('all');
  const [inspectingProduct, setInspectingProduct] = useState<WcProduct | null>(
    null
  );
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [metaSyncStatuses, setMetaSyncStatuses] = useState<
    Record<string, MetaProductSyncStatusRecord>
  >(() => loadMetaSyncStatuses());
  const [syncingMetaIds, setSyncingMetaIds] = useState<Set<number>>(new Set());
  const [removingMetaIds, setRemovingMetaIds] = useState<Set<number>>(
    new Set()
  );
  const [bulkMetaProgress, setBulkMetaProgress] =
    useState<BulkMetaSyncProgress | null>(null);
  const bulkMetaAbortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const selectSection = useCallback((section: AdminSection) => {
    setActiveSection(section);
    const targetPath = section === 'overview' ? '/admin' : `/admin/${section}`;
    if (window.location.pathname !== targetPath) {
      window.history.replaceState({}, '', targetPath);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const status = await fetchAdminAuthStatus();
      setAuthStatus(status);
    } catch {
      setAuthStatus({ authenticated: false, mode: 'setup', needsSetup: true });
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const handleUnauthorized = useCallback(() => {
    clearAdminBearerToken();
    setAuthStatus((prev) =>
      prev
        ? { ...prev, authenticated: false }
        : { authenticated: false, mode: 'env', needsSetup: false }
    );
  }, []);

  const loadCatalog = useCallback(
    async (prefetchVariations = false) => {
      setLoadingCatalog(true);
      setCatalogError(null);
      try {
        const res = await fetchAdminCatalog();
        setProducts(res.products || []);
        setCategories(res.categories || []);
        setPlacements(res.placements || {});
        setSyncedAt(res.syncedAt);
        onStorefrontConfigUpdated?.({ placements: res.placements || {} });

        if (prefetchVariations && res.products && res.products.length > 0) {
          const variableProducts = res.products
            .filter(
              (p) =>
                p.type === 'variable' ||
                (p.variations && p.variations.length > 0)
            )
            .slice(0, 8);
          await Promise.allSettled(
            variableProducts.map(async (vp) => {
              const varRes = await fetchAdminProductVariations(vp.id);
              setProducts((prev) =>
                prev.map((item) =>
                  item.id === vp.id
                    ? { ...item, variation_details: varRes.variations }
                    : item
                )
              );
            })
          );
        }
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          handleUnauthorized();
          return;
        }
        setCatalogError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch live WooCommerce catalog.'
        );
      } finally {
        setLoadingCatalog(false);
      }
    },
    [handleUnauthorized, onStorefrontConfigUpdated]
  );

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetchAdminOrders();
      setOrders(res.orders || []);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) handleUnauthorized();
    } finally {
      setLoadingOrders(false);
    }
  }, [handleUnauthorized]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetchAdminSettings();
      setSettings(res.settings);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) handleUnauthorized();
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    if (authStatus?.authenticated) {
      void Promise.all([loadCatalog(false), loadOrders(), loadSettings()]);
    }
  }, [authStatus?.authenticated, loadCatalog, loadOrders, loadSettings]);

  const handleRefreshCatalog = async () => {
    await loadCatalog(true);
    showToast('Live WooCommerce catalog & variations refreshed.');
  };

  const handleTogglePlacement = async (
    productId: number,
    patch: { featured?: boolean; hidden?: boolean }
  ) => {
    setSavingProductId(productId);
    try {
      const res = await updateProductPlacement(productId, patch);
      setPlacements(res.placements);
      onStorefrontConfigUpdated?.({ placements: res.placements });
      if (patch.hidden !== undefined) {
        showToast(
          patch.hidden
            ? `Product #${productId} hidden from storefront.`
            : `Product #${productId} restored to storefront.`
        );
      } else if (patch.featured !== undefined) {
        showToast(
          patch.featured
            ? `Product #${productId} pinned as Featured.`
            : `Removed Featured pin from #${productId}.`
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to update product placement.'
      );
    } finally {
      setSavingProductId(null);
    }
  };

  const handleBulkPlacement = async (
    productIds: number[],
    patch: { featured?: boolean; hidden?: boolean }
  ) => {
    setBulkSaving(true);
    try {
      const res = await bulkUpdateProductPlacements(productIds, patch);
      setPlacements(res.placements);
      onStorefrontConfigUpdated?.({ placements: res.placements });
      showToast(`Updated storefront placement for ${res.updatedCount} products.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to run bulk placement update.'
      );
    } finally {
      setBulkSaving(false);
    }
  };

  const handleSyncProductToMeta = async (product: WcProduct) => {
    const productKey = String(product.id);
    setSyncingMetaIds((prev) => new Set(prev).add(product.id));
    try {
      const existing = metaSyncStatuses[productKey];
      const { response, statusRecord } = await syncProductToMeta(
        product,
        existing
      );
      setMetaSyncStatuses((prev) => ({ ...prev, [productKey]: statusRecord }));
      showToast(
        `Synced "${decodeHtmlEntities(product.name)}" (${response.variantCount} ${response.variantCount === 1 ? 'item' : 'variants'}) to Meta Catalog${response.shopPublished ? ' & Shop' : ''}.`
      );
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        handleUnauthorized();
        return;
      }
      setMetaSyncStatuses(loadMetaSyncStatuses());
      showToast(
        err instanceof Error
          ? err.message
          : 'Unable to sync product to Meta Catalog.'
      );
    } finally {
      setSyncingMetaIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleRemoveProductFromMeta = async (product: WcProduct) => {
    const productKey = String(product.id);
    setRemovingMetaIds((prev) => new Set(prev).add(product.id));
    try {
      const existing = metaSyncStatuses[productKey];
      const { response, statusRecord } = await removeProductFromMeta(
        product,
        existing
      );
      setMetaSyncStatuses((prev) => ({ ...prev, [productKey]: statusRecord }));
      showToast(
        `Removed "${decodeHtmlEntities(product.name)}" (${response.removedCount} Meta ${response.removedCount === 1 ? 'item' : 'items'}) from Meta Catalog.`
      );
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        handleUnauthorized();
        return;
      }
      showToast(
        err instanceof Error
          ? err.message
          : 'Unable to remove product from Meta Catalog.'
      );
    } finally {
      setRemovingMetaIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleCancelBulkMetaSync = () => {
    bulkMetaAbortRef.current?.abort();
  };

  const handleBulkSyncToMeta = async (productsToSync: WcProduct[]) => {
    if (productsToSync.length === 0) return;

    bulkMetaAbortRef.current?.abort();
    const controller = new AbortController();
    bulkMetaAbortRef.current = controller;

    setBulkMetaProgress({
      active: true,
      total: productsToSync.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      currentProductName: `Preparing ${productsToSync.length} products for batched Meta sync...`,
      statusNote: 'Bundling products into shared Meta batches to stay within Catalog rate limits.',
      errors: [],
    });

    const summary = await syncProductsBulkToMeta(productsToSync, {
      signal: controller.signal,
      onPhaseChange: (info) => {
        setSyncingMetaIds(new Set(info.activeProductIds));
        setBulkMetaProgress({
          active: true,
          total: productsToSync.length,
          completed: info.completed,
          succeeded: info.succeeded,
          failed: info.failed,
          currentProductName: info.currentProductName,
          statusNote: info.statusNote,
          errors: info.errors,
        });
      },
      onStatusesUpdated: (nextStatuses) => {
        setMetaSyncStatuses(nextStatuses);
      },
    });

    setSyncingMetaIds(new Set());
    if (bulkMetaAbortRef.current === controller) {
      bulkMetaAbortRef.current = null;
    }

    if (summary.unauthorized) {
      handleUnauthorized();
      setBulkMetaProgress(null);
      return;
    }

    setBulkMetaProgress({
      active: false,
      total: productsToSync.length,
      completed: summary.succeeded + summary.failed,
      succeeded: summary.succeeded,
      failed: summary.failed,
      currentProductName: '',
      statusNote: summary.cancelled
        ? 'Bulk sync cancelled by admin. Completed batches remain synced.'
        : undefined,
      errors: summary.errors,
    });

    showToast(
      summary.cancelled
        ? `Bulk Meta Sync stopped: ${summary.succeeded} succeeded before cancel.`
        : `Bulk Meta Sync finished: ${summary.succeeded} succeeded, ${summary.failed} failed.`
    );
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: AdminOrderStatus
  ) => {
    setUpdatingOrderStatus(true);
    try {
      await updateAdminOrderStatus(orderId, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      setSelectedOrder((prev) =>
        prev && prev.id === orderId ? { ...prev, status } : prev
      );
      showToast(`Order #${orderId} status updated to ${status}.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to update order status.'
      );
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    await checkAuth();
  };

  const handleJumpCategoryToProducts = (categoryId: number) => {
    setProductCategoryFilter(categoryId);
    selectSection('products');
    setMobileSidebarOpen(false);
  };

  if (checkingAuth || !authStatus) {
    return (
      <div className="min-h-screen bg-[#F4F5F8] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-[14px] text-[#5A6275]">
          <Loader2 className="w-5 h-5 animate-spin text-[#0B0F19]" />
          <span>Verifying admin session...</span>
        </div>
      </div>
    );
  }

  if (!authStatus.authenticated) {
    return (
      <AdminLoginScreen
        authStatus={authStatus}
        onAuthenticated={() => {
          setAuthStatus((prev) =>
            prev
              ? { ...prev, authenticated: true, needsSetup: false }
              : { authenticated: true, mode: 'claimed', needsSetup: false }
          );
        }}
        onExitToStorefront={onExitToStorefront}
      />
    );
  }

  const activeNavLabel =
    NAV_ITEMS.find((item) => item.id === activeSection)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-[#0B0F19] flex">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[#0B0F19] text-white border-r border-white/10 shrink-0 transition-[width] duration-200 print:hidden ${
          sidebarCollapsed ? 'w-[76px]' : 'w-[260px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-9 w-10 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/Glossy_Navy_Shopping_Bag_with_Golden_50_36b56e7c.png"
                alt="Fifty Dollar Shop"
                className="w-full h-full object-contain"
              />
            </span>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="font-heading font-bold text-[14px] text-white truncate">
                  Fifty Dollar Shop
                </p>
                <p className="text-[11px] font-mono text-white/55 truncate">
                  Admin Console
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer shrink-0"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Admin sections">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full h-11 px-3 rounded-xl flex items-center gap-3 text-[13.5px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#E54826] text-white font-semibold'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden={true} />
                {!sidebarCollapsed && (
                  <span className="truncate whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1.5">
          <button
            type="button"
            onClick={onExitToStorefront}
            title={sidebarCollapsed ? 'View Storefront' : undefined}
            className={`w-full h-10 px-3 rounded-xl text-white/75 hover:bg-white/10 hover:text-white text-[13px] font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && (
              <span className="whitespace-nowrap">View Storefront</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            title={sidebarCollapsed ? 'Logout' : undefined}
            className={`w-full h-10 px-3 rounded-xl text-white/75 hover:bg-red-500/20 hover:text-red-200 text-[13px] font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed && (
              <span className="whitespace-nowrap">Logout</span>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex print:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-[#0B0F19]/50 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-[270px] bg-[#0B0F19] text-white h-full flex flex-col shadow-2xl"
            >
              <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="h-9 w-10 rounded-lg bg-white p-1 flex items-center justify-center">
                    <img
                      src="/assets/aistudio/Glossy_Navy_Shopping_Bag_with_Golden_50_36b56e7c.png"
                      alt="Fifty Dollar Shop"
                      className="w-full h-full object-contain"
                    />
                  </span>
                  <span className="font-heading font-bold text-[14.5px]">
                    Admin Console
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  aria-label="Close menu"
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        selectSection(item.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full h-11 px-3 rounded-xl flex items-center gap-3 text-[14px] font-medium cursor-pointer ${
                        active
                          ? 'bg-[#E54826] text-white font-semibold'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden={true} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="p-3 border-t border-white/10 space-y-1.5">
                <button
                  type="button"
                  onClick={onExitToStorefront}
                  className="w-full h-10 px-3 rounded-xl text-white/80 hover:bg-white/10 text-[13.5px] font-medium flex items-center gap-2.5 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  <span>View Storefront</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="w-full h-10 px-3 rounded-xl text-red-200 hover:bg-red-500/20 text-[13.5px] font-medium flex items-center gap-2.5 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-[#E2E5EC] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open admin navigation"
              className="lg:hidden w-9 h-9 rounded-lg border border-[#E2E5EC] hover:bg-[#F4F5F8] flex items-center justify-center text-[#0B0F19] cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-[13.5px] min-w-0">
              <span className="text-[#5A6275] whitespace-nowrap">Admin</span>
              <span className="text-[#CBD5E1]" aria-hidden="true">
                /
              </span>
              <span className="font-heading font-semibold text-[#0B0F19] truncate">
                {activeNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onExitToStorefront}
              className="hidden sm:inline-flex h-9 px-3.5 rounded-lg border border-[#E2E5EC] bg-white hover:bg-[#F4F5F8] text-[#0B0F19] text-[13px] font-semibold items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Storefront</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="h-9 px-3.5 rounded-lg bg-[#0B0F19] hover:bg-[#E54826] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Active Section Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'overview' && (
            <AdminOverviewTab
              products={products}
              categories={categories}
              orders={orders}
              placements={placements}
              metaSyncStatuses={metaSyncStatuses}
              syncedAt={syncedAt}
              loadingCatalog={loadingCatalog}
              onRefreshCatalog={() => void handleRefreshCatalog()}
              onNavigateSection={selectSection}
              onSelectCategoryFilter={handleJumpCategoryToProducts}
              onOpenOrder={(o) => setSelectedOrder(o)}
              onViewStorefront={onExitToStorefront}
            />
          )}

          {activeSection === 'products' && (
            <AdminProductsTab
              products={products}
              categories={categories}
              placements={placements}
              metaSyncStatuses={metaSyncStatuses}
              syncingMetaIds={syncingMetaIds}
              removingMetaIds={removingMetaIds}
              bulkMetaProgress={bulkMetaProgress}
              syncedAt={syncedAt}
              loading={loadingCatalog}
              error={catalogError}
              initialCategoryFilter={productCategoryFilter}
              savingProductId={savingProductId}
              bulkSaving={bulkSaving}
              onRefreshCatalog={() => void handleRefreshCatalog()}
              onInspectVariations={(p) => setInspectingProduct(p)}
              onTogglePlacement={(id, patch) =>
                void handleTogglePlacement(id, patch)
              }
              onBulkPlacement={(ids, patch) =>
                void handleBulkPlacement(ids, patch)
              }
              onSyncProductToMeta={(p) => void handleSyncProductToMeta(p)}
              onRemoveProductFromMeta={(p) =>
                void handleRemoveProductFromMeta(p)
              }
              onBulkSyncToMeta={(list) => void handleBulkSyncToMeta(list)}
              onCancelBulkMetaSync={handleCancelBulkMetaSync}
              onDismissBulkMetaProgress={() => setBulkMetaProgress(null)}
            />
          )}

          {activeSection === 'categories' && (
            <AdminCategoriesTab
              categories={categories}
              products={products}
              loading={loadingCatalog}
              onRefresh={() => void handleRefreshCatalog()}
              onSelectCategory={handleJumpCategoryToProducts}
            />
          )}

          {activeSection === 'orders' && (
            <AdminOrdersTab
              orders={orders}
              loading={loadingOrders}
              onRefresh={() => void loadOrders()}
              onSelectOrder={(o) => setSelectedOrder(o)}
            />
          )}

          {activeSection === 'settings' && (
            <AdminSettingsTab
              settings={settings}
              onSettingsSaved={(updated) => {
                setSettings(updated);
                onStorefrontConfigUpdated?.({ settings: updated });
              }}
            />
          )}
        </main>
      </div>

      {/* Drawers & Toast */}
      <VariationsInspectorDrawer
        product={inspectingProduct}
        onClose={() => setInspectingProduct(null)}
      />

      <OrderDetailModal
        order={selectedOrder}
        updatingStatus={updatingOrderStatus}
        onUpdateStatus={handleUpdateOrderStatus}
        onClose={() => setSelectedOrder(null)}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-5 right-5 z-50 bg-[#0B0F19] text-white px-4 py-3 rounded-xl border border-white/10 shadow-xl text-[13.5px] font-medium max-w-sm print:hidden"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
