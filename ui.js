import { controlConfig, processPresets } from "./presets.js";

const numberFormat = (v) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(1));

export function initProcessSelector(selectEl, onChange) {
  Object.entries(processPresets).forEach(([key, value]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = value.label;
    selectEl.appendChild(opt);
  });
  selectEl.addEventListener("change", () => onChange(selectEl.value));
}

export function renderControls(container, state, onInput) {
  container.innerHTML = "";

  controlConfig.forEach((cfg) => {
    const [key, label, minOrOpts, max, step] = cfg;
    const wrapper = document.createElement("div");
    wrapper.className = "control";

    const head = document.createElement("div");
    head.className = "control-head";
    const title = document.createElement("strong");
    title.textContent = label;
    const value = document.createElement("small");
    value.id = `value-${key}`;
    value.textContent = state[key];

    head.append(title, value);
    wrapper.appendChild(head);

    if (Array.isArray(minOrOpts)) {
      const select = document.createElement("select");
      select.value = state[key];
      minOrOpts.forEach((optValue) => {
        const opt = document.createElement("option");
        opt.value = optValue;
        opt.textContent = optValue;
        select.appendChild(opt);
      });
      select.addEventListener("change", () => onInput(key, select.value));
      wrapper.appendChild(select);
    } else {
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(minOrOpts);
      input.max = String(max);
      input.step = String(step);
      input.value = state[key];
      input.addEventListener("input", () => {
        const parsed = step < 1 ? parseFloat(input.value) : parseInt(input.value, 10);
        value.textContent = numberFormat(parsed);
        onInput(key, parsed);
      });
      wrapper.appendChild(input);
    }

    container.appendChild(wrapper);
  });
}

export function renderSummary(summaryEl, statsEl, text, profile) {
  summaryEl.textContent = text;
  statsEl.innerHTML = "";

  ["acidity", "sweetness", "bitterness", "body", "polyphenols", "aroma", "clarity", "floralFruit", "chocoNut"].forEach((k) => {
    const stat = document.createElement("div");
    stat.className = "stat";
    stat.innerHTML = `<div class="label">${k}</div><div class="value">${Math.round(profile[k])}</div>`;
    statsEl.appendChild(stat);
  });
}
