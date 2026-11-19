import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Package } from 'lucide-react';
import type { WcProduct } from '../types/woocommerce';
import {
  decodeHtmlEntities,
  formatWcDecimalPrice,
  getRegularComparePrice,
} from '../utils/format';

interface WhyFiftySectionProps {
  products?: WcProduct[];
  onSelectProduct?: (product: WcProduct) => void;
}

const CRAFT_IMAGE_SRC = '/src/assets/images/editorial_factory_craft_1795041233046.jpg';
const easeCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const WhyFiftySection: React.FC<WhyFiftySectionProps> = ({
  products = [],
  onSelectProduct,
}) => {
  const [craftImgError, setCraftImgError] = useState(false);

  const pillars = [
    {
      num: '01.',
      title: 'Direct From Verified Factories',
      description:
        'Big US retail brands add 3x–4x markups for mall leases and middlemen. We source directly from the same certified production lines.',
    },
    {
      num: '02.',
      title: 'One Simple $50 Flat Price',
      description:
        'No surprise fees at checkout. Every IPL device, high-speed hair dryer, heated vest, and smart wearable is locked at $50 flat.',
    },
    {
      num: '03.',
      title: 'Free Tracked USA Delivery',
      description:
        'Every order ships free anywhere in the 50 US states with 7–15 day tracked delivery and a 30-day no-hassle return policy.',
    },
  ];

  const ledgerProducts = products.slice(0, 4);

  return (
    <section className="bg-[#0B0F19] text-[#F4F5F8] py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Asymmetric Editorial Top Spread */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch mb-16">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.45, ease: easeCurve }}
            className="lg:col-span-6 flex flex-col justify-between gap-8"
          >
            <div>
              <p className="text-[12.5px] font-mono text-[#E54826] mb-3 tracking-wide">
                Transparent Direct Pricing
              </p>
              <h2 className="type-h2 text-white">
                Why Pay $70-$200 in USA? Get the Same Trending Products for $50 Only
              </h2>
              <p className="type-body text-white/70 mt-4 max-w-xl">
                We eliminate traditional retail markups so US shoppers get high-demand wellness, beauty, and winter tech at a single honest price.
              </p>
            </div>

            {/* Live Price Reality Ledger */}
            {ledgerProducts.length > 0 && (
              <div className="border-t border-white/12 pt-5">
                <div className="flex items-center justify-between text-[11.5px] font-mono text-white/50 pb-2.5 border-b border-white/10">
                  <span>Live Catalog Comparison</span>
                  <span>US Retail vs. Ours</span>
                </div>
                <div className="divide-y divide-white/10">
                  {ledgerProducts.map((p) => {
                    const regular = getRegularComparePrice(p);
                    const ours = formatWcDecimalPrice(
                      p.sale_price || p.price || '50',
                      false
                    );
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectProduct?.(p)}
                        className="w-full py-3 flex items-center justify-between gap-4 text-left hover:bg-white/[0.04] px-1.5 -mx-1.5 rounded-lg transition-colors cursor-pointer group"
                      >
                        <span className="text-[14px] font-medium text-white/90 group-hover:text-white truncate">
                          {decodeHtmlEntities(p.name)}
                        </span>
                        <span className="flex items-center gap-3 shrink-0 font-mono tabular-nums text-[13.5px]">
                          <span className="text-white/45 line-through">${regular}</span>
                          <span className="font-bold text-[#E54826]">{ours}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-white/40 group-hover:text-[#E54826] transition-colors" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* Right Studio Craftsmanship Photography */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.52, delay: 0.08, ease: easeCurve }}
            className="lg:col-span-6 flex"
          >
            <div className="w-full rounded-3xl overflow-hidden bg-[#131926] border border-white/12 relative min-h-[280px] sm:min-h-[360px]">
              {!craftImgError ? (
                <img
                  src={CRAFT_IMAGE_SRC}
                  alt="Matte black styling tools, brushed metal wellness massager, and smart watch arranged on travertine and brushed steel"
                  referrerPolicy="no-referrer"
                  onError={() => setCraftImgError(true)}
                  className="w-full h-full object-cover lg:absolute lg:inset-0"
                />
              ) : (
                <div className="w-full h-full min-h-[280px] flex flex-col items-center justify-center p-8 text-center">
                  <Package className="w-10 h-10 text-white/40 mb-3" aria-hidden="true" />
                  <p className="font-heading font-semibold text-white">
                    Factory-Direct Quality Standards
                  </p>
                </div>
              )}

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0B0F19]/90 via-[#0B0F19]/35 to-transparent"
              />

              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11.5px] font-mono text-[#4ADE80]">
                    FiftyDollarShop.com Standard
                  </p>
                  <p className="font-heading font-semibold text-[16px] text-white mt-0.5">
                    US 110V Compatible · Inspected Before Dispatch
                  </p>
                </div>
                <span className="font-heading font-extrabold text-[26px] text-[#E54826] tabular-nums leading-none shrink-0">
                  $50
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Hairline-Divided 3 Editorial Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-white/12 divide-y md:divide-y-0 md:divide-x divide-white/12">
          {pillars.map((pillar, idx) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.38, delay: idx * 0.05, ease: easeCurve }}
              className="pt-8 md:pt-10 md:px-8 first:md:pl-0 last:md:pr-0 flex flex-col gap-3"
            >
              <span className="font-mono text-[13px] font-semibold text-[#E54826]">
                {pillar.num}
              </span>
              <h3 className="font-heading font-semibold text-[19px] text-white">
                {pillar.title}
              </h3>
              <p className="type-body text-white/70">{pillar.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
