import { DEFAULTS, summarize } from './core.js';

const SOURCE = 'https://dataportal-api.nordpoolgroup.com/api/DayAheadPrices';
const CACHE_SECONDS = 60;
const DATA_CACHE = new Map();
const SLOT_CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;
const HISTORY_CACHE_TTL_MS = 6 * 3600 * 1000;
// Nord Pool works by bidding zone, not always by whole country. Prices are read
// from Nord Pool's DayAheadPrices endpoint; markets not served by that endpoint
// are omitted from the chooser instead of showing fake prices.
const MARKETS = Object.freeze({
  lv: { country:'LV', zone:'LV', nordpoolArea:'LV', live:true, currency:'EUR', timezone:'Europe/Riga', vatPct:21, addersEurPerKwh:0.16, name:{en:'Latvia',lv:'Latvija',lt:'Latvija',ee:'Läti',ru:'Латвия'}, flag:'🇱🇻', lang:'lv' },
  lt: { country:'LT', zone:'LT', nordpoolArea:'LT', live:true, currency:'EUR', timezone:'Europe/Vilnius', vatPct:21, addersEurPerKwh:0.16, name:{en:'Lithuania',lv:'Lietuva',lt:'Lietuva',ee:'Leedu',ru:'Литва'}, flag:'🇱🇹', lang:'lt' },
  ee: { country:'EE', zone:'EE', nordpoolArea:'EE', live:true, currency:'EUR', timezone:'Europe/Tallinn', vatPct:24, addersEurPerKwh:0.16, name:{en:'Estonia',lv:'Igaunija',lt:'Estija',ee:'Eesti',ru:'Эстония'}, flag:'🇪🇪', lang:'ee' },
  fi: { country:'FI', zone:'FI', nordpoolArea:'FI', live:true, currency:'EUR', timezone:'Europe/Helsinki', vatPct:25.5, addersEurPerKwh:0.16, name:{en:'Finland',lv:'Somija',lt:'Suomija',ee:'Soome',ru:'Финляндия'}, flag:'🇫🇮', lang:'en' },
  no1:{ country:'NO', zone:'NO1', live:true, nordpoolArea:'NO1', currency:'EUR', timezone:'Europe/Oslo', vatPct:25, addersEurPerKwh:0.16, name:{en:'Norway NO1 Oslo',lv:'Norvēģija NO1 Oslo',lt:'Norvegija NO1 Oslas',ee:'Norra NO1 Oslo',ru:'Норвегия NO1 Осло'}, flag:'🇳🇴', lang:'en' },
  no2:{ country:'NO', zone:'NO2', live:true, nordpoolArea:'NO2', currency:'EUR', timezone:'Europe/Oslo', vatPct:25, addersEurPerKwh:0.16, name:{en:'Norway NO2 Kristiansand',lv:'Norvēģija NO2 Kristiansand',lt:'Norvegija NO2 Kristiansand',ee:'Norra NO2 Kristiansand',ru:'Норвегия NO2 Кристиансанд'}, flag:'🇳🇴', lang:'en' },
  no3:{ country:'NO', zone:'NO3', live:true, nordpoolArea:'NO3', currency:'EUR', timezone:'Europe/Oslo', vatPct:25, addersEurPerKwh:0.16, name:{en:'Norway NO3 Trondheim',lv:'Norvēģija NO3 Trondheim',lt:'Norvegija NO3 Trondheim',ee:'Norra NO3 Trondheim',ru:'Норвегия NO3 Тронхейм'}, flag:'🇳🇴', lang:'en' },
  no4:{ country:'NO', zone:'NO4', live:true, nordpoolArea:'NO4', currency:'EUR', timezone:'Europe/Oslo', vatPct:25, addersEurPerKwh:0.16, name:{en:'Norway NO4 Tromsø',lv:'Norvēģija NO4 Tromsø',lt:'Norvegija NO4 Tromsø',ee:'Norra NO4 Tromsø',ru:'Норвегия NO4 Тромсё'}, flag:'🇳🇴', lang:'en' },
  no5:{ country:'NO', zone:'NO5', live:true, nordpoolArea:'NO5', currency:'EUR', timezone:'Europe/Oslo', vatPct:25, addersEurPerKwh:0.16, name:{en:'Norway NO5 Bergen',lv:'Norvēģija NO5 Bergen',lt:'Norvegija NO5 Bergen',ee:'Norra NO5 Bergen',ru:'Норвегия NO5 Берген'}, flag:'🇳🇴', lang:'en' },
  se1:{ country:'SE', zone:'SE1', live:true, nordpoolArea:'SE1', currency:'EUR', timezone:'Europe/Stockholm', vatPct:25, addersEurPerKwh:0.16, name:{en:'Sweden SE1 Luleå',lv:'Zviedrija SE1 Luleå',lt:'Švedija SE1 Luleå',ee:'Rootsi SE1 Luleå',ru:'Швеция SE1 Лулео'}, flag:'🇸🇪', lang:'en' },
  se2:{ country:'SE', zone:'SE2', live:true, nordpoolArea:'SE2', currency:'EUR', timezone:'Europe/Stockholm', vatPct:25, addersEurPerKwh:0.16, name:{en:'Sweden SE2 Sundsvall',lv:'Zviedrija SE2 Sundsvall',lt:'Švedija SE2 Sundsvall',ee:'Rootsi SE2 Sundsvall',ru:'Швеция SE2 Сундсвалль'}, flag:'🇸🇪', lang:'en' },
  se3:{ country:'SE', zone:'SE3', live:true, nordpoolArea:'SE3', currency:'EUR', timezone:'Europe/Stockholm', vatPct:25, addersEurPerKwh:0.16, name:{en:'Sweden SE3 Stockholm',lv:'Zviedrija SE3 Stokholma',lt:'Švedija SE3 Stokholmas',ee:'Rootsi SE3 Stockholm',ru:'Швеция SE3 Стокгольм'}, flag:'🇸🇪', lang:'en' },
  se4:{ country:'SE', zone:'SE4', live:true, nordpoolArea:'SE4', currency:'EUR', timezone:'Europe/Stockholm', vatPct:25, addersEurPerKwh:0.16, name:{en:'Sweden SE4 Malmö',lv:'Zviedrija SE4 Malmö',lt:'Švedija SE4 Malmö',ee:'Rootsi SE4 Malmö',ru:'Швеция SE4 Мальмё'}, flag:'🇸🇪', lang:'en' },
  dk1:{ country:'DK', zone:'DK1', live:true, nordpoolArea:'DK1', currency:'EUR', timezone:'Europe/Copenhagen', vatPct:25, addersEurPerKwh:0.16, name:{en:'Denmark DK1 West',lv:'Dānija DK1 Rietumi',lt:'Danija DK1 Vakarai',ee:'Taani DK1 lääs',ru:'Дания DK1 запад'}, flag:'🇩🇰', lang:'en' },
  dk2:{ country:'DK', zone:'DK2', live:true, nordpoolArea:'DK2', currency:'EUR', timezone:'Europe/Copenhagen', vatPct:25, addersEurPerKwh:0.16, name:{en:'Denmark DK2 East',lv:'Dānija DK2 Austrumi',lt:'Danija DK2 Rytai',ee:'Taani DK2 ida',ru:'Дания DK2 восток'}, flag:'🇩🇰', lang:'en' },
  de_lu:{ country:'DE/LU', zone:'DE-LU', live:false, currency:'EUR', timezone:'Europe/Berlin', vatPct:19, addersEurPerKwh:0, name:{en:'Germany / Luxembourg',lv:'Vācija / Luksemburga',lt:'Vokietija / Liuksemburgas',ee:'Saksamaa / Luksemburg',ru:'Германия / Люксембург'}, flag:'🇩🇪', lang:'en' },
  nl: { country:'NL', zone:'NL', live:true, nordpoolArea:'NL', currency:'EUR', timezone:'Europe/Amsterdam', vatPct:21, addersEurPerKwh:0.16, name:{en:'Netherlands',lv:'Nīderlande',lt:'Nyderlandai',ee:'Holland',ru:'Нидерланды'}, flag:'🇳🇱', lang:'en' },
  be: { country:'BE', zone:'BE', live:true, nordpoolArea:'BE', currency:'EUR', timezone:'Europe/Brussels', vatPct:21, addersEurPerKwh:0.16, name:{en:'Belgium',lv:'Beļģija',lt:'Belgija',ee:'Belgia',ru:'Бельгия'}, flag:'🇧🇪', lang:'en' },
  at: { country:'AT', zone:'AT', live:true, nordpoolArea:'AT', currency:'EUR', timezone:'Europe/Vienna', vatPct:20, addersEurPerKwh:0.16, name:{en:'Austria',lv:'Austrija',lt:'Austrija',ee:'Austria',ru:'Австрия'}, flag:'🇦🇹', lang:'en' },
  fr: { country:'FR', zone:'FR', live:true, nordpoolArea:'FR', currency:'EUR', timezone:'Europe/Paris', vatPct:20, addersEurPerKwh:0.16, name:{en:'France',lv:'Francija',lt:'Prancūzija',ee:'Prantsusmaa',ru:'Франция'}, flag:'🇫🇷', lang:'en' },
  pl: { country:'PL', zone:'PL', live:true, nordpoolArea:'PL', currency:'EUR', timezone:'Europe/Warsaw', vatPct:23, addersEurPerKwh:0.16, name:{en:'Poland',lv:'Polija',lt:'Lenkija',ee:'Poola',ru:'Польша'}, flag:'🇵🇱', lang:'en' },
  gb: { country:'GB', zone:'GB', live:false, currency:'GBP', timezone:'Europe/London', vatPct:20, addersEurPerKwh:0, name:{en:'Great Britain',lv:'Lielbritānija',lt:'Didžioji Britanija',ee:'Suurbritannia',ru:'Великобритания'}, flag:'🇬🇧', lang:'en' },
  ie: { country:'IE', zone:'IE/SEM', live:false, currency:'EUR', timezone:'Europe/Dublin', vatPct:23, addersEurPerKwh:0, name:{en:'Ireland',lv:'Īrija',lt:'Airija',ee:'Iirimaa',ru:'Ирландия'}, flag:'🇮🇪', lang:'en' }
});
const ACTIVE_MARKETS = Object.freeze(Object.fromEntries(Object.entries(MARKETS).filter(([,m]) => m.live && m.nordpoolArea)));
function normalizeArea(area){ const key = String(area || 'lv').toLowerCase().replace('-', '_'); return ACTIVE_MARKETS[key] ? key : 'lv'; }
function marketDefaults(area){ const m = MARKETS[normalizeArea(area)]; return { vatPct:m.vatPct ?? DEFAULTS.vatPct, addersEurPerKwh:m.addersEurPerKwh ?? DEFAULTS.addersEurPerKwh }; }

