import assert from "node:assert/strict";
import test from "node:test";
import { cityRows, resolvedZone, searchTimezones, zoneRow } from "./timezone-search.js";
import { targetInstant } from "./time.js";
import { seasonalHoliday, upcomingDatePresets } from "./dashboard-date-presets.js";

const rows = [
  ...cityRows([
    [1, "São Paulo", "Brazil", "", "America/Sao_Paulo", 100, "Sao Paulo"],
    [2, "Portland", "United States", "Maine", "America/New_York", 50, ""],
    [3, "Portland", "United States", "Oregon", "America/Los_Angeles", 80, ""],
    [4, "Mumbai", "India", "", "Asia/Kolkata", 150, "", "Bombay"],
    [5, "Bombay", "United States", "", "America/New_York", 10, ""],
    [6, "Missing", "", "", "Unknown/Zone", 1000, ""],
  ]),
  zoneRow("America/New_York"),
];

test("timezone search ranks exact, normalized city, alias and zone matches", () => {
  assert.equal(searchTimezones(rows, " SAO__Paulo ").results[0].zone, "America/Sao_Paulo");
  assert.deepEqual(searchTimezones(rows, "Bombay").results.map(row => row.zone), [
    "America/New_York", "Asia/Kolkata",
  ]);
  assert.deepEqual(searchTimezones(rows, "Portland").results.map(row => row.label), [
    "Portland · Oregon · United States", "Portland · Maine · United States",
  ]);
  assert.equal(searchTimezones(rows, "America/New_York").results[0].id, "America/New_York");
  assert.equal(searchTimezones(rows, "Missing").count, 0);
  assert.equal(resolvedZone("US/Pacific"), resolvedZone("America/Los_Angeles"));
});

test("common queries report total matches and render at most 30", () => {
  const many = Array.from({ length: 40 }, (_, id) => ({ ...rows[1], id: String(id) }));
  const { count, results } = searchTimezones(many, "port");
  assert.equal(count, 40);
  assert.equal(results.length, 30);
});

test("a New Year's preset uses the chosen zone's midnight", () => {
  const now = Date.parse("2026-12-26T12:00:00Z");
  const findNewYear = zone => upcomingDatePresets("US", zone, now).find(holiday => holiday.id === "new-year").value;
  const east = findNewYear("America/New_York");
  const west = findNewYear("America/Los_Angeles");
  assert.equal(east.wallTime, "2027-01-01T00:00");
  assert.equal(west.wallTime, east.wallTime);
  assert.equal(Date.parse(west.instant) - Date.parse(east.instant), 3 * 60 * 60 * 1000);
  assert.equal(targetInstant(east.wallTime, "US/Eastern"), east.instant);
});

test("holiday presets include selected dates for each country", () => {
  const now = Date.parse("2027-01-02T12:00:00Z");
  const canada = upcomingDatePresets("CA", "UTC", now);
  const us = upcomingDatePresets("US", "UTC", now);
  const india = upcomingDatePresets("IN", "UTC", now);
  assert.equal(canada.find(holiday => holiday.id === "canada-day").value.wallTime, "2027-07-01T00:00");
  assert.equal(canada.find(holiday => holiday.name === "Thanksgiving").value.wallTime, "2027-10-11T00:00");
  assert.equal(us.find(holiday => holiday.name === "Thanksgiving").value.wallTime, "2027-11-25T00:00");
  assert.deepEqual(india.filter(holiday => holiday.name.startsWith("Holi")).map(holiday => holiday.id), ["holi-goa", "holi"]);
  assert.equal(india.find(holiday => holiday.id === "holi-goa").value.wallTime, "2027-03-22T00:00");
  assert.equal(seasonalHoliday("IN", "Asia/Kolkata", Date.parse("2027-03-20T00:00Z")).id, "holi");
});

test("handpicked events join holidays and keep their preset local time", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");
  const election = (country, zone, time = now) =>
    upcomingDatePresets(country, zone, time).find(preset => preset.id === "us-general-election");
  const east = election("US", "America/New_York");
  const west = election("US", "America/Los_Angeles");
  assert.equal(east.value.wallTime, "2026-11-03T20:00");
  assert.equal(west.value.wallTime, east.value.wallTime);
  assert.equal(Date.parse(west.value.instant) - Date.parse(east.value.instant), 3 * 60 * 60 * 1000);
  assert.equal(election("CA", "UTC"), undefined);
  assert.equal(election("US", "UTC", Date.parse("2026-11-23T12:00:00Z")).value.wallTime, "2028-11-07T20:00");
  assert.equal(seasonalHoliday("US", "UTC", now).id, "thanksgiving");
});
