# Summer Quest

Family summer-camp PWA-style app for Lucien, Lili, and Luis.

## Run Locally

Open `index.html` directly in a browser. The app works in local-only mode when `js/config.js` is missing.

For Supabase sync, copy `js/config.example.js` to `js/config.js` and fill in the project URL and anon key.

## Install On Tablets

Open the live site in the tablet browser, then use **Add to Home Screen** / **Install app**. The installed app caches the kid app shell for offline launch; admin still needs network for login and live data.

## Verify

```sh
node scripts/check.mjs
```

## Deploy

For GitHub Pages, use the included GitHub Actions workflow. Add repository secrets:

- `SQ_SUPABASE_URL`
- `SQ_SUPABASE_ANON_KEY`
- `SQ_NTFY_TOPIC` optional

Then set Pages source to **GitHub Actions**. The workflow writes `js/config.js` during deployment; the file stays uncommitted locally.
