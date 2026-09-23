import test from 'node:test';
import assert from 'node:assert/strict';
import { runCost, bestWindows, currentRow, cents } from './core.js';
import { readFileSync } from 'node:fs';
const rows = Array.from({length:12},(_,i)=>({timestamp:1000+i*900,price:[200,180,60,50,40,70,100,220,300,90,80,70][i]}));
test('dryer run cost uses 15-minute intervals and VAT/adders',()=>{
  const r=runCost(rows,0,{durationHours:1.5,powerKw:2.5,addersEurPerKwh:0.16,vatPct:21});
  assert.equal(r.intervals,6);
  assert.equal(Number(r.energyKwh.toFixed(2)),3.75);
  assert.equal(cents(r.market),38); // avg 100 €/MWh = 0.10 €/kWh * 3.75
  assert.equal(cents(r.adders),60);
  assert.equal(cents(r.total),118);
});
test('best window picks contiguous cheapest 1.5 hours',()=>{
  const b=bestWindows(rows,{durationHours:1.5,powerKw:2.5,addersEurPerKwh:0,vatPct:0},1)[0];
  assert.equal(b.start,1000+1*900);
  assert.equal(b.end,1000+7*900);
  assert.equal(Math.round(b.avgPrice),83);
});
test('current row finds 15-minute interval',()=>{
  assert.equal(currentRow(rows, (1000+3*900+20)*1000).price,50);
});

test('Nord Pool market setup connects every API-supported market and hides unsupported ones',()=>{
  const html = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  for (const [code, flag] of Object.entries({lv:'🇱🇻',lt:'🇱🇹',ee:'🇪🇪',fi:'🇫🇮',nl:'🇳🇱'})) {
    assert.match(html, new RegExp(`${code}:\\s*\\{[^\n]+live:true`));
    assert.match(html, new RegExp(`${code}:\\s*\\{[^\n]+nordpoolArea:`));
    assert.ok(html.includes(flag));
  }
  for (const code of ['no1','no5','se1','se4','dk1','dk2','nl','be','at','fr','pl']) {
    assert.match(html, new RegExp(`${code}:\\s*\\{[^\n]+live:true`));
    assert.match(html, new RegExp(`${code}:\\s*\\{[^\n]+nordpoolArea:`));
  }
  for (const code of ['de_lu','gb','ie']) {
    assert.match(html, new RegExp(`${code}:\\s*\\{[^\n]+live:false`));
  }
  assert.match(html, /ACTIVE_MARKETS/);
  assert.match(html, /DayAheadPrices/);
  assert.match(html, /multiAreaEntries/);
  assert.match(html, /SLOT_CACHE/);
  assert.match(html, /quick = url\.searchParams\.get\('quick'\) === '1'/);
  assert.match(html, /scheduleFullRefresh/);
  assert.match(html, /function makeSlotKey/);
  assert.match(html, /selectedMarket = localStorage\.getItem\('market'\)/);
  assert.match(html, /localStorage\.setItem\('market'/);
  assert.match(html, /MARKETS\[selectedMarket\]\.lang/);
});

test('supported languages have a short site slogan and are remembered',()=>{
  const html = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  for (const code of ['lv','ee','lt','ru','en']) assert.match(html, new RegExp(`${code}:`));
  for (const slogan of [
    'Live electricity prices and cheaper usage times.',
    'Dzīvās elektrības cenas un lētākie lietošanas laiki.',
    'Gyvos elektros kainos ir pigesnis vartojimo laikas.',
    'Reaalajas elektrihinnad ja odavamad kasutusajad.',
    'Живые цены на электричество и более дешёвые часы.'
  ]) {
    assert.ok(html.includes(`subtitle:'${slogan}'`));
    assert.ok(slogan.length <= 64);
  }
  assert.match(html, /const LANGS = \{lv:'LV',ee:'EE',lt:'LT',ru:'RU',en:'EN'\}/);
  assert.match(html, /localStorage\.getItem\('lang'\)/);
  assert.match(html, /localStorage\.setItem\('lang'/);
  assert.match(html, /document\.documentElement\.lang = lang/);
});

test('UI remains simple with hidden advanced controls and consumer units',()=>{
  const html = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  assert.match(html, /priceLabel:'1\. Price now'/);
  assert.match(html, /costLabel:'2\. If I run dryer now'/);
  assert.match(html, /€\/kWh/);
  assert.match(html, /for 1 kWh/);
  assert.match(html, /Best times to run dryer/);
  assert.match(html, /It would cost about/);
  assert.match(html, /advanced\{display:none/);
});

test('market dropdown is scrollable on mobile',()=>{
  const html = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  assert.match(html, /\.sheet\{[^}]*max-height:calc\(100dvh - 76px - env\(safe-area-inset-bottom\)\)/);
  assert.match(html, /\.sheet\{[^}]*overflow-y:auto/);
  assert.match(html, /-webkit-overflow-scrolling:touch/);
});
