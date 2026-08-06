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

## Contact form (Resend)

The form (`#contacto`) POSTs to a Vercel serverless function at `api/lead.js`,
which validates the payload and emails the lead via [Resend](https://resend.com).
The client shows a calm confirmation on success and an inline error on failure;
a hidden honeypot field (`website`) drops bots.

To make it deliver mail:

1. Create a Resend account and **verify the `mexillum.com` domain** (add the
   SPF/DKIM DNS records Resend gives you).
2. In Vercel → project → **Settings → Environment Variables**, add:
   - `RESEND_API_KEY` — your Resend API key (**required**).
   - `LEAD_TO` — where leads are sent (optional, default `info@mexillum.com`).
   - `LEAD_FROM` — verified sender (optional, default
     `Mexillum Web <notificaciones@mexillum.com>`; must be on the verified domain).
3. Redeploy. Replies go to the lead's address (`reply_to`).

Local note: `python3 -m http.server` does **not** run `/api` functions, so the
form shows the error state locally. Test the real send on a Vercel deployment
(or with `vercel dev` and a `.env` holding `RESEND_API_KEY`).

## Notes

- Fonts load from Google Fonts (Barlow Semi Condensed, JetBrains Mono, Nunito).
