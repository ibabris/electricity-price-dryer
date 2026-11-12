# Hosting and deployment

How Elektroprice.lv runs, from the machine that serves it to the DNS that makes it reachable, plus the exact
steps to bring the domain back after it stopped resolving.

Status as of 2026-11-12: **serving, not yet on its domain.** The site and its API answer on the hosting Mac mini;
`elektroprice.lv` does not resolve because the DNS zone died with the DigitalOcean account.

## 1. What the product actually is

Two processes share one codebase:

| Piece | File | Runs where |
| --- | --- | --- |
| Website (server-rendered HTML, 5 languages) | `worker.js` | Cloudflare Worker, or the Node adapter |
| Price API (`/api/prices`) | `worker.js` | same |
| Mobile app (Expo/React Native) | `apps/mobile/App.js` | iOS/Android via EAS |

`worker.js` is the whole site: it renders the page, calls the Nord Pool day-ahead API, applies the LV/LT tariff
(+0.16 €/kWh, 21% VAT) and answers JSON. There is no separate frontend build step and no database — every number
is derived from the upstream price feed at request time.

`server.js` is a thin `node:http` adapter that turns a request into the `Request` object the Worker expects and
writes the `Response` back. That means **the Cloudflare Worker runs unchanged on a plain Node process**, which is
what makes self-hosting possible without a rewrite.

## 2. Why the domain is down

- `elektroprice.lv`'s nameservers were `ns1/ns2/ns3.digitalocean.com`. The DigitalOcean account was disabled, so
  the **zone went with it** — not one broken record, but no records at all. `dig @1.1.1.1 NS elektroprice.lv`
  returns nothing, and so does the API host the app used to call
  (`electricity-price-dryer-lns56.ondigitalocean.app`).
- The hosting Mac mini sits on **Starlink, behind carrier NAT**: the reverse DNS for its public address is
  `customer.wrswpol1.isp.starlink.com`. No inbound port can be forwarded to it, on any IP. Direct hosting
  (A record → home IP) is therefore impossible; the machine must reach the internet through an outbound tunnel.
- Consequence for the app: with the API unreachable it used to paint `0.000 €/kWh` and a green "cheap" badge. That
  was fixed in `bc3f02e` — a missing price now renders as `—`, with badge, gauge and dryer cost suppressed.

## 3. Layout on the host

All public sites on this machine live under one root, one directory per site, one port per site:

```
/Volumes/HermesRuntime/public/
├── hosting.py                 registry: register | list | check | tunnel-config
├── sites.json                 one record per site (slug, domain, kind, port, paths)
├── sites/<slug>/{app,api,data,logs}
├── databases/<slug>/{*.sqlite,backups/}
├── tunnels/                   cloudflared.yml + tunnel credentials
├── LaunchAgents/              plists, linted before install
└── logs/
```

Elektroprice specifically:

```
public/sites/elektroprice/
├── api/        server.js worker.js core.js package.json   (copied from this repo)
├── app/        reserved for static assets
├── data/       reserved for a price cache if one is ever added
└── logs/       api.log, api.err.log
```

Rules that keep sites from interfering: a directory per site, a port assigned by the registry (Elektroprice is
**8100**), logs beside the service, and **databases never inside a web root** — a database under
`sites/<slug>/app/` is one path bug away from being downloadable.

`deploy/hosting.py` is the registry itself; `deploy/lv.elektroprice.api.plist` is the LaunchAgent;
`deploy/cloudflared.yml.example` is the tunnel ingress.

## 4. Running it

```bash
cd /Volumes/HermesRuntime/public/sites/elektroprice/api
PORT=8100 NODE_ENV=production node server.js
```

Verify before exposing anything:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8100/
curl -sS 'http://127.0.0.1:8100/api/prices?area=lv' | head -c 200
```

Measured on 2026-11-12: page `200`, API `{"ok":true,...}` with `0.20 €/kWh` and 192 quarter-hour slots.

To survive logout and reboot, install the LaunchAgent (the owner runs this, not an automation shell):

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/lv.elektroprice.api.plist
```

`RunAtLoad` and `KeepAlive` are both true, stdout goes to the site's `logs/api.log`. Node must be on `PATH` at
the path in `ProgramArguments` (`/usr/local/bin/node` on this machine — check with `which node`).

## 5. Exposing it: Cloudflare Tunnel

Preferred and only $0 option for a custom hostname. The Mac dials out; no port forwarding, no inbound firewall
rule, TLS terminates at Cloudflare's edge.

1. Create a free Cloudflare account and add `elektroprice.lv` as a zone (Free plan). Cloudflare assigns two
   nameservers.
2. At the `.lv` registrar (account holder only), replace the three `digitalocean.com` nameservers with those two.
   The zone has to be recreated from scratch — the old records are gone with DigitalOcean.
3. On the host:

   ```bash
   brew install cloudflared
   cloudflared tunnel login                       # browser, authorize the zone
   cloudflared tunnel create elektroprice
   cloudflared tunnel route dns elektroprice elektroprice.lv
   cloudflared tunnel route dns elektroprice www.elektroprice.lv
   sudo cloudflared service install
   ```

   Put the credentials JSON in `public/tunnels/` and copy `deploy/cloudflared.yml.example` to
   `public/tunnels/cloudflared.yml`, replacing the tunnel id and credentials filename.

4. Verify from outside the machine (section 7).

Until step 2 completes, `cloudflared tunnel --url http://127.0.0.1:8100` gives an anonymous HTTPS URL on a random
`*.trycloudflare.com` hostname — fine for a smoke test, useless as a product address because it changes on every
restart.

Rejected alternatives, for the record: port forwarding (impossible behind Starlink CGNAT), Tailscale Funnel (no
custom domain support), VPS relay (works, but adds a paid second machine and a second failure point).

## 6. The app

`apps/mobile/App.js` uses a single constant:

```js
const API_BASE = 'https://elektroprice.lv';
```

Changing it requires an **EAS rebuild and a bumped build number**; the signing credentials are not on the hosting
machine. Until that build ships, installed copies still call the dead DigitalOcean host and show the unavailable
state. Because the site serves HTML and `/api` on the same origin, no CORS configuration is needed — the mobile app
talks to the same host a browser does.

## 7. Verification checklist

```bash
dig +short @1.1.1.1 NS elektroprice.lv           # Cloudflare nameservers, not digitalocean.com
dig +short @1.1.1.1 A  elektroprice.lv           # Cloudflare edge addresses
curl -sS -o /dev/null -w '%{http_code}\n' https://elektroprice.lv/
curl -sS https://elektroprice.lv/api/prices?area=lv | head -c 200
python3 /Volumes/HermesRuntime/public/hosting.py check
```

`hosting.py check` reports `running` for a site whose port answers its own pages, and a *problem* only when
something unrelated holds the port.

## 8. Operating notes

- The Mac must stay awake — a sleeping Mac is a 502 behind any tunnel:
  `sudo pmset -a sleep 0 disablesleep 1`.
- Two daemons must be installed: the site's LaunchAgent and the tunnel service. Neither is a login item.
- The upstream feed is `dataportal-api.nordpoolgroup.com/api/DayAheadPrices`. It sends **no
  `Access-Control-Allow-Origin`**, so a browser cannot call it directly; every client goes through this server,
  which is what the `/api/prices` proxy is for. (A native app could call Nord Pool itself and drop the proxy, at
  the cost of duplicating the tariff and window logic.)
- Slots are **quarter-hourly** (96 per day), not hourly. Any code that assumes 60-minute slots will misprice the
  cheapest-window calculation.
