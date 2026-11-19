import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, RotateCcw, ShieldCheck, Truck } from 'lucide-react';

export const TrustBar: React.FC = () => {
  const items = [
    {
      icon: Truck,
      title: 'Free Shipping in USA',
      detail: 'All 50 states, zero minimums',
    },
    {
      icon: ShieldCheck,
      title: '256-Bit Encrypted Checkout',
      detail: 'Verified buyer protection',
    },
    {
      icon: CheckCircle2,
      title: '7–15 Days Delivery',
      detail: 'Tracked nationwide fulfillment',
    },
    {
      icon: RotateCcw,
      title: '30-Day Easy Returns',
      detail: 'Hassle-free USA buyer guarantee',
    },
  ];

  return (
    <section
      aria-label="Store guarantees"
      className="bg-[#F4F5F8] border-b border-[#E2E5EC]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x divide-[#E2E5EC]">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 0.35,
                  delay: idx * 0.04,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex items-start gap-3 py-5 sm:py-6 lg:px-6 first:lg:pl-0 last:lg:pr-0"
              >
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E2E5EC] text-[#122B5C] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Icon className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-[13.5px] sm:text-[14px] text-[#0B0F19] leading-snug">
                    {item.title}
                  </p>
                  <p className="text-[12px] sm:text-[13px] text-[#5A6275] leading-snug mt-0.5">
                    {item.detail}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
