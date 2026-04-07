import { brewMethodPresets, controlConfig } from "./presets.js";
import { equationLibrary, filterEffects, modelSections } from "./model.js";

const numberFormat = (v) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(1));

export function initProcessSelector(selectEl, onChange) {
  Object.entries(brewMethodPresets).forEach(([key, value]) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = value.label;
    selectEl.appendChild(opt);
  });
  selectEl.addEventListener("change", () => onChange(selectEl.value));
}

export function initViewTabs(container, currentView, onChange) {
  container.innerHTML = "";
  [
    { key: "simulator", label: "Simulator" },
    { key: "model", label: "Equations / Model" }
  ].forEach((tab) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mode-btn ${tab.key === currentView ? "active" : ""}`;
    btn.textContent = tab.label;
    btn.addEventListener("click", () => onChange(tab.key));
    container.appendChild(btn);
  });
}

export function renderMethodDescription(descriptionEl, processKey) {
  if (!descriptionEl) return;
  descriptionEl.textContent = brewMethodPresets[processKey]?.description || "";
}

export function renderControls(container, state, onInput) {
  container.innerHTML = "";

  controlConfig.forEach((cfg) => {
    const [key, label, minOrOpts, max, step] = cfg;
    const wrapper = document.createElement("div");
    wrapper.className = "control";
    wrapper.dataset.controlKey = key;

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
      select.addEventListener("change", () => onInput(key, select.value, { anchorEl: wrapper, inputType: "select" }));
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
        onInput(key, parsed, { anchorEl: wrapper, inputType: "range" });
      });
      wrapper.appendChild(input);
    }

    container.appendChild(wrapper);
  });
}

export function createEquationPopupManager() {
  const popup = document.createElement("div");
  popup.className = "equation-popup";
  popup.setAttribute("aria-live", "polite");
  document.body.appendChild(popup);

  let hideTimer = null;

  function hide() {
    popup.classList.remove("visible");
  }

  function show(details) {
    if (!details?.anchorEl) return;
    const rect = details.anchorEl.getBoundingClientRect();
    popup.innerHTML = `
      <div class="equation-title">${details.title}</div>
      <div class="equation-expression">${details.equation}</div>
      <div class="equation-change">${details.variable}: <span class="equation-highlight">${details.before} → ${details.after}</span></div>
      <div class="equation-effect">${details.effect}</div>
    `;

    popup.style.left = `${Math.min(rect.left + 8, window.innerWidth - 340)}px`;
    popup.style.top = `${Math.max(rect.top - 12, 10)}px`;

    popup.classList.add("visible");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 1400);
  }

  return { show, hide };
}

export function initGraphModeControls(container, modes, currentMode, onModeChange) {
  container.innerHTML = "";
  Object.entries(modes).forEach(([key, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `mode-btn ${key === currentMode ? "active" : ""}`;
    btn.dataset.mode = key;
    btn.textContent = label;
    btn.addEventListener("click", () => onModeChange(key));
    container.appendChild(btn);
  });
}

export function renderCurveControls(container, series, visibleCurves, onToggle) {
  container.innerHTML = "";
  series.forEach((s) => {
    const label = document.createElement("label");
    label.className = "curve-chip";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = visibleCurves[s.key] !== false;
    cb.addEventListener("change", () => onToggle(s.key, cb.checked));

    const swatch = document.createElement("span");
    swatch.className = `swatch ${s.family}`;
    swatch.style.setProperty("--swatch", s.color);

    const text = document.createElement("span");
    text.textContent = s.label;

    label.append(cb, swatch, text);
    container.appendChild(label);
  });
}

function makeTag(text) {
  const tag = document.createElement("span");
  tag.className = "eq-tag";
  tag.textContent = text;
  return tag;
}

function renderEquationCard(eqId) {
  const eq = equationLibrary[eqId];
  if (!eq) return null;

  const card = document.createElement("article");
  card.className = "eq-card";

  const header = document.createElement("div");
  header.className = "eq-card-head";
  const h4 = document.createElement("h4");
  h4.textContent = eq.title;
  const type = makeTag(eq.type);
  header.append(h4, type);

  const formula = document.createElement("pre");
  formula.className = "eq-formula";
  formula.textContent = eq.formula;

  const explain = document.createElement("p");
  explain.textContent = eq.relevance;

  const vars = document.createElement("ul");
  vars.className = "eq-vars";
  Object.entries(eq.variables || {}).forEach(([k, v]) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${k}</strong>: ${v}`;
    vars.appendChild(li);
  });

  const impacts = document.createElement("div");
  impacts.className = "eq-impacts";
  eq.affectedGraphs.forEach((g) => impacts.appendChild(makeTag(`Used in ${g} graph`)));

  card.append(header, formula, explain, vars, impacts);
  return card;
}

export function renderModelDocumentation(tocEl, contentEl) {
  tocEl.innerHTML = "";
  contentEl.innerHTML = "";

  modelSections.forEach((section) => {
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.textContent = section.title;
    tocEl.appendChild(link);

    const secEl = document.createElement("section");
    secEl.className = "model-section";
    secEl.id = section.id;

    const h3 = document.createElement("h3");
    h3.textContent = section.title;
    const desc = document.createElement("p");
    desc.className = "subtitle";
    desc.textContent = section.description;

    secEl.append(h3, desc);

    section.equations.forEach((eqId) => {
      const card = renderEquationCard(eqId);
      if (card) secEl.appendChild(card);
    });

    if (section.id === "presets") {
      const grid = document.createElement("div");
      grid.className = "preset-grid";
      Object.entries(brewMethodPresets).forEach(([key, preset]) => {
        const card = document.createElement("article");
        card.className = "eq-card";
        card.innerHTML = `<h4>${preset.label}</h4>
          <p>${preset.description}</p>
          <p><strong>speed:</strong> ${preset.coeff.speed}, <strong>clarity:</strong> ${preset.coeff.clarity}, <strong>body:</strong> ${preset.coeff.body}, <strong>aroma:</strong> ${preset.coeff.aroma}</p>`;
        card.appendChild(makeTag("Preset-dependent"));
        card.dataset.preset = key;
        grid.appendChild(card);
      });
      secEl.appendChild(grid);
    }

    if (section.id === "filter-effects") {
      const table = document.createElement("div");
      table.className = "eq-card";
      table.innerHTML = `<h4>Filter post-adjustment coefficients</h4><pre class="eq-formula">${JSON.stringify(filterEffects, null, 2)}</pre>`;
      table.appendChild(makeTag("Preset-dependent"));
      secEl.appendChild(table);
    }

    if (section.id === "limitations") {
      const note = document.createElement("article");
      note.className = "eq-card";
      note.innerHTML = `<h4>Educational assumptions</h4>
      <ul class="eq-vars">
        <li>Curves are normalized 0-100 proxies, not direct mg/L chemistry.</li>
        <li>Sensory outputs are weighted blends of proxies and user controls.</li>
        <li>Method coefficients encode style tendencies rather than measured constants.</li>
      </ul>`;
      note.appendChild(makeTag("Heuristic"));
      secEl.appendChild(note);
    }

    contentEl.appendChild(secEl);
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
