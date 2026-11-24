const normalize = value => value.normalize("NFKD").replace(/\p{M}/gu, "")
  .toLowerCase().replace(/[\s_]+/g, " ").trim();

const supportedZones = new Map();
export function resolvedZone(zone) {
  if (typeof zone !== "string" || !/^[a-z]/i.test(zone)) return undefined;
  if (!supportedZones.has(zone)) {
    let resolved;
    try {
      resolved = new Intl.DateTimeFormat(undefined, { timeZone: zone }).resolvedOptions().timeZone;
    } catch {
      // The platform may have an older timezone database.
    }
    supportedZones.set(zone, resolved);
  }
  return supportedZones.get(zone);
}

export const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function zoneLabel(zone) {
  const parts = zone.replaceAll("_", " ").split("/");
  return [parts.pop(), ...parts].join(" · ");
}

export function zoneRow(zone, label = zoneLabel(zone)) {
  return {
    id: zone, zone, label, group: zone.includes("/") ? zone.split("/")[0] : "Other",
    direct: [normalize(zoneLabel(zone).split(" · ")[0]), normalize(zone)], aliases: [], population: 0,
  };
}

export function cityRows(records) {
  return records.flatMap(([id, name, country, region, zone, population, ascii, ...aliases]) => {
    if (!resolvedZone(zone)) return [];
    return [{
      id: String(id), zone, label: [name, region, country].filter(Boolean).join(" · "),
      direct: [...new Set([name, ascii || name].map(normalize))],
      aliases: aliases.map(normalize), population,
    }];
  });
}

const limit = 30;

function matchRank(terms, query) {
  let best = Infinity;
  for (const term of terms) {
    if (term === query) return 0;
    if (term.startsWith(query)) best = Math.min(best, 2);
    else if (term.includes(query)) best = Math.min(best, 4);
  }
  return best;
}

export function searchTimezones(rows, search) {
  const query = normalize(search);
  if (!query) return { results: [], count: 0 };
  const matches = [];
  for (const row of rows) {
    const rank = Math.min(matchRank(row.direct, query), matchRank(row.aliases, query) + 1);
    if (rank < Infinity) matches.push({ row, rank });
  }
  matches.sort((a, b) => a.rank - b.rank || b.row.population - a.row.population ||
    (a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0));
  return { results: matches.slice(0, limit).map(match => match.row), count: matches.length };
}
