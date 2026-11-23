import type { WcProduct, WcVariationDetail } from '../types/woocommerce';

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&times;': '×',
  '&deg;': '°',
};

export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&#(\d+);/g, (_match, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&[a-zA-Z0-9]+;/g, (entity) => NAMED_ENTITIES[entity] ?? entity);
}

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');
  const stripped = withBreaks.replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(stripped)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseDescriptionSections(html: string): {
  paragraphs: string[];
  specs: string[];
  packingList: string[];
} {
  const clean = stripHtmlToText(html);
  const blocks = clean
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  const specs: string[] = [];
  const packingList: string[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines[0]?.toLowerCase().startsWith('specifications')) {
      specs.push(...lines.slice(1));
    } else if (lines[0]?.toLowerCase().startsWith('packing list')) {
      packingList.push(...lines.slice(1));
    } else {
      paragraphs.push(block);
    }
  }

  return { paragraphs, specs, packingList };
}

export function formatMinorPrice(
  minorAmount: string | number | undefined,
  minorUnit = 2,
  showCents = true
): string {
  const raw = Number(minorAmount ?? 5000);
  const value = Number.isFinite(raw) ? raw / Math.pow(10, minorUnit) : 50;
  if (!showCents && Number.isInteger(value)) {
    return `$${value}`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatWcDecimalPrice(
  amount: string | number | undefined,
  showCents = false
): string {
  const num = Number(amount);
  const value = Number.isFinite(num) && num > 0 ? num : 50;
  if (!showCents && Number.isInteger(value)) {
    return `$${value}`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Returns live WooCommerce regular_price if set above the active sale/price,
 * otherwise provides a realistic USA market comparison price ($79–$149).
 */
export function getRegularComparePrice(
  product: WcProduct,
  activeVariation?: WcVariationDetail
): number {
  const activePrice = Number(
    activeVariation?.sale_price || activeVariation?.price || product.sale_price || product.price || 50
  );
  const liveRegular = Number(
    activeVariation?.regular_price || product.regular_price || 0
  );

  if (Number.isFinite(liveRegular) && liveRegular > activePrice) {
    return Math.round(liveRegular);
  }

  if (activePrice > 0 && activePrice < 45) {
    return Math.max(Math.round(activePrice * 1.9), Math.ceil(activePrice) + 25);
  }

  const name = decodeHtmlEntities(product.name).toLowerCase();
  if (name.includes('ipl')) {
    return 189;
  }
  if (name.includes('hair dryer')) {
    return 169;
  }
  if (name.includes('smart watch') || name.includes('smart glasses') || name.includes('bluetooth audio')) {
    return 159;
  }
  if (name.includes('vest')) {
    return 149;
  }
  if (name.includes('blanket') || name.includes('smart ring') || name.includes('health mon')) {
    return 139;
  }
  if (name.includes('massage gun')) {
    return 129;
  }
  if (name.includes('neck massager') || name.includes('eye massager') || name.includes('facial')) {
    return 119;
  }
  if (name.includes('flat iron') || name.includes('curling') || name.includes('straightener') || name.includes('hot comb')) {
    return 99;
  }
  if (name.includes('gloves') || name.includes('socks') || name.includes('flosser') || name.includes('cupping')) {
    return 89;
  }
  if (name.includes('lunch box') || name.includes('posture') || name.includes('bracelet')) {
    return 79;
  }

  const fallbackPool = [79, 89, 99, 119, 139, 159, 179, 199];
  return fallbackPool[product.id % fallbackPool.length];
}

export type CollectionFilter =
  | 'all'
  | 'beauty-hair'
  | 'heating-winter'
  | 'massage-wellness'
  | 'smart-tech-home';

export const COLLECTION_TABS: Array<{ id: CollectionFilter; label: string }> = [
  { id: 'all', label: 'All Deals' },
  { id: 'beauty-hair', label: 'Beauty & Hair' },
  { id: 'heating-winter', label: 'Heating & Winter' },
  { id: 'massage-wellness', label: 'Massage & Wellness' },
  { id: 'smart-tech-home', label: 'Smart Tech & Home' },
];

export function classifyProductCollection(product: WcProduct): CollectionFilter {
  const name = decodeHtmlEntities(product.name).toLowerCase();
  if (
    name.includes('hair') ||
    name.includes('ipl') ||
    name.includes('curling') ||
    name.includes('straightener') ||
    name.includes('flat iron') ||
    name.includes('facial') ||
    name.includes('flosser')
  ) {
    return 'beauty-hair';
  }
  if (
    name.includes('heated') ||
    name.includes('vest') ||
    name.includes('blanket') ||
    name.includes('gloves') ||
    name.includes('socks')
  ) {
    return 'heating-winter';
  }
  if (
    name.includes('massage') ||
    name.includes('posture') ||
    name.includes('cupping') ||
    name.includes('bracelet')
  ) {
    return 'massage-wellness';
  }
  return 'smart-tech-home';
}

export function findColorAttribute(product: WcProduct) {
  return (product.attributes || []).find((a) => {
    const lower = a.name.toLowerCase();
    return lower.includes('color') || lower.includes('colour');
  });
}

export function isWearableSizeOption(raw: string): boolean {
  const cleaned = decodeHtmlEntities(raw).trim();
  return /^(?:size\s+)?(?:xxs|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|small|medium|large|extra\s*small|extra\s*large)$/i.test(
    cleaned
  );
}

export function findWearableSizeAttribute(product: WcProduct) {
  const sizeAttr = (product.attributes || []).find((a) =>
    a.name.toLowerCase().includes('size')
  );
  if (!sizeAttr || !sizeAttr.options?.length) return null;
  const validOptions = sizeAttr.options.filter(isWearableSizeOption);
  if (validOptions.length === 0) return null;
  return {
    ...sizeAttr,
    options: validOptions,
  };
}

export function findSizeAttribute(product: WcProduct) {
  const explicitSize = (product.attributes || []).find((a) =>
    a.name.toLowerCase().includes('size')
  );
  if (explicitSize) return explicitSize;

  return (product.attributes || []).find((a) => {
    const lower = a.name.toLowerCase();
    return (
      !lower.includes('color') &&
      !lower.includes('colour') &&
      a.options &&
      a.options.length > 0
    );
  });
}

export function findMatchingVariationDetail(
  product: WcProduct,
  selectedAttrs: Record<string, string>
): WcVariationDetail | undefined {
  const details = product.variation_details;
  if (!details || details.length === 0) {
    return undefined;
  }

  const normalizedSelected = new Map<string, string>();
  for (const [k, v] of Object.entries(selectedAttrs)) {
    normalizedSelected.set(k.toLowerCase().trim(), v.toLowerCase().trim());
  }

  const exact = details.find((variation) =>
    variation.attributes.every((attr) => {
      const chosen = normalizedSelected.get(attr.name.toLowerCase().trim());
      return !chosen || chosen === attr.option.toLowerCase().trim();
    })
  );
  return exact ?? details[0];
}

export function getDefaultAttributes(product: WcProduct): Record<string, string> {
  const defaults: Record<string, string> = {};
  const firstDetail = product.variation_details?.[0];
  if (firstDetail) {
    for (const attr of firstDetail.attributes) {
      defaults[attr.name] = attr.option;
    }
    return defaults;
  }
  for (const attr of product.attributes || []) {
    if (attr.options && attr.options.length > 0) {
      defaults[attr.name] = attr.options[0];
    }
  }
  return defaults;
}

export function isAllowedStoreCategory(cat: {
  name?: string;
  slug?: string;
}): boolean {
  const slug = (cat.slug || '').toLowerCase();
  const name = (cat.name || '').toLowerCase();
  return (
    slug === 'hot-sale' ||
    name.includes('hot selling') ||
    slug === 'new-arrival' ||
    slug === 'new-arrivals' ||
    name.includes('new arrival')
  );
}

const SWATCH_MAP: Array<[string, string]> = [
  ['rose gold', '#D8A39D'],
  ['light brown', '#A67B5B'],
  ['dark brown', '#5C4033'],
  ['champagne', '#E6D5B8'],
  ['gold', '#D4AF37'],
  ['silver', '#C4C7CE'],
  ['black', '#141413'],
  ['white', '#F5F5F3'],
  ['ivory', '#F2EFE9'],
  ['beige', '#DFD3C3'],
  ['cream', '#EDE6D6'],
  ['pink', '#E598A8'],
  ['rose', '#D46A7E'],
  ['red', '#C83E37'],
  ['burgundy', '#6D222D'],
  ['blue', '#355C8C'],
  ['navy', '#1E2D45'],
  ['green', '#3A6B52'],
  ['olive', '#5D6644'],
  ['grey', '#8E8E93'],
  ['gray', '#8E8E93'],
  ['brown', '#7A543E'],
  ['purple', '#7B5E8C'],
  ['orange', '#E54826'],
];

export function resolveSwatchColor(optionText: string): string | null {
  const lower = decodeHtmlEntities(optionText).toLowerCase();
  for (const [keyword, hex] of SWATCH_MAP) {
    if (lower.includes(keyword)) {
      return hex;
    }
  }
  return null;
}

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

