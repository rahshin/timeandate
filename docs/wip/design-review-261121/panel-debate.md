# Panel debate

This record captures the substantive exchanges in order. Product Design, Senior Software Architecture, and UX were independent reviewers. The Senior UI Developer inspected the live preview, challenged proposals, and moderated the decision.

## Opening positions

| Reviewer | Critique | Proposal |
| --- | --- | --- |
| Product Design | The empty dashboard asks people to interpret two plus buttons, board administration, and a History entry before timing anything. Labels make a bigger difference here than another feature. | Make **Add timer or clock** the clear action. Disclose board management. Keep History separate and bounded. Use a passive off-board cue to help people find activity. |
| Senior Software Architecture | The shared session store already supports cross-dashboard History and recovery, but its scope differs from the standalone web tools. A paused display does not explain a cold recovery. The store can fall back to memory without telling the user. Removal can discard a run before it enters History. | Keep one session engine and repository. Explain recovered state and persistence failures. Clarify History eligibility, define destructive behavior, and keep existing URLs and stores. Initially proposed an active-runs shortcut on every route. |
| UX | First run asks the user to choose a type, configure, add, find the card, and start. The top rail mixes board navigation, management, and app-wide History. Automatic grid replacement risks losing focus. | Use task-led type descriptions, a visible path to the newly created timer, and distinct recovery feedback. Initially proposed an explicit **Start now** alongside **Add ready**. |
| Senior UI Developer | Chrome at 375 px shows partial board tabs and a paused card with wrapped, equally weighted actions. At 1366 px, direct board links work spatially, but tab-level delete buttons compete with selection. The iOS reference shows a long heading consuming vertical space even with a smaller native masthead. | Separate destination navigation from board selection. Use a labeled switcher on narrow screens and direct board links on wide web. Keep the run controls labeled and stable, and let the timer value and phase lead the card. |

## Rebuttal round

### Starting a first timer

UX argued that **Start now** removes a real step for a one-off job. Product countered that Add already means “prepare a timer,” which is valuable when building a board or adjusting a preset. Two equally prominent outcomes would make a novice decide what to do before seeing the timer card. UI agreed that both actions would compete on narrow screens. Architecture said an explicit shortcut is feasible as an atomic create-and-start operation without another timer model.

**Resolution.** Keep one Add action. Land on the new card, bring it into view, and make Start the next focus target. Test whether people still hesitate or abandon before prototyping a shortcut.

### Finding an off-board run

Architecture proposed access from every route because the store keeps running even when the active board changes. Product warned that a global control tray would duplicate controls and interrupt unrelated web utility work. UX wanted a named destination and an accessible jump to the correct card, especially with same-named timers. UI pointed out that the current board rail allows truncation but provides no signal of off-board activity.

**Resolution.** Prototype a compact, conditional cue in the Dashboard switcher. Show a direct jump when one card qualifies and a short list when several do. Include running and paused Dashboard duration and interval runs, including restored ones. Keep control on the owning card. Defer coverage on other web routes unless testing shows people lose runs there.

### Visible timing controls and deletion

Architecture challenged a generic overflow that could bury agreed interval controls. UX and Product agreed that run actions are learned and used under time pressure. UI proposed one prominent Start/Pause/Resume control, Stop alongside it, and visible, lower-weight Skip, Skip rest, and Restart when applicable. The eligible pen and mute can remain easy to reach. Put destructive card and board actions behind named options.

Product preferred an explicit discard confirmation during active removal because Stop creates a history entry that a person discarding a run may not want. UX preferred requiring people to resolve the run first to avoid turning Remove into a multi-choice dialog. Architecture supported a guard checked again under the storage lock, since another tab can start a run while confirmation is open.

**Resolution.** The first design uses the guarded path. Explain which runs block deletion and offer a route to them. The user can explicitly Stop and keep the outcome or back out. Removal never stops a run on the user's behalf. Record deliberate active discard as an open research question and preserve existing Reset and Restart semantics.

### History and ownership

Product argued that History is valuable for checking whether an interval finished, but does not deserve the same prominence as starting and controlling a timer. Architecture challenged wording such as “all timers on this device” because browser profiles and each native install have separate storage. Date Countdowns, World Clocks, and the standalone web tools do not write sessions into this list. UX pointed out that same-named timers make dashboard context useful, and that filtering by timer name should return both results. UI supported a muted dashboard line in a stable position and recommended removing board admin controls from History itself.

**Resolution.** Give History its own destination and explain its coverage in one line. Show local end date/time, timer name, dashboard, and outcome. Use the current dashboard name for surviving boards and a saved name for deleted boards. Keep repetition results brief and defer aggregate charts and additional filters.

### Recovery and accessibility

Architecture argued for persisting explicit recovery provenance because the current paused state cannot tell the UI why a timer paused. UX asked that recovered work stay visible until acknowledged by acting on the run, with no focus jump and no per-second speech. Product treated knowing whether a run can be trusted as more valuable than engagement features. UI proposed a visible status adjacent to the remaining time and stable focus when controls change across phases.

**Resolution.** Use explicit recovery state, visible and accessible. Distinguish cold process restart from retained suspension. Report local persistence loss where the application can detect it. Keep foreground alert scope as confirmed and validate touch, keyboard, VoiceOver, and TalkBack independently.

## Final agreement

All four reviewers endorsed the timer-first Dashboard, separate cross-dashboard History, and a passive route back to off-board runs. Product explicitly signed the guarded-deletion compromise after preserving an open question about intentional discard. UX withdrew the two-action setup proposal for the first iteration. Architecture withdrew the all-routes placement for the first prototype. UI retained the session controls and changed their emphasis and placement instead of moving them into a menu.
