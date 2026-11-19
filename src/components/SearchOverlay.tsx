import React, { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Package, Search, X } from 'lucide-react';
import type { WcProduct } from '../types/woocommerce';
import {
  decodeHtmlEntities,
  formatWcDecimalPrice,
  getRegularComparePrice,
} from '../utils/format';

interface SearchOverlayProps {
  open: boolean;
  query: string;
  products: WcProduct[];
  onClose: () => void;
  onQueryChange: (q: string) => void;
  onSelectProduct: (product: WcProduct) => void;
  onViewAllResults: (q: string) => void;
}

const POPULAR_TERMS = [
  'IPL Hair Removal',
  'Heated Vest',
  'Hair Dryer',
  'Massage Gun',
  'Smart Watch',
  'Water Flosser',
];

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  open,
  query,
  products,
  onClose,
  onQueryChange,
  onSelectProduct,
  onViewAllResults,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products
      .filter((p) => {
        const hay = `${decodeHtmlEntities(p.name)} ${p.sku || ''} ${p.categories?.map((c) => decodeHtmlEntities(c.name)).join(' ') || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [products, query]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Search store products"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B0F19]/55 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-2xl bg-white rounded-3xl border border-[#E2E5EC] shadow-2xl overflow-hidden"
          >
            {/* Search Input Header */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onViewAllResults(query);
                onClose();
              }}
              className="flex items-center gap-3 px-5 py-4 border-b border-[#E2E5EC]"
            >
              <Search className="w-5 h-5 text-[#5A6275] shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search heated vests, hair tools, massagers..."
                aria-label="Search products"
                className="flex-1 bg-transparent text-[15px] sm:text-[16px] text-[#0B0F19] placeholder:text-[#5A6275] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  className="text-[12px] font-medium text-[#5A6275] hover:text-[#0B0F19] px-2 py-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search"
                className="w-9 h-9 rounded-full hover:bg-[#ECEEF2] flex items-center justify-center text-[#0B0F19] cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Term Buttons */}
            <div className="px-5 py-3 bg-[#F4F5F8] border-b border-[#E2E5EC] flex items-center gap-2 overflow-x-auto">
              <span className="text-[12px] font-medium text-[#5A6275] whitespace-nowrap shrink-0">
                Trending:
              </span>
              {POPULAR_TERMS.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => onQueryChange(term)}
                  className="px-3 py-1 rounded-full bg-white border border-[#E2E5EC] hover:border-[#0B0F19] text-[12px] font-medium text-[#0B0F19] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>

            {/* Instant Results */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[#E2E5EC]">
              {matches.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-heading font-semibold text-[#0B0F19] text-[16px]">
                    No products match &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-[13.5px] text-[#5A6275] mt-1">
                    Try searching for Hair Dryer, Heated Blanket, Neck Massager, or Smart Watch.
                  </p>
                </div>
              ) : (
                matches.map((product) => {
                  const title = decodeHtmlEntities(product.name);
                  const img = product.images?.[0]?.src || '';
                  const price = formatWcDecimalPrice(
                    product.sale_price || product.price || '50',
                    false
                  );
                  const regular = getRegularComparePrice(product);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        onSelectProduct(product);
                        onClose();
                      }}
                      className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-[#F4F5F8] text-left transition-colors cursor-pointer group"
                    >
                      <div className="w-14 h-14 rounded-xl bg-[#ECEEF2] shrink-0 flex items-center justify-center overflow-hidden">
                        {img ? (
                          <img
                            src={img}
                            alt={title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain p-1.5 mix-blend-multiply"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-[#5A6275]" aria-hidden="true" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-[14.5px] text-[#0B0F19] group-hover:text-[#E54826] truncate transition-colors">
                          {title}
                        </p>
                        <p className="text-[12px] text-[#5A6275] mt-0.5 font-mono tabular-nums">
                          #{product.id} ·{' '}
                          {decodeHtmlEntities(
                            product.categories?.[0]?.name || 'Hot Selling 50$ Products'
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-heading font-extrabold text-[16px] text-[#E54826] tabular-nums">
                          {price}
                        </p>
                        <p className="text-[11.5px] text-[#5A6275] line-through tabular-nums">
                          ${regular}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {query.trim() && matches.length > 0 && (
              <div className="px-5 py-3 bg-[#F4F5F8] border-t border-[#E2E5EC] flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onViewAllResults(query);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 text-[13px] font-heading font-semibold text-[#0B0F19] hover:text-[#E54826] cursor-pointer transition-colors"
                >
                  <span>Show all matching items in catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
