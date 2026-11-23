import {
  fetchWcProductById,
  fetchWcProducts,
} from '../api/woocommerce';
import type { WcProduct, WcVariationDetail } from '../types/woocommerce';
import { decodeHtmlEntities } from './format';

export interface ParsedMetaCheckoutItem {
  rawToken: string;
  retailerId: string;
  quantity: number;
}

export interface ParsedMetaCheckoutParams {
  items: ParsedMetaCheckoutItem[];
  coupon: string | null;
}

export interface ResolvedMetaCartAddition {
  cartItemId: number;
  productId: number;
  variationId?: number;
  quantity: number;
  variationAttributes?: Array<{ attribute: string; value: string }>;
  matchedLabel: string;
}

/**
 * Parses Meta / Instagram Shop website checkout query parameters:
 *   /checkout/?products=<retailerId>:<qty>,<retailerId2>:<qty>&coupon=<code>
 */
export function parseMetaCheckoutQuery(
  search: string
): ParsedMetaCheckoutParams {
  const params = new URLSearchParams(search || '');
  const rawProducts = (params.get('products') || '').trim();
  const couponRaw = (params.get('coupon') || '').trim();
  const coupon = couponRaw ? couponRaw.slice(0, 64) : null;

  if (!rawProducts) {
    return { items: [], coupon };
  }

  const items: ParsedMetaCheckoutItem[] = [];
  for (const segment of rawProducts.split(',')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.lastIndexOf(':');
    let retailerId = trimmed;
    let quantity = 1;

    if (colonIdx > 0) {
      const qtyCandidate = Number.parseInt(trimmed.slice(colonIdx + 1), 10);
      if (Number.isFinite(qtyCandidate) && qtyCandidate > 0) {
        retailerId = trimmed.slice(0, colonIdx).trim();
        quantity = Math.min(20, qtyCandidate);
      }
    }

    if (retailerId) {
      items.push({ rawToken: trimmed, retailerId, quantity });
    }
  }

  return { items, coupon };
}

function slugifyToken(raw: string): string {
  return decodeHtmlEntities(raw || '')
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function splitCompositeRetailerId(retailerId: string): {
  basePart: string;
  attrSlugs: string[];
} {
  const delimiter = retailerId.includes('--')
    ? '--'
    : retailerId.includes('__')
      ? '__'
      : null;
  if (!delimiter) {
    return { basePart: retailerId.trim(), attrSlugs: [] };
  }
  const parts = retailerId
    .split(delimiter)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    basePart: parts[0] || retailerId.trim(),
    attrSlugs: parts.slice(1).map((s) => slugifyToken(s)).filter(Boolean),
  };
}

function extractNumericId(basePart: string): number | null {
  const clean = basePart.trim().toLowerCase();
  const direct = clean.match(/^(?:wc-|wc_|fds-)?(\d+)$/);
  if (direct) {
    const num = Number.parseInt(direct[1], 10);
    return Number.isInteger(num) && num > 0 ? num : null;
  }
  return null;
}

function matchVariationByAttrSlugs(
  product: WcProduct,
  attrSlugs: string[],
  preferredVariationId?: number
): {
  variationId?: number;
  variationAttributes?: Array<{ attribute: string; value: string }>;
} {
  const details: WcVariationDetail[] = product.variation_details || [];

  if (preferredVariationId) {
    const directDetail = details.find((d) => d.id === preferredVariationId);
    if (directDetail) {
      const attrs = resolveWildcardAttrs(
        product,
        directDetail.attributes || [],
        attrSlugs
      );
      return {
        variationId: directDetail.id,
        variationAttributes: attrs.length > 0 ? attrs : undefined,
      };
    }
    const directVarId = product.variations?.find(
      (vid) => vid === preferredVariationId
    );
    if (directVarId) {
      return {
        variationId: directVarId,
      };
    }
  }

  if (attrSlugs.length > 0 && details.length > 0) {
    let bestDetail: WcVariationDetail | null = null;
    let bestScore = -1;
    for (const d of details) {
      const varSlugs = (d.attributes || [])
        .map((a) => slugifyToken(a.option))
        .filter(Boolean);
      let score = 0;
      for (const s of attrSlugs) {
        if (varSlugs.includes(s)) score += 2;
        else if (varSlugs.some((vs) => vs.includes(s) || s.includes(vs))) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestDetail = d;
      }
    }
    if (bestDetail) {
      const attrs = resolveWildcardAttrs(
        product,
        bestDetail.attributes || [],
        attrSlugs
      );
      return {
        variationId: bestDetail.id,
        variationAttributes: attrs.length > 0 ? attrs : undefined,
      };
    }
  }

  if (details.length > 0) {
    const firstAvailable =
      details.find((d) => d.stock_status !== 'outofstock') || details[0];
    const attrs = resolveWildcardAttrs(
      product,
      firstAvailable.attributes || [],
      attrSlugs
    );
    return {
      variationId: firstAvailable.id,
      variationAttributes: attrs.length > 0 ? attrs : undefined,
    };
  }

  if (product.variations && product.variations.length > 0) {
    const firstId = product.variations[0];
    return {
      variationId: firstId,
    };
  }

  return {};
}

