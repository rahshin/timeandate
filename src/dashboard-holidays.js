import { Temporal } from "@js-temporal/polyfill";
import { targetInstant } from "./time.js";

const shared = [
  { id: "christmas", name: "Christmas", date: year => `${year}-12-25` },
  { id: "new-year", name: "New Year’s Eve", date: year => `${year + 1}-01-01` },
];

// https://www.opm.gov/frequently-asked-questions/pay-and-leave-faq/pay-administration/what-are-federal-holidays
const thanksgiving = {
  id: "thanksgiving",
  name: "Thanksgiving",
  date(year) {
    const first = Temporal.PlainDate.from({ year, month: 11, day: 1 });
    return first.add({ days: 21 + (4 - first.dayOfWeek + 7) % 7 }).toString();
  },
};

// Gazetted dates for central government offices.
// 2026: https://cgca.gov.in/ccadl/list-of-holiday
// 2027: https://www.iirs.gov.in/holidaycalender/
// Goa's Dhulivandana: https://www.goa.gov.in/wp-content/uploads/2026/11/List-of-Holidays-for-the-year-2027.pdf
const india = [
  { id: "holi", name: "Holi (central government calendar)", dates: ["2026-03-04", "2027-03-23"] },
  { id: "holi-goa", name: "Holi (Dhulivandana, Goa)", dates: ["2027-03-22"], presetOnly: true },
  { id: "dussehra", name: "Dussehra (Vijaya Dashami)", dates: ["2026-10-20", "2027-10-09"] },
  { id: "diwali", name: "Diwali (Deepavali)", dates: ["2026-11-08", "2027-10-29"] },
];

const catalog = { US: [...shared, thanksgiving], IN: [...shared, ...india] };

export function upcomingHolidays(country, zone, now = Date.now()) {
  const year = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone).year;
  const holidays = Object.hasOwn(catalog, country) ? catalog[country] : shared;
  return holidays.flatMap(({ date, dates = [date(year - 1), date(year), date(year + 1)], ...holiday }) => {
    for (const day of dates) {
      const wallTime = day + "T00:00";
      let instant;
      try {
        instant = targetInstant(wallTime, zone);
      } catch {
        // Some timezones skip or repeat local midnight.
        continue;
      }
      if (Date.parse(instant) > now) return [{ ...holiday, value: { wallTime, zone, instant } }];
    }
    return [];
  }).sort((a, b) => Date.parse(a.value.instant) - Date.parse(b.value.instant));
}

export function seasonalHoliday(country, zone, now) {
  const deadline = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone)
    .add({ days: 30 }).epochMilliseconds;
  return upcomingHolidays(country, zone, now)
    .find(holiday => !holiday.presetOnly && Date.parse(holiday.value.instant) <= deadline);
}
