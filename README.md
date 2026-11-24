# Time And Date

Time And Date includes time and date related utilities. The GitHub Actions web release pipeline promotes a verified build from QA to production.

- **World Clocks** compares the date and local time in selected cities. Sort by city name (**A–Z** or **Z–A**) or by the current UTC offset (**lowest first** or **highest first**). The shared link preserves the order. Try `/clocks?cities=seattle,london,tokyo`.
- **Dashboard** is the landing page and is also available at `/dashboard`. Use **+** in the tab bar to create a named dashboard and **×** to remove one. Select **Set as default** to choose which dashboard opens first. Use **+** beside the dashboard name to add a timer or a clock for any listed timezone. Each clock can show seconds. New dashboard timers open ready to start. Use **Pause** to hold a timer and **Edit** to change its configuration while stopped or paused. Saving edits returns it to **Ready**. Countdown Timer **Reset** restores the full duration and restarts it if it was running. Date countdowns keep their selected deadline and catch up when resumed. Dashboards and their items are saved on this device. Timers on other dashboards keep running silently. The visible dashboard announces timer changes and can also play a tone when **Timer sound** is enabled. Use a timer’s speaker button to silence its dashboard announcements and tones. The web and Capacitor dashboards offer Date Countdown, Countdown Timer, Interval Timer, and World Clock.
- **Date Countdown** targets a date, time, and timezone. **Countdown Timer** counts down a duration in hours, minutes, and seconds. Standalone countdown screens are also available on the web. See [how to update the bundled date presets and timezones](#update-bundled-date-presets-and-timezones).
- **Interval Timer** repeats a timed activity with optional rest between repetitions. The standalone web PWA is available at `/interval-timer-app/`. Old `/interval-timer-v0` bookmarks open the PWA.

## Run locally

Use Node 24, the version used by CI.

```sh
npm ci
npm test
npm run dev
```

Vite prints the local URL. The production build is written to `dist/` by `npm run build`.

The dashboard browser tests run against the built app:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

To test the web bundle used by Android and iOS, run `npm run mobile:build` followed by `TIMEANDATE_TEST_MODE=native npm run test:e2e`.

## Build and run mobile apps

Both mobile apps open Dashboard and include its four item types. The [mobile build guide](docs/mobile.md) covers running iOS and Android locally, building QA artifacts, and building signed releases for TestFlight, the App Store, and Google Play.

## Install and use Interval Timer

Configure the intervals and select **Start** to begin. The routine finishes after the last activity. Use **Pause**, **Resume**, and **Reset** to control it. The settings, timer, and sound preference are saved in local browser storage.

Open `/interval-timer-app/` over HTTPS and use your browser’s install or Add to Home Screen option when available. After the first successful online load, the standalone app caches its files so it can reopen offline. To test this locally, run `npm run build` followed by `npm run preview`, visit the standalone URL, and reload with the browser set to offline. The service worker is registered by the production build.

Keep the app open for reliable alerts. Sound may not play while your device is locked or the app is in the background. When you return, the timer catches up from its saved deadline.

## Update bundled date presets and timezones

Web and mobile builds use the JSON snapshots in the repository. Refresh them when the underlying data changes.

- **Date presets.** Edit the holiday allowlists, reviewed dates, or handpicked events in [the preset source](scripts/data/date-presets.json). Run `node scripts/build-date-presets.mjs` from the repository root after `npm ci`. Review the diff in `src/date-presets.json`. Recheck dated holidays annually and update handpicked events as their dates are confirmed.
- **Timezones.** During major-release preparation or after changing the city filter, download `cities15000.zip`, `countryInfo.txt`, and `admin1CodesASCII.txt` from the [GeoNames export directory](https://download.geonames.org/export/dump/). Run `python3 scripts/build-timezone-catalog.py /path/to/downloads YYYY-MM-DD` using the download date. Review the city count, compressed size, and representative searches. See the [GeoNames attribution](docs/third-party-notices.md).

In [Actions → Refresh date and timezone catalogs](https://github.com/rahshin/timeandate/actions/workflows/refresh-date-and-timezone-catalogs.yml), select the default workflow branch and choose **Run workflow**. Select cities, dates, or both. For maintenance, enter the existing `release/<major>.<minor>` branch as the target. That branch must already contain the catalog and generator. If a selected catalog changes, the workflow runs tests and builds, commits the update on a new branch, and requests your review on a PR targeting the selected branch. To enforce approval before merging, require a PR approval in the branch ruleset.

In **Actions → Release**, select **Refresh catalogs** when creating a candidate from `main` with a blank `source_sha`. If a PR opens, review and merge it, wait for push CI, then start a new candidate run. If the refresh finds no changes, the candidate proceeds in the same run. For a maintenance release, use the separate refresh workflow and enter the tested SHA from the release branch when creating the next candidate.

Other workflows can call `.github/workflows/refresh-date-and-timezone-catalogs.yml` with the same catalog selections and target branch. A future quarterly workflow can use that entry point to propose updates for review.

The repository must allow Actions to create pull requests under **Settings → Actions → General → Workflow permissions**. If GitHub prompts for approval to start PR checks on the bot's PR, approve the workflow run from the PR page.

## Release pipeline

The [CI/CD guide](docs/ci-cd.md) shows the feature and patch flows, including review, artifact verification, and rollback. See [deployment setup](docs/setup.md) for GitHub and Cloudflare configuration.

The web app and standalone PWA run in Cloudflare Workers Static Assets. The existing Capacitor apps use a separate build target. The [Substack draft](docs/multi-timer-cicd-substack.md) and [portfolio case study](docs/multi-timer-cicd-portfolio.md) use Multi Timer to walk through both targets and the release pipeline.