function resolveWildcardAttrs(
  product: WcProduct,
  varAttrs: Array<{ id?: number; name: string; slug?: string; option: string }>,
  attrSlugs: string[]
): Array<{ attribute: string; value: string }> {
  const result: Array<{ attribute: string; value: string }> = [];
  const usedSlugs = new Set<string>();

  for (const attr of varAttrs) {
    const cleanName = decodeHtmlEntities(attr.name);
    if (attr.option && attr.option.trim()) {
      result.push({
        attribute: cleanName,
        value: decodeHtmlEntities(attr.option),
      });
      continue;
    }
    // Wildcard "" value: match against attrSlugs using product attribute options
    const prodAttr = (product.attributes || []).find(
      (pa) => pa.name.trim().toLowerCase() === attr.name.trim().toLowerCase()
    );
    const options = prodAttr?.options || [];
    const matchedOpt = options.find((opt) => {
      const oSlug = slugifyToken(opt);
      if (attrSlugs.includes(oSlug) && !usedSlugs.has(oSlug)) {
        usedSlugs.add(oSlug);
        return true;
      }
      return false;
    });
    const fallbackOpt = matchedOpt || options[0];
    if (fallbackOpt) {
      result.push({
        attribute: cleanName,
        value: decodeHtmlEntities(fallbackOpt),
      });
    }
  }

  return result;
}

/**
 * Resolves parsed Meta checkout items against the loaded storefront catalog with
 * live WooCommerce Store API fallback for composite variant IDs, variation IDs, SKUs, or slugs.
 */
export async function resolveMetaCheckoutItems(
  items: ParsedMetaCheckoutItem[],
  loadedProducts: WcProduct[]
): Promise<ResolvedMetaCartAddition[]> {
  if (items.length === 0) return [];

  let catalog = [...loadedProducts];
  if (catalog.length === 0) {
    try {
      catalog = await fetchWcProducts({ perPage: 100 });
    } catch {
      catalog = [];
    }
  }

  const additions: ResolvedMetaCartAddition[] = [];

  for (const item of items) {
    const { basePart, attrSlugs } = splitCompositeRetailerId(item.retailerId);
    const numericId = extractNumericId(basePart);
    const baseLower = basePart.toLowerCase();
    const baseSlug = slugifyToken(basePart);

    let matchedProduct: WcProduct | null = null;
    let matchedVariationId: number | undefined;

    // 1. Direct match by WooCommerce product ID, variation ID, SKU, or slug in loaded catalog
    for (const prod of catalog) {
      if (numericId && prod.id === numericId) {
        matchedProduct = prod;
        break;
      }
      if (
        numericId &&
        (prod.variations?.includes(numericId) ||
          prod.variation_details?.some((v) => v.id === numericId))
      ) {
        matchedProduct = prod;
        matchedVariationId = numericId;
        break;
      }
      if (prod.sku && prod.sku.trim().toLowerCase() === baseLower) {
        matchedProduct = prod;
        break;
      }
      if (
        prod.variation_details?.some(
          (v) => v.sku && v.sku.trim().toLowerCase() === baseLower
        )
      ) {
        const matchedVar = prod.variation_details.find(
          (v) => v.sku && v.sku.trim().toLowerCase() === baseLower
        );
        matchedProduct = prod;
        matchedVariationId = matchedVar?.id;
        break;
      }
      if (prod.slug && slugifyToken(prod.slug) === baseSlug) {
        matchedProduct = prod;
        break;
      }
    }

    // 2. Live WooCommerce Store API fallback if not found in memory
    if (!matchedProduct && numericId) {
      try {
        const fetched = await fetchWcProductById(numericId);
        if (fetched && fetched.id) {
          matchedProduct = fetched;
        }
      } catch {
        // numericId may be a variation ID whose parent wasn't loaded yet — add directly by ID
        additions.push({
          cartItemId: numericId,
          productId: numericId,
          variationId: numericId,
          quantity: item.quantity,
          matchedLabel: `Item #${numericId}`,
        });
        continue;
      }
    }

    if (!matchedProduct) {
      try {
        const searched = await fetchWcProducts({ search: basePart, perPage: 10 });
        if (searched.length > 0) {
          matchedProduct =
            searched.find(
              (p) =>
                (p.sku && p.sku.trim().toLowerCase() === baseLower) ||
                slugifyToken(p.slug) === baseSlug
            ) || searched[0];
        }
      } catch {
        // ignore search failure
      }
    }

    if (!matchedProduct) continue;

    // Fetch full product details if variable and variation_details aren't loaded yet
    const isVariable =
      matchedProduct.type === 'variable' ||
      (matchedProduct.variations && matchedProduct.variations.length > 0);
    if (
      isVariable &&
      (!matchedProduct.variation_details ||
        matchedProduct.variation_details.length === 0)
    ) {
      try {
        matchedProduct = await fetchWcProductById(matchedProduct.id);
      } catch {
        // continue with available variation metadata
      }
    }

    if (isVariable) {
      const resolvedVar = matchVariationByAttrSlugs(
        matchedProduct,
        attrSlugs,
        matchedVariationId
      );
      const targetId = resolvedVar.variationId || matchedProduct.id;
      additions.push({
        cartItemId: targetId,
        productId: matchedProduct.id,
        variationId: resolvedVar.variationId,
        quantity: item.quantity,
        variationAttributes: resolvedVar.variationAttributes,
        matchedLabel: decodeHtmlEntities(matchedProduct.name),
      });
    } else {
      additions.push({
        cartItemId: matchedProduct.id,
        productId: matchedProduct.id,
        quantity: item.quantity,
        matchedLabel: decodeHtmlEntities(matchedProduct.name),
      });
    }
  }

  return additions;
}
