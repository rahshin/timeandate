# Time And Date design review · November 21, 2026

The panel recommends a **timer-first Dashboard**, a clear route back to off-board runs, and a separate **History** destination. The Dashboard should let people start work, see what is happening, and recover their place. History should answer what ended and where it ran.

- [Panel debate](panel-debate.md) records the four opening positions, rebuttals, and compromises.
- [Agreed design and acceptance plan](agreed-design.md) describes the web and mobile navigation, run controls, History, safeguards, rollout, and tests.

## Evidence reviewed

| Evidence | Observation |
| --- | --- |
| [Fresh mobile web at 375 px](evidence/empty-mobile-web.png) | The global header, board rail, two plus buttons, and board settings all appear before the first action is explained. |
| [Paused interval on mobile web](evidence/mobile-active.png) | The board rail clips the next board. The four session controls wrap, and their similar weight makes Resume compete with Stop, Skip, and Restart. |
| [Desktop Dashboard at 1366 px](evidence/desktop-dashboard.png) | The wider rail gives direct board access. Repeated remove actions and the large heading still compete with the work area. |
| [Mobile History with two Warm-ups](evidence/mobile-history.png) | Dashboard names distinguish identical timer names. Board management remains visible above an all-dashboard view, which suggests a scope the list does not use. |
| [iOS Simulator during Phase 3 review](evidence/ios-simulator-phase3.png) | The native Dashboard has a shorter header. Long board names still wrap and the two add controls are still visually similar. |

Chrome captures use a production preview from branch `feat/timer-local-data-recovery` at `0c80d12` and synthetic timers. The earlier iOS image is a Phase 3 development build with synthetic QA data. Android was reviewed through the shared Capacitor UI code and existing Phase 3 emulator results. The work is an expert inspection, with no new Android interaction run, physical-device study, or assistive-technology test. Earlier verification and its limits are in the [progress handoff](../phase-prompts/progress.md).

This review documents design decisions. It makes no application changes.

The [release plan](release-plan.md) breaks the design into independent releases.
