import { CHANNEL_NAMES, filterAndSort, parseCatalog, snapshotState } from './catalog-core.mjs';

const byId = id => document.getElementById(id);
const ui = Object.fromEntries(['fixture-flag','catalog-meta','controls','search','category','sort','reset','result-status','cards','more','fallback','fallback-copy','item-dialog','close-dialog','dialog-media','dialog-category','dialog-title','dialog-meta','dialog-price','dialog-description','dialog-links','dialog-note'].map(id => [id, byId(id)]));
const fixture = new URLSearchParams(location.search).get('demo') === '1';
const sample = !fixture && new URLSearchParams(location.search).get('sample') === '1';
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const PAGE = 24;
let catalog, limit = PAGE, openTrigger;
let searchTimer;

function element(tag, name, content) {
  const el = document.createElement(tag);
  if (name) el.className = name;
  if (content !== undefined) el.textContent = content;
  return el;
}
function assign(el, value) {
  el.textContent = value;
  el.hidden = !value;
}
function productImage(path, { detail = false, alt = '' } = {}) {
  const holder = element('div', 'product-image');
  const placeholder = element('span', 'image-mark', 'F&F');
  placeholder.setAttribute('aria-hidden','true');
  holder.append(placeholder);
  if (path) {
    const img = element('img');
    img.alt = alt;
    img.loading = detail ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => img.remove(), { once: true });
    img.src = path;
    holder.append(img);
  }
  return holder;
}
function homeState() {
  limit = PAGE;
  ui.search.value = '';
  ui.category.value = '';
  ui.sort.value = sample ? 'title' : 'newest';
}
function focusBack() {
  if (openTrigger?.isConnected && !ui.cards.hidden) openTrigger.focus();
  else if (!ui.controls.hidden) ui.search.focus();
  else ui.fallback.querySelector('a').focus();
}
ui['close-dialog'].addEventListener('click', () => ui['item-dialog'].close());
ui['item-dialog'].addEventListener('close',focusBack);
ui['item-dialog'].addEventListener('click', e => {
  if (e.target === ui['item-dialog']) ui['item-dialog'].close();
});
function expiryCheck() {
  if (!fixture && !sample && catalog?.state === 'fresh' && snapshotState(catalog.updatedAt) !== 'fresh') {
    showState('stale');
    return false;
  }
  return catalog?.state === 'fresh';
}
function details(item, trigger) {
  if (!expiryCheck()) return;
  openTrigger = trigger;
  assign(ui['dialog-category'], item.category);
  assign(ui['dialog-title'], item.title);
  assign(ui['dialog-meta'], [item.brand,item.size,item.condition].filter(Boolean).join(' · '));
  assign(ui['dialog-price'], item.price === null ? '' : usd.format(item.price));
  assign(ui['dialog-description'], item.description);
  ui['dialog-media'].replaceChildren();
  ui['dialog-media'].hidden = !item.images.length;
  if (item.images.length) {
    const hero = element('div');
    const gallery = element('div','photo-switcher');
    gallery.setAttribute('role','group');
    gallery.setAttribute('aria-label','Listing photos');
    const count = element('p','intro photo-count');
    count.setAttribute('role','status');
    const switches = [];
    const showPhoto = i => {
      const label = 'Listing photo ' + (i+1) + ' of ' + item.images.length;
      hero.replaceChildren(productImage(item.images[i], {detail:true, alt: label + ': ' + item.title}));
      count.textContent = label;
      switches.forEach((button,index) => button.setAttribute('aria-pressed',String(index === i)));
    };
    item.images.forEach((_, i) => {
      const photoButton = element('button','button secondary',String(i+1));
      photoButton.type = 'button';
      photoButton.setAttribute('aria-label','Show listing photo '+(i+1));
      photoButton.addEventListener('click', () => { if (expiryCheck()) showPhoto(i); });
      switches.push(photoButton); gallery.append(photoButton);
    });
    showPhoto(0);
    ui['dialog-media'].append(hero);
    if (item.images.length > 1) ui['dialog-media'].append(count,gallery);
  }
  ui['dialog-links'].replaceChildren();
  let n = 0;
  for (const [key, name] of Object.entries(CHANNEL_NAMES)) {
    const url = item.links[key];
    if (!url) continue;
    const a = element('a', 'button ' + (n++ === 0 ? 'primary' : 'secondary'), 'View on ' + name);
    a.href = url;
    // A tab that becomes stale while this dialog is open must not forward an old item.
    a.addEventListener('click', e => { if (!expiryCheck()) e.preventDefault(); });
    ui['dialog-links'].append(a);
  }
  assign(ui['dialog-note'], fixture ? 'Fictional demo item. Not for sale.' : sample ? 'This is an example from the noted date. The marketplace listing may have sold or ended.' : 'Confirm current availability, total price, shipping and returns on the listing.');
  ui['item-dialog'].showModal();
}
function card(item) {
  const art = element('article','card');
  const contents = element('div','card-copy');
  contents.append(element('p','eyebrow',item.category),element('h3','card-title',item.title));
  const meta = [item.brand,item.size,item.condition].filter(Boolean).join(' · ');
  if (meta) contents.append(element('p','item-meta',meta));
  const foot = element('div','card-foot');
  if (item.price !== null) foot.append(element('p','price',usd.format(item.price)));
  const button = element('button','button secondary','View details');
  button.type = 'button';
  button.setAttribute('aria-label','View details: ' + item.title);
  button.addEventListener('click', () => details(item,button));
  foot.append(button); contents.append(foot);
  art.append(productImage(item.images[0]),contents);
  return art;
}
function repaint({ more = false } = {}) {
  if (!expiryCheck()) return;
  const matched = filterAndSort(catalog.items,ui.search.value,ui.category.value,ui.sort.value);
  const cards = matched.slice(0,limit);
  const previous = ui.cards.children.length;
  if (!more) ui.cards.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const product of cards.slice(more ? previous : 0)) fragment.append(card(product));
  ui.cards.append(fragment);
  ui.cards.hidden = !cards.length;
  ui.more.hidden = cards.length >= matched.length;
  ui['result-status'].textContent = matched.length
    ? (cards.length < matched.length ? cards.length + ' of ' : '') + matched.length + (matched.length === 1 ? ' find' : ' finds')
    : 'No matches. Try another search or clear the filters.';
  if (more && ui.more.hidden) ui.cards.children[previous]?.querySelector('button')?.focus();
}
function showState(reason) {
  catalog = { state: reason };
  ui.cards.replaceChildren();
  ui['dialog-links'].replaceChildren();
  ui['dialog-media'].replaceChildren();
  for (const target of [ui.controls,ui.cards,ui.more,ui['result-status'],ui['catalog-meta']]) target.hidden = true;
  ui.fallback.hidden = false;
  assign(ui['fallback-copy'], reason === 'stale'
    ? 'This preview has expired. Browse the seller’s live shops for up-to-date listings.'
    : fixture ? 'The fictional demo is unavailable. The shop links below still open the live marketplaces.'
      : 'There’s no fresh catalog preview to browse here. The seller’s current listings are on the marketplaces.');
  if (ui['item-dialog'].open) ui['item-dialog'].close();
}
ui.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { limit = PAGE; repaint(); }, 120);
});
for (const el of [ui.category,ui.sort]) el.addEventListener('change', () => { limit = PAGE; repaint(); });
ui.reset.addEventListener('click', () => { clearTimeout(searchTimer); homeState(); repaint(); ui.search.focus(); });
ui.more.addEventListener('click', () => { limit += PAGE; repaint({more:true}); });
document.addEventListener('visibilitychange',() => { if (!document.hidden) expiryCheck(); });
window.addEventListener('pageshow', expiryCheck);
window.addEventListener('focus', expiryCheck);
setInterval(expiryCheck, 15000);

