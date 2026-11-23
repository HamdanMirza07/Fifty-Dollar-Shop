import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  Package,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import type { AppPage } from '../../types/woocommerce';

interface AboutPageProps {
  onNavigate: (page: AppPage) => void;
}

const CRAFT_IMAGE_SRC =
  '/src/assets/images/editorial_factory_craft_1795041233046.jpg';
const easeCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  const [imgError, setImgError] = useState(false);

  const metrics = [
    {
      value: '$50 Flat',
      label: 'One Honest Price',
      detail: 'Every flagship hot-selling item locked at $50 with zero hidden markups.',
      accent: 'text-[#E54826]',
    },
    {
      value: '$0.00',
      label: 'Free USA Shipping',
      detail: 'Tracked nationwide delivery across all 50 US states with no minimum order.',
      accent: 'text-[#16A34A]',
    },
    {
      value: '7–15 Days',
      label: 'Tracked Fulfillment',
      detail: 'Inspected before dispatch with live email tracking updates to your door.',
      accent: 'text-[#0B0F19]',
    },
    {
      value: '30 Days',
      label: 'Buyer Protection',
      detail: 'Straightforward returns, sizing help, or free replacement if damaged.',
      accent: 'text-[#122B5C]',
    },
  ];

  const steps = [
    {
      num: '01.',
      title: 'Direct Manufacturer Partnerships',
      body: 'Instead of paying importers, regional distributors, and department store leases that inflate retail prices to $120–$200, we partner directly with audited production lines.',
    },
    {
      num: '02.',
      title: 'US 110V & Quality Verification',
      body: 'Every electrical personal-care tool, heated winter vest, and wellness device is checked for US voltage compatibility, clean packaging, and dependable everyday durability.',
    },
    {
      num: '03.',
      title: 'Transparent Flat-Rate Pricing',
      body: 'No inflated MSRP games or surprise shipping charges at checkout. What you see on the product card is what you pay — $50 flat with free tracked delivery anywhere in America.',
    },
  ];

  const comparisonRows = [
    {
      feature: 'Typical Price for Trending Wellness & Beauty Tech',
      retail: '$90 – $200',
      ours: '$50 Flat',
    },
    {
      feature: 'Standard USA Tracked Shipping',
      retail: '$9.95 – $18.00',
      ours: 'Always Free ($0)',
    },
    {
      feature: 'Middleman & Mall Retail Markups',
      retail: '3x – 4x Markup',
      ours: 'Eliminated (Factory Direct)',
    },
    {
      feature: '30-Day Satisfaction & Damage Protection',
      retail: 'Restocking Fees Often Apply',
      ours: 'Included on Every Order',
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Editorial Hero Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: easeCurve }}
          className="lg:col-span-7 flex flex-col justify-center"
        >
          <p className="text-[12.5px] font-mono font-semibold text-[#122B5C] mb-3">
            About FiftyDollarShop.com · Founded for Smart US Shoppers
          </p>
          <h1 className="type-h1 text-[#0B0F19] mb-5">
            Built for USA Shoppers Who Refuse to Overpay
          </h1>
          <p className="type-body text-[#5A6275] mb-4 max-w-2xl">
            FiftyDollarShop.com started with a simple observation: American shoppers were paying $90 to $200 for viral beauty styling tools, heated winter outerwear, recovery massagers, and smart lifestyle essentials that come off the exact same factory lines as luxury-labeled brands.
          </p>
          <p className="type-body text-[#5A6275] mb-7 max-w-2xl">
            We removed traditional retail middlemen and built one straightforward destination where trending essentials are curated honestly — locked at $50 flat with free tracked shipping to all 50 states.
          </p>

          <div className="flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              onClick={() => onNavigate('shop')}
              className="type-button px-7 py-3.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center gap-2 cursor-pointer transition-colors shadow-[0_14px_30px_-12px_rgba(229,72,38,0.45)]"
            >
              <span>Shop Hot Selling $50</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="type-button px-6 py-3.5 rounded-full bg-white border border-[#E2E5EC] hover:border-[#0B0F19] text-[#0B0F19] cursor-pointer transition-colors"
            >
              Contact USA Support
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, delay: 0.08, ease: easeCurve }}
          className="lg:col-span-5 flex"
        >
          <div className="w-full rounded-3xl overflow-hidden bg-[#ECEEF2] border border-[#E2E5EC] relative min-h-[280px] sm:min-h-[340px]">
            {!imgError ? (
              <img
                src={CRAFT_IMAGE_SRC}
                alt="Curated personal care, wellness, and smart home essentials offered at FiftyDollarShop.com"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover lg:absolute lg:inset-0"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                <Package className="w-10 h-10 text-[#5A6275] mb-3" aria-hidden="true" />
                <p className="font-heading font-semibold text-[#0B0F19]">
                  Direct-to-Consumer Quality Standards
                </p>
              </div>
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0B0F19]/85 via-[#0B0F19]/30 to-transparent"
            />
            <div className="absolute bottom-5 left-5 right-5 text-white">
              <p className="text-[11px] font-mono text-[#4ADE80]">
                Direct-to-Consumer Standard
              </p>
              <p className="font-heading font-semibold text-[16px] mt-0.5">
                Curated, Inspected &amp; Shipped Nationwide
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 4-Column Key Commitments Ledger */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E5EC]">
        {metrics.map((m) => (
          <div key={m.label} className="p-6 sm:p-7">
            <p className={`font-heading font-extrabold text-[28px] tabular-nums leading-none mb-2 ${m.accent}`}>
              {m.value}
            </p>
            <p className="font-heading font-semibold text-[15px] text-[#0B0F19] mb-1.5">
              {m.label}
            </p>
            <p className="text-[13.5px] text-[#5A6275] leading-relaxed">
              {m.detail}
            </p>
          </div>
        ))}
      </div>

      {/* How Our $50 Model Works */}
      <div className="space-y-6">
        <div>
          <p className="text-[12px] font-mono font-semibold text-[#122B5C] mb-1.5">
            How It Works
          </p>
          <h2 className="type-h2 text-[#0B0F19]">
            How We Keep Trending Products at Half the US Retail Price
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.num}
              className="bg-white rounded-2xl border border-[#E2E5EC] p-6 sm:p-7 flex flex-col gap-3"
            >
              <span className="font-mono text-[13px] font-semibold text-[#E54826]">
                {step.num}
              </span>
              <h3 className="font-heading font-bold text-[18px] text-[#0B0F19]">
                {step.title}
              </h3>
              <p className="text-[14.5px] text-[#5A6275] leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Traditional US Retail vs FiftyDollarShop.com */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-[#E2E5EC]">
          <p className="text-[12px] font-mono font-semibold text-[#122B5C] mb-1">
            Honest Breakdown
          </p>
          <h2 className="font-heading font-bold text-[22px] sm:text-[26px] text-[#0B0F19]">
            Traditional US Retail vs. FiftyDollarShop.com
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-[#F4F5F8] border-b border-[#E2E5EC] text-[12px] font-mono uppercase tracking-wider text-[#5A6275]">
                <th className="py-3.5 px-6">What Matters</th>
                <th className="py-3.5 px-6">Big-Box &amp; Mall Retail</th>
                <th className="py-3.5 px-6 text-[#0B0F19]">FiftyDollarShop.com</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5EC] text-[14px]">
              {comparisonRows.map((row) => (
                <tr key={row.feature}>
                  <td className="py-4 px-6 font-medium text-[#0B0F19]">
                    {row.feature}
                  </td>
                  <td className="py-4 px-6 text-[#5A6275]">
                    <span className="inline-flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5 text-[#5A6275]/70 shrink-0" aria-hidden="true" />
                      <span>{row.retail}</span>
                    </span>
                  </td>
                  <td className="py-4 px-6 font-semibold text-[#0B0F19]">
                    <span className="inline-flex items-center gap-1.5 text-[#16A34A]">
                      <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="text-[#0B0F19]">{row.ours}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Trust Banner */}
      <div className="rounded-3xl bg-[#0B0F19] text-white p-7 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-[12px] font-mono text-[#E54826] mb-2">
            Ready to See What&apos;s Trending?
          </p>
          <h2 className="font-heading font-bold text-[24px] sm:text-[28px] leading-tight">
            Every Order Ships Free Across All 50 States.
          </h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-[13.5px] text-white/75">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-[#4ADE80]" aria-hidden="true" />
              <span>7–15 Days Tracked USA Delivery</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#4ADE80]" aria-hidden="true" />
              <span>30-Day Money-Back Guarantee</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('shop')}
            className="type-button px-6 py-3.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <span>Browse $50 Deals</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('categories')}
            className="type-button px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
          >
            All Categories
          </button>
        </div>
      </div>
    </div>
  );
};
