# Design release plan

This release plan is frozen as part of the design review record. The [future timezone enhancements spec](../timezone-picker-spec.md) tracks later work.

The reconvened panel agreed to release independently useful changes. Product favored pairing clearer first use with safer removal. UX and Architecture argued for proving the lifecycle and storage changes on the existing UI before changing navigation. The UI review agreed, since a navigation rewrite would make focus and recovery regressions harder to isolate.

| Phase | Branch scope | Exit gate |
| --- | --- | --- |
| 1. Run safety and recovery | Recovery status, storage notice, guarded removal, and History scope. Preserve existing navigation, shortcuts, and all timing controls. | Chrome smoke and local tests. Verify the candidate after CI, including History following Stop, ordinary pause versus cold restoration, and protected removal. |
| 2. Dashboard hierarchy | A labeled Add action, named board options, narrow switcher and wide direct links, and a first-class History destination. After Add, reveal and focus the new card's Start where applicable. | A fresh user can start a first timer without creating another board. Existing bookmarks, default selection, keyboard navigation, and live controls work. Check long names and enlarged text. |
| 3. Off-board continuity | A passive cue for live Countdown and Interval runs on other boards, linking to their existing controls. Prototype single-result and multiple-result cases. | A user with two timers on different boards can return to the right active card while both continue. Verify quiet boards and controls remain predictable. Extend to other web routes only if the evidence warrants it. |

Foreground alerts and wake behavior follow their existing roadmap. They do not enter this redesign release train. The same applies to proposals for instant Start, explicit active discard, analytics, and extra History filters until users show a recurring need.

## Per-phase release gate

1. Start from current `main` on a dedicated branch. Implement and test one phase. Capture visual changes using synthetic fixtures and annotate them in the changelog.
2. Open a PR and wait for checks. Merge. Wait for the successful **push** CI run on the merge commit.
3. Dispatch **Release → candidate** from `main` against that exact merge SHA. Verify the generated RC on QA before promotion. Confirm its build identity and the checks for this phase.
4. Dispatch **Release → promote** with the exact verified candidate tag. Approve the production environment only after the plan shows that tag and bundle digest. Confirm production smoke checks, stable release, and live build identity.
5. Start the next production phase only after verification of the previous one. Keep it independently reversible through the established release rollback.

See the [release workflow guide](../../ci-cd.md) and the [Phase 1 changelog](../../changelog/design-phase-1/README.md).

## Phase 2 review decisions

Product pointed out that a switcher has no job before a user creates a second dashboard. UX found that changing a native select could trigger navigation before a keyboard user finished browsing. The implementation hides the switcher on a single board and uses a labeled disclosure with links on narrow layouts. Wide layouts give short board lists direct links. Architecture confirmed that destination-board audio should unlock on the same board-selecting gesture in both layouts. History remains global and uses a board in the URL only for return navigation.

## Phase 3 review decisions

The cue appears only on Dashboard and only when another board has an unfinished Countdown or Interval Timer. Product's concern about duplicate controls was resolved by linking to the owning card. Architecture verified that the projection reads existing state and honors its deadline without triggering commands. UX reviewed the narrow layout and identified a need for links that also reveal the exact timer when opened in a new tab. The link carries both board and card identity and falls back to the board if the card no longer exists. Browser checks cover navigation, focus continuity during peer-tab changes, and identical timer names. A separate usability study and assistive-technology testing remain open.
