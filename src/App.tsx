import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  HOT_SELLING_CATEGORY_NAME,
  HOT_SELLING_CATEGORY_SLUG,
  addWcCartItem,
  fetchWcCart,
  fetchWcCategories,
  fetchWcProductById,
  fetchWcProductByIdCached,
  fetchWcProducts,
  removeWcCartItem,
  updateWcCartItem,
} from './api/woocommerce';
import { CartDrawer } from './components/CartDrawer';
import { CartView } from './components/CartView';
import { CategoriesView } from './components/CategoriesView';
import { CheckoutView } from './components/CheckoutView';
import { CollectionSplitBanner } from './components/CollectionSplitBanner';
import { CompareFloatingBar, CompareModal } from './components/CompareModal';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { InfoPages } from './components/InfoPages';
import { NewArrivalsCarousel } from './components/NewArrivalsCarousel';
import { ProductDetailView } from './components/ProductDetailView';
import { ProductGrid } from './components/ProductGrid';
import { QuickViewModal } from './components/QuickViewModal';
import { SearchOverlay } from './components/SearchOverlay';
import { TrustBar } from './components/TrustBar';
import { WhyFiftySection } from './components/WhyFiftySection';
import { WishlistDrawer } from './components/WishlistDrawer';
import { WishlistView } from './components/WishlistView';
import type {
  AppPage,
  WcCart,
  WcCategory,
  WcProduct,
} from './types/woocommerce';
import { decodeHtmlEntities, findMatchingVariationDetail } from './utils/format';
import {
  loadWishlistFromStorage,
  saveWishlistToStorage,
} from './utils/wishlistStorage';

function parseRouteFromLocation(): {
  page: AppPage;
  categorySlug?: string;
  productId?: number;
} {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { page: 'home' };
  if (path === '/shop') return { page: 'shop' };
  if (path === '/categories') return { page: 'categories' };
  if (path === '/wishlist') return { page: 'wishlist' };
  if (path === '/cart') return { page: 'cart' };
  if (path === '/checkout') return { page: 'checkout' };
  if (path === '/about') return { page: 'about' };
  if (path === '/contact') return { page: 'contact' };
  if (path === '/shipping-policy') return { page: 'shipping-policy' };
  if (path === '/return-policy') return { page: 'return-policy' };
  if (path === '/privacy-policy') return { page: 'privacy-policy' };

  const catMatch = path.match(/^\/category\/([^/]+)$/);
  if (catMatch) {
    return { page: 'category', categorySlug: decodeURIComponent(catMatch[1]) };
  }

  const prodMatch = path.match(/^\/product\/(\d+)$/);
  if (prodMatch) {
    return { page: 'product', productId: Number(prodMatch[1]) };
  }

  return { page: 'home' };
}

const PAGE_DEPTH: Record<AppPage, number> = {
  home: 0,
  shop: 1,
  categories: 1,
  wishlist: 1,
  category: 2,
  product: 3,
  cart: 4,
  checkout: 5,
  about: 1,
  contact: 1,
  'shipping-policy': 1,
  'return-policy': 1,
  'privacy-policy': 1,
};

const pageTransitionVariants = {
  initial: (dir: number) => ({
    opacity: 0,
    y: dir === 0 ? 12 : 10,
    x: dir * 16,
    scale: 0.992,
  }),
  animate: {
    opacity: 1,
    y: 0,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: -8,
    x: dir * -12,
    scale: 0.995,
    transition: {
      duration: 0.18,
      ease: [0.4, 0, 1, 1] as [number, number, number, number],
    },
  }),
};

