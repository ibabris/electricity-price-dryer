import { DEFAULTS, summarize } from './core.js';

const SOURCE = 'https://dashboard.elering.ee/api/nps/price';
const CACHE_SECONDS = 60;

function priceUrl(){
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 3600 * 1000);
  const end = new Date(now.getTime() + 36 * 3600 * 1000);
  return `${SOURCE}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
}

function historyUrl(days){
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 3600 * 1000);
  return `${SOURCE}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(now.toISOString())}`;
}

async function fetchPrices(){
  const res = await fetch(priceUrl(), { headers: { 'user-agent':'Electricity price dryer helper' }, cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } });
  if(!res.ok) throw new Error(`price_source_${res.status}`);
  const json = await res.json();
  const lv = json?.data?.lv;
  if(!Array.isArray(lv) || !lv.length) throw new Error('price_source_empty');
  return lv.map(x => ({ timestamp: Number(x.timestamp), price: Number(x.price) })).filter(x => Number.isFinite(x.timestamp) && Number.isFinite(x.price));
}

async function fetchHistory(days){
  const res = await fetch(historyUrl(days), { headers: { 'user-agent':'Electricity price dryer helper' }, cf: { cacheTtl: 600, cacheEverything: true } });
  if(!res.ok) return [];
  const json = await res.json();
  const lv = json?.data?.lv;
  return Array.isArray(lv) ? lv.map(x => ({ timestamp: Number(x.timestamp), price: Number(x.price) })).filter(x => Number.isFinite(x.timestamp) && Number.isFinite(x.price)) : [];
}

const slotFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Riga', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
function slotKey(ts){
  const parts = Object.fromEntries(slotFmt.formatToParts(new Date(ts * 1000)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return Number(parts.hour) * 60 + Math.floor(Number(parts.minute) / 15) * 15;
}
function avg(rows){ return rows.length ? rows.reduce((a,r)=>a+Number(r.price || 0),0) / rows.length : 0; }
function percentile(value, rows){
  if(!rows.length) return 50;
  const below = rows.filter(r => Number(r.price || 0) <= value).length;
  return Math.round((below / rows.length) * 100);
}
function gaugeLabel(p){ return p < 10 ? 'Very low' : p < 30 ? 'Low' : p < 70 ? 'Normal' : p < 90 ? 'High' : 'Very high'; }
function buildBenchmark(current, hist90, hist365){
  if(!current) return null;
  const key = slotKey(current.timestamp);
  const same3m = hist90.filter(r => slotKey(r.timestamp) === key);
  const same12m = hist365.filter(r => slotKey(r.timestamp) === key);
  const pct12 = percentile(current.price, same12m);
  return { slotMinutes:key, currentKwh: current.price / 1000, avg3mKwh: avg(same3m) / 1000, avg12mKwh: avg(same12m) / 1000, percentile12m:pct12, label:gaugeLabel(pct12), sample3m:same3m.length, sample12m:same12m.length };
}

function apiPayload(rows, url, hist90 = [], hist365 = []){
  const q = url.searchParams;
  const opts = {
    durationHours: Number(q.get('duration') || DEFAULTS.durationHours),
    powerKw: Number(q.get('kw') || DEFAULTS.powerKw),
    addersEurPerKwh: Number(q.get('adders') || DEFAULTS.addersEurPerKwh),
    vatPct: Number(q.get('vat') || DEFAULTS.vatPct)
  };
  const s = summarize(rows, opts);
  return { ok:true, source:'Elering / Nord Pool Latvia electricity prices', sourceUrl:SOURCE, updatedAt:new Date().toISOString(), timezone:'Europe/Riga', intervalMinutes:15, opts, benchmarks: buildBenchmark(s.current, hist90, hist365), ...s };
}

function json(data,status=200){ return new Response(JSON.stringify(data), { status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' } }); }
function page(){ return new Response(HTML, { headers:{ 'content-type':'text/html; charset=utf-8', 'cache-control':'public, max-age=120' } }); }

export default { async fetch(request){
  const url = new URL(request.url);
  if(url.pathname === '/api/prices'){
    try { const [rows, hist90, hist365] = await Promise.all([fetchPrices(), fetchHistory(90), fetchHistory(365)]); return json(apiPayload(rows, url, hist90, hist365)); }
    catch(err){ return json({ ok:false, error:String(err.message||err), sourceUrl:SOURCE }, 502); }
  }
  return page();
}};

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Dry clothes cheaper — Latvia electricity now</title>
<style>
:root{--bg:#f3f7fb;--ink:#102033;--muted:#637287;--card:#fff;--line:#dce6f1;--blue:#0b65d8;--green:#0e9f6e;--red:#dc2626;--amber:#b7791f;--softBlue:#eaf4ff;--softGreen:#e8fff3;--shadow:0 20px 60px rgba(16,32,51,.14)}*{box-sizing:border-box}html{background:#eaf3fb}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,"Segoe UI",sans-serif;background:linear-gradient(180deg,#f8fbff 0,#edf6ff 48%,#f6f8fb 100%);color:var(--ink);min-height:100vh}main{width:min(720px,100%);margin:0 auto;padding:env(safe-area-inset-top) 14px 28px}.appTop{position:sticky;top:0;z-index:5;margin:0 -14px 10px;padding:10px 14px 8px;background:rgba(248,251,255,.88);backdrop-filter:blur(18px);border-bottom:1px solid rgba(220,230,241,.7)}.topLine{display:flex;align-items:center;justify-content:space-between;gap:8px}.brand{display:flex;align-items:center;gap:9px;font-weight:900}.bolt{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#0b65d8,#27c0ff);color:#fff;box-shadow:0 8px 22px rgba(11,101,216,.25)}.live{font-size:12px;font-weight:800;color:var(--green);background:#e8fff3;border:1px solid #baf2d1;border-radius:999px;padding:7px 10px}.subtitle{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.25}.card{background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:28px;box-shadow:var(--shadow);padding:16px;margin:12px 0}.heroCard{background:linear-gradient(180deg,#ffffff 0,#eef8ff 100%)}.label{font-size:13px;font-weight:900;color:#4b6078;text-transform:uppercase;letter-spacing:.06em}.answer{font-weight:950;letter-spacing:-.04em}.priceNow{display:flex;align-items:end;gap:6px;margin-top:5px;min-width:0;flex-wrap:wrap}.priceNumber{font-size:clamp(62px,20vw,126px);line-height:.82;color:#06162b}.priceUnit{font-size:clamp(20px,5.5vw,25px);font-weight:950;margin-bottom:8px;color:#27445f}.plain{font-size:19px;line-height:1.28;margin:12px 0 0;color:#294259}.plain b{color:#07182e}.mood{display:inline-flex;margin-top:12px;border-radius:999px;padding:8px 12px;font-weight:900;font-size:14px}.mood.good{color:#05603a;background:#d9ffe9}.mood.ok{color:#794b05;background:#fff4cc}.mood.bad{color:#991b1b;background:#ffe2e2}.costCard{background:linear-gradient(160deg,#063b73 0,#0b65d8 62%,#13a0dd 100%);color:#fff;border:0}.costCard .label{color:#dbeafe}.costLine{font-size:clamp(34px,10vw,68px);line-height:.95;margin:8px 0 4px}.costLine small{font-size:.42em;letter-spacing:0}.costText{font-size:20px;line-height:1.25;margin:10px 0 0;color:#eef6ff}.gaugeTitle{display:flex;justify-content:space-between;align-items:end;gap:10px;margin:8px 0 10px}.gaugeTitle span:first-child{font-size:34px;font-weight:950;letter-spacing:-.04em}.gaugeTitle span:last-child{font-size:15px;font-weight:950;color:#52657b}.gaugeRail{position:relative;height:24px;border-radius:999px;background:linear-gradient(90deg,#14b86a 0,#a3e635 25%,#facc15 52%,#fb923c 75%,#ef4444 100%);box-shadow:inset 0 0 0 1px rgba(16,32,51,.12)}.gaugeNeedle{position:absolute;top:-5px;width:6px;height:34px;border-radius:999px;background:#102033;box-shadow:0 3px 10px rgba(16,32,51,.35);left:50%;transform:translateX(-50%)}.gaugeScale{display:flex;justify-content:space-between;color:#52657b;font-weight:900;font-size:12px;margin-top:7px}.bestTitle{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}.bestTitle h2{margin:0;font-size:24px;letter-spacing:-.03em}.window{display:grid;grid-template-columns:auto 1fr;gap:11px;padding:13px 0;border-top:1px solid #e7eef6}.window:first-child{border-top:0}.rank{width:40px;height:40px;border-radius:15px;background:var(--softGreen);color:var(--green);display:grid;place-items:center;font-weight:950}.when{font-size:22px;font-weight:950;letter-spacing:-.03em}.meaning{font-size:16px;margin-top:3px;color:#334e68;line-height:1.28}.priceChip{display:inline-flex;margin-top:8px;border-radius:12px;background:#effaf3;color:#067647;padding:7px 10px;font-size:15px;font-weight:900}.advancedToggle{width:100%;border:0;border-radius:18px;padding:14px 16px;margin:4px 0 0;text-align:left;background:#16243a;color:#fff;font-size:16px;font-weight:900;display:flex;justify-content:space-between;align-items:center}.advanced{display:none;margin-top:10px}.advanced.open{display:block}.controls{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{border:1px solid var(--line);background:#fff;border-radius:18px;padding:11px}.field label{display:block;font-size:12px;color:#65758a;font-weight:900;margin-bottom:5px}.field input{width:100%;border:0;outline:0;font-size:24px;font-weight:950;color:var(--ink);background:transparent}.miniGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}.mini{border:1px solid var(--line);border-radius:18px;background:#fff;padding:10px}.mini b{display:block;font-size:19px}.mini span{display:block;font-size:12px;color:var(--muted);font-weight:800;margin-top:3px}.chartCard h2{margin:0;font-size:22px;letter-spacing:-.03em}.chartCard p{margin:4px 0 0;color:#52657b;font-size:14px}.chartHead{display:flex;justify-content:space-between;gap:10px;align-items:start}.chartNow{background:#102033;color:#fff;border-radius:999px;padding:8px 10px;font-weight:950;font-size:13px;white-space:nowrap}.legend{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.legend span{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:900;color:#405671;background:#f4f8fc;border:1px solid #e0e8f1;border-radius:999px;padding:7px 9px}.leg{width:12px;height:12px;border-radius:4px;display:inline-block}.leg.cheap{background:#2dd47a}.leg.middle{background:#54b6ff}.leg.high{background:#ff6868}.chartWrap{display:grid;grid-template-columns:54px 1fr;gap:8px;align-items:stretch}.yAxis{display:flex;flex-direction:column;justify-content:space-between;align-items:end;text-align:right;color:#52657b;font-size:11px;font-weight:900;padding:2px 0 24px}.yAxis span:nth-child(2){writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;color:#102033}.chartArea{min-width:0}.chart{height:165px;display:flex;align-items:end;gap:1px;border-radius:20px;background:linear-gradient(180deg,#fff1f1 0,#eef7ff 48%,#eafff4 100%);padding:10px;overflow:hidden;border:1px solid #d8e4ef}.bar{flex:1;min-width:0;border-radius:6px 6px 0 0;background:#54b6ff}.bar.good{background:#2dd47a}.bar.bad{background:#ff6868}.bar.now{box-shadow:0 0 0 2px #102033,0 0 0 5px rgba(255,255,255,.95)}.xAxis{display:flex;justify-content:space-between;gap:8px;color:#52657b;font-size:11px;font-weight:900;padding:6px 4px 0}.xAxis span:nth-child(2){color:#102033}.note{color:var(--muted);font-size:13px;line-height:1.35}.source{font-size:12px;color:#64748b;text-align:center;margin:16px 4px}.source a{color:#0b65d8}#statusLine{font-size:13px;color:#64748b;margin-top:8px}@media(min-width:760px){main{padding-top:18px}.desktopGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:stretch}.desktopGrid .card{margin:0}.bestAndAdvanced{display:grid;grid-template-columns:1.05fr .95fr;gap:14px;align-items:start}.priceNumber{font-size:118px}.costLine{font-size:64px}}@media(max-width:420px){main{padding-left:10px;padding-right:10px}.appTop{margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px}.card{border-radius:24px;padding:14px}.controls{grid-template-columns:1fr 1fr;gap:8px}.miniGrid{grid-template-columns:1fr}.when{font-size:20px}.costText,.plain{font-size:18px}.field input{font-size:22px}}
</style>
</head>
<body>
<main>
  <header class="appTop">
    <div class="topLine"><div class="brand"><div class="bolt">⚡</div><div>Dry clothes cheaper</div></div><div class="live">Live Latvia price</div></div>
    <p class="subtitle">Simple answer first. Advanced details are hidden unless you want them.</p>
  </header>

  <section class="desktopGrid">
    <article class="card heroCard">
      <div class="label">1. Price now</div>
      <div class="priceNow"><div id="price" class="answer priceNumber">—</div><div class="priceUnit">€/kWh</div></div>
      <p id="pricePlain" class="plain">Loading price for 1 kWh…</p>
      <div id="badge" class="mood ok">Checking if this is cheap or expensive</div>
    </article>

    <article class="card costCard">
      <div class="label">2. If I run dryer now</div>
      <div id="costNow" class="answer costLine">— €</div>
      <p id="costPlain" class="costText">Loading how much a 1.5 hour dryer run would cost now…</p>
    </article>
  </section>

  <section class="card gaugeCard">
    <div class="label">3. Price gauge</div>
    <div class="gaugeTitle"><span id="gaugeLabel">—</span><span id="gaugePct">—</span></div>
    <div class="gaugeRail"><div class="gaugeFill"></div><div id="gaugeNeedle" class="gaugeNeedle"></div></div>
    <div class="gaugeScale"><span>Very low</span><span>Normal</span><span>Very high</span></div>
    <p id="gaugePlain" class="plain">Comparing price now with the same time of day from the last 12 months and last 3 months…</p>
  </section>

  <section class="bestAndAdvanced">
    <article class="card">
      <div class="bestTitle"><h2>Best times to run dryer</h2><span class="live">Cheapest first</span></div>
      <div id="windows"><div class="note">Loading the cheapest 1.5 hour windows…</div></div>
    </article>

    <article>
      <button id="advancedBtn" class="advancedToggle" type="button">For experienced users <span>Show</span></button>
      <div id="advanced" class="advanced card">
        <div class="controls">
          <div class="field"><label>Dryer power</label><input id="kw" type="number" min="0.1" step="0.1" value="2.5"><div class="note">kW, example: 2.5</div></div>
          <div class="field"><label>Running time</label><input id="duration" type="number" min="0.25" step="0.25" value="1.5"><div class="note">hours, example: 1.5</div></div>
          <div class="field"><label>Extra fees</label><input id="adders" type="number" min="0" step="0.01" value="0.16"><div class="note">€/kWh for network + seller</div></div>
          <div class="field"><label>VAT</label><input id="vat" type="number" min="0" step="1" value="21"><div class="note">%, example: 21</div></div>
        </div>
        <div class="miniGrid">
          <div class="mini"><b id="minp">— €/kWh</b><span>cheapest price for 1 kWh</span></div>
          <div class="mini"><b id="avgp">— €/kWh</b><span>average price for 1 kWh during dryer run now</span></div>
          <div class="mini"><b id="maxp">— €/kWh</b><span>most expensive price for 1 kWh</span></div>
        </div>
        <p id="costBreakdown" class="note">Advanced cost split loading…</p>
        <div id="statusLine">Live data loading…</div>
      </div>
    </article>
  </section>

  <section class="card chartCard">
    <div class="chartHead"><div><h2>Price picture</h2><p>Left to right = time. Bottom = cheap. Top = expensive. White line = now.</p></div><div class="chartNow" id="chartNow">Now</div></div>
    <div class="legend"><span><i class="leg cheap"></i>Cheap</span><span><i class="leg middle"></i>Middle</span><span><i class="leg high"></i>Expensive</span></div>
    <div class="chartWrap">
      <div class="yAxis"><span id="yHigh">High</span><span>Price €/kWh</span><span id="yLow">Low</span></div>
      <div class="chartArea"><div id="chart" class="chart" aria-label="Today electricity price chart"></div><div class="xAxis"><span id="xStart">00:00</span><span>Time (Riga)</span><span id="xEnd">24:00</span></div></div>
    </div>
  </section>

  <p class="source">Data source: <a href="https://dashboard.elering.ee/api/nps/price" target="_blank" rel="noreferrer">Elering / Nord Pool Latvia</a>. Shows market electricity price converted to €/kWh. Your final bill also depends on your seller, network tariff and VAT.</p>
</main>
<script>
const $ = id => document.getElementById(id);
const fmtMoney = v => Number(v || 0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPrice = v => Number(v || 0).toLocaleString('en-GB',{maximumFractionDigits:0});
const fmtOne = v => Number(v || 0).toLocaleString('en-GB',{minimumFractionDigits:1,maximumFractionDigits:1});
const tf = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Riga',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const range = (s,e) => tf.format(new Date(s*1000)) + '–' + tf.format(new Date(e*1000));
function moodClass(price){ return price < 80 ? 'good' : price < 180 ? 'ok' : 'bad'; }
function moodText(price){ return price < 80 ? 'Good time — electricity is cheap' : price < 180 ? 'Middle price — okay if you need it' : 'Bad time — expensive, wait if you can'; }
function wordsForHours(h){ return fmtOne(h) + ' hour' + (Number(h) === 1 ? '' : 's'); }
async function load(){
  const params = new URLSearchParams({kw:$('kw').value,duration:$('duration').value,adders:$('adders').value,vat:$('vat').value});
  let data;
  try{
    const res = await fetch('/api/prices?' + params);
    data = await res.json();
    if(!data.ok) throw new Error(data.error || 'Price load failed');
  }catch(err){
    $('badge').textContent = 'Could not load live price'; $('badge').className = 'mood bad';
    $('pricePlain').textContent = 'Please refresh in a moment.'; return;
  }
  const cur = data.current || {}; const opts = data.opts || {}; const run = data.currentRun || {};
  const kwhPrice = Number(cur.price || 0) / 1000;
  const minKwh = Number(data.min?.price || 0) / 1000;
  const maxKwh = Number(data.max?.price || 0) / 1000;
  const avgKwh = Number(run.avgPrice || 0) / 1000;
  $('price').textContent = kwhPrice.toFixed(3);
  $('pricePlain').innerHTML = '<b>Price now:</b> ' + kwhPrice.toFixed(3) + ' € for 1 kWh.';
  $('badge').textContent = moodText(cur.price); $('badge').className = 'mood ' + moodClass(cur.price);
  const bm = data.benchmarks || {};
  const pct = Number.isFinite(Number(bm.percentile12m)) ? Math.max(0, Math.min(100, Number(bm.percentile12m))) : 50;
  $('gaugeLabel').textContent = bm.label || 'Normal';
  $('gaugePct').textContent = 'higher than ' + Math.round(pct) + '% of same-time prices';
  $('gaugeNeedle').style.left = pct + '%';
  $('gaugePlain').innerHTML = 'Same time average: <b>' + Number(bm.avg3mKwh || 0).toFixed(3) + ' €/kWh</b> last 3 months, <b>' + Number(bm.avg12mKwh || 0).toFixed(3) + ' €/kWh</b> last 12 months.';
  $('costNow').innerHTML = fmtMoney(run.total) + ' €';
  $('costPlain').innerHTML = 'Running a <b>' + fmtOne(opts.powerKw) + ' kW</b> dryer for <b>' + wordsForHours(opts.durationHours) + '</b> now will cost about <b>' + fmtMoney(run.total) + ' €</b>.';
  $('minp').textContent = minKwh.toFixed(3) + ' €/kWh'; $('avgp').textContent = avgKwh.toFixed(3) + ' €/kWh'; $('maxp').textContent = maxKwh.toFixed(3) + ' €/kWh';
  $('costBreakdown').textContent = wordsForHours(opts.durationHours) + ' at ' + fmtOne(opts.powerKw) + ' kW uses about ' + Number(run.energyKwh || 0).toFixed(2) + ' kWh. Current-run split: market electricity ' + fmtMoney(run.market) + ' €, extra fees ' + fmtMoney(run.adders) + ' €, VAT included in total.';
  $('windows').innerHTML = (data.best || []).slice(0,4).map((w,i) => '<div class="window"><div class="rank">' + (i+1) + '</div><div><div class="when">' + range(w.start,w.end) + '</div><div class="meaning">Run dryer for ' + wordsForHours(opts.durationHours) + ' then. It would cost about <b>' + fmtMoney(w.total) + ' €</b>.</div><div class="priceChip">Price then: ' + (Number(w.avgPrice || 0)/1000).toFixed(3) + ' €/kWh</div></div></div>').join('') || '<div class="note">No full upcoming dryer window is available yet.</div>';
  const rows = data.rows || []; const vals = rows.map(r=>r.price); const min = Math.min(...vals); const max = Math.max(...vals); const nowTs = cur.timestamp;
  $('chart').innerHTML = rows.map(r=>{ const h = 12 + Math.round(((r.price - min) / Math.max(1,max-min)) * 146); const cls = (r.timestamp === nowTs ? ' now' : '') + (r.price < 90 ? ' good' : r.price > 220 ? ' bad' : ''); return '<div class="bar' + cls + '" style="height:' + h + 'px" title="' + range(r.timestamp,r.timestamp+900) + ': ' + (Number(r.price||0)/1000).toFixed(3) + ' €/kWh"></div>'; }).join('');
  const sorted = [...rows].sort((a,b)=>a.timestamp-b.timestamp);
  if(sorted.length){ $('xStart').textContent = tf.format(new Date(sorted[0].timestamp*1000)); $('xEnd').textContent = tf.format(new Date((sorted[sorted.length-1].timestamp+900)*1000)); }
  $('yHigh').textContent = (max/1000).toFixed(3) + ' €/kWh'; $('yLow').textContent = (min/1000).toFixed(3) + ' €/kWh'; $('chartNow').textContent = 'Now ' + tf.format(new Date(Number(nowTs||0)*1000));
  $('statusLine').textContent = 'Updated ' + new Date(data.updatedAt).toLocaleString('en-GB',{timeZone:'Europe/Riga'}) + ' Riga time. Refreshes automatically.';
}
$('advancedBtn').addEventListener('click',()=>{ const box=$('advanced'); const open=!box.classList.contains('open'); box.classList.toggle('open',open); $('advancedBtn').querySelector('span').textContent = open ? 'Hide' : 'Show'; });
['kw','duration','adders','vat'].forEach(id => $(id).addEventListener('input',()=>{ clearTimeout(window.t); window.t=setTimeout(load,180); }));
load(); setInterval(load,60000);
</script>
</body>
</html>`;
