import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Heart, ShoppingBag, Trash2 } from 'lucide-react';
import type { WcProduct } from '../types/woocommerce';
import { getRegularComparePrice } from '../utils/format';
import { ProductCard } from './ProductCard';

interface WishlistViewProps {
  items: WcProduct[];
  addingProductId: number | null;
  justAddedProductId: number | null;
  compareIds: number[];
  onToggleWishlist: (product: WcProduct) => void;
  onToggleCompare: (product: WcProduct) => void;
  onClearWishlist: () => void;
  onSelectProduct: (product: WcProduct) => void;
  onQuickView?: (product: WcProduct) => void;
  onSelectCategoryId: (categoryId: number) => void;
  onContinueShopping: () => void;
  onAddToCart: (
    product: WcProduct,
    variationId?: number,
    variationAttrs?: Array<{ attribute: string; value: string }>,
    selectedAttrsMap?: Record<string, string>
  ) => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  items,
  addingProductId,
  justAddedProductId,
  compareIds,
  onToggleWishlist,
  onToggleCompare,
  onClearWishlist,
  onSelectProduct,
  onQuickView,
  onSelectCategoryId,
  onContinueShopping,
  onAddToCart,
}) => {
  const totalSavings = items.reduce((sum, item) => {
    const activePrice = Number(item.sale_price || item.price || 50) || 50;
    const compare = getRegularComparePrice(item);
    return sum + Math.max(Math.round(compare - activePrice), 15);
  }, 0);

  return (
    <section className="bg-[#F4F5F8] py-8 sm:py-14 min-h-[72vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <button
            type="button"
            onClick={onContinueShopping}
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0B0F19] hover:text-[#E54826] cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Continue Shopping</span>
          </button>

          {items.length > 0 && (
            <button
              type="button"
              onClick={onClearWishlist}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E2E5EC] bg-white text-[13px] font-semibold text-[#5A6275] hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Wishlist</span>
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pb-6 border-b border-[#E2E5EC]">
          <div>
            <p className="text-[12.5px] font-mono font-medium text-[#E54826] mb-1.5">
              Saved For Later · Stored On This Device
            </p>
            <h1 className="type-h1 text-[#0B0F19]">
              My Wishlist ({items.length})
            </h1>
          </div>

          {items.length > 0 && totalSavings > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-[#E2E5EC]">
              <span className="text-[13px] text-[#5A6275]">Total Potential Savings:</span>
              <span className="font-heading font-extrabold text-[17px] text-[#16A34A] tabular-nums">
                ${totalSavings} vs. USA Retail
              </span>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-[#E2E5EC] p-10 sm:p-12 text-center max-w-xl mx-auto shadow-[0_12px_32px_-20px_rgba(14,14,13,0.1)]"
          >
            <div className="w-16 h-16 rounded-full bg-[#ECEEF2] flex items-center justify-center mx-auto mb-4">
              <Heart className="w-7 h-7 text-[#0B0F19]/45" aria-hidden="true" />
            </div>
            <h2 className="font-heading font-bold text-[22px] text-[#0B0F19] mb-2">
              Your Wishlist Is Empty
            </h2>
            <p className="type-body text-[#5A6275] mb-6">
              Save your favorite $50 trending finds by clicking the heart icon on any product card. Your saved items stay ready whenever you return.
            </p>
            <button
              type="button"
              onClick={onContinueShopping}
              className="type-button px-7 py-3.5 rounded-full bg-[#E54826] hover:bg-[#CC3B1C] text-white inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              <span>Browse Hot Selling $50 Products</span>
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {items.map((product, idx) => (
              <ProductCard
                key={product.id}
                product={product}
                index={idx}
                isAdding={addingProductId === product.id}
                justAdded={justAddedProductId === product.id}
                isWishlisted={true}
                onToggleWishlist={onToggleWishlist}
                isCompared={compareIds.includes(product.id)}
                onToggleCompare={onToggleCompare}
                onSelectProduct={onSelectProduct}
                onQuickView={onQuickView}
                onSelectCategoryId={onSelectCategoryId}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
