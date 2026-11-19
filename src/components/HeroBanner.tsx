import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, Package } from 'lucide-react';
import type { WcProduct } from '../types/woocommerce';
import {
  decodeHtmlEntities,
  formatWcDecimalPrice,
  getRegularComparePrice,
} from '../utils/format';

interface HeroBannerProps {
  productCount: number;
  products?: WcProduct[];
  onShopNow: () => void;
  onBrowseCategories?: () => void;
  onSelectProduct?: (product: WcProduct) => void;
}

const HERO_IMAGE_SRC = '/src/assets/images/hero_trending_essentials_1795038705886.jpg';
const easeCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const heroItemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: easeCurve,
    },
  },
};

export const HeroBanner: React.FC<HeroBannerProps> = ({
  productCount,
  products = [],
  onShopNow,
  onBrowseCategories,
  onSelectProduct,
}) => {
  const [imgError, setImgError] = useState(false);

  const featuredTrio = useMemo(
    () => products.filter((p) => p.images && p.images.length > 0).slice(0, 3),
    [products]
  );

  return (
    <section className="relative bg-white border-b border-[#E2E5EC] overflow-hidden">
      {/* Subtle Architectural Studio Dot-Grid Texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-studio-grid opacity-55 [mask-image:radial-gradient(ellipse_at_top_left,black_25%,transparent_75%)]"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Editorial Typographic Column */}
          <motion.div
            variants={heroContainerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-6 flex flex-col justify-center"
          >
            <motion.p
              variants={heroItemVariants}
              className="text-[12.5px] font-mono font-semibold text-[#122B5C] tracking-wide mb-4"
            >
              USA Flat-Price Flagship · {productCount || 20} Curated Drops Live
            </motion.p>

            <motion.h1
              variants={heroItemVariants}
              className="type-h1 text-[#0B0F19] mb-5"
            >
              Viral USA Essentials. Locked at{' '}
              <span className="text-[#E54826]">$50 Flat.</span>
            </motion.h1>

            <motion.p
              variants={heroItemVariants}
              className="type-body text-[#5A6275] max-w-xl mb-8"
            >
              High-demand personal care tools, heated winter outerwear, and smart home wellness essentials that retail for $70–$200 across America — factory-direct at $50 with free tracked shipping nationwide.
            </motion.p>

            <motion.div
              variants={heroItemVariants}
              className="flex flex-wrap items-center gap-3.5 mb-12"
            >
              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.16, ease: easeCurve }}
                onClick={onShopNow}
                className="group type-button inline-flex items-center justify-center gap-2.5 bg-[#E54826] hover:bg-[#CC3B1C] text-white px-7 py-4 rounded-full shadow-[0_18px_36px_-12px_rgba(229,72,38,0.52)] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Shop $50 Bestsellers</span>
                <ArrowRight
                  className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </motion.button>

              {onBrowseCategories && (
                <button
                  type="button"
                  onClick={onBrowseCategories}
                  className="type-button inline-flex items-center justify-center gap-1.5 px-6 py-4 rounded-full border border-[#E2E5EC] hover:border-[#0B0F19] text-[#0B0F19] bg-[#F4F5F8] hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Explore Categories</span>
                </button>
              )}
            </motion.div>

            {/* Clean Architectural Metric Ledger */}
            <motion.div
              variants={heroItemVariants}
              className="grid grid-cols-3 pt-6 border-t border-[#E2E5EC] max-w-lg"
            >
              <div className="pr-4 border-r border-[#E2E5EC]">
                <p className="font-heading font-extrabold text-[24px] sm:text-[28px] text-[#0B0F19] tabular-nums leading-none">
                  $50
                </p>
                <p className="text-[12.5px] text-[#5A6275] mt-1.5">Flat price promise</p>
              </div>
              <div className="px-4 border-r border-[#E2E5EC]">
                <p className="font-heading font-extrabold text-[24px] sm:text-[28px] text-[#16A34A] tabular-nums leading-none">
                  50 States
                </p>
                <p className="text-[12.5px] text-[#5A6275] mt-1.5">Free tracked delivery</p>
              </div>
              <div className="pl-4">
                <p className="font-heading font-extrabold text-[24px] sm:text-[28px] text-[#0B0F19] tabular-nums leading-none">
                  50–75%
                </p>
                <p className="text-[12.5px] text-[#5A6275] mt-1.5">Below US retail</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Studio Visual Frame + Live Catalog Preview Strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.58, delay: 0.14, ease: easeCurve }}
            className="lg:col-span-6 flex flex-col gap-3.5"
          >
            <div className="w-full rounded-3xl overflow-hidden bg-[#ECEEF2] border border-[#E2E5EC] aspect-[16/10] relative shadow-[0_28px_60px_-28px_rgba(11,15,25,0.22)]">
              {!imgError ? (
                <motion.img
                  src={HERO_IMAGE_SRC}
                  alt="Curated wellness, beauty styling tools, and smart essentials available for $50 flat at FiftyDollarShop.com"
                  referrerPolicy="no-referrer"
                  initial={{ scale: 1.05, opacity: 0.88 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.85, ease: easeCurve }}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#F4F5F8] to-[#E2E5EC]">
                  <Package className="w-12 h-12 text-[#0B0F19] mb-3" aria-hidden="true" />
                  <p className="font-heading font-bold text-[#0B0F19] text-lg">
                    Curated $50 USA Essentials
                  </p>
                </div>
              )}

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0B0F19]/80 via-[#0B0F19]/25 to-transparent"
              />

              <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4 text-white">
                <div>
                  <p className="text-[11px] font-mono text-white/80">
                    US 110V Compatible · Ships Nationwide
                  </p>
                  <p className="font-heading font-semibold text-[15px] sm:text-[16px]">
                    Direct-to-Consumer Essentials Edit
                  </p>
                </div>
                <span className="font-heading font-extrabold text-[22px] text-white tabular-nums">
                  $50.00
                </span>
              </div>
            </div>

            {/* 3-Up Live Product Preview Strip Below Hero Photography */}
            {featuredTrio.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, delay: 0.28, ease: easeCurve }}
                className="grid grid-cols-3 gap-3"
              >
                {featuredTrio.map((item) => {
                  const title = decodeHtmlEntities(item.name);
                  const price = formatWcDecimalPrice(
                    item.sale_price || item.price || '50',
                    false
                  );
                  const regular = getRegularComparePrice(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectProduct?.(item)}
                      className="group bg-[#F4F5F8] hover:bg-white rounded-2xl border border-[#E2E5EC] hover:border-[#0B0F19]/25 p-2.5 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-[0_14px_30px_-18px_rgba(11,15,25,0.2)]"
                    >
                      <div className="w-full aspect-square rounded-xl bg-white overflow-hidden mb-2 flex items-center justify-center p-2">
                        <img
                          src={item.images[0]?.src}
                          alt={title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div>
                        <p className="font-heading font-semibold text-[12px] sm:text-[13px] text-[#0B0F19] group-hover:text-[#E54826] truncate transition-colors">
                          {title}
                        </p>
                        <div className="flex items-center justify-between gap-1 mt-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-heading font-extrabold text-[13.5px] text-[#E54826] tabular-nums">
                              {price}
                            </span>
                            <span className="text-[11px] text-[#5A6275] line-through tabular-nums">
                              ${regular}
                            </span>
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 text-[#5A6275] group-hover:text-[#0B0F19] shrink-0" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
