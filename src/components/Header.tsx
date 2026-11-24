import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ChevronDown,
  Heart,
  Menu,
  Package,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { AppPage, WcCategory, WcProduct } from '../types/woocommerce';
import {
  decodeHtmlEntities,
  formatWcDecimalPrice,
  getRegularComparePrice,
} from '../utils/format';

interface HeaderProps {
  currentPage: AppPage;
  searchQuery: string;
  cartCount: number;
  wishlistCount: number;
  announcementText?: string;
  categories?: WcCategory[];
  products?: WcProduct[];
  onNavigate: (page: AppPage) => void;
  onSelectCategory?: (catOrId: WcCategory | number | 'all') => void;
  onSelectProduct?: (product: WcProduct) => void;
  onOpenSearch: () => void;
  onOpenWishlist: () => void;
  onOpenCart: () => void;
}

type MegaStockFilter = 'all' | 'instock';
type MegaTypeFilter = 'all' | 'variable' | 'simple';
type MegaSortOption = 'featured' | 'newest' | 'az';

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  searchQuery,
  cartCount,
  wishlistCount,
  announcementText,
  categories = [],
  products = [],
  onNavigate,
  onSelectCategory,
  onSelectProduct,
  onOpenSearch,
  onOpenWishlist,
  onOpenCart,
}) => {
  const [bannerVisible, setBannerVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Shop Mega-Menu state (desktop hover + keyboard accessible)
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [megaCategoryId, setMegaCategoryId] = useState<number | 'all'>('all');
  const [megaStockFilter, setMegaStockFilter] = useState<MegaStockFilter>('all');
  const [megaTypeFilter, setMegaTypeFilter] = useState<MegaTypeFilter>('all');
  const [megaSort, setMegaSort] = useState<MegaSortOption>('featured');
  const [megaSearch, setMegaSearch] = useState('');
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!shopMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShopMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shopMenuOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const openShopMenu = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShopMenuOpen(true);
  };

  const scheduleCloseShopMenu = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setShopMenuOpen(false);
      closeTimerRef.current = null;
    }, 150);
  };

  const navItems: Array<{ id: AppPage; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'shop', label: 'Shop' },
    { id: 'categories', label: 'Categories' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (page: AppPage) => {
    setMobileMenuOpen(false);
    setShopMenuOpen(false);
    onNavigate(page);
  };

  const handleMegaCategoryOpen = (catOrId: WcCategory | number | 'all') => {
    setShopMenuOpen(false);
    setMobileMenuOpen(false);
    if (onSelectCategory) {
      onSelectCategory(catOrId);
    } else {
      onNavigate('shop');
    }
  };

  const handleMegaProductOpen = (product: WcProduct) => {
    setShopMenuOpen(false);
    setMobileMenuOpen(false);
    onSelectProduct?.(product);
  };

  const categoryCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of products) {
      for (const c of p.categories || []) {
        counts.set(c.id, (counts.get(c.id) || 0) + 1);
      }
    }
    return counts;
  }, [products]);

  const filteredMegaProducts = useMemo(() => {
    const q = megaSearch.trim().toLowerCase();
    const list = products.filter((p) => {
      if (megaCategoryId !== 'all') {
        const matchesCat = (p.categories || []).some(
          (c) => c.id === megaCategoryId
        );
        if (!matchesCat) return false;
      }
      if (megaStockFilter === 'instock' && p.stock_status !== 'instock') {
        return false;
      }
      const isVariable =
        p.type === 'variable' || (p.variations && p.variations.length > 0);
      if (megaTypeFilter === 'variable' && !isVariable) return false;
      if (megaTypeFilter === 'simple' && isVariable) return false;

      if (q) {
        const title = decodeHtmlEntities(p.name).toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        if (!title.includes(q) && !sku.includes(q)) return false;
      }
      return true;
    });

    if (megaSort === 'newest') {
      return [...list].sort((a, b) => {
        const tA = a.date_created ? Date.parse(a.date_created) : 0;
        const tB = b.date_created ? Date.parse(b.date_created) : 0;
        return tB !== tA ? tB - tA : b.id - a.id;
      });
    }
    if (megaSort === 'az') {
      return [...list].sort((a, b) =>
        decodeHtmlEntities(a.name).localeCompare(decodeHtmlEntities(b.name))
      );
    }
    return list;
  }, [
    products,
    megaCategoryId,
    megaStockFilter,
    megaTypeFilter,
    megaSort,
    megaSearch,
  ]);

  const activeMegaCategory = useMemo(
    () =>
      megaCategoryId === 'all'
        ? null
        : categories.find((c) => c.id === megaCategoryId) || null,
    [categories, megaCategoryId]
  );

  const hasMegaFilters =
    megaCategoryId !== 'all' ||
    megaStockFilter !== 'all' ||
    megaTypeFilter !== 'all' ||
    megaSort !== 'featured' ||
    megaSearch.trim().length > 0;

  const resetMegaFilters = () => {
    setMegaCategoryId('all');
    setMegaStockFilter('all');
    setMegaTypeFilter('all');
    setMegaSort('featured');
    setMegaSearch('');
  };

  return (
    <>
      {/* Slim Dismissible Announcement Strip */}
      {bannerVisible &&
        (announcementText === undefined ||
          announcementText.trim().length > 0) && (
          <div className="bg-[#0B0F19] text-[#F4F5F8] text-[12px] font-medium h-8 px-4 flex items-center justify-center relative tracking-wide border-b border-white/10">
            <span className="truncate pr-6">
              {announcementText ||
                'All-America Flat $50 Drop · Free Tracked USA Shipping · 30-Day Guarantee'}
            </span>
            <button
              type="button"
              onClick={() => setBannerVisible(false)}
              aria-label="Dismiss announcement"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-white/60 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      {/* Flagship Frosted Architectural Sticky Header */}
      <header
        className={`sticky top-0 z-40 transition-all duration-200 border-b ${
          scrolled || shopMenuOpen
            ? 'bg-white/98 backdrop-blur-xl border-[#E2E5EC] shadow-[0_10px_30px_-20px_rgba(11,15,25,0.22)]'
            : 'bg-white/90 backdrop-blur-md border-[#E2E5EC]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[70px] flex items-center justify-between gap-4 lg:gap-8 relative">
          {/* Zone 1: Uploaded Brand Logo Only */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full text-[#0B0F19] hover:bg-[#F4F5F8] transition-colors cursor-pointer"
              aria-label={
                mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
              }
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('home');
              }}
              aria-label="FiftyDollarShop.com Home"
              className="group inline-flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-[#E54826] rounded-xl"
            >
              <span className="h-12 w-14 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] p-1 flex items-center justify-center overflow-hidden shadow-xs group-hover:border-[#E54826]/60 transition-colors duration-200">
                <img
                  src="/assets/aistudio/Glossy_Navy_Shopping_Bag_with_Golden_50_36b56e7c.png"
                  alt="FiftyDollarShop.com"
                  className="w-full h-full object-contain rounded-lg"
                />
              </span>
            </a>
          </div>

          {/* Zone 2: Clean Editorial Text Navigation with Active Indicator */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-7 h-full"
          >
            {navItems.map((item) => {
              const active =
                currentPage === item.id ||
                (item.id === 'shop' && currentPage === 'product') ||
                (item.id === 'categories' && currentPage === 'category');

              if (item.id === 'shop') {
                return (
                  <div
                    key={item.id}
                    className="h-full flex items-center"
                    onMouseEnter={openShopMenu}
                    onMouseLeave={scheduleCloseShopMenu}
                  >
                    <a
                      href="/shop"
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavClick('shop');
                      }}
                      onFocus={openShopMenu}
                      aria-expanded={shopMenuOpen}
                      aria-haspopup="true"
                      className={`relative py-2 text-[14px] whitespace-nowrap shrink-0 inline-flex items-center gap-1 transition-colors duration-150 ${
                        active || shopMenuOpen
                          ? 'text-[#0B0F19] font-semibold'
                          : 'text-[#5A6275] hover:text-[#0B0F19] font-medium'
                      }`}
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          shopMenuOpen ? 'rotate-180 text-[#E54826]' : ''
                        }`}
                        aria-hidden="true"
                      />
                      {active && (
                        <motion.span
                          layoutId="header-nav-underline"
                          transition={{
                            type: 'spring',
                            stiffness: 460,
                            damping: 36,
                          }}
                          className="absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-[#E54826]"
                        />
                      )}
                    </a>
                  </div>
                );
              }

              return (
                <a
                  key={item.id}
                  href={item.id === 'home' ? '/' : `/${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.id);
                  }}
                  onMouseEnter={() => setShopMenuOpen(false)}
                  className={`relative py-2 text-[14px] whitespace-nowrap shrink-0 transition-colors duration-150 ${
                    active
                      ? 'text-[#0B0F19] font-semibold'
                      : 'text-[#5A6275] hover:text-[#0B0F19] font-medium'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <motion.span
                      layoutId="header-nav-underline"
                      transition={{
                        type: 'spring',
                        stiffness: 460,
                        damping: 36,
                      }}
                      className="absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-[#E54826]"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Search, Wishlist & Bag */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search store products"
              className="inline-flex items-center gap-2 px-3 sm:px-3.5 h-10 rounded-full border border-[#E2E5EC] bg-[#F4F5F8] hover:bg-white hover:border-[#0B0F19]/30 text-[#0B0F19] text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <Search
                className="w-4 h-4 text-[#5A6275] shrink-0"
                aria-hidden="true"
              />
              <span className="hidden sm:inline max-w-[100px] truncate text-[#5A6275]">
                {searchQuery.trim() ? searchQuery : 'Search'}
              </span>
              <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[#5A6275] bg-white border border-[#E2E5EC] rounded">
                /
              </kbd>
            </button>

            <button
              type="button"
              onClick={onOpenWishlist}
              aria-label={`Open wishlist with ${wishlistCount} saved items`}
              className={`relative inline-flex items-center justify-center w-10 h-10 rounded-full border transition-colors cursor-pointer shrink-0 ${
                currentPage === 'wishlist' || wishlistCount > 0
                  ? 'border-[#E2E5EC] bg-white text-[#0B0F19] hover:border-[#E54826]'
                  : 'border-[#E2E5EC] bg-[#F4F5F8] text-[#0B0F19] hover:bg-white hover:border-[#0B0F19]/30'
              }`}
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  wishlistCount > 0
                    ? 'text-[#E54826] fill-[#E54826]'
                    : 'text-[#5A6275]'
                }`}
                aria-hidden="true"
              />
              {wishlistCount > 0 && (
                <motion.span
                  key={wishlistCount}
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                  data-testid="wishlist-count"
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0B0F19] text-white text-[10px] font-bold tabular-nums flex items-center justify-center"
                >
                  {wishlistCount}
                </motion.span>
              )}
            </button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={onOpenCart}
              className="relative inline-flex items-center gap-2 px-4 h-10 rounded-full bg-[#0B0F19] hover:bg-[#E54826] text-white font-heading font-semibold text-[13.5px] whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer shadow-xs"
              aria-label={`Open shopping cart with ${cartCount} items`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Bag</span>
              <motion.span
                key={cartCount}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#E54826] text-white text-[11px] font-bold tabular-nums"
                data-testid="cart-count"
              >
                {cartCount}
              </motion.span>
            </motion.button>
          </div>
        </div>

        {/* Full Header-Width Shop Mega-Menu Dropdown (Desktop Hover) */}
        <AnimatePresence>
          {shopMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              onMouseEnter={openShopMenu}
              onMouseLeave={scheduleCloseShopMenu}
              className="hidden lg:block absolute left-0 right-0 top-full z-50 px-4 sm:px-6 lg:px-8 pt-2"
            >
              <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-[#E2E5EC] shadow-[0_28px_60px_-24px_rgba(11,15,25,0.28)] overflow-hidden">
                <div className="grid grid-cols-12">
                  {/* Left Rail: Categories & Interactive Filters */}
                  <div className="col-span-3 bg-[#F4F5F8] border-r border-[#E2E5EC] p-5 flex flex-col justify-between gap-5">
                    <div className="space-y-5">
                      {/* Categories List */}
                      <div>
                        <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#5A6275] font-semibold mb-2.5">
                          Categories
                        </p>
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => setMegaCategoryId('all')}
                            className={`w-full px-3 py-2 rounded-xl text-left text-[13.5px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              megaCategoryId === 'all'
                                ? 'bg-[#0B0F19] text-white font-semibold'
                                : 'text-[#0B0F19] hover:bg-white font-medium'
                            }`}
                          >
                            <span className="truncate">All $50 Products</span>
                            <span
                              className={`text-[11.5px] font-mono tabular-nums ${
                                megaCategoryId === 'all'
                                  ? 'text-white/75'
                                  : 'text-[#5A6275]'
                              }`}
                            >
                              {products.length}
                            </span>
                          </button>

                          {categories.map((cat) => {
                            const selected = megaCategoryId === cat.id;
                            const liveCount =
                              categoryCounts.get(cat.id) ?? cat.count;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setMegaCategoryId(cat.id)}
                                className={`w-full px-3 py-2 rounded-xl text-left text-[13.5px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                  selected
                                    ? 'bg-[#0B0F19] text-white font-semibold'
                                    : 'text-[#0B0F19] hover:bg-white font-medium'
                                }`}
                              >
                                <span className="truncate">
                                  {decodeHtmlEntities(cat.name)}
                                </span>
                                <span
                                  className={`text-[11.5px] font-mono tabular-nums ${
                                    selected
                                      ? 'text-white/75'
                                      : 'text-[#5A6275]'
                                  }`}
                                >
                                  {liveCount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quick Filters */}
                      <div className="pt-4 border-t border-[#E2E5EC] space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.12em] text-[#5A6275] font-semibold">
                            <SlidersHorizontal
                              className="w-3.5 h-3.5"
                              aria-hidden="true"
                            />
                            <span>Filters</span>
                          </span>
                          {hasMegaFilters && (
                            <button
                              type="button"
                              onClick={resetMegaFilters}
                              className="text-[11.5px] font-semibold text-[#E54826] hover:underline cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Availability Segmented Control */}
                        <div>
                          <p className="text-[11.5px] font-semibold text-[#5A6275] mb-1.5">
                            Availability
                          </p>
                          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#ECEEF2]">
                            <button
                              type="button"
                              onClick={() => setMegaStockFilter('all')}
                              className={`h-8 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${
                                megaStockFilter === 'all'
                                  ? 'bg-white text-[#0B0F19] shadow-xs'
                                  : 'text-[#5A6275] hover:text-[#0B0F19]'
                              }`}
                            >
                              All Items
                            </button>
                            <button
                              type="button"
                              onClick={() => setMegaStockFilter('instock')}
                              className={`h-8 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${
                                megaStockFilter === 'instock'
                                  ? 'bg-white text-[#0B0F19] shadow-xs'
                                  : 'text-[#5A6275] hover:text-[#0B0F19]'
                              }`}
                            >
                              In Stock
                            </button>
                          </div>
                        </div>

                        {/* Product Type Segmented Control */}
                        <div>
                          <p className="text-[11.5px] font-semibold text-[#5A6275] mb-1.5">
                            Product Type
                          </p>
                          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#ECEEF2]">
                            {(
                              [
                                { id: 'all', label: 'All' },
                                { id: 'variable', label: 'Variants' },
                                { id: 'simple', label: 'Single' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setMegaTypeFilter(opt.id)}
                                className={`h-8 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${
                                  megaTypeFilter === opt.id
                                    ? 'bg-white text-[#0B0F19] shadow-xs'
                                    : 'text-[#5A6275] hover:text-[#0B0F19]'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Sort Order */}
                        <div>
                          <label
                            htmlFor="mega-menu-sort"
                            className="block text-[11.5px] font-semibold text-[#5A6275] mb-1.5"
                          >
                            Sort By
                          </label>
                          <select
                            id="mega-menu-sort"
                            value={megaSort}
                            onChange={(e) =>
                              setMegaSort(e.target.value as MegaSortOption)
                            }
                            className="w-full h-9 px-2.5 rounded-xl border border-[#E2E5EC] bg-white text-[12.5px] font-medium text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
                          >
                            <option value="featured">Featured First</option>
                            <option value="newest">Newest Arrivals</option>
                            <option value="az">Title: A–Z</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleMegaCategoryOpen(
                          activeMegaCategory ?? 'all'
                        )
                      }
                      className="w-full h-10 px-3.5 rounded-xl bg-[#E54826] hover:bg-[#CC3B1C] text-white text-[13px] font-heading font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="truncate">
                        {activeMegaCategory
                          ? `Open ${decodeHtmlEntities(activeMegaCategory.name)}`
                          : 'View Full Shop'}
                      </span>
                      <ArrowRight
                        className="w-3.5 h-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  {/* Right Workspace: Instant Search + Live Filtered Products Grid */}
                  <div className="col-span-9 p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4 pb-3.5 border-b border-[#E2E5EC]">
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-[16px] text-[#0B0F19] truncate">
                          {activeMegaCategory
                            ? decodeHtmlEntities(activeMegaCategory.name)
                            : 'All Flat $50 Products'}
                        </p>
                        <p className="text-[12px] font-mono text-[#5A6275] tabular-nums">
                          {filteredMegaProducts.length}{' '}
                          {filteredMegaProducts.length === 1
                            ? 'product'
                            : 'products'}{' '}
                          matching · Free Tracked USA Shipping
                        </p>
                      </div>

                      <div className="relative w-64 shrink-0">
                        <Search
                          className="w-3.5 h-3.5 text-[#5A6275] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          value={megaSearch}
                          onChange={(e) => setMegaSearch(e.target.value)}
                          placeholder="Filter products..."
                          aria-label="Filter products in shop menu"
                          className="w-full h-9 pl-8 pr-7 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] focus:bg-white text-[12.5px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19] transition-colors"
                        />
                        {megaSearch && (
                          <button
                            type="button"
                            onClick={() => setMegaSearch('')}
                            aria-label="Clear menu filter"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A6275] hover:text-[#0B0F19] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {filteredMegaProducts.length === 0 ? (
                      <div className="flex-1 min-h-[260px] flex flex-col items-center justify-center text-center py-8">
                        <Package
                          className="w-8 h-8 text-[#5A6275]/60 mb-2"
                          aria-hidden="true"
                        />
                        <p className="font-heading font-semibold text-[15px] text-[#0B0F19]">
                          No products match these filters
                        </p>
                        <p className="text-[13px] text-[#5A6275] mt-1 mb-3">
                          Try switching category or clearing your active filter.
                        </p>
                        <button
                          type="button"
                          onClick={resetMegaFilters}
                          className="h-9 px-4 rounded-xl bg-[#0B0F19] hover:bg-[#E54826] text-white text-[12.5px] font-semibold transition-colors cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1">
                        {filteredMegaProducts.slice(0, 8).map((prod) => {
                          const title = decodeHtmlEntities(prod.name);
                          const catLabel = decodeHtmlEntities(
                            prod.categories?.[0]?.name ||
                              'Hot Selling 50$ Products'
                          );
                          const imgUrl =
                            prod.images?.[0]?.thumbnail ||
                            prod.images?.[0]?.src ||
                            '';
                          const displayPrice = formatWcDecimalPrice(
                            prod.sale_price ||
                              prod.price ||
                              prod.regular_price ||
                              '50',
                            false
                          );
                          const comparePrice = getRegularComparePrice(prod);

                          return (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => handleMegaProductOpen(prod)}
                              className="group text-left rounded-xl border border-[#E2E5EC] hover:border-[#0B0F19]/40 bg-white p-2.5 flex flex-col gap-2 transition-all hover:shadow-[0_12px_24px_-16px_rgba(11,15,25,0.22)] cursor-pointer"
                            >
                              <div className="aspect-square w-full rounded-lg bg-[#ECEEF2] overflow-hidden p-2 flex items-center justify-center">
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={title}
                                    loading="lazy"
                                    className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-200"
                                  />
                                ) : (
                                  <Package
                                    className="w-6 h-6 text-[#5A6275]/50"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>

                              <div className="min-w-0 flex-1 flex flex-col justify-between gap-1.5">
                                <div>
                                  <p className="text-[10.5px] font-mono text-[#5A6275] truncate">
                                    {catLabel}
                                  </p>
                                  <p className="font-heading font-semibold text-[12.5px] leading-snug text-[#0B0F19] group-hover:text-[#E54826] transition-colors line-clamp-2 mt-0.5">
                                    {title}
                                  </p>
                                </div>

                                <div className="flex items-baseline gap-1.5 pt-1 border-t border-[#E2E5EC]/70">
                                  <span className="font-heading font-extrabold text-[14.5px] text-[#E54826] tabular-nums">
                                    {displayPrice}
                                  </span>
                                  <span className="text-[11px] text-[#5A6275]/75 line-through tabular-nums">
                                    ${comparePrice}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {filteredMegaProducts.length > 8 && (
                      <div className="pt-2 border-t border-[#E2E5EC] flex items-center justify-between text-[12.5px]">
                        <span className="text-[#5A6275] font-mono tabular-nums">
                          Showing 8 of {filteredMegaProducts.length} matching
                          products
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleMegaCategoryOpen(
                              activeMegaCategory ?? 'all'
                            )
                          }
                          className="font-heading font-semibold text-[#0B0F19] hover:text-[#E54826] inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>View all {filteredMegaProducts.length} items</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Mobile navigation"
              className="lg:hidden border-t border-[#E2E5EC] bg-white px-4 py-3 flex flex-col gap-1"
            >
              {navItems.map((item) => {
                const active = currentPage === item.id;
                return (
                  <React.Fragment key={item.id}>
                    <a
                      href={item.id === 'home' ? '/' : `/${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavClick(item.id);
                      }}
                      className={`px-3.5 py-2.5 rounded-xl text-[15px] font-medium transition-colors ${
                        active
                          ? 'bg-[#F4F5F8] text-[#0B0F19] font-semibold'
                          : 'text-[#5A6275] hover:bg-[#F4F5F8] hover:text-[#0B0F19]'
                      }`}
                    >
                      {item.label}
                    </a>
                    {item.id === 'shop' && categories.length > 0 && (
                      <div className="pl-4 pb-1 flex flex-col gap-0.5">
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleMegaCategoryOpen(cat)}
                            className="px-3 py-2 rounded-lg text-left text-[13.5px] text-[#5A6275] hover:bg-[#F4F5F8] hover:text-[#0B0F19] flex items-center justify-between cursor-pointer"
                          >
                            <span>{decodeHtmlEntities(cat.name)}</span>
                            <span className="text-[11.5px] font-mono tabular-nums">
                              {categoryCounts.get(cat.id) ?? cat.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  );
};
