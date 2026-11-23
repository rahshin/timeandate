import assert from "node:assert/strict";
import test from "node:test";
import { resolveDashboardTemplate } from "./dashboard-templates.js";

test("starter templates match canonical locale, explicit region, then language", () => {
  const templates = {
    global: () => [],
    "en-IN": () => [],
    IN: () => [],
    hi: () => [],
  };
  assert.equal(resolveDashboardTemplate("EN-in-u-nu-latn", templates), templates["en-IN"]);
  assert.equal(resolveDashboardTemplate("hi-IN", templates), templates.IN);
  assert.equal(resolveDashboardTemplate("hi", templates), templates.hi);
  assert.equal(resolveDashboardTemplate("en-US", templates), templates.global);
  assert.equal(resolveDashboardTemplate("en", templates), templates.global);
  assert.equal(resolveDashboardTemplate("bad_locale", templates), templates.global);
  assert.equal(resolveDashboardTemplate(undefined, templates), templates.global);
});

test("regional seasonal layouts add at most one holiday within 30 days", () => {
  const tiles = (locale, date) => resolveDashboardTemplate(locale)({ zone: "UTC", now: Date.parse(date) });
  assert.equal(tiles("en-US", "2026-11-23").at(-1).name, "Thanksgiving");
  assert.equal(tiles("en-IN", "2026-11-23").length, 3);
  assert.equal(tiles("hi-IN", "2027-03-01").at(-1).value.wallTime, "2027-03-23T00:00");
  assert.equal(tiles("en-GB", "2026-11-25").at(-1).name, "Christmas");
  assert.equal(tiles("en-GB", "2026-11-24").length, 3);
  assert.equal(tiles("en-GB", "2026-12-26").at(-1).value.wallTime, "2027-01-01T00:00");
  assert.equal(tiles("en-IN", "2028-03-01").length, 3);
});
