# Dashboard design phase 2 · Navigation and first use

- Use **Add timer or clock** to open the picker. A newly added timer opens ready, and its Start control receives focus. Cancel returns to the Add action.
- Switch dashboards through direct links when they fit on wide web. A labeled list works on narrow screens and with longer board names. The switcher appears once there is more than one dashboard.
- Open **Dashboard options** for board creation, renaming, default selection, sound, or removal. Timer cards keep the primary timing action prominent. Remove lives in the card's options.
- Open **History** from the main navigation. It still finds completed and stopped runs across all dashboards, even when opened from a particular board. **Back to dashboard** returns to that board.

The screenshots below use synthetic timers in the web production preview. Both native builds share the Dashboard controls and show Dashboard and History in their main navigation.

| Preview | What changed |
| --- | --- |
| [Mobile-width first use](mobile-first-use.png) | Below the header, the green Add action is the one way into the picker. The switcher stays out of the way on the first board. |
| [Ready timer](mobile-ready.png) | The card groups the remaining time and state above the green Start control. Setup details appear below the controls. |
| [Mobile-width board switcher](mobile-board-picker.png) | The open list offers dashboard links and marks the current dashboard. Choosing a different board takes an explicit action. |
| [Dashboard options](dashboard-options.png) | The dialog groups board settings and identifies the board being managed. |
| [History](mobile-history.png) | The main navigation marks History as current. Same-name results show their dashboard names, and the return link keeps board context. |
| [Desktop navigation](desktop-boards.png) | Short board lists appear as direct links, separate from both the main navigation and Dashboard options. |
