import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Heart, Menu, Search, ShoppingBag, X } from 'lucide-react';
import type { AppPage } from '../types/woocommerce';

interface HeaderProps {
  currentPage: AppPage;
  searchQuery: string;
  cartCount: number;
  wishlistCount: number;
  onNavigate: (page: AppPage) => void;
  onOpenSearch: () => void;
  onOpenWishlist: () => void;
  onOpenCart: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  searchQuery,
  cartCount,
  wishlistCount,
  onNavigate,
  onOpenSearch,
  onOpenWishlist,
  onOpenCart,
}) => {
  const [bannerVisible, setBannerVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems: Array<{ id: AppPage; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'shop', label: 'Hot Selling $50' },
    { id: 'categories', label: 'Categories' },
    { id: 'about', label: 'About' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (page: AppPage) => {
    setMobileMenuOpen(false);
    onNavigate(page);
  };

  return (
    <>
      {/* Slim Dismissible Announcement Strip */}
      {bannerVisible && (
        <div className="bg-[#0B0F19] text-[#F4F5F8] text-[12px] font-medium h-8 px-4 flex items-center justify-center relative tracking-wide border-b border-white/10">
          <span className="truncate pr-6">
            All-America Flat $50 Drop · Free Tracked USA Shipping · 30-Day Guarantee
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
          scrolled
            ? 'bg-white/95 backdrop-blur-xl border-[#E2E5EC] shadow-[0_10px_30px_-20px_rgba(11,15,25,0.22)]'
            : 'bg-white/90 backdrop-blur-md border-[#E2E5EC]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[70px] flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Uploaded Brand Logo Only */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full text-[#0B0F19] hover:bg-[#F4F5F8] transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
            className="hidden lg:flex items-center gap-7"
          >
            {navItems.map((item) => {
              const active =
                currentPage === item.id ||
                (item.id === 'shop' && currentPage === 'product') ||
                (item.id === 'categories' && currentPage === 'category');
              return (
                <a
                  key={item.id}
                  href={item.id === 'home' ? '/' : `/${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(item.id);
                  }}
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
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
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
              <Search className="w-4 h-4 text-[#5A6275] shrink-0" aria-hidden="true" />
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
                  wishlistCount > 0 ? 'text-[#E54826] fill-[#E54826]' : 'text-[#5A6275]'
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
                  <a
                    key={item.id}
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
                );
              })}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  );
};
