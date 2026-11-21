# Dashboard design phase 1 · Run safety and recovery

- A timer interrupted by closing the app displays **Restored paused** when it reopens at its saved position.
- Removing a timer or dashboard with an unfinished Countdown or Interval run is blocked. Stop the run to record its outcome, then remove the card if desired. Past runs stay in History.
- History explains which runs it includes. It shows completed and stopped Countdown and Interval Timer runs across your dashboards in this app.
- The Dashboard reports when local storage is unavailable and changes may be lost on reload or close.

## Annotated screenshots

These screenshots use synthetic timers in a 375 px Chrome production preview.

| Preview | What changed |
| --- | --- |
| [Restored run](restored-paused.png) | Below the large remaining-time value, **Restored paused** identifies recovery. Resume remains the next action. |
| [Blocked removal](unfinished-removal.png) | The centered dialog identifies the unfinished timer and explains how to resolve it. The card remains on the dashboard. |
| [History scope](history-scope.png) | The text between the History title and name filter describes the list's cross-dashboard scope and included timer types. |
| [Storage notice](storage-notice.png) | The accented notice below the dashboard heading reports that changes may be lost when local saving fails. |
