import { DEFAULTS, summarize } from './core.js';

const SOURCE = 'https://dashboard.elering.ee/api/nps/price';
const CACHE_SECONDS = 60;

function priceUrl(){
  const now = new Date();
  const start = new Date(now.getTime() - 6 * 3600 * 1000);
  const end = new Date(now.getTime() + 36 * 3600 * 1000);
  return `${SOURCE}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
}

async function fetchPrices(){
  const res = await fetch(priceUrl(), { headers: { 'user-agent':'Electricity price dryer helper' }, cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } });
  if(!res.ok) throw new Error(`price_source_${res.status}`);
  const json = await res.json();
  const lv = json?.data?.lv;
  if(!Array.isArray(lv) || !lv.length) throw new Error('price_source_empty');
  return lv.map(x => ({ timestamp: Number(x.timestamp), price: Number(x.price) })).filter(x => Number.isFinite(x.timestamp) && Number.isFinite(x.price));
}

function apiPayload(rows, url){
  const q = url.searchParams;
  const opts = {
    durationHours: Number(q.get('duration') || DEFAULTS.durationHours),
    powerKw: Number(q.get('kw') || DEFAULTS.powerKw),
    addersEurPerKwh: Number(q.get('adders') || DEFAULTS.addersEurPerKwh),
    vatPct: Number(q.get('vat') || DEFAULTS.vatPct)
  };
  const s = summarize(rows, opts);
  return { ok:true, source:'Elering / Nord Pool Latvia electricity prices', sourceUrl:SOURCE, updatedAt:new Date().toISOString(), timezone:'Europe/Riga', intervalMinutes:15, opts, ...s };
}

function json(data,status=200){ return new Response(JSON.stringify(data), { status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' } }); }
function page(){ return new Response(HTML, { headers:{ 'content-type':'text/html; charset=utf-8', 'cache-control':'public, max-age=120' } }); }

export default { async fetch(request){
  const url = new URL(request.url);
  if(url.pathname === '/api/prices'){
    try { return json(apiPayload(await fetchPrices(), url)); }
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
:root{--bg:#f3f7fb;--ink:#102033;--muted:#637287;--card:#fff;--line:#dce6f1;--blue:#0b65d8;--green:#0e9f6e;--red:#dc2626;--amber:#b7791f;--softBlue:#eaf4ff;--softGreen:#e8fff3;--shadow:0 20px 60px rgba(16,32,51,.14)}*{box-sizing:border-box}html{background:#eaf3fb}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Inter,"Segoe UI",sans-serif;background:linear-gradient(180deg,#f8fbff 0,#edf6ff 48%,#f6f8fb 100%);color:var(--ink);min-height:100vh}main{width:min(720px,100%);margin:0 auto;padding:env(safe-area-inset-top) 14px 28px}.appTop{position:sticky;top:0;z-index:5;margin:0 -14px 10px;padding:10px 14px 8px;background:rgba(248,251,255,.88);backdrop-filter:blur(18px);border-bottom:1px solid rgba(220,230,241,.7)}.topLine{display:flex;align-items:center;justify-content:space-between;gap:8px}.brand{display:flex;align-items:center;gap:9px;font-weight:900}.bolt{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#0b65d8,#27c0ff);color:#fff;box-shadow:0 8px 22px rgba(11,101,216,.25)}.live{font-size:12px;font-weight:800;color:var(--green);background:#e8fff3;border:1px solid #baf2d1;border-radius:999px;padding:7px 10px}.subtitle{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.25}.card{background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:28px;box-shadow:var(--shadow);padding:16px;margin:12px 0}.heroCard{background:linear-gradient(180deg,#ffffff 0,#eef8ff 100%)}.label{font-size:13px;font-weight:900;color:#4b6078;text-transform:uppercase;letter-spacing:.06em}.answer{font-weight:950;letter-spacing:-.04em}.priceNow{display:flex;align-items:end;gap:8px;margin-top:5px}.priceNumber{font-size:clamp(68px,23vw,134px);line-height:.78;color:#06162b}.priceUnit{font-size:25px;font-weight:950;margin-bottom:8px;color:#27445f}.plain{font-size:19px;line-height:1.28;margin:12px 0 0;color:#294259}.plain b{color:#07182e}.mood{display:inline-flex;margin-top:12px;border-radius:999px;padding:8px 12px;font-weight:900;font-size:14px}.mood.good{color:#05603a;background:#d9ffe9}.mood.ok{color:#794b05;background:#fff4cc}.mood.bad{color:#991b1b;background:#ffe2e2}.costCard{background:linear-gradient(160deg,#063b73 0,#0b65d8 62%,#13a0dd 100%);color:#fff;border:0}.costCard .label{color:#dbeafe}.costLine{font-size:clamp(34px,10vw,68px);line-height:.95;margin:8px 0 4px}.costLine small{font-size:.42em;letter-spacing:0}.costText{font-size:20px;line-height:1.25;margin:10px 0 0;color:#eef6ff}.bestTitle{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}.bestTitle h2{margin:0;font-size:24px;letter-spacing:-.03em}.window{display:grid;grid-template-columns:auto 1fr;gap:11px;padding:13px 0;border-top:1px solid #e7eef6}.window:first-child{border-top:0}.rank{width:40px;height:40px;border-radius:15px;background:var(--softGreen);color:var(--green);display:grid;place-items:center;font-weight:950}.when{font-size:22px;font-weight:950;letter-spacing:-.03em}.meaning{font-size:16px;margin-top:3px;color:#334e68;line-height:1.28}.priceChip{display:inline-flex;margin-top:8px;border-radius:12px;background:#effaf3;color:#067647;padding:7px 10px;font-size:15px;font-weight:900}.advancedToggle{width:100%;border:0;border-radius:18px;padding:14px 16px;margin:4px 0 0;text-align:left;background:#16243a;color:#fff;font-size:16px;font-weight:900;display:flex;justify-content:space-between;align-items:center}.advanced{display:none;margin-top:10px}.advanced.open{display:block}.controls{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{border:1px solid var(--line);background:#fff;border-radius:18px;padding:11px}.field label{display:block;font-size:12px;color:#65758a;font-weight:900;margin-bottom:5px}.field input{width:100%;border:0;outline:0;font-size:24px;font-weight:950;color:var(--ink);background:transparent}.miniGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}.mini{border:1px solid var(--line);border-radius:18px;background:#fff;padding:10px}.mini b{display:block;font-size:19px}.mini span{display:block;font-size:12px;color:var(--muted);font-weight:800;margin-top:3px}.chart{height:145px;display:flex;align-items:end;gap:3px;border-radius:20px;background:#0d1930;padding:10px;overflow:hidden}.bar{flex:1;min-width:2px;border-radius:6px 6px 0 0;background:#54b6ff}.bar.good{background:#2dd47a}.bar.bad{background:#ff6868}.bar.now{box-shadow:0 0 0 2px #fff,0 0 18px #fff}.note{color:var(--muted);font-size:13px;line-height:1.35}.source{font-size:12px;color:#64748b;text-align:center;margin:16px 4px}.source a{color:#0b65d8}#statusLine{font-size:13px;color:#64748b;margin-top:8px}@media(min-width:760px){main{padding-top:18px}.desktopGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:stretch}.desktopGrid .card{margin:0}.bestAndAdvanced{display:grid;grid-template-columns:1.05fr .95fr;gap:14px;align-items:start}.priceNumber{font-size:118px}.costLine{font-size:64px}}@media(max-width:420px){main{padding-left:10px;padding-right:10px}.appTop{margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px}.card{border-radius:24px;padding:14px}.controls{grid-template-columns:1fr 1fr;gap:8px}.miniGrid{grid-template-columns:1fr}.when{font-size:20px}.costText,.plain{font-size:18px}.field input{font-size:22px}}
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
      <div class="priceNow"><div id="price" class="answer priceNumber">—</div><div class="priceUnit">€/MWh</div></div>
      <p id="pricePlain" class="plain">Loading the current electricity price in Latvia…</p>
      <div id="badge" class="mood ok">Checking if this is cheap or expensive</div>
    </article>

    <article class="card costCard">
      <div class="label">2. If I run dryer now</div>
      <div id="costNow" class="answer costLine">— €</div>
      <p id="costPlain" class="costText">Loading how much a 1.5 hour dryer run would cost now…</p>
    </article>
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
          <div class="mini"><b id="minp">— €/MWh</b><span>lowest price in data</span></div>
          <div class="mini"><b id="avgp">— €/MWh</b><span>average price during dryer run now</span></div>
          <div class="mini"><b id="maxp">— €/MWh</b><span>highest price in data</span></div>
        </div>
        <p id="costBreakdown" class="note">Advanced cost split loading…</p>
        <div id="chart" class="chart" aria-label="15 minute price chart"></div>
        <div id="statusLine">Live data loading…</div>
      </div>
    </article>
  </section>

  <p class="source">Data source: <a href="https://dashboard.elering.ee/api/nps/price" target="_blank" rel="noreferrer">Elering / Nord Pool Latvia</a>. Prices are market electricity prices in 15-minute intervals. Your final bill also depends on your seller, network tariff and VAT.</p>
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
  $('price').textContent = fmtPrice(cur.price);
  $('pricePlain').innerHTML = 'Electricity market price now is <b>' + fmtPrice(cur.price) + ' €/MWh</b>. That means about <b>' + kwhPrice.toFixed(3) + ' € for 1 kWh</b> before your seller/network fees.';
  $('badge').textContent = moodText(cur.price); $('badge').className = 'mood ' + moodClass(cur.price);
  $('costNow').innerHTML = fmtMoney(run.total) + ' €';
  $('costPlain').innerHTML = 'Running a <b>' + fmtOne(opts.powerKw) + ' kW</b> dryer for <b>' + wordsForHours(opts.durationHours) + '</b> right now will cost about <b>' + fmtMoney(run.total) + ' €</b>.';
  $('minp').textContent = fmtPrice(data.min?.price) + ' €/MWh'; $('avgp').textContent = fmtPrice(run.avgPrice) + ' €/MWh'; $('maxp').textContent = fmtPrice(data.max?.price) + ' €/MWh';
  $('costBreakdown').textContent = wordsForHours(opts.durationHours) + ' at ' + fmtOne(opts.powerKw) + ' kW uses about ' + Number(run.energyKwh || 0).toFixed(2) + ' kWh. Current-run split: market electricity ' + fmtMoney(run.market) + ' €, extra fees ' + fmtMoney(run.adders) + ' €, VAT included in total.';
  $('windows').innerHTML = (data.best || []).slice(0,4).map((w,i) => '<div class="window"><div class="rank">' + (i+1) + '</div><div><div class="when">' + range(w.start,w.end) + '</div><div class="meaning">Run dryer for ' + wordsForHours(opts.durationHours) + ' then. It would cost about <b>' + fmtMoney(w.total) + ' €</b>.</div><div class="priceChip">Average electricity price: ' + fmtPrice(w.avgPrice) + ' €/MWh</div></div></div>').join('') || '<div class="note">No full upcoming dryer window is available yet.</div>';
  const rows = data.rows || []; const vals = rows.map(r=>r.price); const min = Math.min(...vals); const max = Math.max(...vals); const nowTs = cur.timestamp;
  $('chart').innerHTML = rows.map(r=>{ const h = 12 + Math.round(((r.price - min) / Math.max(1,max-min)) * 126); const cls = (r.timestamp === nowTs ? ' now' : '') + (r.price < 90 ? ' good' : r.price > 220 ? ' bad' : ''); return '<div class="bar' + cls + '" style="height:' + h + 'px" title="' + range(r.timestamp,r.timestamp+900) + ': ' + r.price + ' €/MWh"></div>'; }).join('');
  $('statusLine').textContent = 'Updated ' + new Date(data.updatedAt).toLocaleString('en-GB',{timeZone:'Europe/Riga'}) + ' Riga time. Refreshes automatically.';
}
$('advancedBtn').addEventListener('click',()=>{ const box=$('advanced'); const open=!box.classList.contains('open'); box.classList.toggle('open',open); $('advancedBtn').querySelector('span').textContent = open ? 'Hide' : 'Show'; });
['kw','duration','adders','vat'].forEach(id => $(id).addEventListener('input',()=>{ clearTimeout(window.t); window.t=setTimeout(load,180); }));
load(); setInterval(load,60000);
</script>
</body>
</html>`;
