import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import type {
  WcAddress,
  WcCart,
  WcCheckoutResponse,
} from '../types/woocommerce';
import {
  WC_STORE_ORIGIN,
  submitWcCheckout,
  updateWcCustomer,
} from '../api/woocommerce';
import { US_STATES, decodeHtmlEntities, formatMinorPrice } from '../utils/format';
import { trackInitiateCheckout, trackPurchase } from '../services/metaTracking';

interface CheckoutViewProps {
  cart: WcCart | null;
  hydratingMetaCheckout?: boolean;
  metaCouponCode?: string | null;
  onBackToShop: () => void;
  onCartUpdated: (cart: WcCart) => void;
  onOrderCompleted: () => void;
}

const inputClass =
  'w-full h-11 px-3.5 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] text-[14px] text-[#0B0F19] placeholder:text-[#5A6275]/70 focus:outline-none focus:border-[#0B0F19] focus:bg-white transition-colors';

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  cart,
  hydratingMetaCheckout = false,
  metaCouponCode = null,
  onBackToShop,
  onCartUpdated,
  onOrderCompleted,
}) => {
  const existingShipping = cart?.shipping_address;
  const existingBilling = cart?.billing_address;

  const [firstName, setFirstName] = useState(existingShipping?.first_name || '');
  const [lastName, setLastName] = useState(existingShipping?.last_name || '');
  const [email, setEmail] = useState(existingBilling?.email || '');
  const [phone, setPhone] = useState(existingShipping?.phone || '');
  const [address1, setAddress1] = useState(existingShipping?.address_1 || '');
  const [address2, setAddress2] = useState(existingShipping?.address_2 || '');
  const [city, setCity] = useState(existingShipping?.city || '');
  const [state, setState] = useState(existingShipping?.state || 'CA');
  const [postcode, setPostcode] = useState(existingShipping?.postcode || '');
  const [customerNote, setCustomerNote] = useState(
    metaCouponCode ? `Coupon: ${metaCouponCode}` : ''
  );

  const paymentMethods = cart?.payment_methods ?? [];
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    paymentMethods[0] || ''
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderConfirmation, setOrderConfirmation] = useState<WcCheckoutResponse | null>(
    null
  );
  const [syncedHandoffUrl, setSyncedHandoffUrl] = useState<string | null>(null);
  const hasTrackedCheckoutRef = useRef(false);

  const items = cart?.items ?? [];
  const minorUnit = cart?.totals?.currency_minor_unit ?? 2;
  const totalDisplay = formatMinorPrice(cart?.totals?.total_price ?? '0', minorUnit, true);

  // Fire deduplicated InitiateCheckout (Browser Pixel + Server CAPI) once checkout loads with items
  useEffect(() => {
    if (
      !hasTrackedCheckoutRef.current &&
      !hydratingMetaCheckout &&
      !orderConfirmation &&
      cart &&
      items.length > 0
    ) {
      hasTrackedCheckoutRef.current = true;
      trackInitiateCheckout(cart, cart.billing_address);
    }
  }, [cart, hydratingMetaCheckout, items.length, orderConfirmation]);

  const buildStoreCartUrl = () => {
    const firstItem = items[0];
    if (firstItem) {
      return `${WC_STORE_ORIGIN}/checkout/?add-to-cart=${firstItem.id}&quantity=${firstItem.quantity}`;
    }
    return `${WC_STORE_ORIGIN}/checkout/`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const addressPayload: WcAddress = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      address_1: address1.trim(),
      address_2: address2.trim(),
      city: city.trim(),
      state,
      postcode: postcode.trim(),
      country: 'US',
      phone: phone.trim(),
      email: email.trim(),
    };

    try {
      const updatedCart = await updateWcCustomer({
        billing_address: addressPayload,
        shipping_address: {
          first_name: addressPayload.first_name,
          last_name: addressPayload.last_name,
          address_1: addressPayload.address_1,
          address_2: addressPayload.address_2,
          city: addressPayload.city,
          state: addressPayload.state,
          postcode: addressPayload.postcode,
          country: 'US',
          phone: addressPayload.phone,
        },
      });
      onCartUpdated(updatedCart);

      const availableGateways = updatedCart.payment_methods || [];
      const activeGateway = selectedPaymentMethod || availableGateways[0];

      if (activeGateway) {
        const result = await submitWcCheckout({
          billing_address: addressPayload,
          shipping_address: {
            first_name: addressPayload.first_name,
            last_name: addressPayload.last_name,
            address_1: addressPayload.address_1,
            address_2: addressPayload.address_2,
            city: addressPayload.city,
            state: addressPayload.state,
            postcode: addressPayload.postcode,
            country: 'US',
            phone: addressPayload.phone,
          },
          payment_method: activeGateway,
          customer_note: customerNote.trim(),
        });
        // Non-blocking deduplicated Purchase event (shared orderId-based event_id)
        const confirmedOrderId = result.order_id || result.order_number;
        if (confirmedOrderId) {
          trackPurchase({
            orderId: confirmedOrderId,
            cart: updatedCart,
            customer: {
              ...addressPayload,
              ...(result.billing_address || {}),
              email: result.billing_address?.email || addressPayload.email,
              phone: result.billing_address?.phone || addressPayload.phone,
            },
            currency: updatedCart.totals?.currency_code || 'USD',
          });
        }
        setOrderConfirmation(result);
        onOrderCompleted();
      } else {
        setSyncedHandoffUrl(buildStoreCartUrl());
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit checkout right now. Please verify your address details.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (orderConfirmation) {
    return (
      <section className="bg-[#F4F5F8] py-12 sm:py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-3xl border border-[#E2E5EC] p-6 sm:p-10 text-center shadow-[0_18px_40px_-24px_rgba(14,14,13,0.12)]">
            <div className="w-14 h-14 rounded-full bg-[#16A34A]/12 text-[#16A34A] flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h1 className="type-h1 text-[#0B0F19] mb-2">
              Order #{orderConfirmation.order_number || orderConfirmation.order_id} Confirmed
            </h1>
            <p className="type-body text-[#5A6275] mb-6">
              Thank you, {orderConfirmation.billing_address.first_name}! Your order has been placed with Free USA Shipping (7–15 days tracked delivery).
            </p>
            <div className="bg-[#ECEEF2] rounded-2xl border border-[#E2E5EC] p-4 text-left text-[14px] space-y-1.5 mb-6">
              <p>
                <span className="font-semibold text-[#0B0F19]">Status:</span>{' '}
                {orderConfirmation.status}
              </p>
              <p>
                <span className="font-semibold text-[#0B0F19]">Ship To:</span>{' '}
                {orderConfirmation.shipping_address.address_1},{' '}
                {orderConfirmation.shipping_address.city},{' '}
                {orderConfirmation.shipping_address.state}{' '}
                {orderConfirmation.shipping_address.postcode}
              </p>
            </div>
            {orderConfirmation.payment_result?.redirect_url && (
              <a
                href={orderConfirmation.payment_result.redirect_url}
                target="_blank"
                rel="noopener noreferrer"
                className="type-button inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white mb-4 transition-colors"
              >
                <span>Complete Payment Step</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <div>
              <button
                type="button"
                onClick={onBackToShop}
                className="type-button px-7 py-3.5 rounded-full bg-[#0B0F19] text-white hover:bg-[#232320] cursor-pointer transition-colors"
              >
                Continue Shopping $50 Deals
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (hydratingMetaCheckout && items.length === 0) {
    return (
      <section className="bg-[#F4F5F8] py-14">
        <div className="max-w-xl mx-auto px-4 text-center bg-white rounded-3xl border border-[#E2E5EC] p-10 space-y-3">
          <Loader2
            className="w-7 h-7 animate-spin text-[#0B0F19] mx-auto"
            aria-hidden="true"
          />
          <h1 className="font-heading font-bold text-[22px] text-[#0B0F19]">
            Loading Your Selected Item...
          </h1>
          <p className="type-body text-[#5A6275]">
            Syncing your exact variant and quantity directly from Fifty Dollar Shop inventory.
          </p>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="bg-[#F4F5F8] py-14">
        <div className="max-w-xl mx-auto px-4 text-center bg-white rounded-3xl border border-[#E2E5EC] p-10">
          <h1 className="type-h1 text-[#0B0F19] mb-3">Your Checkout Cart Is Empty</h1>
          <p className="type-body text-[#5A6275] mb-6">
            Add any of our hot-selling $50 products to your cart before checking out.
          </p>
          <button
            type="button"
            onClick={onBackToShop}
            className="type-button px-7 py-3.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white cursor-pointer transition-colors"
          >
            Browse $50 Products
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#F4F5F8] py-8 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onBackToShop}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0B0F19] hover:text-[#E54826] mb-6 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Shopping</span>
        </button>

        <h1 className="type-h1 text-[#0B0F19] mb-8">Secure USA Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Shipping & Billing Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 bg-white rounded-3xl border border-[#E2E5EC] p-5 sm:p-8 space-y-6 shadow-[0_14px_34px_-22px_rgba(14,14,13,0.1)]"
          >
            <div>
              <h2 className="font-heading font-bold text-[18px] text-[#0B0F19] mb-4">
                USA Shipping Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="chk-first" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                    First Name *
                  </label>
                  <input
                    id="chk-first"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="chk-last" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                    Last Name *
                  </label>
                  <input
                    id="chk-last"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Morgan"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="chk-email" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                    Email Address *
                  </label>
                  <input
                    id="chk-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="chk-phone" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                    US Phone Number *
                  </label>
                  <input
                    id="chk-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 234-5678"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 mt-4">
                <div>
                  <label htmlFor="chk-addr1" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                    Street Address *
                  </label>
                  <input
                    id="chk-addr1"
                    required
                    value={address1}
                    onChange={(e) => setAddress1(e.target.value)}
                    placeholder="742 Evergreen Terrace"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="chk-addr2" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                    Apartment, Suite, Unit (Optional)
                  </label>
                  <input
                    id="chk-addr2"
                    value={address2}
                    onChange={(e) => setAddress2(e.target.value)}
                    placeholder="Apt 4B"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <label htmlFor="chk-city" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                    City *
                  </label>
                  <input
                    id="chk-city"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Austin"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="chk-state" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                    State *
                  </label>
                  <select
                    id="chk-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className={inputClass}
                  >
                    {US_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="chk-zip" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                    ZIP Code *
                  </label>
                  <input
                    id="chk-zip"
                    required
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="78701"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="chk-note" className="block text-[13px] font-semibold text-[#0B0F19] mb-1.5">
                  Delivery Instructions (Optional)
                </label>
                <input
                  id="chk-note"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Leave package on covered porch"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Payment Method Section */}
            <div className="border-t border-[#E2E5EC] pt-5">
              <h2 className="font-heading font-bold text-[18px] text-[#0B0F19] mb-3">
                Payment Method
              </h2>

              {paymentMethods.length > 0 ? (
                <div className="space-y-2.5">
                  {paymentMethods.map((method) => (
                    <label
                      key={method}
                      className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#E2E5EC] bg-[#F4F5F8] cursor-pointer hover:border-[#0B0F19] transition-colors"
                    >
                      <input
                        type="radio"
                        name="wc_payment_method"
                        value={method}
                        checked={(selectedPaymentMethod || paymentMethods[0]) === method}
                        onChange={() => setSelectedPaymentMethod(method)}
                        className="accent-[#E54826]"
                      />
                      <span className="font-medium text-[14px] text-[#0B0F19] capitalize">
                        {method.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="bg-[#ECEEF2] rounded-2xl border border-[#E2E5EC] p-4 text-[14px] text-[#5A6275]">
                  <p className="font-semibold text-[#0B0F19] mb-1">
                    Encrypted Hosted Checkout Ready
                  </p>
                  <p>
                    Click below to save your shipping details and complete payment securely on FiftyDollarShop&apos;s encrypted checkout portal.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-[14px] text-red-700">
                {error}
              </div>
            )}

            {syncedHandoffUrl && (
              <div className="rounded-2xl bg-[#16A34A]/8 border border-[#16A34A]/25 p-5 space-y-3">
                <div className="flex items-center gap-2 text-[#16A34A] font-heading font-bold text-[16px]">
                  <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>Shipping Address Saved</span>
                </div>
                <p className="text-[14px] text-[#5A6275]">
                  Your cart and USA shipping address are ready. Click below to open Secure Checkout and finalize payment.
                </p>
                <a
                  href={syncedHandoffUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="type-button inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#0B0F19] hover:bg-[#232320] text-white transition-colors"
                >
                  <span>Continue to Secure Checkout</span>
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            )}

            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              disabled={submitting}
              className="type-button w-full h-12 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 shadow-[0_12px_24px_-8px_rgba(229,72,38,0.45)]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Processing Order...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {paymentMethods.length > 0
                      ? `Place Order — ${totalDisplay}`
                      : `Confirm Address & Proceed — ${totalDisplay}`}
                  </span>
                </>
              )}
            </motion.button>
          </form>

          {/* Right Order Summary */}
          <aside className="lg:col-span-5 bg-white rounded-3xl border border-[#E2E5EC] p-5 sm:p-8 space-y-5 shadow-[0_14px_34px_-22px_rgba(14,14,13,0.1)]">
            <h2 className="font-heading font-bold text-[18px] text-[#0B0F19]">
              Order Summary ({cart?.items_count ?? 0})
            </h2>

            <div className="divide-y divide-[#E2E5EC] max-h-[380px] overflow-y-auto pr-1">
              {items.map((item) => {
                const imgSrc = item.images?.[0]?.thumbnail || item.images?.[0]?.src || '';
                const lineTotal = formatMinorPrice(
                  item.totals?.line_total ?? item.prices?.price ?? '5000',
                  item.totals?.currency_minor_unit ?? 2,
                  true
                );
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="w-14 h-14 rounded-xl bg-[#ECEEF2] overflow-hidden shrink-0 flex items-center justify-center">
                      {imgSrc && (
                        <img
                          src={imgSrc}
                          alt={decodeHtmlEntities(item.name)}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-1 mix-blend-multiply"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-semibold text-[14px] text-[#0B0F19] truncate">
                        {decodeHtmlEntities(item.name)}
                      </p>
                      <p className="text-[12px] text-[#5A6275]">
                        Qty: {item.quantity}
                        {item.variation?.length
                          ? ` · ${item.variation.map((v) => decodeHtmlEntities(v.value)).join(', ')}`
                          : ''}
                      </p>
                    </div>
                    <span className="font-heading font-bold text-[15px] text-[#E54826] tabular-nums">
                      {lineTotal}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#E2E5EC] pt-4 space-y-2 text-[14px]">
              <div className="flex justify-between text-[#5A6275]">
                <span>Subtotal</span>
                <span className="tabular-nums font-medium text-[#0B0F19]">{totalDisplay}</span>
              </div>
              <div className="flex justify-between text-[#5A6275]">
                <span>USA Shipping (7–15 Days)</span>
                <span className="font-semibold text-[#16A34A]">FREE</span>
              </div>
              <div className="flex justify-between font-heading font-bold text-[19px] text-[#0B0F19] pt-2 border-t border-[#E2E5EC]">
                <span>Total</span>
                <span className="text-[#E54826] tabular-nums">{totalDisplay}</span>
              </div>
            </div>

            <div className="pt-2 space-y-2 text-[13px] text-[#5A6275]">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                <span>Free tracked shipping to all 50 US states</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" aria-hidden="true" />
                <span>30-day easy returns guarantee</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};
