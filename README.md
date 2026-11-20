# Time And Date

Time And Date includes time and date related utilities. It also contains GitHub Actions release pipeline that promotes the verified build from QA to production.

- **World Clocks** compares the date and local time in selected cities. Add, remove, or move cities, then copy a link that preserves their order. Try `/clocks?cities=seattle,london,tokyo`.
- **Timer** includes a date countdown for a target date, time, and timezone, plus a duration timer with hours, minutes, and seconds. Both modes are on `/timer` on the web. Android and iOS show **Date countdown** and **Duration timer** as separate screens. Both timers persist locally and show the active countdown in the browser tab title on the web. The duration timer supports pausing, resuming, and resetting. A browser may defer title updates while a tab is in the background.

## Run locally

Use Node 24, the version used by CI.

```sh
npm ci
npm test
npm run dev
```

Vite prints the local URL. The production build is written to `dist/` by `npm run build`.

## Release pipeline

The [CI/CD guide](docs/ci-cd.md) shows the feature and patch flows, including review, artifact verification, and rollback. See [deployment setup](docs/setup.md) for GitHub and Cloudflare configuration and [mobile builds](docs/mobile.md) for Android and iOS.

The web app runs in Cloudflare Workers Static Assets and the native apps wrap the same source with Capacitor.
