# Timezone picker design and implementation specification

This document tracks two future enhancements together. The searchable timezone picker and Date Countdown rule reconciliation can ship independently.

## Release decision

Replace the long timezone dropdown with one searchable picker in Dashboard Date Countdown, Dashboard World Clock, and the standalone web Date Countdown. Default new forms to the device timezone. Bundle a GeoNames search index and refresh it during major-release preparation. Keep the standalone World Clocks board's separate curated **Add a city** control outside this change. It uses city IDs in share links and has a different purpose.

Users choose a named timezone and, for Date Countdown, a local date and time. The runtime applies daylight saving rules automatically. Handling a timezone rule change during a saved countdown is a future release.

## Picker interaction

1. Show a compact field labeled **Timezone** with the current value visible, such as **Device timezone · Los Angeles** or **Mumbai · India** immediately after selection. The form stores a named timezone ID such as `Asia/Kolkata`. After a reload or edit, display the saved zone's city-first label, such as **Kolkata · Asia**. A city alias is a way to find a timezone and is transient in this release.
2. Opening the picker focuses **Search city or timezone**. With an empty query, pin **Device timezone** and **UTC**, then show supported zones grouped by IANA region. Sort group names and city-first rows alphabetically. Show pinned zones only once where IDs resolve to the same zone. The full browse list remains available even when no city data maps to a zone.
3. A nonempty query shows a single ranked list across all regions. Match city names, ASCII spellings, selected aliases, and full timezone identifiers. Normalize case, accents, and runs of whitespace or underscores. Rank exact city, alias, or zone-ID matches before prefixes and then substring matches. Break otherwise equal matches by direct city name before alias, then population descending and stable ID. Return up to 30 results and invite refinement when more match. Display city plus country, with state or province when needed to distinguish duplicates. Show the timezone ID as secondary text where it helps distinguish results. Keep multiple city matches selectable even if they map to the same zone.
4. **No matching cities or timezones** is an empty state with a clear-search action. Selecting a result commits its zone and closes the picker. Escape and dismissal leave the committed value intact. Pressing Enter in search chooses the active result when one exists and never submits the outer form. Changing the timezone leaves the target date and time fields intact. Clear on standalone Date Countdown resets the zone to the device default along with the target.
5. Use an editable combobox with a listbox, following the WAI-ARIA combobox pattern. Give the trigger and search input accessible names, expose expanded state and the active option, and announce result counts or no matches without moving focus. Support arrows, Enter, Escape, Tab, and pointer selection. Escape and selection return focus to the trigger. Tab and outside clicks respect the user's destination. Allow the results to scroll independently, keep the active option visible, and verify mobile keyboard, zoom, touch targets, and narrow-screen layout. [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)

Examples for acceptance include `mumbai` → Mumbai, India → `Asia/Kolkata`, `sao paulo` → São Paulo, Brazil, and `America/New_York` → New York's zone. A lookup for `Portland` must distinguish Oregon and Maine. Use runtime-supported timezone IDs as the final selectable values and retain valid saved IDs, including supported legacy aliases absent from the runtime enumeration.

## Date presets

