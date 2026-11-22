# Agreed design and acceptance plan

## Design objective

Let someone start timing without organizing the app first, keep the current phase and next action visible during a run, and make recent outcomes easy to check. Retain four timing jobs in the Dashboard picker.

| User goal | Picker item |
| --- | --- |
| Time a duration once | Countdown Timer |
| Repeat activity and rest | Interval Timer |
| Track time until a specific date and time | Date Countdown |
| See the current time somewhere else | World Clock |

The name and preset are optional. Keep Prepare and final-seconds options in Advanced as applicable. Make it clear which alert options work in the current release and retain saved settings. The confirmation step for adding a card leaves the card ready. The next focus target is its Start control or its equivalent for that card type.

## Navigation and layout

| Surface | Design |
| --- | --- |
| Native app | Two clear destinations, **Dashboard** and **History**. Open on the saved default dashboard. Put the board switcher and active board controls inside Dashboard. |
| Narrow web | Use the same compact Dashboard layout, with labeled board selection and a stable path to History. Keep existing web tools discoverable through global navigation. |
| Wide web | Keep direct board links where they fit, with the same accessible switcher available for longer board lists. Preserve board URLs, default preference, and browser Back behavior. |
| History | Label the destination independently from board tabs. Do not put board creation, removal, or default settings inside History. A return link can remember the board the user left. The selected board does not scope the list. |

Give **Add timer or clock** the primary visual treatment, with one obvious entry when the board is empty. Keep the current board easy to identify even if its full name wraps. Move add board, rename, set default, board sound, and delete into labeled board options or board management. Preserve one-click selection for visible desktop board links. Preserve the existing web tools and direct URLs, including the standalone Interval Timer PWA, while making the Dashboard picker the ordinary path for new Dashboard timers.

## Running and paused cards

- Place the card name, remaining time, and phase close together. Visually separate setup details from the live reading.
- Make Start, Pause, or Resume the primary action for the current state. Keep Stop and applicable Skip, Skip rest, and Restart visible with clear labels. Allow orderly wrapping at narrow widths without reordering the primary action or shrinking touch targets.
- Keep eligible Edit and Mute easy to reach, with accessible names and a visible mute state. Put Remove in named card options. Keep the interval pen available before a run and after it ends.
- When another board has unfinished Dashboard Countdown or Interval runs, prototype a passive cue with the counts of running and paused work. A single result goes directly to its owning board and card. Multiple results get a short list with timer and board names. Use existing card controls after jumping.
- Report **Restored paused** near the affected timer's current position when a formerly running session was recovered on cold launch. Store the reason with the session, clear it on Resume, Stop, or a new run, and preserve ordinary Paused for intentional holds. Visibility of recovered timers and ordinary pause status must survive navigation.
- Guard normal deletion of cards and boards that contain unfinished runs. Show what blocks deletion and offer a path to resolve it. Recheck inside the same storage transaction as deletion. Removing an inactive card preserves its ended history. Evaluate explicit discard only if users regularly need it.
- Keep the currently approved foreground alert behavior. Separate visible timing state from what can be heard when the app is backgrounded or locked. Show a clear persistence message if writes fail and the app continues in memory.

## History

Keep the latest **30 completed or stopped Dashboard Countdown and Interval Timer runs** across dashboards in the current app installation or browser profile. A concise description such as “Recent Countdown and Interval Timer runs from all dashboards in this app” sets expectations. History is especially helpful for intervals, where the user may care whether the routine finished or a repetition was skipped. Leave it available one navigation action away from Dashboard.

Use newest-first rows with this order.

1. Local end date and time.
2. Timer name as it was recorded for that run.
3. Dashboard name as secondary context. Show its current name when available and retain a name if the dashboard is deleted. In a future delete implementation, save the latest name for older rows before removing a renamed board. A deleted board has no navigation link.
4. Outcome and a short interval result if applicable. Additional per-run statistics can be disclosed later if they answer a tested need.

Keep case-insensitive name search. A query for two same-named timers should return both. Show a useful empty or no-match state. Avoid grouping histories across timer renames until there is a stable timer identity in the ledger. Keep charts, streaks, board filters, and a global command tray out of the first design. Date Countdown, World Clock, and separate web utility data keep their existing scope.

## Delivery and acceptance

| Order | Deliverable | Verification before proceeding |
| --- | --- | --- |
| 1 | Trust and safety. Recovery provenance, clear History scope, persistence feedback, and guarded deletion. | Use separate tests for intentional Pause, ordinary suspension, native force quit and restart, and an additional browser tab. Check that closed time earns no credit and that two tabs stopping one run create one history row. Verify that starting a timer while another tab has an open deletion confirmation blocks deletion. |
| 2 | Hierarchy and navigation. Labeled Add, dashboard options, narrow switcher and wide board links, separate History, clearer cards. | Start a five-minute timer from a fresh install without creating a dashboard or preset. On Add, the new card and Start are in view and keyboard focus is useful. Cancel and Back preserve the board. Rename the default and reopen its existing bookmark. Search two same-name runs and identify their boards. |
| 3 | Cross-board continuity. Prototype the conditional off-board cue and compare users' ability to find a run. | Start two sessions on different boards, switch boards, and return to the intended card without altering either run. Verify the cue is absent with no matching sessions. Observe whether users actually need access to off-board runs from standalone web tools. |

Use the same engine, commands, and repository on web and Capacitor. Retain existing deadline behavior, including Date Countdown's absolute target. Any new navigation or projection should reuse state without adding a second scheduler or changing the visible-board alert policy.

Exercise 320 px and wide desktop layouts, long board and timer names, enlarged text, keyboard-only navigation, VoiceOver and TalkBack. Use 44 CSS pixels as the review target for touch controls. Verify accessible action names, close-and-return focus for options, sensible focus when controls disappear, and one useful announcement for state changes without speaking each tick. Verify lifecycle and alerts on physical iOS and Android devices separately from simulators.

These are proposed acceptance checks. The panel did not measure completion rates or conduct a usability or assistive-technology study. The remaining product questions are whether first-time users need Start now, whether users need an explicit history-free discard, and whether the narrower off-board cue solves run discovery before extending it.

## Future timezone enhancements

- Add a shared searchable picker for Dashboard Date Countdown, Dashboard World Clock, and standalone Date Countdown. Users can search by city or timezone and save a named timezone ID. [Timezone picker specification](../timezone-picker-spec.md)
- Reconcile pending and running Date Countdown deadlines when timezone rules change, preserving the selected local date, time, and timezone. [Date Countdown release plan](release-plan.md#future-feature--date-countdown-timezone-rule-updates)
