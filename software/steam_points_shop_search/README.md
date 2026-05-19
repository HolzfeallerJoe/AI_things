# Steam Points Shop Search

Angular app for searching Steam Points Shop rewards by game, item text, class, appid, defid, and point cost. On launch it shows the 10 most sold rewards from Steam's global rewards query.

## Setup

```bash
npm install
npm start
```

`npm start` runs the Angular dev server with `proxy.conf.json`. The proxy is required because the app calls Steam Web API and Steam Community endpoints from the browser.

## Scripts

```bash
npm run build
npm run test
npm run check
```

`npm run check` builds the production bundle and runs the unit tests.

## Notes

- Steam endpoint responses can change without notice.
- The global index load queries Steam's rewards endpoint directly without a curated local game list.
- Global index loading is capped at 1000 rewards per request to keep the browser and Steam API usage reasonable.
- Some Steam CDN assets are cross-origin; raw asset links open in a new tab and may not download directly in every browser.