export default function App() {
  const initialRoute = useMemo(() => parseRouteFromLocation(), []);

  const [currentPage, setCurrentPage] = useState<AppPage>(initialRoute.page);
  const [categories, setCategories] = useState<WcCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all' | null>(
    null
  );
  const [pendingCategorySlug, setPendingCategorySlug] = useState<string | undefined>(
    initialRoute.categorySlug
  );

  // Live catalogs for primary categories + active category page view
  const [hotSellingProducts, setHotSellingProducts] = useState<WcProduct[]>([]);
  const [goinfoevProducts, setGoinfoevProducts] = useState<WcProduct[]>([]);
  const [newArrivalProducts, setNewArrivalProducts] = useState<WcProduct[]>([]);
  const [products, setProducts] = useState<WcProduct[]>([]);

  const [categoryThumbnails, setCategoryThumbnails] = useState<Record<number, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<WcProduct | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<WcProduct | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [goinfoevSearchQuery, setGoinfoevSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const [compareProducts, setCompareProducts] = useState<WcProduct[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const [wishlistProducts, setWishlistProducts] = useState<WcProduct[]>(() =>
    loadWishlistFromStorage()
  );
  const [wishlistOpen, setWishlistOpen] = useState(false);

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [navDirection, setNavDirection] = useState<number>(0);
  const [routePulseKey, setRoutePulseKey] = useState<number>(0);
  const pendingScrollResetRef = useRef(false);

  const [cart, setCart] = useState<WcCart | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
  const [justAddedProductId, setJustAddedProductId] = useState<number | null>(null);
  const [updatingCartKey, setUpdatingCartKey] = useState<string | null>(null);
  const [cartNotice, setCartNotice] = useState<string | null>(null);

  const catalogRef = useRef<HTMLDivElement | null>(null);
  const goinfoevRef = useRef<HTMLDivElement | null>(null);

  const pushPath = useCallback((nextPath: string) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
  }, []);

  const showNotice = useCallback((msg: string) => {
    setCartNotice(msg);
    window.setTimeout(() => {
      setCartNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const syncThumbnailsFromProducts = useCallback((list: WcProduct[]) => {
    setCategoryThumbnails((prev) => {
      const next = { ...prev };
      for (const product of list) {
        const img = product.images?.[0]?.src;
        if (!img) continue;
        for (const cat of product.categories || []) {
          if (!next[cat.id]) {
            next[cat.id] = img;
          }
        }
      }
      return next;
    });
  }, []);

  const hotCategory = useMemo(
    () =>
      categories.find((c) => c.name === HOT_SELLING_CATEGORY_NAME) ||
      categories.find((c) => c.slug === HOT_SELLING_CATEGORY_SLUG) ||
      categories.find((c) => c.name.toLowerCase().includes('hot selling')),
    [categories]
  );

  const goinfoevCategory = useMemo(
    () =>
      categories.find((c) => c.slug === 'goinfoev') ||
      categories.find((c) => c.name.toLowerCase().includes('goinfoev')),
    [categories]
  );

  const newArrivalCategory = useMemo(
    () =>
      categories.find(
        (c) => c.slug === 'new-arrival' || c.slug === 'new-arrivals'
      ) ||
      categories.find((c) => c.name.toLowerCase().includes('new arrival')),
    [categories]
  );

  const loadCategoriesAndProducts = useCallback(
    async (overrideCategory?: number | 'all', silent = false) => {
      if (!silent) {
        setLoadingCatalog(true);
      }
      setCatalogError(null);
      try {
        const rawCats = await fetchWcCategories();
        const activeCats = rawCats.filter((c) => c.count > 0);
        const cats = activeCats.length > 0 ? activeCats : rawCats;
        setCategories(cats);

        const foundHot =
          cats.find((c) => c.name === HOT_SELLING_CATEGORY_NAME) ||
          cats.find((c) => c.slug === HOT_SELLING_CATEGORY_SLUG) ||
          cats.find((c) => c.name.toLowerCase().includes('hot selling')) ||
          cats[0];

        const foundGo =
          cats.find((c) => c.slug === 'goinfoev') ||
          cats.find((c) => c.name.toLowerCase().includes('goinfoev'));

        const foundNewArrival =
          cats.find(
            (c) => c.slug === 'new-arrival' || c.slug === 'new-arrivals'
          ) ||
          cats.find((c) => c.name.toLowerCase().includes('new arrival'));

        let targetCat: number | 'all' | undefined = overrideCategory;

        if (targetCat === undefined && pendingCategorySlug) {
          if (pendingCategorySlug === 'all') {
            targetCat = 'all';
          } else {
            const matched = cats.find((c) => c.slug === pendingCategorySlug);
            if (matched) targetCat = matched.id;
          }
        }

        if (targetCat === undefined) {
          targetCat =
            selectedCategoryId !== null
              ? selectedCategoryId
              : foundHot
                ? foundHot.id
                : 'all';
        }

        if (selectedCategoryId !== targetCat) {
          setSelectedCategoryId(targetCat);
        }

        const hotPromise = foundHot
          ? fetchWcProducts({ category: foundHot.id, perPage: 100 })
          : Promise.resolve([] as WcProduct[]);

        const goPromise = foundGo
          ? fetchWcProducts({ category: foundGo.id, perPage: 100 })
          : Promise.resolve([] as WcProduct[]);

        const newArrivalPromise = foundNewArrival
          ? fetchWcProducts({ category: foundNewArrival.id, perPage: 100 })
          : Promise.resolve([] as WcProduct[]);

        const activePromise =
          targetCat === foundHot?.id
            ? hotPromise
            : targetCat === foundGo?.id
              ? goPromise
              : targetCat === foundNewArrival?.id
                ? newArrivalPromise
                : fetchWcProducts({
                    category: targetCat === 'all' ? 'all' : targetCat,
                    perPage: 100,
                  });

        const [hotList, goList, newArrivalList, activeList] = await Promise.all([
          hotPromise,
          goPromise,
          newArrivalPromise,
          activePromise,
        ]);

        setHotSellingProducts(hotList);
        setGoinfoevProducts(goList);
        setNewArrivalProducts(newArrivalList);
        setProducts(activeList);

        syncThumbnailsFromProducts([
          ...hotList,
          ...goList,
          ...newArrivalList,
          ...activeList,
        ]);

        const allCombined = [
          ...hotList,
          ...goList,
          ...newArrivalList,
          ...activeList,
        ];

        setWishlistProducts((prev) =>
          prev.map((saved) => {
            const updated = allCombined.find((item) => item.id === saved.id);
            return updated
              ? { ...updated, variation_details: saved.variation_details }
              : saved;
          })
        );

        setSelectedProduct((prev) => {
          if (!prev) return null;
          const updated = allCombined.find((item) => item.id === prev.id);
          return updated
            ? { ...updated, variation_details: prev.variation_details }
            : prev;
        });
      } catch (err) {
        if (!silent) {
          setCatalogError(
            err instanceof Error
              ? err.message
              : 'Unable to load store products right now.'
          );
        }
      } finally {
        if (!silent) {
          setLoadingCatalog(false);
        }
      }
    },
    [pendingCategorySlug, selectedCategoryId, syncThumbnailsFromProducts]
  );

  const loadCart = useCallback(async () => {
    try {
      const liveCart = await fetchWcCart();
      setCart(liveCart);
    } catch {
      // Cart initializes cleanly on first add-to-cart
    }
  }, []);

  useEffect(() => {
    if (initialRoute.page === 'product' && initialRoute.productId) {
      fetchWcProductById(initialRoute.productId)
        .then((prod) => setSelectedProduct(prod))
        .catch(() => {
          setCurrentPage('shop');
          pushPath('/shop');
        });
    }
  }, [initialRoute.page, initialRoute.productId, pushPath]);

  useEffect(() => {
    loadCategoriesAndProducts(undefined, false);
    loadCart();

    const handleFocus = () => {
      loadCategoriesAndProducts(undefined, true);
    };
    window.addEventListener('focus', handleFocus);
    const interval = window.setInterval(() => {
      loadCategoriesAndProducts(undefined, true);
    }, 45000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(interval);
    };
  }, [loadCategoriesAndProducts, loadCart]);

  useEffect(() => {
    saveWishlistToStorage(wishlistProducts);
  }, [wishlistProducts]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';
      if (
        (e.key === '/' && !isInput) ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const parsed = parseRouteFromLocation();
      const prevDepth = PAGE_DEPTH[currentPage] ?? 0;
      const nextDepth = PAGE_DEPTH[parsed.page] ?? 0;
      setNavDirection(nextDepth === prevDepth ? -1 : nextDepth > prevDepth ? 1 : -1);
      pendingScrollResetRef.current = true;
      setRoutePulseKey((k) => k + 1);
      setCurrentPage(parsed.page);
      setPendingCategorySlug(parsed.categorySlug);

      if (parsed.page === 'category' && parsed.categorySlug) {
        if (parsed.categorySlug === 'all') {
          setSelectedCategoryId('all');
          loadCategoriesAndProducts('all', false);
        } else {
          const found = categories.find((c) => c.slug === parsed.categorySlug);
          if (found) {
            setSelectedCategoryId(found.id);
            loadCategoriesAndProducts(found.id, false);
          }
        }
      } else if (parsed.page === 'product' && parsed.productId) {
        fetchWcProductById(parsed.productId)
          .then((prod) => setSelectedProduct(prod))
          .catch(() => setCurrentPage('shop'));
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [categories, currentPage, loadCategoriesAndProducts]);

  const scrollToCatalog = () => {
    window.setTimeout(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const scrollToGoinfoev = () => {
    window.setTimeout(() => {
      goinfoevRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const triggerPageTransition = useCallback(
    (nextPage: AppPage) => {
      const prevDepth = PAGE_DEPTH[currentPage] ?? 0;
      const nextDepth = PAGE_DEPTH[nextPage] ?? 0;
      setNavDirection(nextDepth === prevDepth ? 0 : nextDepth > prevDepth ? 1 : -1);
      setRoutePulseKey((k) => k + 1);
      if (nextPage !== currentPage) {
        pendingScrollResetRef.current = true;
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentPage]
  );

  const handleNavigate = (page: AppPage) => {
    triggerPageTransition(page);
    setPendingCategorySlug(undefined);
    setCurrentPage(page);
    pushPath(page === 'home' ? '/' : `/${page}`);

    if (page === 'home' || page === 'shop') {
      if (hotCategory && selectedCategoryId !== hotCategory.id) {
        setSelectedCategoryId(hotCategory.id);
        loadCategoriesAndProducts(hotCategory.id, false);
      }
    }
  };

  const handleOpenCategory = (catOrId: WcCategory | number | 'all') => {
    triggerPageTransition('category');
    pendingScrollResetRef.current = true;
    setPendingCategorySlug(undefined);
    if (catOrId === 'all') {
      setSelectedCategoryId('all');
      setCurrentPage('category');
      pushPath('/category/all');
      loadCategoriesAndProducts('all', false);
      return;
    }

    const catObj =
      typeof catOrId === 'number'
        ? categories.find((c) => c.id === catOrId)
        : catOrId;

    const targetId = typeof catOrId === 'number' ? catOrId : catOrId.id;
    setSelectedCategoryId(targetId);
    setCurrentPage('category');
    pushPath(catObj ? `/category/${encodeURIComponent(catObj.slug)}` : `/category/${targetId}`);
    loadCategoriesAndProducts(targetId, false);
  };

  const handleSearchSubmit = (q: string) => {
    setSearchQuery(q);
    if (currentPage !== 'home' && currentPage !== 'shop' && currentPage !== 'category') {
      triggerPageTransition('shop');
      setCurrentPage('shop');
      pushPath('/shop');
    }
    scrollToCatalog();
  };

  const handleSelectProduct = async (product: WcProduct) => {
    triggerPageTransition('product');
    pendingScrollResetRef.current = true;
    setSelectedProduct(product);
    setCurrentPage('product');
    pushPath(`/product/${product.id}`);
    try {
      const fresh = await fetchWcProductById(product.id);
      setSelectedProduct(fresh);
    } catch {
      // Keep card snapshot if individual detail refresh fails
    }
  };

  const handleToggleCompare = useCallback(
    (product: WcProduct) => {
      setCompareProducts((prev) => {
        const exists = prev.some((item) => item.id === product.id);
        if (exists) {
          return prev.filter((item) => item.id !== product.id);
        }
        if (prev.length >= 4) {
          showNotice('Compare limit is 4 products. Remove an item to add another.');
          return prev;
        }
        return [...prev, product];
      });
    },
    [showNotice]
  );

  const wishlistIds = useMemo(
    () => wishlistProducts.map((item) => item.id),
    [wishlistProducts]
  );

  const handleToggleWishlist = useCallback(
    (product: WcProduct) => {
      const exists = wishlistProducts.some((item) => item.id === product.id);
      if (exists) {
        setWishlistProducts((prev) =>
          prev.filter((item) => item.id !== product.id)
        );
        showNotice(`Removed "${decodeHtmlEntities(product.name)}" from wishlist.`);
      } else {
        setWishlistProducts((prev) => [product, ...prev]);
        showNotice(`Saved "${decodeHtmlEntities(product.name)}" to wishlist.`);
      }
    },
    [wishlistProducts, showNotice]
  );

  const handleRemoveWishlistItem = useCallback((productId: number) => {
    setWishlistProducts((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const handleClearWishlist = useCallback(() => {
    setWishlistProducts([]);
    showNotice('Wishlist cleared.');
  }, [showNotice]);

  const handleAddToCart = async (
    product: WcProduct,
    quantity = 1,
    variationId?: number,
    variationAttrs?: Array<{ attribute: string; value: string }>,
    selectedAttrsMap?: Record<string, string>
  ) => {
    setAddingProductId(product.id);
    try {
      let targetId = variationId;
      let resolvedAttrs = variationAttrs;

      if (
        !targetId &&
        product.variations &&
        product.variations.length > 1 &&
        selectedAttrsMap
      ) {
        try {
          const fresh = await fetchWcProductByIdCached(product.id);
          const matched = findMatchingVariationDetail(fresh, selectedAttrsMap);
          if (matched) {
            targetId = matched.id;
            resolvedAttrs = matched.attributes.map((a) => ({
              attribute: a.name,
              value: a.option,
            }));
          }
        } catch {
          // Fall back to default variation if variation detail fetch fails
        }
      }

      const finalTargetId =
        targetId ??
        (product.variations && product.variations.length > 0
          ? product.variations[0]
          : product.id);

      const updatedCart = await addWcCartItem(
        finalTargetId,
        quantity,
        resolvedAttrs
      );
      setCart(updatedCart);
      setJustAddedProductId(product.id);
      setCartOpen(true);
      window.setTimeout(() => {
        setJustAddedProductId((prev) => (prev === product.id ? null : prev));
      }, 1800);
    } catch (err) {
      showNotice(
        err instanceof Error
          ? decodeHtmlEntities(err.message)
          : 'Could not add product to cart.'
      );
    } finally {
      setAddingProductId(null);
    }
  };

  const handleBuyNow = async (
    product: WcProduct,
    quantity = 1,
    variationId?: number,
    variationAttrs?: Array<{ attribute: string; value: string }>
  ) => {
    setAddingProductId(product.id);
    try {
      const targetId =
        variationId ??
        (product.variations && product.variations.length > 0
          ? product.variations[0]
          : product.id);

      const updatedCart = await addWcCartItem(targetId, quantity, variationAttrs);
      setCart(updatedCart);
      setCartOpen(false);
      triggerPageTransition('checkout');
      setCurrentPage('checkout');
      pushPath('/checkout');
    } catch (err) {
      showNotice(
        err instanceof Error
          ? decodeHtmlEntities(err.message)
          : 'Could not start checkout.'
      );
    } finally {
      setAddingProductId(null);
    }
  };

  const handleUpdateCartQty = async (key: string, quantity: number) => {
    setUpdatingCartKey(key);
    try {
      const updated = await updateWcCartItem(key, quantity);
      setCart(updated);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Unable to update quantity.');
    } finally {
      setUpdatingCartKey(null);
    }
  };

  const handleRemoveCartItem = async (key: string) => {
    setUpdatingCartKey(key);
    try {
      const updated = await removeWcCartItem(key);
      setCart(updated);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Unable to remove item.');
    } finally {
      setUpdatingCartKey(null);
    }
  };

  const allSearchableProducts = useMemo(() => {
    const map = new Map<number, WcProduct>();
    for (const p of [
      ...hotSellingProducts,
      ...goinfoevProducts,
      ...newArrivalProducts,
      ...products,
    ]) {
      map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [hotSellingProducts, goinfoevProducts, newArrivalProducts, products]);

  // Dynamic New Arrivals from the dedicated WooCommerce "New Arrival" category (fallback to newest-first if empty)
  const displayedNewArrivals = useMemo(() => {
    if (newArrivalProducts.length > 0) {
      return newArrivalProducts;
    }
    return [...allSearchableProducts].sort((a, b) => {
      const timeA = a.date_created ? Date.parse(a.date_created) : 0;
      const timeB = b.date_created ? Date.parse(b.date_created) : 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.id - a.id;
    });
  }, [newArrivalProducts, allSearchableProducts]);

  const cartCount = cart?.items_count ?? 0;
  const activeCatValue: number | 'all' = selectedCategoryId ?? 'all';
  const pageViewKey =
    currentPage === 'product'
      ? `product-${selectedProduct?.id || '0'}`
      : currentPage === 'category'
        ? `category-${activeCatValue}`
        : currentPage;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-[#F4F5F8] text-[#0B0F19]">
        {/* Subtle App-Like Route Transition Progress Pulse */}
        {routePulseKey > 0 && (
          <motion.div
            key={routePulseKey}
            aria-hidden="true"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: [0, 0.72, 1], opacity: [1, 1, 0] }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 right-0 h-[2.5px] bg-[#E54826] z-50 origin-left pointer-events-none"
          />
        )}

        <Header
          currentPage={currentPage}
          searchQuery={searchQuery}
          cartCount={cartCount}
          wishlistCount={wishlistProducts.length}
          onNavigate={handleNavigate}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenWishlist={() => setWishlistOpen(true)}
          onOpenCart={() => setCartOpen(true)}
        />

        <AnimatePresence>
          {cartNotice && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed bottom-5 right-5 z-50 bg-[#0B0F19] text-white px-5 py-3.5 rounded-2xl border border-white/10 shadow-xl text-[14px] font-medium max-w-sm"
            >
              {cartNotice}
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-x-clip">
          <AnimatePresence
            mode="wait"
            custom={navDirection}
            onExitComplete={() => {
              if (pendingScrollResetRef.current) {
                pendingScrollResetRef.current = false;
                window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
              }
            }}
          >
            <motion.div
              key={pageViewKey}
              custom={navDirection}
              variants={pageTransitionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {currentPage === 'home' && (
                <>
                  <HeroBanner
                    productCount={hotSellingProducts.length || products.length}
                    products={hotSellingProducts.length > 0 ? hotSellingProducts : products}
                    onShopNow={scrollToCatalog}
                    onBrowseCategories={() => handleNavigate('categories')}
                    onSelectProduct={handleSelectProduct}
                  />

                  <TrustBar />

                  {/* New Arrivals: Single-Row Carousel synced to WooCommerce New Arrival Category */}
                  <NewArrivalsCarousel
                    category={newArrivalCategory}
                    products={displayedNewArrivals}
                    loading={loadingCatalog}
                    addingProductId={addingProductId}
                    justAddedProductId={justAddedProductId}
                    wishlistIds={wishlistIds}
                    onToggleWishlist={handleToggleWishlist}
                    compareIds={compareProducts.map((item) => item.id)}
                    onToggleCompare={handleToggleCompare}
                    onSelectProduct={handleSelectProduct}
                    onQuickView={(p) => setQuickViewProduct(p)}
                    onSelectCategoryId={handleOpenCategory}
                    onViewAllArrivals={() =>
                      handleOpenCategory(newArrivalCategory ?? 'all')
                    }
                    onAddToCart={(p, variationId, variationAttrs, selectedAttrsMap) =>
                      handleAddToCart(p, 1, variationId, variationAttrs, selectedAttrsMap)
                    }
                  />

                  <CollectionSplitBanner
                    hotCategory={hotCategory}
                    goinfoevCategory={goinfoevCategory}
                    hotThumb={
                      hotSellingProducts[0]?.images?.[0]?.src ||
                      (hotCategory ? categoryThumbnails[hotCategory.id] : undefined)
                    }
                    goinfoevThumb={
                      goinfoevProducts[0]?.images?.[0]?.src ||
                      (goinfoevCategory ? categoryThumbnails[goinfoevCategory.id] : undefined)
                    }
                    onJumpToHot={scrollToCatalog}
                    onJumpToGoinfoev={scrollToGoinfoev}
                    onOpenCategoryPage={(cat) => handleOpenCategory(cat)}
                  />

                  {/* Section 1: Hot Selling 50$ Products (4 per row -> 8 initial + Load More) */}
                  <div ref={catalogRef}>
                    <ProductGrid
                      sectionId="hot-selling-section"
                      sectionBg="white"
                      products={hotSellingProducts}
                      categories={categories}
                      selectedCategoryId={hotCategory?.id ?? 18}
                      showCategorySelector={false}
                      gridColumns={4}
                      initialVisibleCount={8}
                      loadMoreStep={8}
                      searchQuery={searchQuery}
                      loading={loadingCatalog}
                      error={catalogError}
                      addingProductId={addingProductId}
                      justAddedProductId={justAddedProductId}
                      wishlistIds={wishlistIds}
                      onToggleWishlist={handleToggleWishlist}
                      compareIds={compareProducts.map((item) => item.id)}
                      onToggleCompare={handleToggleCompare}
                      onSelectCategoryId={handleOpenCategory}
                      onViewAllCategories={() => handleNavigate('categories')}
                      onViewFullCategory={
                        hotCategory ? () => handleOpenCategory(hotCategory) : undefined
                      }
                      onSearchChange={setSearchQuery}
                      onRefresh={() => loadCategoriesAndProducts(activeCatValue, false)}
                      onSelectProduct={handleSelectProduct}
                      onQuickView={(p) => setQuickViewProduct(p)}
                      onAddToCart={(p, variationId, variationAttrs, selectedAttrsMap) =>
                        handleAddToCart(p, 1, variationId, variationAttrs, selectedAttrsMap)
                      }
                    />
                  </div>

                  {/* Section 2: GOINFOEV Category Section (4 per row -> 8 initial + Load More) */}
                  <div ref={goinfoevRef}>
                    <ProductGrid
                      sectionId="goinfoev-section"
                      sectionBg="chalk"
                      products={goinfoevProducts}
                      categories={categories}
                      selectedCategoryId={goinfoevCategory?.id ?? 15}
                      showCategorySelector={false}
                      gridColumns={4}
                      initialVisibleCount={8}
                      loadMoreStep={8}
                      searchQuery={goinfoevSearchQuery}
                      loading={loadingCatalog}
                      error={catalogError}
                      addingProductId={addingProductId}
                      justAddedProductId={justAddedProductId}
                      wishlistIds={wishlistIds}
                      onToggleWishlist={handleToggleWishlist}
                      compareIds={compareProducts.map((item) => item.id)}
                      onToggleCompare={handleToggleCompare}
                      onSelectCategoryId={handleOpenCategory}
                      onViewAllCategories={() => handleNavigate('categories')}
                      onViewFullCategory={
                        goinfoevCategory
                          ? () => handleOpenCategory(goinfoevCategory)
                          : undefined
                      }
                      onSearchChange={setGoinfoevSearchQuery}
                      onRefresh={() => loadCategoriesAndProducts(activeCatValue, false)}
                      onSelectProduct={handleSelectProduct}
                      onQuickView={(p) => setQuickViewProduct(p)}
                      onAddToCart={(p, variationId, variationAttrs, selectedAttrsMap) =>
                        handleAddToCart(p, 1, variationId, variationAttrs, selectedAttrsMap)
                      }
                    />
                  </div>

                  <WhyFiftySection
                    products={hotSellingProducts.length > 0 ? hotSellingProducts : products}
                    onSelectProduct={handleSelectProduct}
                  />
                </>
              )}

              {(currentPage === 'shop' || currentPage === 'category') && (
                <>
                  <TrustBar />
                  <div ref={catalogRef}>
                    <ProductGrid
                      sectionId="category-catalog-section"
                      sectionBg="white"
                      products={products}
                      categories={categories}
                      selectedCategoryId={activeCatValue}
                      isCategoryPage={currentPage === 'category'}
                      showCategorySelector={true}
                      gridColumns={4}
                      initialVisibleCount={8}
                      loadMoreStep={8}
                      searchQuery={searchQuery}
                      loading={loadingCatalog}
                      error={catalogError}
                      addingProductId={addingProductId}
                      justAddedProductId={justAddedProductId}
                      wishlistIds={wishlistIds}
                      onToggleWishlist={handleToggleWishlist}
                      compareIds={compareProducts.map((item) => item.id)}
                      onToggleCompare={handleToggleCompare}
                      onSelectCategoryId={handleOpenCategory}
                      onViewAllCategories={() => handleNavigate('categories')}
                      onSearchChange={setSearchQuery}
                      onRefresh={() => loadCategoriesAndProducts(activeCatValue, false)}
                      onSelectProduct={handleSelectProduct}
                      onQuickView={(p) => setQuickViewProduct(p)}
                      onAddToCart={(p, variationId, variationAttrs, selectedAttrsMap) =>
                        handleAddToCart(p, 1, variationId, variationAttrs, selectedAttrsMap)
                      }
                    />
                  </div>
                </>
              )}

              {currentPage === 'categories' && (
                <CategoriesView
                  categories={categories}
                  categoryThumbnails={categoryThumbnails}
                  loading={loadingCatalog}
                  onSelectCategory={(cat) => handleOpenCategory(cat)}
                  onViewAllProducts={() => handleOpenCategory('all')}
                />
              )}

              {currentPage === 'wishlist' && (
                <WishlistView
                  items={wishlistProducts}
                  addingProductId={addingProductId}
                  justAddedProductId={justAddedProductId}
                  compareIds={compareProducts.map((item) => item.id)}
                  onToggleWishlist={handleToggleWishlist}
                  onToggleCompare={handleToggleCompare}
                  onClearWishlist={handleClearWishlist}
                  onSelectProduct={handleSelectProduct}
                  onQuickView={(p) => setQuickViewProduct(p)}
                  onSelectCategoryId={handleOpenCategory}
                  onContinueShopping={() => handleNavigate('shop')}
                  onAddToCart={(p, variationId, variationAttrs, selectedAttrsMap) =>
                    handleAddToCart(p, 1, variationId, variationAttrs, selectedAttrsMap)
                  }
                />
              )}

              {currentPage === 'product' && selectedProduct && (
                <ProductDetailView
                  product={selectedProduct}
                  isAdding={addingProductId === selectedProduct.id}
                  isWishlisted={wishlistIds.includes(selectedProduct.id)}
                  onToggleWishlist={handleToggleWishlist}
                  onBack={() => {
                    const cat = selectedProduct.categories?.[0];
                    if (cat) {
                      handleOpenCategory(cat.id);
                    } else {
                      handleNavigate('shop');
                    }
                  }}
                  onAddToCart={handleAddToCart}
                  onBuyNow={handleBuyNow}
                />
              )}

              {currentPage === 'cart' && (
                <CartView
                  cart={cart}
                  updatingKey={updatingCartKey}
                  onUpdateQuantity={handleUpdateCartQty}
                  onRemoveItem={handleRemoveCartItem}
                  onProceedToCheckout={() => handleNavigate('checkout')}
                  onContinueShopping={() => handleNavigate('shop')}
                />
              )}

              {currentPage === 'checkout' && (
                <CheckoutView
                  cart={cart}
                  onBackToShop={() => handleNavigate('shop')}
                  onCartUpdated={(updated) => setCart(updated)}
                  onOrderCompleted={() => loadCart()}
                />
              )}

              {(currentPage === 'about' ||
                currentPage === 'contact' ||
                currentPage === 'shipping-policy' ||
                currentPage === 'return-policy' ||
                currentPage === 'privacy-policy') && (
                <InfoPages page={currentPage} onNavigate={handleNavigate} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <Footer onNavigate={handleNavigate} />

        <CartDrawer
          open={cartOpen}
          cart={cart}
          updatingKey={updatingCartKey}
          onClose={() => setCartOpen(false)}
          onUpdateQuantity={handleUpdateCartQty}
          onRemoveItem={handleRemoveCartItem}
          onViewCart={() => {
            setCartOpen(false);
            handleNavigate('cart');
          }}
          onProceedToCheckout={() => {
            setCartOpen(false);
            handleNavigate('checkout');
          }}
          onShopNow={() => handleNavigate('shop')}
        />

        <WishlistDrawer
          open={wishlistOpen}
          items={wishlistProducts}
          addingProductId={addingProductId}
          onClose={() => setWishlistOpen(false)}
          onRemoveItem={handleRemoveWishlistItem}
          onClearAll={handleClearWishlist}
          onMoveToCart={(p) => {
            setWishlistOpen(false);
            handleAddToCart(p, 1);
          }}
          onSelectProduct={handleSelectProduct}
          onViewWishlistPage={() => handleNavigate('wishlist')}
          onShopNow={() => handleNavigate('shop')}
        />

        <SearchOverlay
          open={searchOpen}
          query={searchQuery}
          products={allSearchableProducts}
          onClose={() => setSearchOpen(false)}
          onQueryChange={setSearchQuery}
          onSelectProduct={handleSelectProduct}
          onViewAllResults={handleSearchSubmit}
        />

        <QuickViewModal
          product={quickViewProduct}
          isAdding={addingProductId === quickViewProduct?.id}
          isWishlisted={
            quickViewProduct ? wishlistIds.includes(quickViewProduct.id) : false
          }
          onToggleWishlist={handleToggleWishlist}
          onClose={() => setQuickViewProduct(null)}
          onAddToCart={handleAddToCart}
          onViewFullDetails={handleSelectProduct}
        />

        <CompareFloatingBar
          items={compareProducts}
          onOpenModal={() => setCompareModalOpen(true)}
          onRemoveItem={(id) =>
            setCompareProducts((prev) => prev.filter((item) => item.id !== id))
          }
          onClearAll={() => {
            setCompareProducts([]);
            setCompareModalOpen(false);
          }}
        />

        <CompareModal
          open={compareModalOpen}
          items={compareProducts}
          addingProductId={addingProductId}
          onClose={() => setCompareModalOpen(false)}
          onRemoveItem={(id) =>
            setCompareProducts((prev) => {
              const next = prev.filter((item) => item.id !== id);
              if (next.length === 0) setCompareModalOpen(false);
              return next;
            })
          }
          onSelectProduct={handleSelectProduct}
          onAddToCart={(p) => handleAddToCart(p, 1)}
        />
      </div>
    </MotionConfig>
  );
}
