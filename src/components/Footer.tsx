import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Facebook,
  Instagram,
  Mail,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { AppPage } from '../types/woocommerce';

interface FooterProps {
  onNavigate: (page: AppPage) => void;
  supportEmail?: string;
  instagramUrl?: string;
  facebookUrl?: string;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  supportEmail = 'support@fiftydollarshop.com',
  instagramUrl = 'https://www.instagram.com/',
  facebookUrl = 'https://www.facebook.com/',
}) => {
  const [alertEmail, setAlertEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleLink = (e: React.MouseEvent, page: AppPage) => {
    e.preventDefault();
    onNavigate(page);
  };

  const handleDropSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertEmail.trim()) return;
    setSubscribed(true);
    setAlertEmail('');
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-white text-[#0B0F19] border-t border-[#E2E5EC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-14 pb-8">
        {/* Modern Light Editorial Drop-Alert Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl bg-[#F4F5F8] border border-[#E2E5EC] p-6 sm:p-8 lg:p-10 mb-12 grid grid-cols-1 lg:grid-cols-12 gap-7 items-center"
        >
          <div className="lg:col-span-7">
            <p className="text-[12px] font-mono font-semibold text-[#122B5C] mb-2 tracking-wide">
              FiftyDollarShop.com · USA Flat-Price Store
            </p>
            <h2 className="font-heading font-bold text-[24px] sm:text-[32px] leading-tight text-[#0B0F19] max-w-xl">
              Half the US Retail Price. Always $50 Flat.
            </h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3.5 text-[13px] text-[#5A6275]">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
                <span>Free Tracked USA Shipping</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
                <span>30-Day Easy Returns</span>
              </span>
            </div>
          </div>

          <div className="lg:col-span-5">
            {subscribed ? (
              <div className="rounded-2xl bg-white border border-[#16A34A]/35 px-5 py-4 flex items-center gap-3 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" aria-hidden="true" />
                <p className="text-[13.5px] font-medium text-[#0B0F19]">
                  You&apos;re on the list for weekly $50 US product restocks and drops.
                </p>
              </div>
            ) : (
              <form onSubmit={handleDropSubscribe} className="space-y-2.5">
                <label
                  htmlFor="footer-drop-email"
                  className="block text-[13px] font-semibold text-[#0B0F19]"
                >
                  Get notified when new $50 trending items drop
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    id="footer-drop-email"
                    type="email"
                    required
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="flex-1 h-11 px-4 rounded-full bg-white border border-[#E2E5EC] text-[14px] text-[#0B0F19] placeholder:text-[#5A6275]/60 focus:outline-none focus:border-[#0B0F19] transition-colors shadow-xs"
                  />
                  <button
                    type="submit"
                    className="h-11 px-5 rounded-full bg-[#0B0F19] hover:bg-[#E54826] text-white font-heading font-semibold text-[13.5px] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                  >
                    <span>Notify Me</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>

        {/* Middle 4-Column Light Directory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 pb-10">
          <div className="lg:col-span-4 pr-0 lg:pr-8">
            <a
              href="/"
              onClick={(e) => handleLink(e, 'home')}
              aria-label="FiftyDollarShop.com Home"
              className="group inline-flex items-center mb-4 rounded-xl focus-visible:outline-2 focus-visible:outline-[#E54826]"
            >
              <span className="h-12 w-14 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] p-1 flex items-center justify-center overflow-hidden shadow-xs group-hover:border-[#E54826]/60 transition-colors">
                <img
                  src="/assets/aistudio/Glossy_Navy_Shopping_Bag_with_Golden_50_36b56e7c.png"
                  alt="FiftyDollarShop.com"
                  className="w-full h-full object-contain rounded-lg"
                />
              </span>
            </a>
            <p className="text-[14px] text-[#5A6275] leading-relaxed max-w-sm">
              USA&apos;s curated flat-price destination for trending beauty, wellness, winter heated apparel, and smart gadgets. Every item ships free across all 50 states.
            </p>
          </div>

          <div className="lg:col-span-2">
            <h3 className="font-heading font-bold text-[13.5px] uppercase tracking-wider text-[#0B0F19] mb-4">
              Shop
            </h3>
            <ul className="space-y-2.5 text-[14px] text-[#5A6275]">
              <li>
                <a
                  href="/shop"
                  onClick={(e) => handleLink(e, 'shop')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  Hot Selling 50$ Products
                </a>
              </li>
              <li>
                <a
                  href="/categories"
                  onClick={(e) => handleLink(e, 'categories')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  All Categories
                </a>
              </li>
              <li>
                <a
                  href="/wishlist"
                  onClick={(e) => handleLink(e, 'wishlist')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  Saved Wishlist
                </a>
              </li>
              <li>
                <a
                  href="/cart"
                  onClick={(e) => handleLink(e, 'cart')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  Shopping Cart
                </a>
              </li>
              <li>
                <a
                  href="/checkout"
                  onClick={(e) => handleLink(e, 'checkout')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  Checkout
                </a>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h3 className="font-heading font-bold text-[13.5px] uppercase tracking-wider text-[#0B0F19] mb-4">
              Policies &amp; Support
            </h3>
            <ul className="space-y-2.5 text-[14px] text-[#5A6275]">
              <li>
                <a
                  href="/about"
                  onClick={(e) => handleLink(e, 'about')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => handleLink(e, 'contact')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  Contact USA Support
                </a>
              </li>
              <li>
                <a
                  href="/shipping-policy"
                  onClick={(e) => handleLink(e, 'shipping-policy')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  Shipping Policy (7–15 Days)
                </a>
              </li>
              <li>
                <a
                  href="/return-policy"
                  onClick={(e) => handleLink(e, 'return-policy')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  30-Day Return Policy
                </a>
              </li>
              <li>
                <a
                  href="/privacy-policy"
                  onClick={(e) => handleLink(e, 'privacy-policy')}
                  className="hover:text-[#E54826] transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h3 className="font-heading font-bold text-[13.5px] uppercase tracking-wider text-[#0B0F19] mb-4">
              Connect
            </h3>
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-2 text-[13.5px] text-[#5A6275] hover:text-[#E54826] transition-colors mb-4"
            >
              <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{supportEmail}</span>
            </a>
            <div className="flex flex-wrap items-center gap-2.5">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="FiftyDollarShop on Instagram"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F4F5F8] border border-[#E2E5EC] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19] text-[#0B0F19] text-[13px] font-medium transition-colors"
                >
                  <Instagram className="w-4 h-4" aria-hidden="true" />
                  <span>Instagram</span>
                </a>
              )}
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="FiftyDollarShop on Facebook"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F4F5F8] border border-[#E2E5EC] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19] text-[#0B0F19] text-[13px] font-medium transition-colors"
                >
                  <Facebook className="w-4 h-4" aria-hidden="true" />
                  <span>Facebook</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Quiet Copyright + Discreet Admin Link + Back to Top */}
        <div className="border-t border-[#E2E5EC] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#5A6275]">
          <p>
            &copy; {new Date().getFullYear()} FiftyDollarShop.com · Free USA Shipping · Secure USA Checkout
          </p>
          <div className="flex items-center gap-4">
            <a
              href="/admin"
              onClick={(e) => handleLink(e, 'admin')}
              className="text-[12.5px] text-[#5A6275]/80 hover:text-[#0B0F19] transition-colors"
            >
              Admin
            </a>
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F4F5F8] border border-[#E2E5EC] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19] text-[#0B0F19] text-[12.5px] font-heading font-semibold cursor-pointer transition-colors"
            >
              <span>Back to top</span>
              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
