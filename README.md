# Mexillum — Landing

Static marketing landing page for **Mexillum Energy S.A. de C.V.** — battery energy storage (BESS) and energy solutions for industrial clients in Mexico, sold on a zero-CAPEX service model.

Built on the Mexillum design system (instrumentation aesthetic: dark grounds, one vivid green signal, hairline structure, monospaced measurements). Spanish (MX), C-suite audience.

## Structure

```
index.html            # the page
css/tokens.css         # design tokens (colors, type, spacing, radius, elevation, motion) — mirrored from the DS
css/components.css      # design-system component styles (mx-*)
css/landing.css         # page-specific layout, responsive rules, scroll reveals
js/main.js              # scroll reveal, sticky-bar state, form validation + confirmation, partner-logo fallback
assets/                 # hero image, logo mark, favicon
assets/logos/           # partner logos (see below)
```

## Run locally

```bash
python3 -m http.server 4173
# open http://localhost:4173/index.html
```

## Partner logos

The "Portafolio de marcas integradas" strip renders logos from `assets/logos/` desaturated to match the palette (real color on hover). Add the official files (transparent SVG preferred) named:

```
tesla.svg  schneider-electric.svg  sineng.svg  cornex.svg  solis.svg  etap.svg
```

Any missing file falls back automatically to a text chip, so the strip is never broken.

## Notes

- The contact form is client-side only; wire a real endpoint by replacing the `setTimeout` in `js/main.js`.
- Fonts load from Google Fonts (Barlow Semi Condensed, JetBrains Mono, Nunito).
