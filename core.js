export const RIGA_TZ = 'Europe/Riga';
export const INTERVAL_MINUTES = 15;
export const DEFAULTS = Object.freeze({ durationHours: 1.5, powerKw: 2.5, addersEurPerKwh: 0.16, vatPct: 21 });
export function eurMwhToEurKwh(priceMwh){ return Number(priceMwh || 0) / 1000; }
export function intervalCost(row, opts = {}){
  const o = { ...DEFAULTS, ...opts };
  const hours = INTERVAL_MINUTES / 60;
  const energy = Number(o.powerKw || 0) * hours;
  const market = eurMwhToEurKwh(row.price) * energy;
  const network = Number(o.addersEurPerKwh || 0) * energy;
  const subtotal = market + network;
  const total = subtotal * (1 + Number(o.vatPct || 0) / 100);
  return { energyKwh: energy, market, adders: network, total };
}
export function runCost(rows, startIndex, opts = {}){
  const o = { ...DEFAULTS, ...opts };
  const needed = Math.ceil(Number(o.durationHours || 0) * 60 / INTERVAL_MINUTES);
  const slice = rows.slice(startIndex, startIndex + needed);
  const sum = slice.reduce((acc, r) => {
    const c = intervalCost(r, o);
    acc.market += c.market; acc.adders += c.adders; acc.total += c.total; acc.energyKwh += c.energyKwh;
    return acc;
  }, { market:0, adders:0, total:0, energyKwh:0 });
  const avgPrice = slice.length ? slice.reduce((a,r)=>a+Number(r.price||0),0)/slice.length : 0;
  return { ...sum, avgPrice, intervals: slice.length, complete: slice.length === needed, start: slice[0]?.timestamp, end: slice.at(-1)?.timestamp ? slice.at(-1).timestamp + INTERVAL_MINUTES * 60 : undefined };
}
export function bestWindows(rows, opts = {}, count = 4, at = Date.now()){
  const now = Math.floor(at/1000);
  let future = rows.filter(r => Number(r.timestamp) + INTERVAL_MINUTES*60 > now).sort((a,b)=>a.timestamp-b.timestamp);
  if(!future.length) future = [...rows].sort((a,b)=>a.timestamp-b.timestamp);
  const needed = Math.ceil(Number((opts.durationHours ?? DEFAULTS.durationHours)) * 60 / INTERVAL_MINUTES);
  const candidates = [];
  for(let i=0; i<=future.length-needed; i++){
    const c = runCost(future, i, opts);
    if(c.complete) candidates.push(c);
  }
  return candidates.sort((a,b)=>a.total-b.total || a.start-b.start).slice(0,count);
}
export function currentRow(rows, at = Date.now()){
  const t = Math.floor(at/1000);
  return [...rows].sort((a,b)=>a.timestamp-b.timestamp).find(r => t >= r.timestamp && t < r.timestamp + INTERVAL_MINUTES*60) || [...rows].sort((a,b)=>Math.abs(a.timestamp-t)-Math.abs(b.timestamp-t))[0] || null;
}
export function summarize(rows, opts = {}){
  const sorted = [...rows].sort((a,b)=>a.timestamp-b.timestamp);
  const cur = currentRow(sorted);
  const currentRun = cur ? runCost(sorted, sorted.findIndex(r=>r.timestamp===cur.timestamp), opts) : null;
  return { current: cur, currentRun, best: bestWindows(sorted, opts, 5), min: sorted.reduce((m,r)=>!m||r.price<m.price?r:m,null), max: sorted.reduce((m,r)=>!m||r.price>m.price?r:m,null), rows: sorted };
}
export function formatTimeRange(start,end,locale='en-GB'){
  const f = new Intl.DateTimeFormat(locale,{timeZone:RIGA_TZ,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  return `${f.format(new Date(start*1000))}–${f.format(new Date(end*1000))}`;
}
export function cents(eur){ return Math.round(Number(eur || 0) * 100); }
