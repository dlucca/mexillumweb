# Solar and battery dispatch — preliminary model v2

The summary replaces the fixed 60% solar target and fixed 70% direct self-use with a tariff-aware energy balance. `expediente.dispatch.js` solves a cyclic 24-hour linear program for each selected invoice. `expediente.simulation.js` compares system sizes and refines the choice; `expediente.simulation-view.js` reports the assumptions and results.

## Inputs and boundaries

- Existing invoice selection, uncertainty handling, duplicate exclusion and review status remain in effect. Calculating a provisional scenario never confirms a receipt.
- A typical day preserves base/intermediate/peak kWh when available and consistent; unreviewed uncertain bands use a disclosed uniform fallback. The adjustable schedule is a synthetic day, not the regional CFE calendar. There is no 15-minute metering, weekend/season simulation or weather service.
- Solar follows a normalized daytime sine profile and adjustable annual specific yield (initially 1,500 kWh/kWp). Available area times an adjustable usable fraction (initially 70%), divided by 5.5 m²/kWp, limits capacity. Missing area means a provisional battery-only assessment, explicitly distinct from known zero area.
- Separate solar/grid storage inventories obey cyclic SOC, shared usable capacity, AC power limits, and round-trip efficiency applied at discharge. Solar serves simultaneous load first. Only surplus solar can charge its inventory. Grid charging occurs in base only, bounded by unused import headroom under the smaller of the user's ceiling and that invoice's measured maximum demand. Missing maximum demand uses the highest synthetic hourly load as a conservative ceiling.
- The LP minimizes grid energy cost, with tiny throughput and inventory tie-breaks to avoid pointless cycling. Simultaneous charging/discharging is dominated under nonnegative prices and efficiencies ≤100%; the invariant is explicitly tested, including zero prices and lossless storage. No exports are credited.

## Sizing objective

A coarse set of solar sizes includes demand/yield ratios and the usable roof limit. Battery sizes span zero to enough usable energy for the largest invoice's typical daily load; initial battery power is bounded by capacity and load/import limits. The selection prioritizes maximum useful solar coverage, then operating savings, then smaller size. Binary refinements reduce solar, battery capacity and battery power while retaining coverage within 0.1% of annual demand and savings within 0.1% of the best evaluated (minimum currency tolerance MXN 1/year). This is a bounded search, not proof of a global optimum or an investment optimum. Capacity is continuous, not a selection of commercial equipment.

Each invoice's energy-cost difference is applied to its original subtotal while leaving other charges/adjustments fixed. Savings are capped at subtotal minus capacity and distribution. The UI flags capping. Grid losses may increase kWh purchases while lowering energy cost. No demand-charge reductions, export payments, outage value, capital costs, degradation, maintenance or financing are included.

## Prices and persistence

Missing band prices use one flat approximate invoice reference and disclose that arbitrage is not evaluated. `tariffSet: 0` keeps this provenance through auto-save. Editing a price clears the previous source and marks prices as user assumptions. The API stores only bounded assumptions, never client-computed savings. Reset returns to automatic sizing while retaining tariff inputs and other assumptions. Legacy fixed-self-use and average-price settings no longer drive dispatch.

ITAO's supplied July 2026 receipt (PDF page 25) provides one explicit reference, applied as a constant price assumption across the selected periods:

- Common energy charges: (969.48 transmission + 40.91 CENACE + 37.15 SCnMEM) / 5,383 kWh.
- Base: 1,010.29 generation / 1,139 kWh + common = 1.0815988894 MXN/kWh.
- Intermediate: 6,301.55 / 3,978 + common = 1.7787015736 MXN/kWh.
- Peak: 501.17 / 266 + common = 2.0786992677 MXN/kWh.

These are marginal energy references excluding VAT and with fixed adjustments, not reconstructed tariffs for every historical bill. They are saved only to that authorized expediente, never hard-coded as other customers' defaults.

## Verification

`test/expediente.dispatch.test.js` checks source/total conservation, cyclic inventories, shared capacity, power, no simultaneous charge/discharge, import headroom, no profitable arbitration without a loss-adjusted spread, limited-storage prioritization of peak, and zero-grid supply with ample solar. Simulation tests cover sizing, absent/zero space, manual overrides, per-invoice demand limits, provisional status, persistence and HTML escaping. Existing API and invoice tests remain applicable.

The browser solver is an exact local copy of the pinned YALPS 0.6.3 ESM distribution with its MIT license, avoiding runtime CDN requests.

References: [CFE GDMTH](https://app.cfe.mx/Aplicaciones/CCFE/Tarifas/TarifasCRENegocio/Tarifas/GranDemandaMTH.aspx), [YALPS source and API](https://github.com/IanManske/YALPS).
