import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Send,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { AppPage } from '../types/woocommerce';
import { submitContactInquiry } from '../api/woocommerce';

interface InfoPagesProps {
  page: Exclude<
    AppPage,
    'home' | 'shop' | 'categories' | 'category' | 'product' | 'cart' | 'checkout'
  >;
  onNavigate: (page: AppPage) => void;
}

const inputClass =
  'w-full h-11 px-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] text-[14px] text-[#0B0F19] placeholder:text-[#5A6275]/70 focus:outline-none focus:border-[#0B0F19] focus:bg-white transition-colors';

export const InfoPages: React.FC<InfoPagesProps> = ({ page, onNavigate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTicket, setSentTicket] = useState<{
    ticketId: string;
    message: string;
  } | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setContactError(null);
    try {
      const res = await submitContactInquiry({
        name,
        email,
        orderNumber,
        message,
      });
      setSentTicket({ ticketId: res.ticketId, message: res.message });
      setName('');
      setEmail('');
      setOrderNumber('');
      setMessage('');
    } catch (err) {
      setContactError(
        err instanceof Error ? err.message : 'Could not send message.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="bg-[#F4F5F8] py-10 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0B0F19] hover:text-[#E54826] mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Home</span>
        </button>

        {page === 'about' && (
          <div className="space-y-8">
            <div>
              <p className="text-[12.5px] font-mono font-medium text-[#E54826] mb-2">
                About FiftyDollarShop.com
              </p>
              <h1 className="type-h1 text-[#0B0F19] mb-4">
                Built for USA Shoppers Who Refuse to Overpay
              </h1>
              <p className="type-body text-[#5A6275]">
                FiftyDollarShop.com was founded on one clear promise: every product in our catalog costs exactly $50 — with zero hidden shipping fees. We monitor the fastest-trending personal care, heated winter apparel, massage therapy, and smart home gadgets across Instagram and Facebook, then partner directly with vetted manufacturers to offer them at half the usual $70–$200 US retail price.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 bg-white rounded-3xl border border-[#E2E5EC] divide-y sm:divide-y-0 sm:divide-x divide-[#E2E5EC]">
              <div className="p-6">
                <p className="font-heading font-extrabold text-[26px] text-[#E54826] mb-1">
                  $50 Flat
                </p>
                <p className="font-heading font-semibold text-[#0B0F19] text-[15px] mb-1">
                  One Honest Price
                </p>
                <p className="text-[14px] text-[#5A6275]">
                  Every product in our Hot Selling collection is priced at $50 flat.
                </p>
              </div>
              <div className="p-6">
                <p className="font-heading font-extrabold text-[26px] text-[#16A34A] mb-1">
                  $0.00
                </p>
                <p className="font-heading font-semibold text-[#0B0F19] text-[15px] mb-1">
                  Free USA Shipping
                </p>
                <p className="text-[14px] text-[#5A6275]">
                  Tracked nationwide delivery across all 50 states in 7–15 days.
                </p>
              </div>
              <div className="p-6">
                <p className="font-heading font-extrabold text-[26px] text-[#0B0F19] mb-1">
                  30 Days
                </p>
                <p className="font-heading font-semibold text-[#0B0F19] text-[15px] mb-1">
                  Easy Returns
                </p>
                <p className="text-[14px] text-[#5A6275]">
                  Hassle-free replacement or refund if an item arrives damaged or doesn&apos;t fit.
                </p>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => onNavigate('shop')}
                className="type-button px-7 py-3.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white cursor-pointer transition-colors"
              >
                Explore Hot Selling $50 Products
              </button>
            </div>
          </div>
        )}

        {page === 'contact' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-5 space-y-5">
              <div>
                <p className="text-[12.5px] font-mono font-medium text-[#E54826] mb-2">
                  USA Customer Support
                </p>
                <h1 className="type-h1 text-[#0B0F19] mb-3">Contact Us</h1>
                <p className="type-body text-[#5A6275]">
                  Have a question about an order, US plug compatibility, or sizing? Send us a note and our support team will reply within 24 hours.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#E2E5EC] p-5 space-y-4 text-[14px]">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[#0B0F19] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-[#0B0F19]">Support Email</p>
                    <p className="text-[#5A6275]">support@fiftydollarshop.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-[#0B0F19]">USA Delivery Window</p>
                    <p className="text-[#5A6275]">7–15 Days Tracked Shipping</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#E54826] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-[#0B0F19]">Serving</p>
                    <p className="text-[#5A6275]">All 50 United States</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-7 bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 shadow-[0_14px_34px_-22px_rgba(14,14,13,0.1)]">
              {sentTicket ? (
                <div className="bg-[#F4F5F8] rounded-2xl border border-[#16A34A]/30 p-6 text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-[#16A34A] mx-auto" aria-hidden="true" />
                  <h2 className="font-heading font-bold text-[20px] text-[#0B0F19]">
                    Message Received ({sentTicket.ticketId})
                  </h2>
                  <p className="type-body text-[#5A6275]">{sentTicket.message}</p>
                  <button
                    type="button"
                    onClick={() => setSentTicket(null)}
                    className="type-button px-6 py-2.5 rounded-full bg-[#0B0F19] text-white hover:bg-[#232320] cursor-pointer transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <h2 className="font-heading font-bold text-[18px] text-[#0B0F19]">
                    Send a Support Inquiry
                  </h2>
                  <div>
                    <label htmlFor="c-name" className="block text-[13px] font-semibold text-[#0B0F19] mb-1">
                      Full Name *
                    </label>
                    <input
                      id="c-name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="c-email" className="block text-[13px] font-semibold text-[#0B0F19] mb-1">
                      Email Address *
                    </label>
                    <input
                      id="c-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="c-order" className="block text-[13px] font-semibold text-[#0B0F19] mb-1">
                      Order Number (Optional)
                    </label>
                    <input
                      id="c-order"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="#1042"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="c-msg" className="block text-[13px] font-semibold text-[#0B0F19] mb-1">
                      Message *
                    </label>
                    <textarea
                      id="c-msg"
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help?"
                      className="w-full p-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] text-[14px] text-[#0B0F19] placeholder:text-[#5A6275]/70 focus:outline-none focus:border-[#0B0F19] focus:bg-white transition-colors"
                    />
                  </div>
                  {contactError && (
                    <p className="text-[14px] text-red-600">{contactError}</p>
                  )}
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.98 }}
                    disabled={sending}
                    className="type-button w-full h-12 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" aria-hidden="true" />
                        <span>Send Message</span>
                      </>
                    )}
                  </motion.button>
                </form>
              )}
            </div>
          </div>
        )}

        {page === 'shipping-policy' && (
          <div className="space-y-5">
            <h1 className="type-h1 text-[#0B0F19]">USA Shipping Policy</h1>
            <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 space-y-4 type-body text-[#5A6275]">
              <p>
                <strong className="text-[#0B0F19]">Free Shipping Across All 50 US States:</strong> Every order at FiftyDollarShop.com qualifies for completely free tracked shipping with no minimum purchase amount.
              </p>
              <p>
                <strong className="text-[#0B0F19]">Processing Time:</strong> Orders are verified and dispatched within 1–2 business days from confirmation.
              </p>
              <p>
                <strong className="text-[#0B0F19]">Estimated Delivery Window:</strong> Standard USA delivery takes 7–15 business days with full tracking provided via email once your parcel ships.
              </p>
            </div>
          </div>
        )}

        {page === 'return-policy' && (
          <div className="space-y-5">
            <h1 className="type-h1 text-[#0B0F19]">30-Day Easy Return Policy</h1>
            <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 space-y-4 type-body text-[#5A6275]">
              <p>
                <strong className="text-[#0B0F19]">30-Day Satisfaction Guarantee:</strong> If your $50 item arrives damaged, defective, or does not match your order, you can request a free replacement or full $50 refund within 30 days of delivery.
              </p>
              <p>
                <strong className="text-[#0B0F19]">How to Start a Return:</strong> Reach out through our Contact page with your order number and a quick photo if an item arrived damaged. Our USA support team issues return instructions within 24 hours.
              </p>
            </div>
          </div>
        )}

        {page === 'privacy-policy' && (
          <div className="space-y-5">
            <h1 className="type-h1 text-[#0B0F19]">Privacy Policy</h1>
            <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 space-y-4 type-body text-[#5A6275]">
              <div className="flex items-center gap-2 text-[#0B0F19] font-semibold">
                <ShieldCheck className="w-5 h-5 text-[#16A34A]" aria-hidden="true" />
                <span>Your Information Is Protected</span>
              </div>
              <p>
                FiftyDollarShop.com collects only the shipping, billing, and contact details required to fulfill your orders and provide shipment updates. We never sell or rent customer data to third parties.
              </p>
              <p>
                All checkout transactions are transmitted over encrypted HTTPS directly to our secure payment gateway.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
