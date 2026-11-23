import React from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import type { AppPage } from '../../types/woocommerce';

interface PrivacyPolicyPageProps {
  onNavigate: (page: AppPage) => void;
}

const SECTIONS = [
  {
    id: 'privacy-collection',
    num: '01.',
    title: 'Information We Collect',
    paragraphs: [
      'When you place an order, save products to your wishlist, or reach out to our USA support team at FiftyDollarShop.com, we collect only the information necessary to deliver your purchase and assist you.',
      'This includes your full name, US shipping and billing address, email address, phone number (for carrier delivery notifications), order details, and any messages you submit through our Contact form.',
    ],
  },
  {
    id: 'privacy-usage',
    num: '02.',
    title: 'How We Use Your Information',
    paragraphs: [
      'We use your personal information strictly to process and ship your orders, send automated tracking links, verify delivery issues, process 30-day returns or refunds, prevent fraudulent transactions, and respond to support requests.',
      'If you choose to subscribe to our $50 restock and product drop alerts, we use your email solely to send store updates. You may opt out at any time with a single click or by emailing support@fiftydollarshop.com.',
    ],
  },
  {
    id: 'privacy-security',
    num: '03.',
    title: 'Payment Security & Encryption',
    paragraphs: [
      'All storefront traffic and checkout submissions are transmitted over 256-bit HTTPS/TLS encryption. Sensitive payment details are processed directly by our PCI-compliant payment infrastructure — FiftyDollarShop.com never stores raw credit card numbers or CVV codes on our servers.',
    ],
  },
  {
    id: 'privacy-storage',
    num: '04.',
    title: 'Browser Storage & Session Preferences',
    paragraphs: [
      'To deliver a smooth shopping experience across visits, we use lightweight browser localStorage to preserve your saved Wishlist items and active shopping cart session token on your device. You can clear your saved wishlist anytime from the Wishlist page or your browser settings.',
    ],
  },
  {
    id: 'privacy-sharing',
    num: '05.',
    title: 'Zero Data Selling & Fulfillment Partners',
    paragraphs: [
      'We never sell, rent, or trade your personal information to data brokers or third-party marketers. We share limited delivery details (name, shipping address, and phone/email for tracking alerts) exclusively with trusted logistics and carrier partners (such as USPS and UPS) strictly so your parcel reaches your door.',
    ],
  },
  {
    id: 'privacy-rights',
    num: '06.',
    title: 'Your US Privacy Rights (CCPA & State Laws)',
    paragraphs: [
      'Residents of California and other US states with consumer privacy statutes have the right to request access to the personal information we hold about them, request deletion of their personal data (subject to legal order-record retention), and receive equal service without discrimination.',
      'To exercise any privacy right or request data deletion, email support@fiftydollarshop.com or submit a request via our Contact USA Support page and we will fulfill verified requests promptly.',
    ],
  },
];

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({
  onNavigate,
}) => {
  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Header */}
      <div className="max-w-3xl">
        <p className="text-[12.5px] font-mono font-semibold text-[#122B5C] mb-2">
          Privacy &amp; Data Protection · Effective November 2026
        </p>
        <h1 className="type-h1 text-[#0B0F19] mb-4">Privacy Policy</h1>
        <p className="type-body text-[#5A6275]">
          FiftyDollarShop.com respects your privacy. This policy explains in clear, plain English what information we collect when you shop with us, how we safeguard it, and the rights you hold as a US consumer.
        </p>
      </div>

      {/* Plain-English Commitment Strip */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E5EC]">
        <div className="p-6 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-heading font-bold text-[15px] text-[#0B0F19]">
              We Never Sell Your Data
            </p>
            <p className="text-[13.5px] text-[#5A6275] mt-0.5">
              Customer details are never sold or rented to third parties.
            </p>
          </div>
        </div>
        <div className="p-6 flex items-start gap-3">
          <Lock className="w-5 h-5 text-[#122B5C] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-heading font-bold text-[15px] text-[#0B0F19]">
              256-Bit Encrypted Checkout
            </p>
            <p className="text-[13.5px] text-[#5A6275] mt-0.5">
              All orders and inquiries are protected over HTTPS/TLS.
            </p>
          </div>
        </div>
        <div className="p-6 flex items-start gap-3">
          <Mail className="w-5 h-5 text-[#E54826] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-heading font-bold text-[15px] text-[#0B0F19]">
              Full Deletion On Request
            </p>
            <p className="text-[13.5px] text-[#5A6275] mt-0.5">
              Request access or deletion anytime via USA Support.
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Sticky Contents + Structured Legal Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-4 lg:sticky lg:top-24 bg-white rounded-3xl border border-[#E2E5EC] p-6">
          <p className="text-[12px] font-mono font-semibold text-[#122B5C] mb-3">
            Policy Contents
          </p>
          <nav aria-label="Privacy policy sections" className="space-y-1.5">
            {SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                className="flex items-baseline gap-2.5 px-3 py-2 rounded-xl text-[13.5px] font-medium text-[#5A6275] hover:text-[#0B0F19] hover:bg-[#F4F5F8] transition-colors"
              >
                <span className="font-mono text-[11.5px] text-[#E54826] shrink-0">
                  {sec.num}
                </span>
                <span>{sec.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        <div className="lg:col-span-8 bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-9 divide-y divide-[#E2E5EC]">
          {SECTIONS.map((sec) => (
            <section
              key={sec.id}
              id={sec.id}
              className="py-6 first:pt-0 last:pb-0 scroll-mt-24"
            >
              <p className="text-[12px] font-mono font-semibold text-[#E54826] mb-1">
                {sec.num}
              </p>
              <h2 className="font-heading font-bold text-[20px] text-[#0B0F19] mb-3">
                {sec.title}
              </h2>
              <div className="space-y-3 type-body text-[#5A6275]">
                {sec.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Privacy Contact Footer Strip */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <h3 className="font-heading font-bold text-[18px] text-[#0B0F19]">
            Questions about your data or privacy rights?
          </h3>
          <p className="text-[14px] text-[#5A6275] mt-0.5">
            Email <span className="font-medium text-[#0B0F19]">support@fiftydollarshop.com</span> or submit a verified privacy inquiry online.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('contact')}
          className="type-button px-6 py-3 rounded-full bg-[#0B0F19] hover:bg-[#E54826] text-white inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <span>Contact Privacy Team</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
