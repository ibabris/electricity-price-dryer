# Migration record: DigitalOcean → this Mac mini

Written 2026-11-12, after the migration was verified end to end. Every number in here was measured, not assumed.

## 1. State before the migration

**The website and the app depended on different hosts, and only one of them was in the repository.**

| Piece | Where it ran | Evidence |
| --- | --- | --- |
| Web page + `/api/prices` | Cloudflare Worker (`worker.js`), deployed outside the repo | `wrangler.toml` present, but the live route/deployment was not reachable for inspection |
| Mobile app | Built with `https://electricity-price-dryer-lns56.ondigitalocean.app` compiled in | `App.js:5` at commit `bc3f02e^` |
| DNS | `ns1/ns2/ns3.digitalocean.com` | `dig +short NS`, RDAP lookup |
| iOS signing | Distribution certificate + provisioning profile on EAS servers; ASC API key path `/home/hermes/.hermes/apple/AuthKey_8KGTRRS9N2.p8` | `eas.json`, and the path does not exist on this machine |
| Local hosting | none | no LaunchAgent, no reverse proxy, no tunnel for this project |

**What broke:** the DigitalOcean account was disabled. That removed both the app-platform hostname *and* the DNS
zone in one step. Measured on 2026-11-12:

```
dig +short @1.1.1.1 NS elektroprice.lv     → (empty)
dig +short @1.1.1.1 A  elektroprice.lv     → (empty)
whois                                      → ns1/ns2/ns3.digitalocean.com
```

With no authoritative nameservers there were no records anywhere, so every hostname under the domain failed at
once. The app, meanwhile, showed its own symptom: a red "could not load the price" banner above `0.000 €/kWh` and a
green *cheap* badge, because a failed fetch was rendered as data.

**Why direct hosting was impossible:** the public address of the house resolves to
`customer.wrswpol1.isp.starlink.com` — Starlink carrier NAT. There is no inbound port to forward, on any IP, so
`A record → home IP` was never an option and no DNS provider could have made it work.

## 2. What was built

### 2.1 Hosting layout on the Mac mini

One root, one directory per site, one port per site, databases outside every web root:

```
/Volumes/HermesRuntime/public/
├── hosting.py                  registry: register | list | check | tunnel-config
├── sites.json                  elektroprice → domain, port 8100, paths
├── sites/elektroprice/{app,api,data,logs}
├── databases/                  per-site databases + backups (rules in databases/README.md)
├── tunnels/cloudflared.yml     ingress for this machine's sites
├── LaunchAgents/*.plist        linted before install
├── logs/
└── docs/RUNBOOK-elektroprice.md
```

The service is the repository's own code, unchanged: `worker.js` (page + API) run by `server.js`, a `node:http`
adapter that feeds the Worker's `fetch` handler. No rewrite, no fork.

### 2.2 Runtime, verified

```
PORT=8100 node server.js          # LaunchAgent lv.elektroprice.api
curl http://127.0.0.1:8100/       → 200
curl /api/prices?area=lv&quick=1  → {"ok":true,…} 0.15–0.20 €/kWh, 192 quarter-hour slots
```

- LaunchAgent: `RunAtLoad` + `KeepAlive`, logs to `sites/elektroprice/logs/api.log`.
- Confirmed under launchd: `ps -o pid,ppid` shows the node process with **PPID 1**, and
  `launchctl print gui/506/lv.elektroprice.api` reports `state = running`.
- A second `launchctl bootstrap` returns `Bootstrap failed: 5: Input/output error` — that error means the label is
  already loaded, not that the job failed.

### 2.3 DNS — the change that brought the domain back

The zone had to be **recreated**, not edited: the old one died with the DigitalOcean account.

| Before | After |
| --- | --- |
| `ns1/ns2/ns3.digitalocean.com`, zone gone, domain dead | `chance.ns.cloudflare.com`, `savanna.ns.cloudflare.com`, zone active in a new Cloudflare account |

Sequence actually performed:

1. Cloudflare → *Connect a domain* → `elektroprice.lv` → Free plan. Record import found nothing (expected).
2. The wizard refuses to continue with zero records, so one placeholder was added — `A @ 192.0.2.1` (TEST-NET-1,
   unroutable), DNS-only.
3. Nameservers replaced at the `.lv` registrar with the two Cloudflare ones. Propagation was minutes; both
   1.1.1.1 and 8.8.8.8 answered, and the SOA was served by Cloudflare, confirming the zone was active rather than
   pending.
4. Placeholder deleted, replaced by the tunnel records below.

### 2.4 Tunnel and edge configuration

The Mac dials out; nothing is exposed inbound, no router change, TLS at the edge.

