import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, FolderOpen, Layers, Package } from 'lucide-react';
import type { WcCategory } from '../types/woocommerce';
import { decodeHtmlEntities, stripHtmlToText } from '../utils/format';

interface CategoriesViewProps {
  categories: WcCategory[];
  categoryThumbnails: Record<number, string>;
  loading: boolean;
  onSelectCategory: (category: WcCategory) => void;
  onViewAllProducts: () => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  categoryThumbnails,
  loading,
  onSelectCategory,
  onViewAllProducts,
}) => {
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});

  return (
    <section className="bg-[#F4F5F8] py-12 sm:py-16 min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 pb-6 border-b border-[#E2E5EC]">
          <div>
            <p className="text-[12.5px] font-mono font-semibold text-[#122B5C] mb-1.5">
              Store Category Directory
            </p>
            <h1 className="type-h1 text-[#0B0F19]">Shop by Category</h1>
            <p className="type-body text-[#5A6275] mt-2 max-w-2xl">
              Browse our flagship $50 hot-selling collection or explore our curated store categories.
            </p>
          </div>

          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={onViewAllProducts}
            className="type-button px-6 py-3 rounded-full bg-[#0B0F19] hover:bg-[#E54826] text-white inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            <Layers className="w-4 h-4" aria-hidden="true" />
            <span>Browse All Products</span>
          </motion.button>
        </div>

        {loading && categories.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-[#E2E5EC] p-5 animate-pulse"
              >
                <div className="aspect-[4/3] bg-[#F4F5F8] rounded-xl mb-4" />
                <div className="h-5 w-2/3 bg-[#F4F5F8] rounded mb-2" />
                <div className="h-4 w-full bg-[#F4F5F8] rounded" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2E5EC] p-10 text-center">
            <FolderOpen className="w-10 h-10 text-[#5A6275] mx-auto mb-3" aria-hidden="true" />
            <p className="font-heading font-semibold text-[18px] text-[#0B0F19]">
              No categories found right now
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {categories.map((cat, idx) => {
              const title = decodeHtmlEntities(cat.name);
              const desc = stripHtmlToText(cat.description);
              const imgUrl = cat.image?.src || categoryThumbnails[cat.id] || '';
              const hasFailed = failedImages[cat.id];
              const isFlagship =
                cat.slug === 'hot-sale' ||
                title.toLowerCase().includes('hot selling');

              return (
                <motion.article
                  key={cat.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.36,
                    delay: idx * 0.05,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  whileHover={{ y: -3 }}
                  className="group bg-white rounded-2xl border border-[#E2E5EC] hover:border-[#0B0F19]/25 p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-[0_22px_46px_-22px_rgba(11,15,25,0.2)]"
                >
                  <div>
                    <button
                      type="button"
                      onClick={() => onSelectCategory(cat)}
                      className="w-full aspect-[4/3] bg-[#F4F5F8] rounded-xl overflow-hidden mb-4 flex items-center justify-center cursor-pointer"
                      aria-label={`Open ${title} category`}
                    >
                      {imgUrl && !hasFailed ? (
                        <img
                          src={imgUrl}
                          alt={title}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [cat.id]: true }))
                          }
                          className="w-full h-full object-contain p-4 mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                          <Package className="w-10 h-10 text-[#5A6275] mb-2" aria-hidden="true" />
                          <span className="text-[13px] font-medium text-[#5A6275]">
                            {title}
                          </span>
                        </div>
                      )}
                    </button>

                    <div className="flex items-center gap-2 text-[12px] text-[#5A6275] mb-1.5 px-1">
                      <span className="font-mono tabular-nums">Category #{cat.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums font-semibold text-[#0B0F19]">
                        {cat.count} {cat.count === 1 ? 'Product' : 'Products'}
                      </span>
                    </div>

                    <h2 className="font-heading font-bold text-[20px] text-[#0B0F19] mb-2 px-1">
                      {title}
                    </h2>

                    <p className="text-[14px] text-[#5A6275] mb-5 px-1 line-clamp-2 min-h-[2.8em]">
                      {desc ||
                        (isFlagship
                          ? 'Trending USA bestsellers locked at $50 flat with Free USA Shipping.'
                          : `Featured trending products in ${title}.`)}
                    </p>
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelectCategory(cat)}
                    className={`type-button w-full py-3 px-5 rounded-full inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                      isFlagship
                        ? 'bg-[#E54826] hover:bg-[#CC3B1C] text-white'
                        : 'bg-[#0B0F19] hover:bg-[#E54826] text-white'
                    }`}
                  >
                    <span>View {cat.count} Products</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                  </motion.button>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
