import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Facebook,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  Send,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type { AppPage } from '../../types/woocommerce';
import { submitContactInquiry } from '../../api/woocommerce';

interface ContactPageProps {
  onNavigate: (page: AppPage) => void;
  supportEmail?: string;
  instagramUrl?: string;
  facebookUrl?: string;
}

const TOPICS = [
  'Order Status & Tracking',
  '30-Day Return or Exchange',
  'Sizing & Color Question',
  'US 110V & Product Specs',
  'General Support',
] as const;

const SUPPORT_FAQS = [
  {
    q: 'How do I track my USA shipment?',
    a: 'As soon as your order dispatches (within 1–2 business days), we send a tracking number directly to the email you entered at checkout. If you cannot locate it, enter your order number here and we will resend your live tracking link.',
  },
  {
    q: 'Do electrical products work with standard US 110V outlets?',
    a: 'Yes. All hair styling tools, wellness massagers, and heated wearables sold on FiftyDollarShop.com are selected for standard US 110V power or universal USB power banks.',
  },
  {
    q: 'Can I change my shipping address or size after ordering?',
    a: 'If your order has not yet been packed (usually within the first 12 hours), message us right away with your order number and requested update and our support desk will modify it before dispatch.',
  },
  {
    q: 'What if an item arrives damaged or defective?',
    a: 'Every order is covered by our 30-Day Return Policy. Share your order number and a quick photo of the issue — we arrange a free replacement or full $50 refund within 24 hours.',
  },
];

const inputClass =
  'w-full h-11 px-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] text-[14px] text-[#0B0F19] placeholder:text-[#5A6275]/70 focus:outline-none focus:border-[#0B0F19] focus:bg-white transition-colors';

