import React, { useMemo, useState } from 'react';
import { RefreshCw, Search, ShoppingBag, X } from 'lucide-react';
import type { AdminOrder, AdminOrderStatus } from '../../types/admin';

interface AdminOrdersTabProps {
  orders: AdminOrder[];
  loading: boolean;
  onRefresh: () => void;
  onSelectOrder: (order: AdminOrder) => void;
}

const STATUS_BADGE: Record<AdminOrderStatus, { label: string; classes: string }> = {
  pending: {
    label: 'Pending',
    classes: 'bg-[#D97706]/10 text-[#B45309] border-[#D97706]/25',
  },
  processing: {
    label: 'Processing',
    classes: 'bg-[#122B5C]/10 text-[#122B5C] border-[#122B5C]/25',
  },
  shipped: {
    label: 'Shipped',
    classes: 'bg-[#0B0F19]/10 text-[#0B0F19] border-[#0B0F19]/20',
  },
  delivered: {
    label: 'Delivered',
    classes: 'bg-[#16A34A]/10 text-[#15803D] border-[#16A34A]/25',
  },
  cancelled: {
    label: 'Cancelled',
    classes: 'bg-[#DC2626]/10 text-[#B91C1C] border-[#DC2626]/25',
  },
};

export const AdminOrdersTab: React.FC<AdminOrdersTabProps> = ({
  orders,
  loading,
  onRefresh,
  onSelectOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminOrderStatus>(
    'all'
  );

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (q) {
        const hay =
          `${o.orderNumber} ${o.id} ${o.customerName} ${o.email} ${o.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E2E5EC]">
        <div>
          <p className="text-[12px] font-mono text-[#5A6275] mb-1 tabular-nums">
            Storefront &amp; WooCommerce Fulfillment · {orders.length}{' '}
            {orders.length === 1 ? 'Order' : 'Orders'}
          </p>
          <h1 className="font-heading font-bold text-[26px] sm:text-[30px] text-[#0B0F19] leading-tight">
            Orders
          </h1>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="h-10 px-4 rounded-xl bg-[#0B0F19] hover:bg-[#E54826] disabled:opacity-60 text-white text-[13.5px] font-heading font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#E2E5EC] p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-[#5A6275] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order ID, Customer Name, or Email..."
            aria-label="Search orders"
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-[#E2E5EC] bg-[#F4F5F8] focus:bg-white text-[13.5px] text-[#0B0F19] focus:outline-2 focus:outline-[#0B0F19]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear order search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5A6275] hover:text-[#0B0F19] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="sm:w-52">
          <label className="sr-only" htmlFor="admin-orders-status-filter">
            Filter by Order Status
          </label>
          <select
            id="admin-orders-status-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | AdminOrderStatus)
            }
            className="w-full h-10 px-3 rounded-xl border border-[#E2E5EC] bg-white text-[13.5px] font-medium text-[#0B0F19]"
          >
            <option value="all">Status: All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-[#E2E5EC] overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-[#F4F5F8] animate-pulse"
              />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag
              className="w-9 h-9 text-[#5A6275] mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="font-heading font-semibold text-[16px] text-[#0B0F19] mb-1">
              {orders.length === 0
                ? 'No storefront orders yet'
                : 'No orders match your filter'}
            </p>
            <p className="text-[13.5px] text-[#5A6275] max-w-md mx-auto">
              {orders.length === 0
                ? 'Live WooCommerce orders and completed storefront checkouts will appear here automatically with full customer shipping details, variations, and printable packing slips.'
                : 'Clear your search query or switch the status dropdown to view all orders.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[920px]">
              <thead>
                <tr className="border-b border-[#E2E5EC] bg-[#F4F5F8] text-[12px] font-semibold text-[#5A6275]">
                  <th className="py-3.5 pl-6 pr-3">Order ID</th>
                  <th className="py-3.5 px-3">Date / Time</th>
                  <th className="py-3.5 px-3">Customer</th>
                  <th className="py-3.5 px-3">Destination</th>
                  <th className="py-3.5 px-3">Items</th>
                  <th className="py-3.5 px-3">Payment</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 pl-3 pr-6 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5EC] text-[13.5px]">
                {filteredOrders.map((order) => {
                  const badge = STATUS_BADGE[order.status] || STATUS_BADGE.pending;
                  const totalUnits = order.items.reduce(
                    (acc, item) => acc + item.quantity,
                    0
                  );
                  return (
                    <tr
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      className="hover:bg-[#F4F5F8] transition-colors cursor-pointer"
                    >
                      <td className="py-4 pl-6 pr-3 font-mono font-bold text-[#0B0F19] tabular-nums whitespace-nowrap">
                        #{order.orderNumber}
                      </td>
                      <td className="py-4 px-3 font-mono text-[12.5px] text-[#5A6275] tabular-nums whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-4 px-3">
                        <p className="font-semibold text-[#0B0F19] truncate max-w-[180px]">
                          {order.customerName}
                        </p>
                        <p className="text-[12px] text-[#5A6275] truncate max-w-[180px]">
                          {order.email || order.phone || '—'}
                        </p>
                      </td>
                      <td className="py-4 px-3 text-[13px] text-[#5A6275] whitespace-nowrap">
                        {[
                          order.shippingAddress.city,
                          order.shippingAddress.state,
                        ]
                          .filter(Boolean)
                          .join(', ') || 'USA'}
                      </td>
                      <td className="py-4 px-3 font-mono text-[12.5px] text-[#0B0F19] tabular-nums whitespace-nowrap">
                        {totalUnits > 0
                          ? `${totalUnits} ${totalUnits === 1 ? 'item' : 'items'}`
                          : 'Checkout order'}
                      </td>
                      <td className="py-4 px-3 text-[13px] text-[#5A6275] whitespace-nowrap">
                        {order.paymentMethodTitle || order.paymentMethod}
                      </td>
                      <td className="py-4 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11.5px] font-semibold ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-4 pl-3 pr-6 text-right font-mono font-bold text-[#0B0F19] tabular-nums whitespace-nowrap">
                        ${Number(order.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
