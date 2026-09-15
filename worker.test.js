import test from 'node:test';
import assert from 'node:assert/strict';
import { runCost, bestWindows, currentRow, cents } from './core.js';
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