See the [README refresh guide](../../README.md#update-bundled-date-presets-and-timezones) for the manual and GitHub Actions workflows.

Dashboard holiday presets use the selected country's calendar and fill in the name and local date and time. The form's selected timezone stays in place, with the device timezone as the default for new countdowns. For example, the US New Year's preset fills in January 1 at midnight. New York and Los Angeles give different instants for the same preset. Choosing another timezone keeps the filled date and time. The list of upcoming occurrences is evaluated in the selected timezone.

The preset list is curated for the US, Canada, and India. Edit the area allowlists and reviewed holiday definitions in `scripts/data/date-presets.json`, then run `node scripts/build-date-presets.mjs` and review the generated `src/date-presets.json`. Review dated holidays against the linked official calendars each year. Annual rules continue to work without a new snapshot.

The same generator adds handpicked entries from the source file’s `events` section. Each event has an area, a stable ID, reviewed ISO dates, and an optional local countdown time. The U.S. General Election Day preset uses 8 p.m. in the selected timezone as its countdown target. Only holidays are eligible for the seasonal starter tile.

## City catalog and release process

- Use GeoNames `cities15000.zip` as the starting source. Read its name, ASCII name, short alternate-name field, country and administrative codes, timezone ID, population, and GeoNames ID. Use `countryInfo.txt` and `admin1CodesASCII.txt` where needed for readable disambiguation. The export covers cities with more than 15,000 people plus capitals. Bundle cities with at least 100,000 residents and explicitly included smaller cities, currently Portland, Maine. All supported timezone IDs remain searchable. Credit GeoNames, link CC BY 4.0, and identify the app's filtered and reformatted catalog in third-party notices. [GeoNames file definitions and license](https://download.geonames.org/export/dump/readme.txt)
- Add a deterministic generator under `scripts/` that consumes downloaded snapshots and outputs a compact, versioned asset imported from `src/`. Keep an intake manifest with snapshot date, upstream files, and SHA-256 hashes. Store the generated asset with the release source. Stable sort and deduplicate names within each city. Keep the normal web and native builds independent of upstream availability. Native Vite builds disable `publicDir`, so include the catalog through Vite's source asset pipeline.
- During major-release preparation, download the current files, regenerate the artifact, and review row count, compressed size, invalid or unsupported IDs, and a diff of representative cities. Resolve renamed IDs using a reviewed alias mapping only where needed. Check each returned zone against the user's runtime before offering it. If a platform cannot use a city zone or the catalog cannot load, retain device timezone, UTC, and searchable runtime zones. Keep the previous reviewed snapshot available through release rollback.
- Use the shipped data for offline search. Opening and searching the picker makes zero requests to GeoNames or any external service. If code splitting is used, verify that the catalog is included in the offline path where the app is available offline. Measure search with the actual dataset on a representative mobile device. Use a 100 ms target for input-to-results after the picker opens and render only the bounded search results.
- If users need more aliases, import filtered entries from `alternateNamesV2.zip` by GeoNames ID. Exclude URLs and unrelated identifier types. Add aliases for smaller places through a reviewed supplement or a wider GeoNames extract when there is evidence of demand.

## Implementation sequence

1. Add the catalog generator, checked-in index, and attribution. Keep matching and ranking in a pure module with fixture tests. Compute normalized strings once per catalog load. Check runtime support once per distinct zone and reuse the result across cities and queries. Keep the runtime zone list independent of the catalog and include the device zone and UTC.
2. Build a reusable picker in `src/`. Give each mounted instance unique IDs and an explicit committed zone getter and setter. Scope listeners to its form and remove any document-level listeners on unmount. If a hidden named field carries the committed value, validate it explicitly at submit because hidden inputs do not participate in native constraint validation. Render catalog text with DOM text APIs. Preserve a supported saved zone even if the catalog omits it.
3. Wire the picker into `src/dashboard.js` for Date Countdown and World Clock setup. Initialize from the stored value where applicable, then read only the committed zone on save. Preserve current edit eligibility, timer lifecycle, saved record formats, and World Clock's Show seconds behavior. Wire the same picker into `renderDateTimer` in `src/main.js`, including initial restore and Clear. Remove `fillTimeZones` from `src/time.js` once all its callers move. Keep `targetInstant`, `createDateTimer`, `countdown`, and `clockFormatters` responsible for time semantics.
4. Verify generator results against fixtures and the actual snapshot. Add focused automated coverage for ranking, duplicate city names, aliases, unsupported zones, and a supported saved ID missing from the catalog. Run `npm test`, `npm run build`, and `npm run mobile:build`. Smoke-test dashboard creation, Date Countdown edit and standalone restore/Clear, World Clock with seconds, keyboard and screen-reader paths, and a representative desktop and mobile layout. Check the packaged mobile picker in airplane mode.
5. Confirm automatic daylight saving using one winter and one summer target in a DST-observing zone. Verify current behavior for a skipped spring-forward time and a repeated fall-back time. Both are rejected with the existing instruction to choose a different time. Confirm that selecting a zone by city alias produces the same saved deadline and clock behavior as selecting that zone by its ID.

## Options and review decisions

| Option | Decision |
| --- | --- |
| Shorter labels and a native dropdown | Retain city-first labels and pinned defaults. Use search to address city lookup. |
| Group by region | Use groups for browsing. Rank one list for search. |
| Recent timezones | Defer until repeated selection warrants storing shared local history. |
| Current or target UTC offsets in results | Defer. If added, calculate for the target date and time in Date Countdown and for the current instant in World Clock. |
| Refresh city data every 15 days | Use a major-release snapshot. If between-release updates become necessary, serve versioned data in the background with the shipped index as offline fallback. |

| Panel role | Improvement incorporated |
| --- | --- |
| Product Manager | Scope the first release to city discovery. Preserve the curated board's share-link contract and defer recents. |
| Software Architect | Keep city lookup data separate from timezone rules and stored timer intent. Refresh the bundled catalog through the release workflow. |
| Human Interface Design | Use regional browsing and a ranked search list. Keep selection explicit and disambiguate identical city names. |
| Senior Full Stack Software Engineer | Cover both dashboard and standalone entry points, use a reproducible catalog snapshot, and preserve saved IDs. |
| Frontend Engineer | Isolate picker state from the form's submitted zone. Bound rendered matches and verify keyboard, focus, and offline native packaging. |

## Future release — timezone rule changes during Date Countdown

The selected wall date and time plus named timezone are the event intent. The saved instant is the deadline derived under the rules available at creation. When an updated rule source becomes available, a countdown targeting April 10 at 6:00 p.m. should still end at 6:00 p.m. in the selected timezone. The app updates the instant internally. Show a persistent, dismissible notice on the affected timer only when its instant changes, such as **Timezone rules changed. This countdown still ends April 10 at 6:00 p.m. local time.**

1. Separate saved-record validation from current-rule resolution before enabling reconciliation. Today `validDateTimer` re-resolves the wall time and requires equality with the stored instant. A valid old record could be rejected on load before it can be updated. Trace both dashboard hydration and standalone `readTimer`. Still validate the stored fields and supported timezone.
2. Reconcile when authoritative updated rules are observable, for example on load or return to foreground after a runtime update. Browser and WebView APIs do not expose a portable timezone database version. Re-resolving a saved target detects a changed result on that runtime. Define the rule source and cross-device behavior before promising a notification immediately after a government announcement. A GeoNames refresh is independent of this check.
3. Recompute pending and running deadlines and retain timer lifecycle state. Make the write idempotent and conditional on the stored record still matching the target and old instant so an edit in another tab wins. Use the dashboard repository's concurrency model and define equivalent handling for standalone storage. Store enough notice state to avoid re-alerting for the same update after reload. Leave completed records and history intact.
4. Confirm exception handling before enabling reconciliation. For a newly skipped or repeated time, the proposed behavior is to retain the saved deadline provisionally and show a review notice with a path to choose a valid target. For a uniquely resolved deadline already in the past, the proposed behavior is to complete an active countdown once. Define how ready and paused timers surface an elapsed deadline before shipping. Add deterministic old-rule/new-rule test fixtures for a moved deadline, an unchanged deadline, gaps, overlaps, overdue targets, concurrent edit, and reload. Check that a successful update keeps the same wall time and produces one notice.
