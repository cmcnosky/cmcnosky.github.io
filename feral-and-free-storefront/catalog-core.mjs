export const MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const CHANNEL_NAMES = { ebay: 'eBay', poshmark: 'Poshmark', mercari: 'Mercari' };

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return NaN;
  const day = Date.parse(value.slice(0, 10) + 'T00:00:00Z');
  if (!Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== value.slice(0, 10)) return NaN;
  return Date.parse(value);
}

export function snapshotState(value, now = Date.now()) {
  const stamp = typeof value === 'string' && value.includes('T') ? validDate(value) : NaN;
  if (!Number.isFinite(stamp) || stamp > now) return 'unavailable';
  return now - stamp >= MAX_AGE_MS ? 'stale' : 'fresh';
}

export function marketplaceLink(value, kind) {
  if (typeof value !== 'string' || value.length > 2000 || !value.startsWith('https://') || /[\\\s]/.test(value)) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
  const host = url.hostname;
  if (kind === 'ebay' && ['www.ebay.com', 'ebay.com', 'www.ebay.ca', 'ebay.ca'].includes(host)) {
    const id = url.pathname.match(/^\/itm\/(?:[-a-zA-Z0-9_%+.~]+\/)?([0-9]{10,15})\/?$/)?.[1];
    return id ? 'https://www.ebay.com/itm/' + id : null;
  }
  if (kind === 'poshmark' && ['poshmark.com', 'www.poshmark.com'].includes(host)) {
    const path = url.pathname.match(/^\/listing\/([-a-zA-Z0-9_%+.~]*[a-fA-F0-9]{24})\/?$/)?.[1];
    return path ? 'https://poshmark.com/listing/' + path : null;
  }
  if (kind === 'mercari' && ['mercari.com', 'www.mercari.com'].includes(host)) {
    const id = url.pathname.match(/^\/us\/item\/(m[0-9]{8,16})\/?$/)?.[1];
    return id ? 'https://www.mercari.com/us/item/' + id + '/' : null;
  }
  return null;
}

function imagePath(value) {
  return typeof value === 'string' && /^assets\/catalog\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,110}\.(?:jpe?g|png|webp|avif)$/i.test(value) && value.startsWith('assets/catalog/') ? value : '';
}
function str(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

export function parseCatalog(raw, { fixture = false, now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (fixture ? raw.fixture !== true : 'fixture' in raw) || !Array.isArray(raw.items)) return { state: 'unavailable', items: [] };
  const state = fixture ? 'fresh' : snapshotState(raw.updatedAt, now);
  if (state !== 'fresh') return { state, items: [] };
  const items = [], seen = new Set();
  for (const row of raw.items.slice(0, 10000)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const id = str(row.id, 120), title = str(row.title, 240), category = str(row.category, 100);
    if (!id || !title || !category || seen.has(id)) continue;
    const links = Object.fromEntries(Object.keys(CHANNEL_NAMES).flatMap(kind => {
      const link = !fixture && marketplaceLink(row.links?.[kind], kind);
      return link ? [[kind, link]] : [];
    }));
    if (!fixture && !Object.keys(links).length) continue;
    seen.add(id);
    items.push({
      id, title, category, links,
      description: str(row.description, 30000),
      brand: str(row.brand, 160),
      size: str(row.size, 100),
      condition: str(row.condition, 360),
      images: [...new Set([imagePath(row.image), ...(Array.isArray(row.images) ? row.images.slice(0, 24).map(imagePath) : [])].filter(Boolean))].slice(0, 24),
      price: row.currency === 'USD' && Number.isFinite(row.price) && row.price >= 0 ? row.price : null,
      listedAt: validDate(row.listedAt)
    });
  }
  return { state: items.length ? 'fresh' : 'empty', items, updatedAt: raw.updatedAt };
}

function searchText(value) {
  return value.toLocaleLowerCase('en-US').normalize('NFD').replace(/\p{Mark}/gu, '').replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim();
}
const nameCompare = new Intl.Collator('en-US', {sensitivity: 'base', numeric: true});
export function filterAndSort(items, query, category, sort) {
  const tokens = searchText(query).split(' ').filter(Boolean);
  return items.filter(x => {
    if (category && x.category !== category) return false;
    if (!tokens.length) return true;
    const haystack = searchText([x.title, x.brand, x.description, x.category, x.size, x.condition].join(' '));
    return tokens.every(t => haystack.includes(t));
  }).sort((a,b) => {
    const alpha = nameCompare.compare(a.title,b.title);
    if (sort === 'title') return alpha;
    if (sort === 'low' || sort === 'high') {
      if (a.price === null && b.price !== null) return 1;
      if (b.price === null && a.price !== null) return -1;
      return (sort === 'low' ? a.price - b.price : b.price - a.price) || alpha;
    }
    return ((Number.isFinite(b.listedAt) ? b.listedAt : -Infinity) - (Number.isFinite(a.listedAt) ? a.listedAt : -Infinity)) || alpha;
  });
}
