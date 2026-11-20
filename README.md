# Time And Date

Time And Date includes time and date related utilities. It also contains GitHub Actions release pipeline that promotes the verified build from QA to production.

- **World Clocks** compares the date and local time in selected cities. Sort by city name (**A–Z** or **Z–A**) or by the current UTC offset (**lowest first** or **highest first**). The shared link preserves the order. Try `/clocks?cities=seattle,london,tokyo`.
- **Dashboard** is the landing page and is also available at `/dashboard`. Use **+** in the tab bar to create a named dashboard and **×** to remove one. Select **Set as default** to choose which dashboard opens first. Use **+** beside the dashboard name to add a timer or a clock for any listed timezone. Each clock can show seconds. New dashboard timers wait for **Play**. Use **Pause** to hold a timer and **Edit** to change its configuration while stopped or paused. Saving edits returns it to **Ready**. **Reset** restores the full duration or interval routine and restarts it if it was running. Date countdowns keep their selected deadline and catch up when resumed. Dashboards and their items are saved on this device. Timers on other dashboards keep running silently. The visible dashboard announces timer changes and can also play a tone when **Timer sound** is enabled. The browser dashboard supports all three timer types, and the Capacitor dashboard supports the two countdown types.
- **Countdown Timer** targets a date, time, and timezone. **Duration Countdown** counts down a specified number of hours, minutes, and seconds. Both are on `/countdown` on the web and on separate screens in the Capacitor app.
- **Interval Timer** alternates activity and break phases until the last activity finishes. Set the activity count and phase lengths from the dashboard, at `/interval-timer-v0`, or in the standalone app at `/interval-timer-app/`. The default is three activities, with 10 minutes of activity and 5 minutes of break. Select **Include seconds** to reveal seconds fields.

## Run locally

Use Node 24, the version used by CI.

```sh
npm ci
npm test
npm run dev
```

Vite prints the local URL. The production build is written to `dist/` by `npm run build`.

## Install and use Interval Timer

Configure the intervals and select **Start** to begin. The routine finishes after the last activity. Use **Pause**, **Resume**, and **Reset** to control it. The settings, timer, and sound preference are saved in local browser storage.

Open `/interval-timer-app/` over HTTPS and use your browser’s install or Add to Home Screen option when available. After the first successful online load, the standalone app caches its files so it can reopen offline. To test this locally, run `npm run build` followed by `npm run preview`, visit the standalone URL, and reload with the browser set to offline. The service worker is registered by the production build.

Keep the app open for reliable alerts. Sound may not play while your device is locked or the app is in the background. When you return, the timer catches up from its saved deadline.

## Release pipeline

The [CI/CD guide](docs/ci-cd.md) shows the feature and patch flows, including review, artifact verification, and rollback. See [deployment setup](docs/setup.md) for GitHub and Cloudflare configuration and [mobile builds](docs/mobile.md) for Android and iOS.

The web app and standalone PWA run in Cloudflare Workers Static Assets. The existing Capacitor apps use a separate build target. The [Substack draft](docs/multi-timer-cicd-substack.md) and [portfolio case study](docs/multi-timer-cicd-portfolio.md) use Multi Timer to walk through both targets and the release pipeline.
