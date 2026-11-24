// Units are supplied from largest to smallest so the last change takes precedence.
export function createUnitHighlight() {
  let previous;
  let highlighted;
  let timeout;

  return (units, reset = false) => {
    let changed;
    const values = new Map();
    for (const [unit, value, element] of units) {
      values.set(unit, value);
      if (previous && !reset && /\d/.test(value) && value !== previous.get(unit)) changed = element;
    }
    previous = values;
    if (!changed && !reset) return;
    clearTimeout(timeout);
    highlighted?.classList.remove("timer-unit-changed");
    highlighted = changed;
    if (highlighted) {
      highlighted.classList.add("timer-unit-changed");
      timeout = setTimeout(() => {
        highlighted.classList.remove("timer-unit-changed");
        highlighted = undefined;
      }, 1000);
    }
  };
}

export function createDigitalReadout(element) {
  const highlight = createUnitHighlight();
  let current;
  let lastSmallestUnit;

  return (display, smallestUnit = "s") => {
    if (display === current && smallestUnit === lastSmallestUnit) return false;
    const reset = smallestUnit !== lastSmallestUnit;
    current = display;
    lastSmallestUnit = smallestUnit;
    const tokens = display.split(/(\d+(?:mo|[ydhms])?)/);
    const count = (tokens.length - 1) / 2;
    const clockUnits = smallestUnit === "s" ? ["h", "m", "s"] : ["h", "m"];
    const units = [];
    element.replaceChildren(...tokens.map((token, index) => {
      if (index % 2 === 0) return token;
      const span = document.createElement("span");
      span.className = "timer-readout-unit";
      span.textContent = token;
      const unit = token.match(/[a-z]+$/)?.[0] ?? clockUnits.at((index - 1) / 2 - count);
      units.push([unit, token, span]);
      return span;
    }));
    highlight(units, reset);
    return true;
  };
}
