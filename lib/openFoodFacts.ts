import type { DrinkCategory, EventDrink, PackagingType } from '@/lib/drinks';

const OPEN_FOOD_FACTS_BASE_URL = 'https://world.openfoodfacts.org';
const REQUEST_TIMEOUT_MS = 7000;
const USER_AGENT = 'BunaSpritz/1.0 (local drink catalog lookup; contact: bunaspritz@example.com)';

export type OpenFoodFactsDrink = {
  barcode: string;
  name: string;
  brand?: string;
  category: DrinkCategory;
  subcategory?: string;
  aliases: string[];
  volumesMl: number[];
  packagingTypes?: PackagingType[];
  alcoholPercent?: number;
  alcoholFree?: boolean;
  imageUrl?: string;
  source: 'openfoodfacts';
};

type OpenFoodFactsProduct = {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  quantity?: string;
  packaging?: string;
  image_front_url?: string;
  categories?: string;
  categories_tags?: string[];
  alcohol_value?: number | string;
  alcohol_100g?: number | string;
  ingredients_text?: string;
};

type OpenFoodFactsResponse = {
  status?: number;
  product?: OpenFoodFactsProduct;
};

const cache = new Map<string, OpenFoodFactsDrink | null>();

export async function lookupDrinkByBarcode(barcode: string): Promise<OpenFoodFactsDrink | null> {
  const normalizedBarcode = barcode.trim().replace(/\s/g, '');
  if (!normalizedBarcode) return null;
  if (cache.has(normalizedBarcode)) return cache.get(normalizedBarcode) ?? null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_BASE_URL}/api/v3/product/${encodeURIComponent(normalizedBarcode)}`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) {
      cache.set(normalizedBarcode, null);
      return null;
    }
    const payload = (await response.json()) as OpenFoodFactsResponse;
    const parsed = parseOpenFoodFactsProduct(normalizedBarcode, payload.product);
    cache.set(normalizedBarcode, parsed);
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function addOpenFoodFactsDrinkToEvent(drink: OpenFoodFactsDrink): EventDrink {
  return {
    id: `off-${drink.barcode}`,
    productId: `off-${drink.barcode}`,
    name: drink.name,
    brand: drink.brand,
    category: drink.category,
    volumeMl: drink.volumesMl[0],
    quantity: 1,
    packagingType: drink.packagingTypes?.[0],
    source: 'openfoodfacts',
    imageUrl: drink.imageUrl,
  };
}

export function getOpenFoodFactsCacheSize() {
  return cache.size;
}

function parseOpenFoodFactsProduct(barcode: string, product?: OpenFoodFactsProduct): OpenFoodFactsDrink | null {
  if (!product || !isLikelyBeverage(product)) return null;
  const name = clean(product.product_name || product.product_name_en);
  if (!name) return null;

  const brand = clean(product.brands);
  const category = classifyCategory(`${name} ${brand ?? ''} ${product.categories ?? ''} ${(product.categories_tags ?? []).join(' ')}`);
  const volume = parseVolumeMl(product.quantity);
  const alcoholPercent = parseAlcoholPercent(product);
  const alcoholFree = /0\s*%|0\.0|alcohol[- ]?free|fara alcool|fără alcool|bezalkohol/i.test(`${name} ${product.categories ?? ''} ${product.quantity ?? ''}`);

  return {
    barcode,
    name,
    brand,
    category,
    subcategory: product.categories,
    aliases: [name, brand, ...(product.categories_tags ?? [])].filter(Boolean).map((value) => normalize(value!)),
    volumesMl: volume ? [volume] : [],
    packagingTypes: parsePackaging(product.packaging),
    alcoholPercent,
    alcoholFree: alcoholFree || undefined,
    imageUrl: clean(product.image_front_url),
    source: 'openfoodfacts',
  };
}

function isLikelyBeverage(product: OpenFoodFactsProduct) {
  const text = normalize(`${product.product_name ?? ''} ${product.product_name_en ?? ''} ${product.categories ?? ''} ${(product.categories_tags ?? []).join(' ')} ${product.packaging ?? ''}`);
  if (!text || /cosmetic|parfum|detergent|cleaner|disinfect|sanit|technical|laboratory|automotive|engine|shampoo|soap|supplement|capsule|powder|essence/.test(text)) return false;
  return /beverage|drink|boisson|bebida|bautura|băutură|beer|biere|bere|wine|vino|vin|vodka|whisky|whiskey|rum|gin|tequila|cider|cidre|juice|suc|water|eau|apa|apă|cola|tonic|energy|cocktail|liqueur|liquor|alcohol|alcool|spirit/.test(text);
}

function classifyCategory(text: string): DrinkCategory {
  const value = normalize(text);
  if (/beer|biere|bere|lager|pils/.test(value)) return 'Beer';
  if (/cider|cidre|cidru/.test(value)) return 'Cider';
  if (/wine|vino|vin |prosecco|champagne|cava|spumant/.test(value)) return 'Wine';
  if (/vodka|vodca/.test(value)) return 'Vodka';
  if (/whisky|whiskey|scotch|bourbon/.test(value)) return 'Whisky';
  if (/rum|ron /.test(value)) return 'Rum';
  if (/gin/.test(value)) return 'Gin';
  if (/tequila|mezcal/.test(value)) return 'Tequila';
  if (/brandy|cognac|vinars|divin/.test(value)) return 'Brandy';
  if (/liqueur|liquor|lichior|aperitif|vermouth|bitter|amaro/.test(value)) return 'Liqueur';
  if (/energy|energiz/.test(value)) return 'Energy drinks';
  if (/water|eau|apa|apă/.test(value)) return 'Water';
  if (/juice|suc/.test(value)) return 'Juice';
  if (/cola/.test(value)) return 'Cola';
  if (/tonic/.test(value)) return 'Tonic';
  return 'Soft drinks';
}

function parseVolumeMl(quantity?: string) {
  if (!quantity) return undefined;
  const value = normalize(quantity).replace(',', '.');
  const match = value.match(/(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const unit = match[2];
  const multiplier = unit === 'l' ? 1000 : unit === 'cl' ? 10 : 1;
  const volume = Math.round(amount * multiplier);
  return volume > 0 && volume <= 100000 ? volume : undefined;
}

function parseAlcoholPercent(product: OpenFoodFactsProduct) {
  const value = Number(product.alcohol_value ?? product.alcohol_100g);
  return Number.isFinite(value) && value > 0 && value <= 100 ? value : undefined;
}

function parsePackaging(packaging?: string): PackagingType[] | undefined {
  if (!packaging) return undefined;
  const value = normalize(packaging);
  const result: PackagingType[] = [];
  if (/can|lata|doza/.test(value)) result.push('can');
  if (/bottle|glass|sticla|sticlă/.test(value)) result.push('bottle');
  if (/pet|plastic/.test(value)) result.push('PET');
  if (/bag|box|carton/.test(value)) result.push('bag-in-box');
  return result.length ? [...new Set(result)] : undefined;
}

function clean(value?: string) {
  const result = value?.trim();
  return result || undefined;
}

function normalize(value: string) {
  return value.toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
