import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_AGE_MS, snapshotState, marketplaceLink, parseCatalog, filterAndSort} from './catalog-core.mjs';

const now=Date.parse('2026-11-23T18:00:00Z');
const iso=(ms)=>new Date(ms).toISOString();
const base={id:'a',title:'Café Shirt',description:'Plain linen',category:'Clothing',brand:'Example Mill',links:{ebay:'https://www.ebay.ca/itm/listing-name/123456789012?ref=abc'}};
test('snapshot expires at six hours and rejects date-only or future stamps',()=>{
  assert.equal(snapshotState(iso(now-MAX_AGE_MS+1),now),'fresh');
  assert.equal(snapshotState(iso(now-MAX_AGE_MS),now),'stale');
  assert.equal(snapshotState(iso(now+1),now),'unavailable');
  for(const value of [null,'2026-11-23','2026-02-31T00:00:00Z','2026-11-23T24:00:00Z']) assert.equal(snapshotState(value,now),'unavailable');
});
test('only recognized product URL forms, no credentials, no hosted masquerade',()=>{
  assert.equal(marketplaceLink(base.links.ebay,'ebay'),'https://www.ebay.com/itm/123456789012');
  assert.equal(marketplaceLink('https://poshmark.com/listing/linen-123456789abcdef012345678?a=4','poshmark'),'https://poshmark.com/listing/linen-123456789abcdef012345678');
  assert.equal(marketplaceLink('https://mercari.com/us/item/m12345678901?ref=a','mercari'),'https://www.mercari.com/us/item/m12345678901/');
  for(const url of ['https://www.ebay.com.evil.invalid/itm/123456789012','javascript:alert(1)','http://www.ebay.com/itm/123456789012','https://sam@www.ebay.com/itm/123456789012','https://www.ebay.com:444/itm/123456789012','https://www.ebay.com/str/feralandfree']) assert.equal(marketplaceLink(url,'ebay'),null);
});
test('production requires valid listing; demo strips links; photos must be local',()=>{
  const row={...base,image:'assets/catalog/hero.webp',images:['assets/catalog/hero.webp','assets/catalog/more.jpg','https://example.invalid/bad.jpg','assets/catalog/../invalid.jpg','assets/catalog/bad.svg']};
  const p=parseCatalog({updatedAt:iso(now),items:[row,{...row,id:'bad',links:{ebay:'https://example.invalid'}}]}, {now});
  assert.equal(p.items.length,1);
  assert.deepEqual(p.items[0].images,['assets/catalog/hero.webp','assets/catalog/more.jpg']);
  assert.deepEqual(parseCatalog({fixture:true,items:[row]},{fixture:true,now}).items[0].links,{});
  assert.equal(parseCatalog({fixture:true,items:[row]},{now}).state,'unavailable');
  assert.equal(parseCatalog({updatedAt:null,items:[row]},{now}).state,'unavailable');
});
test('token search spans fields and sale price sorting keeps missing prices last',()=>{
  const p=parseCatalog({updatedAt:iso(now),items:[base,{...base,id:'b',title:'Black belt',price:9,currency:'USD',category:'Accessories'},{...base,id:'c',title:'Blue linen shirt',price:18,currency:'USD'}]}, {now});
  assert.deepEqual(filterAndSort(p.items,'cafe linen mill','','newest').map(x=>x.id),['a']);
  assert.deepEqual(filterAndSort(p.items,'','Clothing','high').map(x=>x.id),['c','a']);
  assert.deepEqual(filterAndSort(p.items,'','','low').map(x=>x.id),['b','c','a']);
});
