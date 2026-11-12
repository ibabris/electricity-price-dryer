# Elektroprice.lv

**Product:** Elektroprice.lv — live Nord Pool day-ahead electricity prices for Latvia, Lithuania, Estonia and Finland.
**Repository alias:** this project is also referenced as `elektroprice-lv`; the repository keeps its historical
name `electricity-price-dryer` so existing links and deployments keep working.
**App Store display name:** `Elektoprice.lv` (spelling drift against the domain `elektroprice.lv` — to be unified).

---

Cloudflare Worker website that shows electricity exchange prices, estimates a dryer run, and recommends cheapest upcoming drying windows.

Live data currently comes from Elering's public Nord Pool endpoint, which exposes Latvia, Lithuania, Estonia and Finland. The app also carries the wider Nord Pool country/bidding-zone setup (Norway NO1-NO5, Sweden SE1-SE4, Denmark DK1-DK2, Germany/Luxembourg, Netherlands, Belgium, Austria, France, Poland, Great Britain and Ireland) so the UI can show the real market structure without inventing live prices for zones that are not in the current source.

Default example: 2.5 kW dryer × 1.5 hours = 3.75 kWh. Inputs allow tariff adders and VAT.
