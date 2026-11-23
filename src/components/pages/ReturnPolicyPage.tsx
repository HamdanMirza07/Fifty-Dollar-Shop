import React from 'react';
import {
  ArrowRight,
  Check,
  Clock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { AppPage } from '../../types/woocommerce';

interface ReturnPolicyPageProps {
  onNavigate: (page: AppPage) => void;
}

export const ReturnPolicyPage: React.FC<ReturnPolicyPageProps> = ({
  onNavigate,
}) => {
  const guarantees = [
    {
      icon: RotateCcw,
      value: '30 Days',
      label: 'Return Window',
      detail: 'Counted from the day your carrier marks the parcel delivered.',
      accent: 'text-[#122B5C]',
    },
    {
      icon: RefreshCw,
      value: 'Free Reship',
      label: 'Damaged or Defective',
      detail: 'Instant free replacement or full $50 refund if an item arrives faulty.',
      accent: 'text-[#16A34A]',
    },
    {
      icon: Clock,
      value: '3–5 Days',
      label: 'Fast Refund Processing',
      detail: 'Refunds are returned directly to your original payment method.',
      accent: 'text-[#E54826]',
    },
  ];

  const returnSteps = [
    {
      num: '01.',
      title: 'Reach Out Within 30 Days',
      desc: 'Open our Contact USA Support page with your order number, email address, and whether you prefer a refund or size/item replacement.',
    },
    {
      num: '02.',
      title: '24-Hour Approval & Instructions',
      desc: 'Our USA team reviews your request within 1 business day. For damaged or wrong items, simply attach a quick photo — no return shipping hassle required.',
    },
    {
      num: '03.',
      title: 'Send Back or Fast Replacement',
      desc: 'For standard unused returns or sizing exchanges, send the item back in its original packaging using the return address provided by our team.',
    },
    {
      num: '04.',
      title: 'Full Refund Issued',
      desc: 'As soon as your return is confirmed, we process your refund back to your original card or payment method within 3–5 business days.',
    },
  ];

  const eligibleItems = [
    'Items that arrive damaged, broken, or defective out of the box',
    'Incorrect size, color, or product delivered compared to your order',
    'Unused items in original packaging with all accessories included',
    'Apparel or activewear exchanges for a different size within 30 days',
  ];

  const exceptions = [
    'Return requests submitted more than 30 days after confirmed delivery',
    'Items showing heavy wear, intentional damage, or missing core parts',
    'Personal hygiene or skincare items that have been opened and used (unless defective)',
    'Returns mailed back without first contacting our support desk for authorization',
  ];

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Header */}
      <div className="max-w-3xl">
        <p className="text-[12.5px] font-mono font-semibold text-[#122B5C] mb-2">
          USA Buyer Protection · Last Updated November 2026
        </p>
        <h1 className="type-h1 text-[#0B0F19] mb-4">
          30-Day Return &amp; Refund Policy
        </h1>
        <p className="type-body text-[#5A6275]">
          Shop with complete confidence. Every order placed on FiftyDollarShop.com is backed by our straightforward 30-day satisfaction, exchange, and damage protection guarantee.
        </p>
      </div>

      {/* 3-Column Guarantee Strip */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E5EC]">
        {guarantees.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.label} className="p-6 sm:p-7">
              <div className="w-10 h-10 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] flex items-center justify-center mb-4">
                <Icon className={`w-5 h-5 ${g.accent}`} aria-hidden="true" />
              </div>
              <p className={`font-heading font-extrabold text-[26px] tabular-nums leading-none mb-1.5 ${g.accent}`}>
                {g.value}
              </p>
              <p className="font-heading font-semibold text-[15px] text-[#0B0F19] mb-1">
                {g.label}
              </p>
              <p className="text-[13.5px] text-[#5A6275] leading-relaxed">
                {g.detail}
              </p>
            </div>
          );
        })}
      </div>

      {/* 4-Step Return Process */}
      <div className="space-y-5">
        <div>
          <p className="text-[12px] font-mono font-semibold text-[#122B5C] mb-1">
            Simple &amp; Stress-Free
          </p>
          <h2 className="type-h2 text-[#0B0F19]">How to Start a Return</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {returnSteps.map((step) => (
            <div
              key={step.num}
              className="bg-white rounded-2xl border border-[#E2E5EC] p-5 flex flex-col gap-2.5"
            >
              <span className="font-mono text-[13px] font-semibold text-[#E54826]">
                {step.num}
              </span>
              <h3 className="font-heading font-bold text-[16.5px] text-[#0B0F19]">
                {step.title}
              </h3>
              <p className="text-[13.5px] text-[#5A6275] leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Eligibility Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-7">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#16A34A]" aria-hidden="true" />
            <h2 className="font-heading font-bold text-[19px] text-[#0B0F19]">
              Covered for Return or Replacement
            </h2>
          </div>
          <ul className="space-y-3 text-[14px] text-[#5A6275]">
            {eligibleItems.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-7">
          <div className="flex items-center gap-2 mb-4">
            <X className="w-5 h-5 text-[#5A6275]" aria-hidden="true" />
            <h2 className="font-heading font-bold text-[19px] text-[#0B0F19]">
              Return Exceptions
            </h2>
          </div>
          <ul className="space-y-3 text-[14px] text-[#5A6275]">
            {exceptions.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <X className="w-4 h-4 text-[#5A6275]/70 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Exchanges & Order Cancellations */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 divide-y divide-[#E2E5EC]">
        <div className="pb-6">
          <h3 className="font-heading font-bold text-[17px] text-[#0B0F19] mb-2">
            Size &amp; Color Exchanges
          </h3>
          <p className="text-[14.5px] text-[#5A6275] leading-relaxed">
            Ordered a heated vest, posture belt, or activewear piece and need a different size? Contact our team within 30 days of delivery with your order number and preferred size so we can coordinate a fast exchange.
          </p>
        </div>
        <div className="pt-6">
          <h3 className="font-heading font-bold text-[17px] text-[#0B0F19] mb-2">
            Order Cancellations
          </h3>
          <p className="text-[14.5px] text-[#5A6275] leading-relaxed">
            Orders can be cancelled for a full refund anytime before carrier dispatch (typically within 12 hours of checkout). Once a parcel has entered transit, you may still use our 30-day return policy upon arrival.
          </p>
        </div>
      </div>

      {/* Start a Return CTA */}
      <div className="rounded-3xl bg-[#0B0F19] text-white p-7 sm:p-9 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="max-w-xl">
          <p className="text-[12px] font-mono text-[#E54826] mb-1.5">
            Fast 24-Hour Resolution
          </p>
          <h2 className="font-heading font-bold text-[22px] sm:text-[26px]">
            Need to Start a Return or Exchange?
          </h2>
          <p className="text-[14px] text-white/75 mt-1.5">
            Message our USA support team with your order number and we will guide you through every step.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('contact')}
          className="type-button px-7 py-3.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span>Start a Return</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
