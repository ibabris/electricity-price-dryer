import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const app = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));

const slogans = [
  'Live electricity prices and cheaper usage times.',
  'Dzīvās elektrības cenas un lētākie lietošanas laiki.',
  'Gyvos elektros kainos ir pigesnis vartojimo laikas.',
  'Reaalajas elektrihinnad ja odavamad kasutusajad.',
  'Живые цены на электричество и более дешёвые часы.'
];
for (const slogan of slogans) assert.ok(app.includes(slogan), `missing slogan ${slogan}`);
for (const code of ['lv','lt','ee','fi','no1','se4','dk2','nl','be','at','fr','pl']) {
  const res = await fetch(`https://electricity-price-dryer-lns56.ondigitalocean.app/api/prices?quick=1&area=${code}`);
  const json = await res.json();
  assert.equal(json.ok, true, `live API ${code}`);
  assert.ok(json.current?.price > 0, `current price ${code}`);
}
assert.equal(appJson.expo.name, 'Elektoprice.lv');
assert.equal(appJson.expo.ios.bundleIdentifier, 'com.ibabris.elektoprice');
assert.equal(appJson.expo.android.package, 'com.ibabris.elektoprice');
assert.equal(appJson.expo.extra.apiBaseUrl, 'https://electricity-price-dryer-lns56.ondigitalocean.app');
assert.ok(app.includes('Modal'));
assert.ok(app.includes('ScrollView'));
assert.ok(app.includes('setTimeout(() => load(true), 80)'));
assert.ok(app.includes('Nord Pool day-ahead market'));
console.log(JSON.stringify({ ok: true, slogans: slogans.length, checkedMarkets: 12, bundle: appJson.expo.ios.bundleIdentifier }, null, 2));
