# Time And Date

Time And Date includes time and date related utilities. It also contains GitHub Actions release pipeline that promotes the verified build from QA to production.

- **World Clocks** compares the date and local time in selected cities. Add, remove, or move cities, then copy a link that preserves their order. Try `/clocks?cities=seattle,london,tokyo`.
- **Timer** counts down to a date and time in a selected timezone. It displays calendar years, months, days, hours, and minutes and puts a compact countdown in the tab title. The timer persists on the device. The browser may defer title updates while a tab is in the background.

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