function isoDate(d){ return d.toISOString().slice(0,10); }
function nordPoolUrl(area, date){
  const market = MARKETS[normalizeArea(area)];
  const params = new URLSearchParams({ market:'DayAhead', currency:'EUR', deliveryArea:market.nordpoolArea, date:isoDate(date) });
  return `${SOURCE}?${params.toString()}`;
}
async function fetchNordPoolDay(area, date, ttlMs = CACHE_TTL_MS){
  const market = MARKETS[normalizeArea(area)];
  if(!market.live || !market.nordpoolArea) throw new Error('market_not_live_yet');
  const url = nordPoolUrl(area, date);
  const now = Date.now();
  const cached = DATA_CACHE.get(url);
  if(cached && now - cached.at < ttlMs) return cached.rows;
  const res = await fetch(url, { headers: { 'user-agent':'Elektoprice.lv electricity helper', accept:'application/json' }, cf: { cacheTtl: Math.round(ttlMs / 1000), cacheEverything: true } });
  if(res.status === 204){ DATA_CACHE.set(url, { at: now, rows: [] }); return []; }
  if(!res.ok) throw new Error(`price_source_${res.status}`);
  const json = await res.json();
  const entries = Array.isArray(json?.multiAreaEntries) ? json.multiAreaEntries : [];
  const rows = entries.map(x => ({ timestamp: Math.floor(Date.parse(x.deliveryStart) / 1000), price: Number(x.entryPerArea?.[market.nordpoolArea]) })).filter(x => Number.isFinite(x.timestamp) && Number.isFinite(x.price));
  DATA_CACHE.set(url, { at: now, rows });
  return rows;
}
async function fetchPrices(area){
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const tomorrow = new Date(today.getTime() + 86400000);
  const parts = await Promise.all([yesterday, today, tomorrow].map(d => fetchNordPoolDay(area, d).catch(() => [])));
  const byTs = new Map(parts.flat().map(r => [r.timestamp, r]));
  const rows = [...byTs.values()].sort((a,b)=>a.timestamp-b.timestamp);
  if(!rows.length) throw new Error('price_source_empty');
  return rows;
}
async function fetchHistory(days, area = 'lv'){
  // Public Nord Pool endpoint is used for live/current day-ahead prices. Long-term
  // history is intentionally not fetched with hundreds of per-day calls; the UI
  // still gets current price, run cost and best windows immediately.
  return [];
}
function makeSlotKey(timezone = 'Europe/Riga'){
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  return ts => {
    const cacheKey = timezone + ':' + ts;
    if(SLOT_CACHE.has(cacheKey)) return SLOT_CACHE.get(cacheKey);
    const parts = Object.fromEntries(fmt.formatToParts(new Date(ts * 1000)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    const key = Number(parts.hour) * 60 + Math.floor(Number(parts.minute) / 15) * 15;
    if(SLOT_CACHE.size > 200000) SLOT_CACHE.clear();
    SLOT_CACHE.set(cacheKey, key);
    return key;
  };
}
function slotKey(ts, timezone = 'Europe/Riga'){
  return makeSlotKey(timezone)(ts);
}
function avg(rows){ return rows.length ? rows.reduce((a,r)=>a+Number(r.price || 0),0) / rows.length : 0; }
function percentile(value, rows){
  if(!rows.length) return 50;
  return Math.round((rows.filter(r => Number(r.price || 0) <= value).length / rows.length) * 100);
}
function gaugeLabel(p){ return p < 10 ? 'veryLow' : p < 30 ? 'low' : p < 70 ? 'normal' : p < 90 ? 'high' : 'veryHigh'; }
function buildBenchmark(current, hist90, hist365, timezone = 'Europe/Riga'){
  if(!current) return null;
  const slot = makeSlotKey(timezone);
  const key = slot(current.timestamp);
  const same3m = [];
  const same12m = [];
  for(const r of hist90) if(slot(r.timestamp) === key) same3m.push(r);
  for(const r of hist365) if(slot(r.timestamp) === key) same12m.push(r);
  const pct12 = percentile(current.price, same12m);
  return { slotMinutes:key, currentKwh: current.price / 1000, avg3mKwh: avg(same3m) / 1000, avg12mKwh: avg(same12m) / 1000, percentile12m:pct12, label:gaugeLabel(pct12), sample3m:same3m.length, sample12m:same12m.length };
}
function apiPayload(rows, url, hist90 = [], hist365 = []){
  const q = url.searchParams;
  const area = normalizeArea(q.get('area'));
  const defaults = marketDefaults(area);
  const opts = {
    durationHours: Number(q.get('duration') || DEFAULTS.durationHours),
    powerKw: Number(q.get('kw') || DEFAULTS.powerKw),
    addersEurPerKwh: Number(q.get('adders') || defaults.addersEurPerKwh),
    vatPct: Number(q.get('vat') || defaults.vatPct)
  };
  const s = summarize(rows, opts);
  return { ok:true, source:'Nord Pool day-ahead electricity prices', sourceUrl:SOURCE, updatedAt:new Date().toISOString(), timezone:MARKETS[area].timezone, intervalMinutes:15, area, market: MARKETS[area], markets: ACTIVE_MARKETS, opts, benchmarks: buildBenchmark(s.current, hist90.length ? hist90 : rows, hist365.length ? hist365 : rows, MARKETS[area].timezone), ...s };
}
function json(data,status=200){ return new Response(JSON.stringify(data), { status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' } }); }
function page(){ return new Response(HTML, { headers:{ 'content-type':'text/html; charset=utf-8', 'cache-control':'public, max-age=120' } }); }
export default { async fetch(request){
  const url = new URL(request.url);
  if(url.pathname === '/api/prices'){
    try { const area = normalizeArea(url.searchParams.get('area')); const quick = url.searchParams.get('quick') === '1'; const rows = await fetchPrices(area); const [hist90, hist365] = quick ? [[], []] : await Promise.all([fetchHistory(90, area), fetchHistory(365, area)]); return json(apiPayload(rows, url, hist90, hist365)); }
    catch(err){ const area = normalizeArea(url.searchParams.get('area')); const status = String(err.message||err) === 'market_not_live_yet' ? 501 : 502; return json({ ok:false, error:String(err.message||err), sourceUrl:SOURCE, area, market:MARKETS[area], markets:MARKETS }, status); }
  }
  return page();
}};

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Elektoprice.lv — electricity price helper</title>
<style>
:root{--bg:#f3f7fb;--ink:#102033;--muted:#637287;--line:#dce6f1;--green:#0e9f6e;--shadow:0 20px 60px rgba(16,32,51,.14)}*{box-sizing:border-box}html{background:#eaf3fb}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,"Segoe UI",sans-serif;background:linear-gradient(180deg,#f8fbff 0,#edf6ff 50%,#f6f8fb 100%);color:var(--ink);min-height:100vh}main{width:min(720px,100%);margin:0 auto;padding:env(safe-area-inset-top) 14px 28px}.appTop{position:sticky;top:0;z-index:5;margin:0 -14px 10px;padding:10px 14px 8px;background:rgba(248,251,255,.9);backdrop-filter:blur(18px);border-bottom:1px solid rgba(220,230,241,.7)}.topLine{display:flex;align-items:center;justify-content:space-between;gap:8px}.brand{display:flex;align-items:center;gap:9px;font-weight:950;font-size:22px;letter-spacing:-.04em}.bolt{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#0b65d8,#27c0ff);color:#fff;box-shadow:0 8px 22px rgba(11,101,216,.25)}.pill{appearance:none;font-family:inherit;font-size:12px;font-weight:900;color:var(--green);background:#e8fff3;border:1px solid #baf2d1;border-radius:999px;padding:8px 10px;cursor:pointer;white-space:nowrap}.subtitle{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.25}.sheet{position:absolute;right:14px;top:58px;background:#fff;border:1px solid #dce6f1;border-radius:18px;box-shadow:0 18px 44px rgba(16,32,51,.18);padding:6px;display:grid;gap:4px;z-index:10;min-width:190px;max-width:min(360px,calc(100vw - 28px));max-height:calc(100dvh - 76px - env(safe-area-inset-bottom));overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin}.sheet[hidden]{display:none}.sheet button{appearance:none;border:0;background:#fff;color:#102033;text-align:left;border-radius:13px;padding:11px 12px;font-weight:950;font-size:16px}.sheet button.active,.sheet button:hover{background:#eaf4ff;color:#0b65d8}.langWrap{display:flex;gap:6px;margin-top:8px;overflow:auto;padding-bottom:2px}.langBtn{appearance:none;border:1px solid #dce6f1;border-radius:999px;background:#fff;color:#405671;padding:6px 10px;font-weight:950}.langBtn.active{background:#102033;color:#fff}.card{background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:28px;box-shadow:var(--shadow);padding:16px;margin:12px 0}.heroCard{background:linear-gradient(180deg,#ffffff 0,#eef8ff 100%)}.label{font-size:13px;font-weight:950;color:#4b6078;text-transform:uppercase;letter-spacing:.06em}.answer{font-weight:950;letter-spacing:-.04em}.priceNow{display:flex;align-items:end;gap:6px;margin-top:5px;min-width:0;flex-wrap:wrap}.priceNumber{font-size:clamp(62px,20vw,126px);line-height:.82;color:#06162b}.priceUnit{font-size:clamp(20px,5.5vw,25px);font-weight:950;margin-bottom:8px;color:#27445f}.plain{font-size:19px;line-height:1.28;margin:12px 0 0;color:#294259}.plain b{color:#07182e}.mood{display:inline-flex;margin-top:12px;border-radius:999px;padding:8px 12px;font-weight:900;font-size:14px}.mood.good{color:#05603a;background:#d9ffe9}.mood.ok{color:#794b05;background:#fff4cc}.mood.bad{color:#991b1b;background:#ffe2e2}.costCard{background:linear-gradient(160deg,#063b73 0,#0b65d8 62%,#13a0dd 100%);color:#fff;border:0}.costCard .label{color:#dbeafe}.costLine{font-size:clamp(34px,10vw,68px);line-height:.95;margin:8px 0 4px}.costText{font-size:20px;line-height:1.25;margin:10px 0 0;color:#eef6ff}.gaugeTitle{display:flex;justify-content:space-between;align-items:end;gap:10px;margin:8px 0 10px}.gaugeTitle span:first-child{font-size:34px;font-weight:950;letter-spacing:-.04em}.gaugeTitle span:last-child{font-size:15px;font-weight:950;color:#52657b}.gaugeRail{position:relative;height:24px;border-radius:999px;background:linear-gradient(90deg,#14b86a 0,#a3e635 25%,#facc15 52%,#fb923c 75%,#ef4444 100%);box-shadow:inset 0 0 0 1px rgba(16,32,51,.12)}.gaugeNeedle{position:absolute;top:-5px;width:6px;height:34px;border-radius:999px;background:#102033;box-shadow:0 3px 10px rgba(16,32,51,.35);left:50%;transform:translateX(-50%)}.gaugeScale{display:flex;justify-content:space-between;color:#52657b;font-weight:900;font-size:12px;margin-top:7px}.bestTitle{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}.bestTitle h2{margin:0;font-size:24px;letter-spacing:-.03em}.window{display:grid;grid-template-columns:auto 1fr;gap:11px;padding:13px 0;border-top:1px solid #e7eef6}.window:first-child{border-top:0}.rank{width:40px;height:40px;border-radius:15px;background:#e8fff3;color:#0e9f6e;display:grid;place-items:center;font-weight:950}.when{font-size:22px;font-weight:950;letter-spacing:-.03em}.meaning{font-size:16px;margin-top:3px;color:#334e68;line-height:1.28}.priceChip{display:inline-flex;margin-top:8px;border-radius:12px;background:#effaf3;color:#067647;padding:7px 10px;font-size:15px;font-weight:900}.advancedToggle{width:100%;border:0;border-radius:18px;padding:14px 16px;margin:4px 0 0;text-align:left;background:#16243a;color:#fff;font-size:16px;font-weight:900;display:flex;justify-content:space-between;align-items:center}.advanced{display:none;margin-top:10px}.advanced.open{display:block}.controls{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{border:1px solid var(--line);background:#fff;border-radius:18px;padding:11px}.field label{display:block;font-size:12px;color:#65758a;font-weight:900;margin-bottom:5px}.field input{width:100%;border:0;outline:0;font-size:24px;font-weight:950;color:var(--ink);background:transparent}.miniGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}.mini{border:1px solid var(--line);border-radius:18px;background:#fff;padding:10px}.mini b{display:block;font-size:19px}.mini span{display:block;font-size:12px;color:var(--muted);font-weight:800;margin-top:3px}.chartCard h2{margin:0;font-size:22px;letter-spacing:-.03em}.chartCard p{margin:4px 0 0;color:#52657b;font-size:14px}.chartHead{display:flex;justify-content:space-between;gap:10px;align-items:start}.chartNow{background:#102033;color:#fff;border-radius:999px;padding:8px 10px;font-weight:950;font-size:13px;white-space:nowrap}.legend{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.legend span{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:900;color:#405671;background:#f4f8fc;border:1px solid #e0e8f1;border-radius:999px;padding:7px 9px}.leg{width:12px;height:12px;border-radius:4px;display:inline-block}.cheap{background:#2dd47a}.middle{background:#54b6ff}.high{background:#ff6868}.chartWrap{display:grid;grid-template-columns:54px 1fr;gap:8px;align-items:stretch}.yAxis{display:flex;flex-direction:column;justify-content:space-between;align-items:end;text-align:right;color:#52657b;font-size:11px;font-weight:900;padding:2px 0 24px}.yAxis span:nth-child(2){writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;color:#102033}.chartArea{min-width:0}.chart{height:165px;display:flex;align-items:end;gap:1px;border-radius:20px;background:linear-gradient(180deg,#fff1f1 0,#eef7ff 48%,#eafff4 100%);padding:10px;overflow:hidden;border:1px solid #d8e4ef}.bar{flex:1;min-width:0;border-radius:6px 6px 0 0;background:#54b6ff}.bar.good{background:#2dd47a}.bar.bad{background:#ff6868}.bar.now{box-shadow:0 0 0 2px #102033,0 0 0 5px rgba(255,255,255,.95)}.xAxis{display:flex;justify-content:space-between;gap:8px;color:#52657b;font-size:11px;font-weight:900;padding:6px 4px 0}.xAxis span:nth-child(2){color:#102033}.note{color:var(--muted);font-size:13px;line-height:1.35}.source{font-size:12px;color:#64748b;text-align:center;margin:16px 4px}.source a{color:#0b65d8}#statusLine{font-size:13px;color:#64748b;margin-top:8px}@media(min-width:760px){main{padding-top:18px}.desktopGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:stretch}.desktopGrid .card{margin:0}.bestAndAdvanced{display:grid;grid-template-columns:1.05fr .95fr;gap:14px;align-items:start}.priceNumber{font-size:118px}.costLine{font-size:64px}}@media(max-width:420px){main{padding-left:10px;padding-right:10px}.appTop{margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px}.card{border-radius:24px;padding:14px}.controls{grid-template-columns:1fr 1fr;gap:8px}.miniGrid{grid-template-columns:1fr}.when{font-size:20px}.costText,.plain{font-size:18px}.field input{font-size:22px}.brand{font-size:20px}}
</style>
</head>
<body>
<main>
  <header class="appTop">
    <div class="topLine"><div class="brand"><div class="bolt">⚡</div><div data-i18n="brand">Dry clothes cheaper</div></div><button id="marketBtn" class="pill" type="button">🇱🇻 Latvia ▾</button></div>
    <div id="marketSheet" class="sheet" hidden></div>
    <div class="langWrap" id="langWrap"></div>
    <p id="subtitle" class="subtitle"></p>
  </header>

  <section class="desktopGrid">
    <article class="card heroCard">
      <div id="priceLabel" class="label"></div>
      <div class="priceNow"><div id="price" class="answer priceNumber">—</div><div class="priceUnit">€/kWh</div></div>
      <p id="pricePlain" class="plain"></p>
      <div id="badge" class="mood ok"></div>
    </article>

    <article class="card costCard">
      <div id="costLabel" class="label"></div>
      <div id="costNow" class="answer costLine">— €</div>
      <p id="costPlain" class="costText"></p>
    </article>
  </section>

  <section class="card gaugeCard">
    <div id="gaugeLabelTop" class="label"></div>
    <div class="gaugeTitle"><span id="gaugeLabel">—</span><span id="gaugePct">—</span></div>
    <div class="gaugeRail"><div id="gaugeNeedle" class="gaugeNeedle"></div></div>
    <div class="gaugeScale"><span id="scaleLow"></span><span id="scaleNormal"></span><span id="scaleHigh"></span></div>
    <p id="gaugePlain" class="plain"></p>
  </section>

  <section class="bestAndAdvanced">
    <article class="card">
      <div class="bestTitle"><h2 id="bestTitle"></h2><span id="cheapestTag" class="pill"></span></div>
      <div id="windows"><div class="note">Loading…</div></div>
    </article>

    <article>
      <button id="advancedBtn" class="advancedToggle" type="button"><span id="advancedTitle"></span><span id="advancedState"></span></button>
      <div id="advanced" class="advanced card">
        <div class="controls">
          <div class="field"><label id="kwLabel"></label><input id="kw" type="number" min="0.1" step="0.1" value="2.5"><div id="kwNote" class="note"></div></div>
          <div class="field"><label id="durationLabel"></label><input id="duration" type="number" min="0.25" step="0.25" value="1.5"><div id="durationNote" class="note"></div></div>
          <div class="field"><label id="addersLabel"></label><input id="adders" type="number" min="0" step="0.01" value="0.16"><div id="addersNote" class="note"></div></div>
          <div class="field"><label id="vatLabel"></label><input id="vat" type="number" min="0" step="1" value="21"><div id="vatNote" class="note"></div></div>
        </div>
        <div class="miniGrid">
          <div class="mini"><b id="minp">— €/kWh</b><span id="minpText"></span></div>
          <div class="mini"><b id="avgp">— €/kWh</b><span id="avgpText"></span></div>
          <div class="mini"><b id="maxp">— €/kWh</b><span id="maxpText"></span></div>
        </div>
        <p id="costBreakdown" class="note"></p>
        <div id="statusLine"></div>
      </div>
    </article>
  </section>

  <section class="card chartCard">
    <div class="chartHead"><div><h2 id="chartTitle"></h2><p id="chartExplain"></p></div><div class="chartNow" id="chartNow">Now</div></div>
    <div class="legend"><span><i class="leg cheap"></i><b id="legendCheap"></b></span><span><i class="leg middle"></i><b id="legendMiddle"></b></span><span><i class="leg high"></i><b id="legendHigh"></b></span></div>
    <div class="chartWrap">
      <div class="yAxis"><span id="yHigh">High</span><span>Price €/kWh</span><span id="yLow">Low</span></div>
      <div class="chartArea"><div id="chart" class="chart" aria-label="Today electricity price chart"></div><div class="xAxis"><span id="xStart">00:00</span><span id="xLabel"></span><span id="xEnd">24:00</span></div></div>
    </div>
  </section>

  <p id="sourceLine" class="source"></p>
</main>
<script>
const MARKETS = ${JSON.stringify(ACTIVE_MARKETS)};
const LANGS = {lv:'LV',ee:'EE',lt:'LT',ru:'RU',en:'EN'};
const I18N = {
 en:{brand:'Elektoprice.lv',subtitle:'Simple answer first. Advanced details are hidden unless you want them.',priceLabel:'1. Price now',costLabel:'2. If I run dryer now',priceNow:m=>m+' price now:',for1:'€ for 1 kWh.',good:'Good time — electricity is cheap',ok:'Middle price — okay if you need it',bad:'Bad time — expensive, wait if you can',cost:p=>'Running a <b>'+p.kw+' kW</b> dryer for <b>'+p.hours+'</b> now will cost about <b>'+p.cost+' €</b>.',gauge:'3. Price gauge',higher:p=>'higher than '+p+'% of same-time prices',sameAvg:(a,b)=>'Same time average: <b>'+a+' €/kWh</b> last 3 months, <b>'+b+' €/kWh</b> last 12 months.',veryLow:'Very low',low:'Low',normal:'Normal',high:'High',veryHigh:'Very high',best:'Best times to run dryer',cheapest:'Cheapest first',runThen:p=>'Run dryer for '+p.hours+' then. It would cost about <b>'+p.cost+' €</b>.',priceThen:p=>'Price then: '+p+' €/kWh',advanced:'For experienced users',show:'Show',hide:'Hide',kw:'Dryer power',hours:'Running time',adders:'Extra fees',vat:'VAT',kwNote:'kW, example: 2.5',hoursNote:'hours, example: 1.5',addersNote:'€/kWh for network + seller',vatNote:'%, example: 21',min:'cheapest price for 1 kWh',avg:'average price for 1 kWh during dryer run now',max:'most expensive price for 1 kWh',breakdown:p=>p.hours+' at '+p.kw+' kW uses about '+p.energy+' kWh. Current-run split: market electricity '+p.market+' €, extra fees '+p.adders+' €, VAT included in total.',chartTitle:'Price picture',chartExplain:'Left to right = time. Bottom = cheap. Top = expensive. White line = now.',now:'Now',cheap:'Cheap',middle:'Middle',expensive:'Expensive',time:'Time (Riga)',updated:p=>'Updated '+p+' Riga time. Refreshes automatically.',source:'Data source: Nord Pool day-ahead market. Shows market electricity price converted to €/kWh. Your final bill also depends on your seller, network tariff and VAT.',notLive:'Live price for this market is not connected yet',notLiveDetail:m=>'Correct setup is saved for '+m+', but the current live source only provides Latvia, Lithuania, Estonia and Finland.',couldNot:'Could not load live price',refresh:'Please refresh in a moment.'},
 lv:{brand:'Elektoprice.lv',subtitle:'Vienkāršā atbilde sākumā. Papildu iestatījumi ir paslēpti.',priceLabel:'1. Cena tagad',costLabel:'2. Ja ieslēdzu žāvētāju tagad',priceNow:m=>m+' cena tagad:',for1:'€ par 1 kWh.',good:'Labs brīdis — elektrība ir lēta',ok:'Vidēja cena — var lietot, ja vajag',bad:'Slikts brīdis — dārgi, labāk pagaidi',cost:p=>'Darbinot <b>'+p.kw+' kW</b> žāvētāju <b>'+p.hours+'</b>, tas tagad maksās ap <b>'+p.cost+' €</b>.',gauge:'3. Cenas mērs',higher:p=>'augstāka nekā '+p+'% līdzīgā laikā',sameAvg:(a,b)=>'Tajā pašā laikā vidēji: <b>'+a+' €/kWh</b> pēdējos 3 mēn., <b>'+b+' €/kWh</b> pēdējos 12 mēn.',veryLow:'Ļoti zema',low:'Zema',normal:'Normāla',high:'Augsta',veryHigh:'Ļoti augsta',best:'Labākie laiki žāvētājam',cheapest:'Lētākie sākumā',runThen:p=>'Darbini žāvētāju '+p.hours+'. Tas maksās ap <b>'+p.cost+' €</b>.',priceThen:p=>'Cena tad: '+p+' €/kWh',advanced:'Pieredzējušiem',show:'Rādīt',hide:'Slēpt',kw:'Žāvētāja jauda',hours:'Darba laiks',adders:'Papildu maksa',vat:'PVN',kwNote:'kW, piemēram: 2.5',hoursNote:'stundas, piemēram: 1.5',addersNote:'€/kWh tīkls + tirgotājs',vatNote:'%, piemēram: 21',min:'lētākā cena par 1 kWh',avg:'vidējā cena žāvēšanas laikā tagad',max:'dārgākā cena par 1 kWh',breakdown:p=>p.hours+' ar '+p.kw+' kW patērē ap '+p.energy+' kWh. Sadalījums: biržas elektrība '+p.market+' €, papildu maksa '+p.adders+' €, PVN iekļauts.',chartTitle:'Cenas attēls',chartExplain:'No kreisās uz labo = laiks. Apakšā = lēti. Augšā = dārgi. Baltā līnija = tagad.',now:'Tagad',cheap:'Lēti',middle:'Vidēji',expensive:'Dārgi',time:'Laiks (Rīga)',updated:p=>'Atjaunots '+p+' pēc Rīgas laika. Atjaunojas automātiski.',source:'Datu avots: Nord Pool nākamās dienas tirgus. Cena rādīta €/kWh. Gala rēķinu ietekmē tirgotājs, tīkls un PVN.',notLive:'Šim tirgum tiešraides cena vēl nav pieslēgta',notLiveDetail:m=>'Pareizais iestatījums ir saglabāts '+m+', bet pašreizējais avots dod tiešraidi tikai Latvijai, Lietuvai, Igaunijai un Somijai.',couldNot:'Neizdevās ielādēt cenu',refresh:'Pārlādē pēc brīža.'},
 lt:{brand:'Elektoprice.lv',subtitle:'Paprastas atsakymas pirmiausia. Papildomi nustatymai paslėpti.',priceLabel:'1. Kaina dabar',costLabel:'2. Jei džiovyklę įjungsiu dabar',priceNow:m=>m+' kaina dabar:',for1:'€ už 1 kWh.',good:'Geras laikas — elektra pigi',ok:'Vidutinė kaina — galima naudoti',bad:'Blogas laikas — brangu, verta palaukti',cost:p=>'Naudojant <b>'+p.kw+' kW</b> džiovyklę <b>'+p.hours+'</b>, dabar kainuos apie <b>'+p.cost+' €</b>.',gauge:'3. Kainos matuoklis',higher:p=>'aukščiau nei '+p+'% to paties laiko kainų',sameAvg:(a,b)=>'Tuo pačiu metu vidutiniškai: <b>'+a+' €/kWh</b> per 3 mėn., <b>'+b+' €/kWh</b> per 12 mėn.',veryLow:'Labai maža',low:'Maža',normal:'Normali',high:'Didelė',veryHigh:'Labai didelė',best:'Geriausias laikas džiovyklei',cheapest:'Pigiausia pirmiau',runThen:p=>'Tada paleiskite džiovyklę '+p.hours+'. Kainuos apie <b>'+p.cost+' €</b>.',priceThen:p=>'Kaina tada: '+p+' €/kWh',advanced:'Patyrusiems naudotojams',show:'Rodyti',hide:'Slėpti',kw:'Džiovyklės galia',hours:'Veikimo laikas',adders:'Papildomi mokesčiai',vat:'PVM',kwNote:'kW, pvz.: 2.5',hoursNote:'valandos, pvz.: 1.5',addersNote:'€/kWh tinklas + tiekėjas',vatNote:'%, pvz.: 21',min:'pigiausia 1 kWh kaina',avg:'vidutinė 1 kWh kaina dabar',max:'brangiausia 1 kWh kaina',breakdown:p=>p.hours+' su '+p.kw+' kW sunaudoja apie '+p.energy+' kWh. Dalis: biržos elektra '+p.market+' €, papildomi mokesčiai '+p.adders+' €, PVM įskaičiuotas.',chartTitle:'Kainos vaizdas',chartExplain:'Iš kairės į dešinę = laikas. Apačia = pigu. Viršus = brangu. Balta linija = dabar.',now:'Dabar',cheap:'Pigu',middle:'Vidutiniškai',expensive:'Brangu',time:'Laikas (Ryga)',updated:p=>'Atnaujinta '+p+' Rygos laiku. Atsinaujina automatiškai.',source:'Duomenų šaltinis: Nord Pool kitos dienos rinka. Kaina rodoma €/kWh. Galutinę sąskaitą lemia tiekėjas, tinklas ir PVM.',notLive:'Šios rinkos tiesioginė kaina dar neprijungta',notLiveDetail:m=>'Teisinga sąranka išsaugota '+m+', bet dabartinis šaltinis gyvai teikia tik Latviją, Lietuvą, Estiją ir Suomiją.',couldNot:'Nepavyko įkelti kainos',refresh:'Bandykite atnaujinti.'},
 ee:{brand:'Elektoprice.lv',subtitle:'Lihtne vastus ees. Täpsemad seaded on peidetud.',priceLabel:'1. Hind praegu',costLabel:'2. Kui panen kuivati nüüd tööle',priceNow:m=>m+' hind praegu:',for1:'€ 1 kWh eest.',good:'Hea aeg — elekter on odav',ok:'Keskmine hind — sobib, kui vaja',bad:'Halb aeg — kallis, oota kui saad',cost:p=>'<b>'+p.kw+' kW</b> kuivati <b>'+p.hours+'</b> töötamine maksab praegu umbes <b>'+p.cost+' €</b>.',gauge:'3. Hinnanäidik',higher:p=>'kõrgem kui '+p+'% sama aja hindadest',sameAvg:(a,b)=>'Samal ajal keskmiselt: <b>'+a+' €/kWh</b> viimased 3 kuud, <b>'+b+' €/kWh</b> viimased 12 kuud.',veryLow:'Väga madal',low:'Madal',normal:'Normaalne',high:'Kõrge',veryHigh:'Väga kõrge',best:'Parim aeg kuivati jaoks',cheapest:'Odavaim ees',runThen:p=>'Pane kuivati siis tööle '+p.hours+'. See maksab umbes <b>'+p.cost+' €</b>.',priceThen:p=>'Hind siis: '+p+' €/kWh',advanced:'Kogenud kasutajale',show:'Näita',hide:'Peida',kw:'Kuivati võimsus',hours:'Tööaeg',adders:'Lisatasud',vat:'KM',kwNote:'kW, näiteks: 2.5',hoursNote:'tundi, näiteks: 1.5',addersNote:'€/kWh võrk + müüja',vatNote:'%, näiteks: 21',min:'odavaim 1 kWh hind',avg:'keskmine 1 kWh hind kuivati ajal',max:'kalleim 1 kWh hind',breakdown:p=>p.hours+' '+p.kw+' kW juures kasutab umbes '+p.energy+' kWh. Jaotus: börsielekter '+p.market+' €, lisatasud '+p.adders+' €, KM hinna sees.',chartTitle:'Hinna pilt',chartExplain:'Vasakult paremale = aeg. All = odav. Üleval = kallis. Valge joon = praegu.',now:'Praegu',cheap:'Odav',middle:'Keskmine',expensive:'Kallis',time:'Aeg (Riia)',updated:p=>'Uuendatud '+p+' Riia aja järgi. Uueneb automaatselt.',source:'Allikas: Nord Pool järgmise päeva turg. Hind kuvatakse €/kWh. Lõpparvet mõjutavad müüja, võrk ja KM.',notLive:'Selle turu otsehind pole veel ühendatud',notLiveDetail:m=>'Õige seadistus on salvestatud '+m+', kuid praegune allikas annab otse ainult Läti, Leedu, Eesti ja Soome.',couldNot:'Hinda ei saanud laadida',refresh:'Värskenda hetke pärast.'},
 ru:{brand:'Elektoprice.lv',subtitle:'Сначала простой ответ. Расширенные настройки скрыты.',priceLabel:'1. Цена сейчас',costLabel:'2. Если включить сушилку сейчас',priceNow:m=>m+' цена сейчас:',for1:'€ за 1 кВт⋅ч.',good:'Хорошее время — электричество дешёвое',ok:'Средняя цена — можно пользоваться',bad:'Плохое время — дорого, лучше подождать',cost:p=>'Сушилка <b>'+p.kw+' кВт</b> за <b>'+p.hours+'</b> сейчас будет стоить около <b>'+p.cost+' €</b>.',gauge:'3. Индикатор цены',higher:p=>'выше чем '+p+'% цен в это же время',sameAvg:(a,b)=>'В это же время в среднем: <b>'+a+' €/kWh</b> за 3 мес., <b>'+b+' €/kWh</b> за 12 мес.',veryLow:'Очень низкая',low:'Низкая',normal:'Нормальная',high:'Высокая',veryHigh:'Очень высокая',best:'Лучшее время для сушилки',cheapest:'Сначала дешёвые',runThen:p=>'Запустите сушилку на '+p.hours+' тогда. Это будет стоить около <b>'+p.cost+' €</b>.',priceThen:p=>'Цена тогда: '+p+' €/kWh',advanced:'Для опытных',show:'Показать',hide:'Скрыть',kw:'Мощность сушилки',hours:'Время работы',adders:'Доп. расходы',vat:'НДС',kwNote:'кВт, например: 2.5',hoursNote:'часы, например: 1.5',addersNote:'€/kWh сеть + продавец',vatNote:'%, например: 21',min:'самая низкая цена за 1 kWh',avg:'средняя цена за 1 kWh сейчас',max:'самая высокая цена за 1 kWh',breakdown:p=>p.hours+' при '+p.kw+' кВт использует около '+p.energy+' kWh. Разделение: биржевая энергия '+p.market+' €, доп. расходы '+p.adders+' €, НДС включён.',chartTitle:'Картина цены',chartExplain:'Слева направо = время. Внизу = дёшево. Вверху = дорого. Белая линия = сейчас.',now:'Сейчас',cheap:'Дёшево',middle:'Средне',expensive:'Дорого',time:'Время (Рига)',updated:p=>'Обновлено '+p+' по рижскому времени. Обновляется автоматически.',source:'Источник: рынок Nord Pool на сутки вперёд. Цена показана в €/kWh. Итоговый счёт зависит от продавца, сети и НДС.',notLive:'Онлайн-цена для этого рынка ещё не подключена',notLiveDetail:m=>'Правильные настройки сохранены для '+m+', но текущий источник даёт live-цены только для Латвии, Литвы, Эстонии и Финляндии.',couldNot:'Не удалось загрузить цену',refresh:'Обновите через минуту.'}
};
let selectedMarket = localStorage.getItem('market') || localStorage.getItem('area') || new URLSearchParams(location.search).get('area') || 'lv';
if(!MARKETS[selectedMarket]) selectedMarket = 'lv';
localStorage.setItem('market', selectedMarket);
let userLang = localStorage.getItem('lang');
let lang = userLang && I18N[userLang] ? userLang : MARKETS[selectedMarket].lang;
const $ = id => document.getElementById(id);
const tr = (key,...args) => { const v = (I18N[lang] || I18N.en)[key] ?? I18N.en[key] ?? key; return typeof v === 'function' ? v(...args) : v; };
const marketName = code => (MARKETS[code]?.name?.[lang] || MARKETS[code]?.name?.en || code);
const fmtMoney = v => Number(v || 0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtOne = v => Number(v || 0).toLocaleString('en-GB',{minimumFractionDigits:1,maximumFractionDigits:1});
let activeTimezone = MARKETS[selectedMarket]?.timezone || 'Europe/Riga';
const timeFmt = tz => new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const dayFmt = tz => new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'});
const range = (s,e) => timeFmt(activeTimezone).format(new Date(s*1000)) + '–' + timeFmt(activeTimezone).format(new Date(e*1000));
function wordsForHours(h){ return fmtOne(h) + (lang==='en' ? (' hour' + (Number(h) === 1 ? '' : 's')) : lang==='ru' ? ' ч' : lang==='lv' ? ' h' : ' val.'); }
function moodClass(price){ return price < 80 ? 'good' : price < 180 ? 'ok' : 'bad'; }
function moodText(price){ return price < 80 ? tr('good') : price < 180 ? tr('ok') : tr('bad'); }
function localizeStatic(){
  document.documentElement.lang = lang;
  document.querySelector('[data-i18n="brand"]').textContent = tr('brand');
  $('subtitle').textContent = tr('subtitle'); $('priceLabel').textContent = tr('priceLabel'); $('costLabel').textContent = tr('costLabel'); $('gaugeLabelTop').textContent = tr('gauge');
  $('scaleLow').textContent = tr('veryLow'); $('scaleNormal').textContent = tr('normal'); $('scaleHigh').textContent = tr('veryHigh');
  $('bestTitle').textContent = tr('best'); $('cheapestTag').textContent = tr('cheapest'); $('advancedTitle').textContent = tr('advanced'); $('advancedState').textContent = $('advanced').classList.contains('open') ? tr('hide') : tr('show');
  $('kwLabel').textContent = tr('kw'); $('durationLabel').textContent = tr('hours'); $('addersLabel').textContent = tr('adders'); $('vatLabel').textContent = tr('vat');
  $('kwNote').textContent = tr('kwNote'); $('durationNote').textContent = tr('hoursNote'); $('addersNote').textContent = tr('addersNote'); $('vatNote').textContent = tr('vatNote');
  $('minpText').textContent = tr('min'); $('avgpText').textContent = tr('avg'); $('maxpText').textContent = tr('max');
  $('chartTitle').textContent = tr('chartTitle'); $('chartExplain').textContent = tr('chartExplain'); $('legendCheap').textContent = tr('cheap'); $('legendMiddle').textContent = tr('middle'); $('legendHigh').textContent = tr('expensive'); $('xLabel').textContent = tr('time'); $('sourceLine').textContent = tr('source');
  $('marketBtn').textContent = MARKETS[selectedMarket].flag + ' ' + marketName(selectedMarket) + ' ▾';
  renderMarketSheet(); renderLangs();
}
function renderMarketSheet(){
  $('marketSheet').innerHTML = Object.entries(MARKETS).map(([code,m]) => '<button class="'+(code===selectedMarket?'active':'')+'" data-market="'+code+'">'+m.flag+' '+marketName(code)+'</button>').join('');
  document.querySelectorAll('[data-market]').forEach(btn => btn.addEventListener('click',()=>{ selectedMarket = btn.dataset.market; localStorage.setItem('market', selectedMarket); if(!localStorage.getItem('lang')) lang = MARKETS[selectedMarket].lang; $('vat').value = MARKETS[selectedMarket].vatPct ?? $('vat').value; $('adders').value = MARKETS[selectedMarket].addersEurPerKwh ?? $('adders').value; $('marketSheet').hidden = true; localizeStatic(); load(); }));
}
function renderLangs(){
  $('langWrap').innerHTML = Object.entries(LANGS).map(([code,label]) => '<button class="langBtn '+(code===lang?'active':'')+'" data-lang="'+code+'">'+label+'</button>').join('');
  document.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click',()=>{ lang = btn.dataset.lang; localStorage.setItem('lang', lang); localizeStatic(); if(window.lastData) renderData(window.lastData); }));
}
function renderData(data){
  localizeStatic();
  activeTimezone = data.timezone || MARKETS[data.area || selectedMarket]?.timezone || activeTimezone;
  const cur = data.current || {}; const opts = data.opts || {}; const run = data.currentRun || {}; const mName = marketName(data.area || selectedMarket);
  const kwhPrice = Number(cur.price || 0) / 1000; const minKwh = Number(data.min?.price || 0) / 1000; const maxKwh = Number(data.max?.price || 0) / 1000; const avgKwh = Number(run.avgPrice || 0) / 1000;
  $('price').textContent = kwhPrice.toFixed(3); $('pricePlain').innerHTML = '<b>'+tr('priceNow', mName)+'</b> ' + kwhPrice.toFixed(3) + ' ' + tr('for1');
  $('badge').textContent = moodText(cur.price); $('badge').className = 'mood ' + moodClass(cur.price);
  const bm = data.benchmarks || {}; const pct = Number.isFinite(Number(bm.percentile12m)) && Number(bm.sample12m) ? Math.max(0, Math.min(100, Number(bm.percentile12m))) : 50;
  $('gaugeLabel').textContent = tr(bm.label || 'normal'); $('gaugePct').textContent = tr('higher', Math.round(pct)); $('gaugeNeedle').style.left = pct + '%'; $('gaugePlain').innerHTML = tr('sameAvg', Number(bm.avg3mKwh || 0).toFixed(3), Number(bm.avg12mKwh || 0).toFixed(3));
  $('costNow').innerHTML = fmtMoney(run.total) + ' €'; $('costPlain').innerHTML = tr('cost', {kw:fmtOne(opts.powerKw), hours:wordsForHours(opts.durationHours), cost:fmtMoney(run.total)});
  $('minp').textContent = minKwh.toFixed(3) + ' €/kWh'; $('avgp').textContent = avgKwh.toFixed(3) + ' €/kWh'; $('maxp').textContent = maxKwh.toFixed(3) + ' €/kWh';
  $('costBreakdown').textContent = tr('breakdown', {hours:wordsForHours(opts.durationHours), kw:fmtOne(opts.powerKw), energy:Number(run.energyKwh || 0).toFixed(2), market:fmtMoney(run.market), adders:fmtMoney(run.adders)});
  $('windows').innerHTML = (data.best || []).slice(0,4).map((w,i) => '<div class="window"><div class="rank">' + (i+1) + '</div><div><div class="when">' + range(w.start,w.end) + '</div><div class="meaning">' + tr('runThen',{hours:wordsForHours(opts.durationHours), cost:fmtMoney(w.total)}) + '</div><div class="priceChip">' + tr('priceThen',(Number(w.avgPrice || 0)/1000).toFixed(3)) + '</div></div></div>').join('');
  const rows = data.rows || []; const df = dayFmt(activeTimezone); const today = df.format(new Date()); const chartRows = rows.filter(r => df.format(new Date(r.timestamp*1000)) === today); const useRows = chartRows.length ? chartRows : rows;
  const vals = useRows.map(r=>r.price); const min = Math.min(...vals); const max = Math.max(...vals); const nowTs = cur.timestamp;
  $('chart').innerHTML = useRows.map(r=>{ const h = 12 + Math.round(((r.price - min) / Math.max(1,max-min)) * 146); const cls = (r.timestamp === nowTs ? ' now' : '') + (r.price < 90 ? ' good' : r.price > 220 ? ' bad' : ''); return '<div class="bar' + cls + '" style="height:' + h + 'px" title="' + range(r.timestamp,r.timestamp+900) + ': ' + (Number(r.price||0)/1000).toFixed(3) + ' €/kWh"></div>'; }).join('');
  $('xStart').textContent = chartRows.length ? '00:00' : '—'; $('xEnd').textContent = chartRows.length ? '24:00' : '—'; $('yHigh').textContent = (max/1000).toFixed(3) + ' €/kWh'; $('yLow').textContent = (min/1000).toFixed(3) + ' €/kWh'; $('chartNow').textContent = tr('now') + ' ' + timeFmt(activeTimezone).format(new Date());
  $('statusLine').textContent = tr('updated', new Date(data.updatedAt).toLocaleString('en-GB',{timeZone:activeTimezone}));
}
async function load(){
  localizeStatic();
  const params = new URLSearchParams({area:selectedMarket,kw:$('kw').value,duration:$('duration').value,adders:$('adders').value,vat:$('vat').value});
  try{
    params.set('quick','1');
    const res = await fetch('/api/prices?' + params);
    const data = await res.json();
    if(!data.ok){ if(data.error === 'market_not_live_yet'){ window.lastData = data; const mName = marketName(data.area || selectedMarket); $('badge').textContent = tr('notLive'); $('badge').className = 'mood ok'; $('price').textContent = '—'; $('pricePlain').textContent = tr('notLiveDetail', mName); $('windows').innerHTML = '<div class="note">'+tr('notLiveDetail', mName)+'</div>'; return; } throw new Error(data.error || 'Price load failed'); }
    window.lastData = data;
    renderData(data);
    scheduleFullRefresh();
  }catch(err){ $('badge').textContent = tr('couldNot'); $('badge').className = 'mood bad'; $('pricePlain').textContent = tr('refresh'); }
}
async function scheduleFullRefresh(){
  clearTimeout(window.fullRefreshTimer);
  window.fullRefreshTimer = setTimeout(async()=>{
    const params = new URLSearchParams({area:selectedMarket,kw:$('kw').value,duration:$('duration').value,adders:$('adders').value,vat:$('vat').value});
    try{
      const res = await fetch('/api/prices?' + params);
      const data = await res.json();
      if(data.ok && data.area === selectedMarket){ window.lastData = data; renderData(data); }
    }catch{}
  }, 60);
}
$('marketBtn').addEventListener('click',()=>{ $('marketSheet').hidden = !$('marketSheet').hidden; });
document.addEventListener('click', e => { if(!$('marketSheet').hidden && !e.target.closest('#marketSheet') && !e.target.closest('#marketBtn')) $('marketSheet').hidden = true; });
$('advancedBtn').addEventListener('click',()=>{ const box=$('advanced'); const open=!box.classList.contains('open'); box.classList.toggle('open',open); $('advancedState').textContent = open ? tr('hide') : tr('show'); });
['kw','duration','adders','vat'].forEach(id => $(id).addEventListener('input',()=>{ clearTimeout(window.t); window.t=setTimeout(load,180); }));
load(); setInterval(load,60000);
</script>
</body>
</html>`;
