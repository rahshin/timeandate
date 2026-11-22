# Phase 5 · Native release readiness

Implement Phase 5 locally in `/Users/rahul/dev/prjs/timeandate` on `feat/timer-native-release-readiness`. Start from a local commit that includes Phase 4 foreground speech and screen wake. Use local `main` if it already includes Phase 4. Otherwise, use `feat/timer-foreground-cues` and record that dependency. Preserve existing work.

Read the **Resume point** and **First-release implementation plan** in `docs/wip/timer_app_requirements_handoff.md`, the Phase 4 results in `docs/wip/phase-prompts/progress.md`, and `docs/mobile.md`.

## Scope

- Verify the production bundle ID and application ID, app name, version and build number, minimum OS versions, assets, and signing requirements for the separate timer app. Use confirmed store identities and signing configuration. If any are missing, finish the independent work and list the exact inputs needed.
- Keep the existing Time And Date app and the separate timer app independently installable. Verify a fresh install of the new app and an upgrade of the existing app that preserves Dashboard data, presets, History, and timer settings. Verify all four Dashboard items and existing web routes.
- Prepare a dismissible mobile-web banner with dismissal remembered locally. Enable it per platform only after that app is publicly available at a verified store URL. Leave production links unset until I provide or verify them. Test with local fixture links.
- Prepare local QA artifacts and a release checklist covering signing, CI, store submission, and enabling the banner after publication. Put user-visible changes in a linked entry in `CHANGELOG.md`, with annotated screenshots for visual changes.

## Verification and handoff

Run `npm test`. Build and check the web preview, standalone Interval Timer PWA, existing Capacitor apps, and separate iOS and Android targets. Verify ordinary suspension and cold recovery separately. Check foreground speech collisions, mute, and screen wake on physical iOS and Android devices if available. Record simulator or emulator results separately. Test the banner with each platform enabled independently, with links absent, and after dismissal and reload.

Append exact commands, artifact paths, build identities, device and OS results, and remaining release gates to `docs/wip/phase-prompts/progress.md`. Work locally. Give me the GitHub, CI, release candidate, deployment, and store submission steps to run.
