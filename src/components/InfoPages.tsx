import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { AppPage } from '../types/woocommerce';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { ReturnPolicyPage } from './pages/ReturnPolicyPage';
import { ShippingPolicyPage } from './pages/ShippingPolicyPage';

export type SupportInfoPage =
  | 'about'
  | 'contact'
  | 'shipping-policy'
  | 'return-policy'
  | 'privacy-policy';

interface InfoPagesProps {
  page: SupportInfoPage;
  onNavigate: (page: AppPage) => void;
}

const SUPPORT_TABS: Array<{ id: SupportInfoPage; label: string }> = [
  { id: 'about', label: 'About Us' },
  { id: 'contact', label: 'Contact USA Support' },
  { id: 'shipping-policy', label: 'Shipping Policy (7–15 Days)' },
  { id: 'return-policy', label: '30-Day Return Policy' },
  { id: 'privacy-policy', label: 'Privacy Policy' },
];

export const InfoPages: React.FC<InfoPagesProps> = ({ page, onNavigate }) => {
  return (
    <section className="bg-[#F4F5F8] py-8 sm:py-14 min-h-[72vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Breadcrumb + Support & Policies Sub-Navigation */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-8 sm:mb-10 border-b border-[#E2E5EC]">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0B0F19] hover:text-[#E54826] cursor-pointer transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Home</span>
          </button>

          <nav
            aria-label="Policies and support navigation"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-full bg-[#ECEEF2]"
          >
            {SUPPORT_TABS.map((tab) => {
              const active = page === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onNavigate(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0B0F19] text-white shadow-2xs'
                      : 'text-[#5A6275] hover:text-[#0B0F19]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Dedicated Page Content */}
        {page === 'about' && <AboutPage onNavigate={onNavigate} />}
        {page === 'contact' && <ContactPage onNavigate={onNavigate} />}
        {page === 'shipping-policy' && (
          <ShippingPolicyPage onNavigate={onNavigate} />
        )}
        {page === 'return-policy' && (
          <ReturnPolicyPage onNavigate={onNavigate} />
        )}
        {page === 'privacy-policy' && (
          <PrivacyPolicyPage onNavigate={onNavigate} />
        )}
      </div>
    </section>
  );
};
