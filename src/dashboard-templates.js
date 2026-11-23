import { seasonalHoliday } from "./dashboard-holidays.js";
import { createTimerSession } from "./timer-session.js";

// Add a factory under a canonical locale tag (en-IN), region (IN), or language (hi).
// Each factory returns an ordered list of tiles with unique IDs.
function starterLayout({ zone, now }, country) {
  const tiles = [
    {
      id: "local-time", type: "clock", name: "Local Time",
      value: { zone, showSeconds: false },
    },
    {
      id: "focus", type: "duration", name: "25-Minute Focus",
      value: createTimerSession({ durationMs: 25 * 60_000 }),
    },
    {
      id: "interval", type: "interval", name: "Quick Intervals",
      value: createTimerSession({ kind: "interval", durationMs: 30_000, restMs: 15_000, repetitions: 3 }),
    },
  ];
  const holiday = seasonalHoliday(country, zone, now);
  if (holiday) {
    tiles.push({
      id: holiday.id, type: "date", name: holiday.name,
      value: { ...holiday.value, holdAt: now, ready: true },
    });
  }
  return tiles;
}

const dashboardTemplates = {
  US: context => starterLayout(context, "US"),
  IN: context => starterLayout(context, "IN"),
  global: context => starterLayout(context),
};

export function resolveDashboardTemplate(locale, templates = dashboardTemplates) {
  let preferred;
  try {
    preferred = new Intl.Locale(locale);
  } catch {
    return templates.global;
  }
  for (const key of [preferred.baseName, preferred.region, preferred.language]) {
    if (key && Object.hasOwn(templates, key)) return templates[key];
  }
  return templates.global;
}
