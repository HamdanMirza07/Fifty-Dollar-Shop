import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Package } from 'lucide-react';
import type { WcCategory } from '../types/woocommerce';
import { decodeHtmlEntities } from '../utils/format';

interface CollectionSplitBannerProps {
  hotCategory?: WcCategory;
  goinfoevCategory?: WcCategory;
  hotThumb?: string;
  goinfoevThumb?: string;
  onJumpToHot: () => void;
  onJumpToGoinfoev: () => void;
  onOpenCategoryPage: (cat: WcCategory) => void;
}

const easeCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const CollectionSplitBanner: React.FC<CollectionSplitBannerProps> = ({
  hotCategory,
  goinfoevCategory,
  hotThumb,
  goinfoevThumb,
  onJumpToHot,
  onJumpToGoinfoev,
  onOpenCategoryPage,
}) => {
  const hotName = hotCategory
    ? decodeHtmlEntities(hotCategory.name)
    : 'Hot Selling 50$ Products';
  const goName = goinfoevCategory
    ? decodeHtmlEntities(goinfoevCategory.name)
    : 'GOINFOEV';

  return (
    <section
      aria-label="Featured store categories"
      className="bg-[#F4F5F8] border-y border-[#E2E5EC] py-12 sm:py-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[12px] font-mono font-semibold text-[#122B5C] mb-1.5">
              Curated Store Collections
            </p>
            <h2 className="type-h2 text-[#0B0F19]">Two Live Collections, Direct Pricing</h2>
          </div>
          <p className="text-[14px] text-[#5A6275] max-w-md">
            Browse our flagship $50 flat-price bestsellers or explore activewear, beauty, and lifestyle drops in GOINFOEV.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Collection 01: High-Contrast Midnight Architectural Feature Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, ease: easeCurve }}
            className="group bg-[#0B0F19] text-white rounded-3xl border border-[#0B0F19] p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center transition-all duration-200 hover:shadow-[0_26px_54px_-24px_rgba(11,15,25,0.45)]"
          >
            <div className="sm:col-span-7 flex flex-col justify-between gap-4">
              <div>
                <p className="text-[12px] font-mono text-[#E54826] mb-1.5 tabular-nums">
                  01 · {hotCategory?.count ?? 20} Products · $50 Flat
                </p>
                <h3 className="font-heading font-bold text-[23px] sm:text-[26px] text-white leading-tight mb-2">
                  {hotName}
                </h3>
                <p className="text-[14px] text-white/70 leading-relaxed">
                  Viral personal care, heated winter apparel, and smart wellness tools locked at $50 flat with free USA shipping.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={onJumpToHot}
                  className="type-button px-5 py-2.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Shop $50 Deals</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                {hotCategory && (
                  <button
                    type="button"
                    onClick={() => onOpenCategoryPage(hotCategory)}
                    className="text-[13px] font-heading font-semibold text-white/80 hover:text-white underline-offset-4 hover:underline cursor-pointer"
                  >
                    Category Page
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-5 aspect-square rounded-2xl bg-[#F4F5F8] overflow-hidden flex items-center justify-center p-4">
              {hotThumb ? (
                <img
                  src={hotThumb}
                  alt={hotName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <Package className="w-10 h-10 text-[#5A6275]" aria-hidden="true" />
              )}
            </div>
          </motion.div>

          {/* Collection 02: Crisp Gallery White Feature Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.08, ease: easeCurve }}
            className="group bg-white rounded-3xl border border-[#E2E5EC] hover:border-[#0B0F19]/25 p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center transition-all duration-200 hover:shadow-[0_24px_50px_-24px_rgba(11,15,25,0.18)]"
          >
            <div className="sm:col-span-7 flex flex-col justify-between gap-4">
              <div>
                <p className="text-[12px] font-mono font-semibold text-[#122B5C] mb-1.5 tabular-nums">
                  02 · {goinfoevCategory?.count ?? 14} Products · Active &amp; Lifestyle
                </p>
                <h3 className="font-heading font-bold text-[23px] sm:text-[26px] text-[#0B0F19] leading-tight mb-2">
                  {goName}
                </h3>
                <p className="text-[14px] text-[#5A6275] leading-relaxed">
                  Sculpting activewear, thermal fleece essentials, beauty care, and smart eyewear curated for everyday style.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={onJumpToGoinfoev}
                  className="type-button px-5 py-2.5 rounded-full bg-[#0B0F19] hover:bg-[#E54826] text-white inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Explore {goName}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                {goinfoevCategory && (
                  <button
                    type="button"
                    onClick={() => onOpenCategoryPage(goinfoevCategory)}
                    className="text-[13px] font-heading font-semibold text-[#0B0F19] hover:text-[#E54826] underline-offset-4 hover:underline cursor-pointer"
                  >
                    Category Page
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-5 aspect-square rounded-2xl bg-[#F4F5F8] overflow-hidden flex items-center justify-center p-4">
              {goinfoevThumb ? (
                <img
                  src={goinfoevThumb}
                  alt={goName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <Package className="w-10 h-10 text-[#5A6275]" aria-hidden="true" />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
