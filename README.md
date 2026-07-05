# what weather

A single static page that compares today's temperature at your location with the temperature on the same calendar day in a past year.

No frameworks, no build step — plain HTML, CSS, and JavaScript, ready to deploy straight to Netlify.

## How it works

- **Top half (white):** today's high/low at your location.
- **Bottom half (black):** high/low for the same calendar day in a past year — random by default, changeable with the arrows, the year picker, or the "random year" link.
- **Orange/blue pill on the divider:** the difference between the two highs — orange when today is warmer, blue when colder, gray when equal.

## Location

The app resolves your location with a cascade, stopping at the first that works:

1. A previously chosen city (remembered in `localStorage`), used directly.
2. Browser geolocation (GPS/Wi-Fi), which is the most accurate.
3. Approximate IP-based lookup (`ipwho.is`, then `ipapi.co` as backup) if geolocation is denied or times out. Approximate locations are marked with a `~` and can be corrected.
4. Lisbon as a last resort if everything above fails.

The location name in the top-right corner is always clickable: it opens a city search so you can pick any city worldwide. A chosen city is remembered for next time; "use my location" clears it and re-detects.

## Sharing

The "share" link opens a small menu to pick a format (**post** 1080×1350 or **story** 1080×1920). The card is drawn on a `<canvas>` to match the app's look. On mobile it's handed to the native share sheet (Web Share API); on desktop you get "save image" + "copy link".

## About page

`/about` is a static, crawlable page (works without JavaScript) with an entity description, how-it-works, data-source notes, facts, and an FAQ marked up with `FAQPage` JSON-LD — for search engines and answer engines.

## Running locally

Because the app uses `navigator.geolocation`, most browsers require a secure context (or `localhost`). The safest route is a local server:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

## Data sources

All free, no API key required, called directly from the browser:

- **Location:** `navigator.geolocation`, with IP fallback via [ipwho.is](https://ipwho.is/) / [ipapi.co](https://ipapi.co/)
- **City search:** [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- **Reverse geocoding (place name):** [Nominatim (OpenStreetMap)](https://nominatim.org/release-docs/latest/api/Reverse/)
- **Today's forecast:** [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- **Historical weather:** [Open-Meteo Archive API](https://open-meteo.com/en/docs/historical-weather-api)

Analytics are collected with Google Analytics (gtag.js).

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project**, and select the repo.
3. Build command: leave empty. Publish directory: `.` (repo root).
4. Deploy — `netlify.toml` covers the publish settings, security headers (including a Content-Security-Policy), and the `/about` rewrite.

> Note: the CSP in `netlify.toml` pins a hash of the inline Google Analytics snippet. If you edit that inline `<script>` in `index.html`, recompute the `sha256-…` hash in the `Content-Security-Policy` header or the snippet will be blocked.