| Item | Value |
| --- | --- |
| Tunnel | `elektroprice`, id `dafee593-8237-4116-9aa0-d18f68b4c613` |
| Connector | `com.cloudflare.cloudflared` system daemon, token in `/Library/Application Support/com.cloudflare.cloudflared/token`, 3–4 QUIC connections to Warsaw edges |
| DNS | `CNAME @` and `CNAME www` → `dafee593-8237-4116-9aa0-d18f68b4c613.cfargotunnel.com`, proxied |
| Ingress | `elektroprice.lv` → `http://localhost:8100`, `www.elektroprice.lv` → same, catch-all `http_status:404` |
| TLS | Cloudflare Universal SSL, Let's Encrypt `CN=elektroprice.lv`, valid to 2027-02-10, SSL mode **Full** |
| Redirect | `Always Use HTTPS` on → `http://` answers `301` to `https://` |

Verified from outside the machine: apex `200`, `www` `200`, `/api/prices?area=lv` → `ok:true` with real prices.

### 2.5 Code changes shipped with the migration

| Commit | Change |
| --- | --- |
| `bc3f02e` | `API_BASE` → `https://elektroprice.lv`; a failed fetch renders `—` instead of `0.000 €/kWh` with a "cheap" badge; badge, gauge and dryer cost suppressed without data |
| `76ec416` | `app.json` and the in-repo QA probe (`scripts/qa.js`) moved off the DigitalOcean host |
| `1788877` | Silent 60 s refresh on the site (`patchHTML` only rewrites changed blocks → no flicker, no re-localisation on background ticks, no error banner over good data); app refreshes on foreground; `GET /api/config` added so the API host is resolved at runtime instead of compiled |
| `aaf7ab8` | Product name aligned to `ElektroPrice` in page, app and config (bundle id deliberately unchanged) |
| `20329f1` | Marketing version 1.0.0 → 1.0.1 (Apple had closed the 1.0.0 train) |
| `53733f8`, `18f42aa` | Live configuration and release log documented |

### 2.6 App Store Connect / EAS

| Before | After |
| --- | --- |
| Build 6 (1.0.0) live, hardcoded DigitalOcean URL | Build 10 (1.0.1) submitted for review, talks to `elektroprice.lv` |
| ASC key `8KGTRRS9N2`, `.p8` on a machine that no longer exists | Team key `VAR9R25BZZ`, `.p8` at `~/.appstore/`, issuer `69a6de73-948a-47e3-e053-5b8c7c11a4d1` |
| Listing marketing URL `https://elektoprice.lv` (dead, misspelt) | `https://elektroprice.lv` |
| Display name `Elektoprice.lv` | `ElektroPrice`, matching the App Store listing |

Distribution certificate and provisioning profile were already valid on EAS (expire 2027-06-06), so no new
certificate was needed — only the submission key. Build 8 was refused by Apple with `ITMS-90062` because the
marketing version had not changed while the 1.0.0 train was closed; `autoIncrement` moves only the build number.

## 3. Current state (single page summary)

```
elektroprice.lv ──► Cloudflare edge (proxied, Universal SSL, Always HTTPS)
                        └─► tunnel dafee593… ──► localhost:8100 on Ivo-Mac-mini
                                                    └─ node server.js (LaunchAgent lv.elektroprice.api)
                                                        └─ worker.js ──► dataportal-api.nordpoolgroup.com
```

- Site and API: same origin, same process. No CORS configuration needed; Nord Pool sends no
  `Access-Control-Allow-Origin`, which is why the browser cannot call it directly and this proxy exists.
- Databases: none yet. If one is added it lives in `sites/elektroprice/data/` or `databases/elektroprice/`, never
  inside `app/`.
- Secrets on disk, all mode 600: `~/.cloudflare/key-file.txt` (account key), `~/.expo/token`, `~/.appstore/*.p8`.
  None of them are in the repository.

## 4. Operating notes and known weaknesses

- **Sleep kills the site.** `sudo pmset -a sleep 0 disablesleep 1` was applied. A sleeping Mac is a 502 behind any
  tunnel.
- **QUIC is flaky on this link.** The connector logs `control stream error: context deadline exceeded` and
  re-registers; traffic recovers by itself. If resets become frequent, pin `--protocol http2`.
- **The host's own resolver lags after a DNS change.** `curl` on the Mac failed to resolve `elektroprice.lv` while
  public resolvers answered correctly; `dscacheutil -flushcache && sudo killall -HUP mDNSResponder` clears it. The
  site was never down.
- **Node 18 is below what RN 0.86 declares.** EAS builds on Node 22 in Expo's cloud, so releases are fine; local
  bundling is not guaranteed.
- **Old installs still point at DigitalOcean** until 1.0.1 is approved and installed. Nothing can patch an
  installed binary remotely — that was the whole reason the marketing version had to change.
- **No monitoring.** Nothing alerts if the tunnel or the LaunchAgent dies; `hosting.py check` answers that question
  on demand only.

## 5. How to undo

1. `launchctl bootout gui/$(id -u)/lv.elektroprice.api` — stop and unregister the site.
2. `sudo cloudflared service uninstall` — remove the tunnel daemon.
3. Cloudflare: delete the `@` and `www` CNAMEs; the domain then resolves to nothing, as it did before.
4. Registrar: nameservers back to any working DNS host (not DigitalOcean — that account is gone).

Nothing here touches other sites on the machine; each has its own directory and port in `hosting.py`.
