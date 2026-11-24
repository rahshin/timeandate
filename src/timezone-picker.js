import "./timezone-picker.css";
import { cityRows, deviceZone, resolvedZone, searchTimezones, zoneLabel, zoneRow } from "./timezone-search.js";

export const timezoneField = `
  <div class="field timezone-picker">
    <span data-zone-label>Timezone</span>
    <input type="hidden" name="timezone">
    <button class="secondary" type="button" data-zone-trigger aria-expanded="false"></button>
    <div data-zone-panel hidden>
      <input type="search" role="combobox" aria-label="Search city or timezone"
        placeholder="Search city or timezone" aria-autocomplete="list" aria-expanded="false"
        autocomplete="off" spellcheck="false">
      <div role="listbox" aria-label="Timezones" tabindex="-1"></div>
      <p role="status"></p>
      <button type="button" class="secondary" data-zone-clear hidden>Clear search</button>
    </div>
  </div>`;

const device = zoneRow(deviceZone, `Your Timezone · ${zoneLabel(deviceZone).split(" · ")[0]}`);
const pinned = resolvedZone(deviceZone) === resolvedZone("UTC") ? [device] : [device, zoneRow("UTC")];
const compareZones = (a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label);
const runtimeRows = Intl.supportedValuesOf("timeZone").map(zone => zoneRow(zone))
  .filter(row => resolvedZone(row.zone))
  .sort(compareZones);
const knownZones = new Set([...pinned, ...runtimeRows].map(row => row.zone));
const searchZones = [...pinned, ...runtimeRows.filter(row => !pinned.some(pin => pin.zone === row.zone))];

let catalog;
function loadCatalog() {
  catalog ??= import("./timezone-catalog/cities.json")
    .then(({ default: records }) => cityRows(records))
    .catch(() => []);
  return catalog;
}

let nextId = 0;

export function mountTimezonePicker(field, savedZone) {
  const root = field.closest(".timezone-picker");
  const label = root.querySelector("[data-zone-label]");
  const trigger = root.querySelector("[data-zone-trigger]");
  const panel = root.querySelector("[data-zone-panel]");
  const search = panel.querySelector("input");
  const list = panel.querySelector("[role=listbox]");
  const status = panel.querySelector("[role=status]");
  const clear = panel.querySelector("[data-zone-clear]");
  const id = `timezone-picker-${++nextId}`;
  label.id = `${id}-label`;
  trigger.id = `${id}-trigger`;
  panel.id = `${id}-panel`;
  list.id = `${id}-list`;
  trigger.setAttribute("aria-labelledby", `${label.id} ${trigger.id}`);
  trigger.setAttribute("aria-controls", panel.id);
  search.setAttribute("aria-controls", list.id);

  let cities = [];
  let loading = true;
  let options = [];
  let results = [];
  let active = -1;

  function setZone(zone, display) {
    field.value = resolvedZone(zone) ? zone : deviceZone;
    trigger.textContent = display ?? (zone === undefined ? pinned[0].label : zoneLabel(field.value));
  }

  function setActive(index, scroll = true) {
    options[active]?.setAttribute("aria-selected", "false");
    active = index;
    const option = options[active];
    if (option) {
      option.setAttribute("aria-selected", "true");
      search.setAttribute("aria-activedescendant", option.id);
      if (scroll) option.scrollIntoView({ block: "nearest" });
    } else {
      search.removeAttribute("aria-activedescendant");
    }
  }

  function render() {
    const query = search.value.trim();
    const saved = knownZones.has(field.value) ? [] : [zoneRow(field.value)];
    const found = query ? searchTimezones([...searchZones, ...saved, ...cities], query) : undefined;
    const seen = new Set();
    results = found?.results ?? [...pinned, ...[...runtimeRows, ...saved].sort(compareZones)].filter(row => {
      const canonical = resolvedZone(row.zone);
      if (seen.has(canonical)) return false;
      seen.add(canonical);
      return true;
    });
    list.replaceChildren();
    let group;
    let groupName;
    options = results.map((row, index) => {
      const name = index < pinned.length ? "Pinned" : row.group;
      if (!query && name !== groupName) {
        const heading = document.createElement("div");
        heading.id = `${id}-group-${index}`;
        heading.textContent = name;
        heading.className = "timezone-group-label";
        group = document.createElement("div");
        group.setAttribute("role", "group");
        group.setAttribute("aria-labelledby", heading.id);
        group.append(heading);
        list.append(group);
        groupName = name;
      }
      const option = document.createElement("div");
      option.id = `${id}-option-${index}`;
      option.dataset.index = index;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.textContent = row.label;
      if (query) {
        const detail = document.createElement("small");
        detail.textContent = row.zone;
        option.append(detail);
      }
      (query ? list : group).append(option);
      return option;
    });
    list.scrollTop = 0;
    active = -1;
    setActive(query && results.length ? 0 : -1, false);
    list.hidden = !results.length;
    clear.hidden = !query || loading || results.length > 0;
    status.textContent = found && found.count > results.length
      ? `Showing ${results.length} of ${found.count} matches. Refine your search.`
      : !results.length
        ? loading ? "Loading cities…" : "No matching cities or timezones"
        : `${results.length} ${query ? "matches" : "timezones available"}`;
  }

  function close(restoreFocus) {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    search.setAttribute("aria-expanded", "false");
    setActive(-1);
    if (restoreFocus) trigger.focus();
  }

  function choose(index) {
    const row = results[index];
    if (!row) return;
    const changed = field.value !== row.zone;
    setZone(row.zone, row.label);
    if (changed) field.dispatchEvent(new Event("change", { bubbles: true }));
    close(true);
  }

  trigger.onclick = () => {
    if (!panel.hidden) {
      close(true);
      return;
    }
    search.value = "";
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    search.setAttribute("aria-expanded", "true");
    render();
    search.focus();
    if (loading) loadCatalog().then(rows => {
      cities = rows;
      loading = false;
      if (!panel.hidden && search.value.trim()) render();
    });
  };
  root.addEventListener("focusout", event => {
    if (!panel.hidden && !root.contains(event.relatedTarget)) close(false);
  });
  root.addEventListener("keydown", event => {
    if (panel.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.target === search && event.key === "Enter") {
      event.preventDefault();
      if (!event.isComposing) choose(active);
    } else if (event.target === search && ["ArrowDown", "ArrowUp"].includes(event.key) && results.length) {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? active + 1 : active < 0 ? results.length - 1 : active - 1;
      setActive(Math.max(0, Math.min(next, results.length - 1)));
    }
  });
  search.addEventListener("input", render);
  list.addEventListener("mousedown", event => {
    if (event.target.closest("[data-index]")) event.preventDefault();
  });
  list.addEventListener("click", event => {
    const option = event.target.closest("[data-index]");
    if (option) choose(Number(option.dataset.index));
  });
  clear.onclick = () => {
    search.value = "";
    search.focus();
    render();
  };
  setZone(savedZone);
  return { setZone };
}
