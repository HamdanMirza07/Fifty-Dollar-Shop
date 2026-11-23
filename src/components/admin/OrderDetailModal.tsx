import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Printer,
  X,
} from 'lucide-react';
import type { AdminOrder, AdminOrderStatus } from '../../types/admin';

interface OrderDetailModalProps {
  order: AdminOrder | null;
  updatingStatus: boolean;
  onUpdateStatus: (orderId: string, status: AdminOrderStatus) => Promise<void>;
  onClose: () => void;
}

const ORDER_STATUS_OPTIONS: Array<{ value: AdminOrderStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  updatingStatus,
  onUpdateStatus,
  onClose,
}) => {
  const [selectedStatus, setSelectedStatus] =
    useState<AdminOrderStatus>('pending');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (order) {
      setSelectedStatus(order.status);
      setSavedNotice(false);
    }
  }, [order]);

  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, onClose]);

  const handleSaveStatus = async () => {
    if (!order) return;
    await onUpdateStatus(order.id, selectedStatus);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {order && (
        <div
          className="fixed inset-0 z-50 flex justify-end print:static print:inset-auto print:block"
          role="dialog"
          aria-modal="true"
          aria-label={`Order ${order.orderNumber} details`}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B0F19]/45 backdrop-blur-[2px] print:hidden"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-2xl bg-white h-full border-l border-[#E2E5EC] flex flex-col shadow-2xl print:max-w-none print:shadow-none print:border-0"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#E2E5EC] flex items-center justify-between gap-4 print:hidden">
              <div>
                <p className="text-[12px] font-mono text-[#5A6275] tabular-nums">
                  {new Date(order.createdAt).toLocaleString()} · Source:{' '}
                  {order.source === 'woocommerce' ? 'WooCommerce' : 'Storefront'}
                </p>
                <h2 className="font-heading font-bold text-[20px] text-[#0B0F19] tabular-nums">
                  Order #{order.orderNumber}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-9 px-3.5 rounded-lg border border-[#E2E5EC] bg-white hover:bg-[#F4F5F8] text-[#0B0F19] text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  <span>Print Packing Slip</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close order details"
                  className="w-9 h-9 rounded-lg border border-[#E2E5EC] hover:bg-[#F4F5F8] flex items-center justify-center text-[#0B0F19] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status Update Control Bar */}
            <div className="px-6 py-3.5 bg-[#F4F5F8] border-b border-[#E2E5EC] flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-2.5">
                <label
                  htmlFor="admin-order-status-select"
                  className="text-[13px] font-semibold text-[#0B0F19]"
                >
                  Order Status:
                </label>
                <select
                  id="admin-order-status-select"
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as AdminOrderStatus)
                  }
                  className="h-9 px-3 rounded-lg border border-[#E2E5EC] bg-white text-[13px] font-semibold text-[#0B0F19]"
                >
                  {ORDER_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={updatingStatus || selectedStatus === order.status}
                  onClick={() => void handleSaveStatus()}
                  className="h-9 px-4 rounded-lg bg-[#0B0F19] hover:bg-[#E54826] disabled:opacity-50 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {updatingStatus ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  <span>Update Status</span>
                </button>
              </div>

              {savedNotice && (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#16A34A]">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Status saved</span>
                </span>
              )}
            </div>

            {/* Printable Invoice / Packing Slip Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Print-Only Header */}
              <div className="hidden print:flex items-center justify-between pb-4 border-b border-[#0B0F19]">
                <div>
                  <p className="font-heading font-bold text-[20px]">
                    FiftyDollarShop.com
                  </p>
                  <p className="text-[12px] text-[#5A6275]">
                    Packing Slip &amp; Order Invoice · https://www.fiftydollarshop.com/
                  </p>
                </div>
                <div className="text-right font-mono">
                  <p className="font-bold text-[16px]">
                    Order #{order.orderNumber}
                  </p>
                  <p className="text-[12px]">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Customer & Shipping Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#E2E5EC] p-4">
                  <p className="text-[12px] font-mono text-[#5A6275] mb-1.5">
                    Customer Details
                  </p>
                  <p className="font-heading font-bold text-[15px] text-[#0B0F19]">
                    {order.customerName}
                  </p>
                  <p className="text-[13.5px] text-[#5A6275] mt-1">
                    {order.email || 'No email provided'}
                  </p>
                  <p className="text-[13.5px] font-mono text-[#5A6275] mt-0.5 tabular-nums">
                    {order.phone || 'No phone provided'}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E2E5EC] p-4">
                  <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#5A6275] mb-1.5">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Shipping Address</span>
                  </div>
                  <p className="text-[13.5px] text-[#0B0F19] leading-relaxed">
                    {order.shippingAddress.address1 || '—'}
                    {order.shippingAddress.address2
                      ? `, ${order.shippingAddress.address2}`
                      : ''}
                    <br />
                    {[
                      order.shippingAddress.city,
                      order.shippingAddress.state,
                      order.shippingAddress.postcode,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                    <br />
                    {order.shippingAddress.country || 'US'}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-xl border border-[#E2E5EC] overflow-hidden">
                <div className="px-4 py-3 bg-[#F4F5F8] border-b border-[#E2E5EC] flex items-center justify-between">
                  <p className="font-heading font-bold text-[14px] text-[#0B0F19]">
                    Line Items
                  </p>
                  <span className="text-[12px] font-mono text-[#5A6275] tabular-nums">
                    {order.items.reduce((acc, item) => acc + item.quantity, 0)}{' '}
                    units
                  </span>
                </div>

                {order.items.length === 0 ? (
                  <div className="p-6 text-center text-[13.5px] text-[#5A6275]">
                    Order captured via Storefront Checkout proxy. Full line-item
                    metadata syncs when WooCommerce Orders read access is active.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E5EC]">
                    {order.items.map((item, idx) => (
                      <div
                        key={`${item.productId}-${item.variationId || idx}`}
                        className="p-4 flex items-start justify-between gap-4"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-lg bg-[#F4F5F8] border border-[#E2E5EC] overflow-hidden flex items-center justify-center shrink-0">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-[#5A6275]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[14px] text-[#0B0F19]">
                              {item.name}
                            </p>
                            <p className="text-[12px] font-mono text-[#5A6275] tabular-nums mt-0.5">
                              SKU: {item.sku || '—'} · Qty: {item.quantity} × $
                              {Number(item.unitPrice || 0).toFixed(2)}
                            </p>
                            {item.attributes.length > 0 && (
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[12px] text-[#5A6275]">
                                {item.attributes.map((a, aIdx) => (
                                  <span key={`${a.name}-${aIdx}`}>
                                    {a.name}:{' '}
                                    <strong className="text-[#0B0F19]">
                                      {a.value}
                                    </strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="font-mono font-bold text-[14px] text-[#0B0F19] tabular-nums whitespace-nowrap">
                          ${Number(item.total || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment & Totals */}
              <div className="rounded-xl border border-[#E2E5EC] p-4 space-y-2.5 text-[13.5px]">
                <div className="flex items-center justify-between text-[#5A6275]">
                  <span>Payment Method</span>
                  <span className="font-medium text-[#0B0F19]">
                    {order.paymentMethodTitle || order.paymentMethod}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#5A6275]">
                  <span>USA Shipping</span>
                  <span className="font-mono text-[#16A34A] font-semibold">
                    FREE ($0.00)
                  </span>
                </div>
                <div className="pt-2.5 border-t border-[#E2E5EC] flex items-center justify-between">
                  <span className="font-heading font-bold text-[15px] text-[#0B0F19]">
                    Total ({order.currency || 'USD'})
                  </span>
                  <span className="font-mono font-bold text-[18px] text-[#0B0F19] tabular-nums">
                    ${Number(order.total || 0).toFixed(2)}
                  </span>
                </div>
                {order.customerNote && (
                  <div className="pt-2.5 border-t border-[#E2E5EC] text-[13px] text-[#5A6275]">
                    <span className="font-semibold text-[#0B0F19]">
                      Customer Note:{' '}
                    </span>
                    {order.customerNote}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