export const ContactPage: React.FC<ContactPageProps> = ({
  onNavigate,
  supportEmail = 'support@fiftydollarshop.com',
  instagramUrl = 'https://www.instagram.com/fifty_dollar_shop/',
  facebookUrl = 'https://www.facebook.com/fiftydollarshop',
}) => {
  const [selectedTopic, setSelectedTopic] = useState<string>(TOPICS[0]);
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
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setContactError(null);
    try {
      const formattedMessage = `[Topic: ${selectedTopic}]\n${message.trim()}`;
      const res = await submitContactInquiry({
        name,
        email,
        orderNumber,
        message: formattedMessage,
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
    <div className="space-y-10 sm:space-y-12">
      {/* Page Intro */}
      <div className="max-w-3xl">
        <p className="text-[12.5px] font-mono font-semibold text-[#122B5C] mb-2">
          USA Customer Support · Real Human Help
        </p>
        <h1 className="type-h1 text-[#0B0F19] mb-4">Contact USA Support</h1>
        <p className="type-body text-[#5A6275]">
          Need help tracking a package, picking the right size, starting a 30-day return, or checking US plug specs? Our support specialists respond to every inquiry within 24 hours.
        </p>
      </div>

      {/* 4-Column Support Info Bar */}
      <div className="bg-white rounded-3xl border border-[#E2E5EC] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E5EC]">
        <div className="p-5 flex items-start gap-3">
          <Mail className="w-5 h-5 text-[#122B5C] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-heading font-semibold text-[14px] text-[#0B0F19]">
              Direct Email
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="text-[13px] text-[#5A6275] hover:text-[#E54826] break-all transition-colors"
            >
              {supportEmail}
            </a>
          </div>
        </div>

        <div className="p-5 flex items-start gap-3">
          <Clock className="w-5 h-5 text-[#E54826] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-heading font-semibold text-[14px] text-[#0B0F19]">
              Support Hours
            </p>
            <p className="text-[13px] text-[#5A6275]">
              Mon – Sat · 9am – 7pm EST
            </p>
          </div>
        </div>

        <div className="p-5 flex items-start gap-3">
          <Truck className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-heading font-semibold text-[14px] text-[#0B0F19]">
              USA Shipping Window
            </p>
            <p className="text-[13px] text-[#5A6275]">
              7–15 Days Tracked · Free
            </p>
          </div>
        </div>

        <div className="p-5 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-[#0B0F19] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-heading font-semibold text-[14px] text-[#0B0F19]">
              Service Coverage
            </p>
            <p className="text-[13px] text-[#5A6275]">
              All 50 United States
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout: Form + Quick Answers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Support Inquiry Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-8 shadow-[0_18px_40px_-28px_rgba(11,15,25,0.16)]">
          {sentTicket ? (
            <div className="bg-[#F4F5F8] rounded-2xl border border-[#16A34A]/35 p-7 text-center space-y-3.5">
              <CheckCircle2
                className="w-11 h-11 text-[#16A34A] mx-auto"
                aria-hidden="true"
              />
              <p className="text-[12px] font-mono font-semibold text-[#16A34A]">
                Ticket #{sentTicket.ticketId} Created
              </p>
              <h2 className="font-heading font-bold text-[22px] text-[#0B0F19]">
                We Received Your Message
              </h2>
              <p className="type-body text-[#5A6275] max-w-md mx-auto">
                {sentTicket.message}
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSentTicket(null)}
                  className="type-button px-6 py-2.5 rounded-full bg-[#0B0F19] hover:bg-[#E54826] text-white cursor-pointer transition-colors"
                >
                  Send Another Inquiry
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('shop')}
                  className="type-button px-6 py-2.5 rounded-full bg-white border border-[#E2E5EC] hover:border-[#0B0F19] text-[#0B0F19] cursor-pointer transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="font-heading font-bold text-[20px] text-[#0B0F19]">
                  Send a Support Message
                </h2>
                <p className="text-[13.5px] text-[#5A6275] mt-1">
                  Select a topic below so your request routes directly to the right USA specialist.
                </p>
              </div>

              {/* Interactive Topic Buttons */}
              <div>
                <p className="text-[13px] font-semibold text-[#0B0F19] mb-2">
                  How can we help?
                </p>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map((topic) => {
                    const active = selectedTopic === topic;
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => setSelectedTopic(topic)}
                        className={`px-3.5 py-2 rounded-full text-[12.5px] font-semibold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#0B0F19] text-white border-[#0B0F19]'
                            : 'bg-[#F4F5F8] text-[#0B0F19] border-[#E2E5EC] hover:border-[#0B0F19]'
                        }`}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="c-name"
                    className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5"
                  >
                    Full Name *
                  </label>
                  <input
                    id="c-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Taylor"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="c-email"
                    className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5"
                  >
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
              </div>

              <div>
                <label
                  htmlFor="c-order"
                  className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5"
                >
                  Order Number (Optional)
                </label>
                <input
                  id="c-order"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g. #1042"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="c-msg"
                  className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5"
                >
                  Message *
                </label>
                <textarea
                  id="c-msg"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your question, product name, or return details..."
                  className="w-full p-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] text-[14px] text-[#0B0F19] placeholder:text-[#5A6275]/70 focus:outline-none focus:border-[#0B0F19] focus:bg-white transition-colors"
                />
              </div>

              {contactError && (
                <p className="text-[13.5px] font-medium text-red-600">
                  {contactError}
                </p>
              )}

              <motion.button
                type="submit"
                whileTap={{ scale: 0.98 }}
                disabled={sending}
                className="type-button w-full h-12 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-[0_14px_28px_-12px_rgba(229,72,38,0.5)]"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Sending Inquiry...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>Send Message to USA Support</span>
                  </>
                )}
              </motion.button>
            </form>
          )}
        </div>

        {/* Right Column: Interactive Quick FAQ + Policy Shortcuts */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6">
            <p className="text-[12px] font-mono font-semibold text-[#122B5C] mb-1">
              Instant Answers
            </p>
            <h2 className="font-heading font-bold text-[19px] text-[#0B0F19] mb-4">
              Frequently Asked Questions
            </h2>

            <div className="divide-y divide-[#E2E5EC]">
              {SUPPORT_FAQS.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={item.q} className="py-3.5 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-3 text-left font-heading font-semibold text-[14.5px] text-[#0B0F19] hover:text-[#E54826] cursor-pointer transition-colors"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 text-[#5A6275] transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#0B0F19]' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen && (
                      <p className="mt-2.5 text-[13.5px] text-[#5A6275] leading-relaxed">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#0B0F19] font-heading font-bold text-[16px]">
              <ShieldCheck className="w-5 h-5 text-[#16A34A]" aria-hidden="true" />
              <span>Helpful Store Policies</span>
            </div>
            <p className="text-[13.5px] text-[#5A6275]">
              Looking for complete fulfillment timelines or return eligibility rules?
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('shipping-policy')}
                className="px-4 py-2 rounded-full bg-[#F4F5F8] border border-[#E2E5EC] hover:border-[#0B0F19] text-[13px] font-semibold text-[#0B0F19] cursor-pointer transition-colors"
              >
                Shipping Policy (7–15 Days)
              </button>
              <button
                type="button"
                onClick={() => onNavigate('return-policy')}
                className="px-4 py-2 rounded-full bg-[#F4F5F8] border border-[#E2E5EC] hover:border-[#0B0F19] text-[13px] font-semibold text-[#0B0F19] cursor-pointer transition-colors"
              >
                30-Day Return Policy
              </button>
            </div>
          </div>

          {(instagramUrl || facebookUrl) && (
            <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 space-y-3">
              <p className="text-[12px] font-mono font-semibold text-[#122B5C]">
                Official Social Channels
              </p>
              <h3 className="font-heading font-bold text-[16px] text-[#0B0F19]">
                Follow Fifty Dollar Shop
              </h3>
              <p className="text-[13.5px] text-[#5A6275]">
                See new $50 USA drops, restock alerts, and product demos on our official pages.
              </p>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 pt-1">
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#F4F5F8] border border-[#E2E5EC] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19] text-[#0B0F19] text-[13.5px] font-semibold transition-colors"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Instagram className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Instagram · @fifty_dollar_shop</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0" aria-hidden="true" />
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#F4F5F8] border border-[#E2E5EC] hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19] text-[#0B0F19] text-[13.5px] font-semibold transition-colors"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <Facebook className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Facebook · Fifty Dollar Shop</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
