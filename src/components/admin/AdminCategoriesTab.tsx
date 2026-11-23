import React from 'react';
import { ArrowRight, FolderOpen, Package, RefreshCw } from 'lucide-react';
import type { WcCategory, WcProduct } from '../../types/woocommerce';
import { decodeHtmlEntities, stripHtmlToText } from '../../utils/format';

interface AdminCategoriesTabProps {
  categories: WcCategory[];
  products: WcProduct[];
  loading: boolean;
  onRefresh: () => void;
  onSelectCategory: (categoryId: number) => void;
}

export const AdminCategoriesTab: React.FC<AdminCategoriesTabProps> = ({
  categories,
  products,
  loading,
  onRefresh,
  onSelectCategory,
}) => {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const getFallbackThumb = (catId: number): string => {
    const match = products.find((p) =>
      (p.categories || []).some((c) => c.id === catId)
    );
    return match?.images?.[0]?.src || '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E2E5EC]">
        <div>
          <p className="text-[12px] font-mono text-[#5A6275] mb-1">
            Live WooCommerce Taxonomy · {categories.length}{' '}
            {categories.length === 1 ? 'Category' : 'Categories'}
          </p>
          <h1 className="font-heading font-bold text-[26px] sm:text-[30px] text-[#0B0F19] leading-tight">
            Categories
          </h1>
          <p className="text-[14px] text-[#5A6275] mt-1">
            Click any live category row to jump directly to WooCommerce Products
            pre-filtered to that category.
          </p>
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
          <span>Refresh Categories</span>
        </button>
      </div>

      {loading && categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-6 space-y-4">
          {Array.from({ length: 2 }).map((_, idx) => (
            <div
              key={idx}
              className="h-20 rounded-xl bg-[#F4F5F8] animate-pulse"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E5EC] p-12 text-center">
          <FolderOpen
            className="w-9 h-9 text-[#5A6275] mx-auto mb-3"
            aria-hidden="true"
          />
          <p className="font-heading font-semibold text-[16px] text-[#0B0F19] mb-1">
            No WooCommerce categories returned
          </p>
          <p className="text-[13.5px] text-[#5A6275]">
            Refresh categories or check WooCommerce diagnostics in Settings.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E5EC] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E5EC] bg-[#F4F5F8] text-[12px] font-semibold text-[#5A6275]">
                  <th className="py-3.5 pl-6 pr-4">Category</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Parent</th>
                  <th className="py-3.5 px-4 text-right">Live Products</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5EC] text-[14px]">
                {categories.map((cat) => {
                  const thumb = cat.image?.src || getFallbackThumb(cat.id);
                  const parentCat =
                    cat.parent > 0 ? categoryById.get(cat.parent) : null;
                  const description = stripHtmlToText(cat.description);

                  return (
                    <tr
                      key={cat.id}
                      onClick={() => onSelectCategory(cat.id)}
                      className="hover:bg-[#F4F5F8] transition-colors cursor-pointer"
                    >
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-[#F4F5F8] border border-[#E2E5EC] overflow-hidden flex items-center justify-center shrink-0">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={decodeHtmlEntities(cat.name)}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-[#5A6275]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-heading font-bold text-[15px] text-[#0B0F19]">
                              {decodeHtmlEntities(cat.name)}
                            </p>
                            <p className="text-[12.5px] text-[#5A6275] truncate max-w-md">
                              {description || `WooCommerce Category #${cat.id}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-[13px] text-[#5A6275] whitespace-nowrap">
                        /{cat.slug}
                      </td>
                      <td className="py-4 px-4 text-[13.5px] text-[#5A6275] whitespace-nowrap">
                        {parentCat
                          ? decodeHtmlEntities(parentCat.name)
                          : 'Top-Level'}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-[15px] text-[#0B0F19] tabular-nums whitespace-nowrap">
                        {cat.count}
                      </td>
                      <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCategory(cat.id);
                          }}
                          className="h-9 px-3.5 rounded-lg border border-[#E2E5EC] bg-white hover:bg-[#0B0F19] hover:text-white hover:border-[#0B0F19] text-[#0B0F19] text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>Filter Products</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
