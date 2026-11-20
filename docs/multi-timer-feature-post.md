# Adding a standalone mobile timer to Time And Date

Time And Date already had World Clocks and two kinds of countdowns when I added Multi Timer. I wanted something I could start once and leave running through a simple routine. It alternates ten minutes of activity with five minutes of break, and it counts how many cycles have started. On the website, it belongs alongside the existing tools. On my phone, I wanted to open it directly from the home screen.

## One timer, two ways to open it

On the website, the timer opens at `/interval-timer-v0`, with the same navigation as the other Time And Date tools. The second address, `/interval-timer-app/`, has an entry page and an app icon of its own. That page can be installed as a progressive web app where the browser supports it. Both addresses mount the same timer view and use the same code for the routine, sound, and local storage. I kept Time And Date’s existing Capacitor build for its native apps. Multi Timer’s standalone installation comes from the web build.

The extra entry page changed what the build needed to produce. Vite writes both pages into the same output directory. A post-build script reads Vite’s manifest to find the standalone page’s generated JavaScript and CSS and builds the service worker’s cache list. The service worker is scoped to `/interval-timer-app/` and caches the files it needs after an online visit. Cloudflare Workers Static Assets serves both entries from the same release bundle.

## What happens when the phone goes to sleep

The state of a running phase includes a deadline. The display updates several times a second, and each update derives the remaining time from that deadline. If I start at 9:00 and come back at 9:17, the timer should show Cycle 2, Activity, with roughly eight minutes left. The first Activity and Break have already passed. On return, the app catches up in one calculation and displays a status message for the current phase.

The deadline also lets the timer recover after a reload. A paused timer saves the remaining milliseconds instead, so it can stay paused for an afternoon without losing time. I used a fake clock in the tests to cover phase boundaries, paused and running states, and recovery after time has elapsed. I checked the standalone page in Chrome at 320 pixels wide and reloaded it offline after the service worker had cached its files. Browsers may suspend the page or audio while the phone is locked, so I describe the sound as an alert for when the app is open.

## Taking the feature through CI and QA

I started this on `feat/multi-timer`. The workflow already runs on pull requests and on pushes to `main` and release branches. When the PR is opened, CI lints the GitHub Actions configuration, installs from the lockfile, runs the tests, and builds both entries. After merging, I wait for the push run on the exact commit I want to release.

I can then run **Release** with operation **candidate**. With the inputs blank, the workflow pins the current `main` commit and chooses the next release candidate number for the version in that commit’s `package.json`. If that version has shipped, I bump it first. The workflow also accepts a full source SHA and an explicit unused RC tag. The candidate job builds once, records the commit SHA and bundle checksum, and deploys to Cloudflare QA.

I extended the deployment smoke test to check the integrated timer route, the standalone page, its manifest, and its service worker whenever the selected bundle includes the new entry. A rollback to an older release still checks the routes that bundle shipped with. I ran those checks on the stamped build with Wrangler’s local preview. In QA, they check that the expected bundle and URLs are live. On QA I’d also start and pause the timer, reload and resume it, observe an Activity-to-Break transition, and open the installed app from a phone’s home screen after going offline.

Once QA passes, I can select **promote** with the candidate tag and review the GitHub production deployment. The workflow verifies and deploys the same bundle to production and records the stable release. That means the mobile entry I test on QA ships with the same files I tested, including the worker and cache list.

For workflow inputs and rollback steps, see the [Time And Date release guide](ci-cd.md).
