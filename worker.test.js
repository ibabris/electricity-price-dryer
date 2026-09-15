import test from 'node:test';
import assert from 'node:assert/strict';
import { runCost, bestWindows, currentRow, cents } from './core.js';
import { readFileSync } from 'node:fs';
const rows = Array.from({length:12},(_,i)=>({timestamp:1000+i*900,price:[200,180,60,50,40,70,100,220,300,90,80,70][i]}));
test('dryer run cost uses 15-minute intervals and VAT/adders',()=>{
  const r=runCost(rows,0,{durationHours:1.5,powerKw:2.5,addersEurPerKwh:0.16,vatPct:21});
  assert.equal(r.intervals,6);
  assert.equal(Number(r.energyKwh.toFixed(2)),3.75);
  assert.equal(cents(r.market),38); // avg 100 €/MWh = 0.10 €\/kWh * 3.75
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

test('UI says what important numbers mean and hides advanced controls',()=>{
  const html = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  assert.match(html, /1\. Price now/);
  assert.match(html, /2\. If I run dryer now/);
  assert.match(html, /€\/kWh/);
  assert.match(html, /price now:<\/b>/);
  assert.match(html, /€ for 1 kWh/);
  assert.match(html, /will cost about <b>/);
  assert.match(html, /Best times to run dryer/);
  assert.match(html, /It would cost about <b>/);
  assert.match(html, /For experienced users/);
  assert.match(html, /3\. Price gauge/);
  assert.match(html, /same time of day from the last 12 months and last 3 months/);
  assert.match(html, /higher than .*same-time prices/);
  assert.match(html, /\.advanced\{display:none/);
});

test('chart has understandable axes, legend, and now marker',()=>{
  const html = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  assert.match(html, /Price picture/);
  assert.match(html, /Left to right = time\. Bottom = cheap\. Top = expensive\. White line = now\./);
  assert.match(html, /Live Latvia price ▾/);
  assert.match(html, /data-area="lt"/);
  assert.match(html, /selectedArea/);
  assert.match(html, /area:selectedArea/);
  assert.match(html, /Price €\/kWh/);
  assert.match(html, /Time \(Riga\)/);
  assert.match(html, /Cheap/);
  assert.match(html, /Expensive/);
  assert.match(html, /chartNow/);
});