async function init() {
  ui['fixture-flag'].hidden = !fixture;
  try {
    const response = await fetch(fixture ? './catalog.fixture.json' : sample ? './catalog.sample.json' : './catalog.json', {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error('Catalog unavailable');
    catalog = parseCatalog(await response.json(), {fixture, sample});
  } catch {
    showState('unavailable');
    return;
  }
  if (catalog.state !== 'fresh') {
    showState(catalog.state);
    return;
  }
  const categories = [...new Set(catalog.items.map(x => x.category))].sort((a,b)=>a.localeCompare(b,'en-US'));
  for (const cat of categories) {
    const option = element('option','',cat); option.value = cat; ui.category.append(option);
  }
  if (sample) {
    for (const opt of Array.from(ui.sort.options)) if (opt.value !== 'title') opt.remove();
    ui.sort.value = 'title';
    assign(ui['catalog-meta'], 'Selected examples from public listings, compiled November 22, 2026 (Central). Not a live stock list. Check the marketplaces for current inventory.');
  } else if (!fixture) assign(ui['catalog-meta'], 'Catalog snapshot from ' + dateFmt.format(new Date(catalog.updatedAt)) + '. Availability and final prices are on the marketplaces.');
  ui.controls.hidden = false;
  ui['result-status'].hidden = false;
  ui.fallback.hidden = true;
  repaint();
}
init();
