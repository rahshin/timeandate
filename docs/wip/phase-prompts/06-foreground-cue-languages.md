# Phase 6 · Foreground cue languages and English accents

Implement Phase 6 locally in `/Users/rahul/dev/prjs/timeandate` on a fresh branch named `feat/timer-cue-locales`. Refresh `origin/main`. Start there if it contains the rest and repetition-start cues from `feat/interval-phase-cues`. Otherwise, branch from the latest committed tip of `feat/interval-phase-cues` and record that dependency. Preserve uncommitted work. Read [Foreground timer cues](../../foreground-timer-cues.md), the Phase 4 entry in [progress.md](progress.md), and the relevant Dashboard and native speech adapter code.

## Design update

Add one device-local **Cue language and accent** preference in Dashboard settings. Apply it across Dashboards and timers on the same installation. Keep timer-specific speech options in each timer’s **Advanced** settings. Existing users start with **English (US)**, which uses the current English wording. The setting changes spoken cues only. Its first release offers locale choices without exposing individual installed voices.

| Picker label | Requested speech locale | Phrase catalog |
| --- | --- | --- |
| English (US) | `en-US` | English |
| Español (España) | `es-ES` | Spanish |
| Français (France) | `fr-FR` | French |
| English (Australia) | `en-AU` | English |
| English (UK) | `en-GB` | English |

Use the same English phrase catalog for all three English accents. Translate complete Spanish and French phrases with placeholders for timer names and numbers so wording and word order can vary naturally. Keep user-entered timer names as written. Include both bare numbers and numbers that name the timer. Check preparation, rest, repetition starts, repetition completion, session completion, and final Skip wording. Chimes and screen wake continue independently.

Request a voice for the selected locale. If a regional voice is unavailable, try a voice for the same language. If that language is unavailable, use English phrases with an English voice. If there is no suitable voice, skip speech and keep the saved preference so it can take effect when a voice becomes available. Where the platform can confirm an unavailable locale, show the effective fallback in settings. Treat voice lists that are still loading as unknown. A device may need an installed voice or speech engine for an accent to be available.

## Implementation plan

1. **Add the preference.** Reuse the existing local preference storage and Dashboard settings patterns. Validate the five supported locale tags, default missing or unknown values to English (US), and verify persistence across reload and Dashboard switches. Keep the preference separate from timer presets. Apply changes to subsequent cues and clear queued or active speech in the old language without replaying a boundary or resetting the timer.
2. **Localize cue copy.** Add a small catalog for English, Spanish, and French. Resolve phrases from the same effective language used for voice selection. Preserve cue identity, expiry, phase validity, priorities, mute, and foreground checks. Add a catalog and label for additional locales only when explicitly requested.
3. **Select platform voices.** On web, use Speech Synthesis voice metadata and handle asynchronous voice availability, including `voiceschanged`. On Android, resolve the selected locale with the active TextToSpeech engine and check language support after initialization. On iOS, use AVSpeechSynthesizer with an available voice matching the locale or fallback. Pass BCP 47 tags through the Capacitor bridge. Ensure fallback chooses text and voice together, including when voice resolution happens on the native side. Keep one utterance at a time and continue dropping expired cues while voices initialize or change.
4. **Document the behavior.** Add language selection and fallback to the architecture guide and linked changelog entry. Include an annotated screenshot of the setting. Record what was verified in the phase progress log, including platform and OS versions and any missing installed voices.

## Acceptance and handoff

- Existing timers keep their settings and speak the current English phrases by default. The picker offers all five choices, and the selected locale persists.
- UK and Australian English use English phrases with the requested accent when a matching voice is available. Spanish and French speak translated phrases and countdown numbers with a matching language voice. A missing voice follows the documented fallback. Selecting a language never pairs translated copy with a voice from a different language.
- Add focused tests for catalog coverage, preference defaults and persistence, locale fallback, and switching languages with a cue pending. Check that timer starts, completion, mute, visibility, and History still behave as before.
- Run `npm test`, `npm run build`, and `npm run mobile:build`. Verify real pronunciation and fallback on web, physical iOS, and physical Android where available. Check a short rest, a name containing non-English characters, and two overlapping timers. Record automated, simulator or emulator, and physical-device checks separately.
- Work locally and report the branch, base commit, test results, and remaining verification. Keep full UI translation, background speech, voice commands, and individual voice selection outside Phase 6.
