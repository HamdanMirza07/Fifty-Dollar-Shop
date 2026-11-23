import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { AppPage } from '../../types/woocommerce';

interface ShippingPolicyPageProps {
  onNavigate: (page: AppPage) => void;
}

export const ShippingPolicyPage: React.FC<ShippingPolicyPageProps> = ({
  onNavigate,
}) => {
  const highlights = [
    {
      icon: Truck,
      value: 'Free ($0.00)',
      label: 'Every USA Order',
      detail: 'No minimum purchase required across all 50 states.',
      accent: 'text-[#16A34A]',
    },
    {
      icon: Clock,
      value: '1–2 Days',
      label: 'Order Processing',
      detail: 'Orders are verified, inspected, and packed within 1–2 business days.',
      accent: 'text-[#122B5C]',
    },
    {
      icon: PackageCheck,
      value: '7–15 Days',
      label: 'Tracked USA Delivery',
      detail: 'End-to-end parcel tracking emailed as soon as your order leaves our hub.',
      accent: 'text-[#E54826]',
    },
  ];

  const timelineSteps = [
    {
      step: '01.',
      title: 'Order Confirmation',
      time: 'Instant',
      desc: 'Right after checkout, you receive an order confirmation email summarizing your items, variations, and delivery address.',
    },
    {
      step: '02.',
      title: 'Quality Check & Dispatch',
      time: '1–2 Business Days',
      desc: 'Our fulfillment team verifies your selected size/color, inspects packaging integrity, and hands your parcel to our carrier partner.',
    },
    {
      step: '03.',
      title: 'Live Tracking Activated',
      time: 'Day 2–3',
      desc: 'A tracking link is sent to your email so you can follow every transit scan through US customs clearance and local USPS/UPS handoff.',
    },
    {
      step: '04.',
      title: 'Doorstep USA Delivery',
      time: '7–15 Business Days',
      desc: 'Delivered straight to your home or office across all 50 United States with zero surprise customs or brokerage fees.',
    },
  ];

  const zoneRows = [
    {
      region: 'Contiguous 48 US States',
      rate: 'Free ($0.00)',
      processing: '1–2 Business Days',
      delivery: '7–15 Business Days',
    },
    {
      region: 'Alaska & Hawaii',
      rate: 'Free ($0.00)',
      processing: '1–2 Business Days',
      delivery: '10–18 Business Days',
    },
    {
      region: 'PO Boxes & Residential Apartments',
      rate: 'Free ($0.00)',
      processing: '1–2 Business Days',
      delivery: '7–15 Business Days (USPS Final Mile)',
    },
  ];

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Header */}
      <div className="max-w-3xl">
        <p className="text-[12.5px] font-mono font-semibold text-[#122B5C] mb-2">
          Nationwide USA Fulfillment · Last Updated November 2026
        </p>
        <h1 className="type-h1 text-[#0B0F19] mb-4">
          Shipping Policy (7–15 Days)
        </h1>
        <p className="type-body text-[#5A6275]">
          Every order at FiftyDollarShop.com ships completely free to all 50 United States with full online tracking. Here is everything you can expect from checkout to doorstep delivery.
        </p>
      </div>

      {/* 3-Column Highlights */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E5EC]">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="p-6 sm:p-7">
              <div className="w-10 h-10 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] flex items-center justify-center mb-4">
                <Icon className={`w-5 h-5 ${item.accent}`} aria-hidden="true" />
              </div>
              <p className={`font-heading font-extrabold text-[26px] tabular-nums leading-none mb-1.5 ${item.accent}`}>
                {item.value}
              </p>
              <p className="font-heading font-semibold text-[15px] text-[#0B0F19] mb-1">
                {item.label}
              </p>
              <p className="text-[13.5px] text-[#5A6275] leading-relaxed">
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>

      {/* 4-Stage Fulfillment Timeline */}
      <div className="space-y-5">
        <div>
          <p className="text-[12px] font-mono font-semibold text-[#122B5C] mb-1">
            From Checkout to Doorstep
          </p>
          <h2 className="type-h2 text-[#0B0F19]">Order Fulfillment Timeline</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {timelineSteps.map((s) => (
            <div
              key={s.step}
              className="bg-white rounded-2xl border border-[#E2E5EC] p-5 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-[13px] font-semibold text-[#E54826]">
                    {s.step}
                  </span>
                  <span className="text-[11.5px] font-mono text-[#5A6275]">
                    {s.time}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-[16.5px] text-[#0B0F19] mb-2">
                  {s.title}
                </h3>
                <p className="text-[13.5px] text-[#5A6275] leading-relaxed">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery Zones Table */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] overflow-hidden">
        <div className="p-6 sm:p-7 border-b border-[#E2E5EC] flex items-center gap-2.5">
          <MapPin className="w-5 h-5 text-[#122B5C]" aria-hidden="true" />
          <h2 className="font-heading font-bold text-[20px] text-[#0B0F19]">
            USA Shipping Rates &amp; Delivery Estimates
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[540px]">
            <thead>
              <tr className="bg-[#F4F5F8] border-b border-[#E2E5EC] text-[12px] font-mono uppercase tracking-wider text-[#5A6275]">
                <th className="py-3.5 px-6">Destination</th>
                <th className="py-3.5 px-6">Shipping Cost</th>
                <th className="py-3.5 px-6">Processing</th>
                <th className="py-3.5 px-6">Estimated Transit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5EC] text-[14px]">
              {zoneRows.map((row) => (
                <tr key={row.region}>
                  <td className="py-4 px-6 font-semibold text-[#0B0F19]">
                    {row.region}
                  </td>
                  <td className="py-4 px-6 font-mono font-semibold text-[#16A34A] tabular-nums">
                    {row.rate}
                  </td>
                  <td className="py-4 px-6 text-[#5A6275] tabular-nums">
                    {row.processing}
                  </td>
                  <td className="py-4 px-6 font-medium text-[#0B0F19] tabular-nums">
                    {row.delivery}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Shipping Policies */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 divide-y divide-[#E2E5EC]">
        <div className="pb-6">
          <h3 className="font-heading font-bold text-[17px] text-[#0B0F19] mb-2">
            Tracking Updates &amp; Split Shipments
          </h3>
          <p className="text-[14.5px] text-[#5A6275] leading-relaxed">
            Once your parcel is scanned by our shipping carrier, tracking updates typically appear within 24–48 hours. If you order multiple items from different categories (for example, heated winter apparel alongside personal care tools), items may ship in separate packages at no extra cost so you receive each product as quickly as possible.
          </p>
        </div>

        <div className="py-6">
          <h3 className="font-heading font-bold text-[17px] text-[#0B0F19] mb-2">
            Address Accuracy &amp; Order Modifications
          </h3>
          <p className="text-[14.5px] text-[#5A6275] leading-relaxed">
            Please double-check your street address, apartment or suite number, and ZIP code before completing checkout. If you notice a typo after ordering, contact our USA support desk within 12 hours and we will update your shipping label prior to carrier pickup.
          </p>
        </div>

        <div className="pt-6">
          <div className="flex items-center gap-2 text-[#0B0F19] font-heading font-bold text-[17px] mb-2">
            <ShieldCheck className="w-5 h-5 text-[#16A34A]" aria-hidden="true" />
            <h3>Lost or Delayed Parcel Guarantee</h3>
          </div>
          <p className="text-[14.5px] text-[#5A6275] leading-relaxed">
            Your purchase is protected all the way to your doorstep. While peak US holiday periods or severe weather can occasionally add 2–3 transit days, if a shipment ever stalls without movement or is confirmed lost by the carrier, we immediately send a free replacement or issue a full refund.
          </p>
        </div>
      </div>

      {/* Bottom Action Card */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-1" aria-hidden="true" />
          <div>
            <h3 className="font-heading font-bold text-[18px] text-[#0B0F19]">
              Have a question about an active shipment?
            </h3>
            <p className="text-[14px] text-[#5A6275] mt-0.5">
              Reach out with your order number and our USA support team will check your carrier status within 24 hours.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('contact')}
          className="type-button px-6 py-3 rounded-full bg-[#0B0F19] hover:bg-[#E54826] text-white inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span>Contact USA Support</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
