# what weather

A single page that compares today's temperature at your location with the temperature on the same calendar day in another year.

No frameworks, no build step — plain HTML, CSS, and JavaScript, ready to deploy straight to Netlify.

## How it works

- Top half (white): today's high/low at your location.
- Bottom half (black): high/low for the same day of the year, in a randomly chosen past year (you can change the year via the arrows, the year selector, or the "random year" link).
- Orange/blue pill on the divider: the difference between the two highs — orange when today is warmer, blue when today is colder, gray when equal.

## Running locally

Because the app uses `navigator.geolocation`, most browsers require a secure context (or `localhost`) for it to work. Opening `index.html` directly usually still works on `localhost`-equivalent file access in some browsers, but the safest route is a local server:

```bash
python3 -m http.server
```

Then open `http://localhost:8000`.

If geolocation is denied or unavailable, the app falls back to Lisbon, Portugal.

## Data sources

All free, no API key required, called directly from the browser:

- **Geolocation:** `navigator.geolocation`
- **Reverse geocoding (place name):** [Nominatim (OpenStreetMap)](https://nominatim.org/release-docs/latest/api/Reverse/)
- **Today's forecast:** [Open-Meteo Forecast API](https://open-meteo.com/en/docs)
- **Historical weather:** [Open-Meteo Archive API](https://open-meteo.com/en/docs/historical-weather-api)

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project**, and select the repo.
3. Build command: leave empty. Publish directory: `.` (repo root).
4. Deploy — `netlify.toml` already covers headers and publish settings.
