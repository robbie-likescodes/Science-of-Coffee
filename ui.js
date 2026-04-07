import { brewMethodPresets, controlConfig, getControlSpec } from "./presets.js";
import { equationLibrary, filterEffects, modelSections } from "./model.js";

const numberFormat = (v) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(1));
const celsiusToFahrenheit = (celsius) => (celsius * 9) / 5 + 32;
const fahrenheitToCelsius = (fahrenheit) => ((fahrenheit - 32) * 5) / 9;

export function initProcessSelector(selectEl, onChange) {
  if (!selectEl) {
    console.error("[coffee-sim] Missing #processSelect element.");
    return;
  }
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

export function renderControls(container, state, processKey, onInput) {
  container.innerHTML = "";

  controlConfig.forEach((cfg) => {
    const { key, label } = cfg;
    const spec = getControlSpec(processKey, key) || cfg;
    const wrapper = document.createElement("div");
    wrapper.className = "control";
    wrapper.dataset.controlKey = key;

    const head = document.createElement("div");
    head.className = "control-head";
    const title = document.createElement("strong");
    title.textContent = label;
    const value = document.createElement("small");
    value.id = `value-${key}`;
    value.textContent = key === "temperature" ? numberFormat(celsiusToFahrenheit(state[key])) : state[key];

    head.append(title, value);
    wrapper.appendChild(head);

    if (spec.type === "select") {
      const select = document.createElement("select");
      select.value = state[key];
      spec.options.forEach((optValue) => {
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
      const isTemperature = key === "temperature";
      input.min = String(isTemperature ? celsiusToFahrenheit(spec.min) : spec.min);
      input.max = String(isTemperature ? celsiusToFahrenheit(spec.max) : spec.max);
      input.step = String(spec.step);
      input.value = String(isTemperature ? celsiusToFahrenheit(state[key]) : state[key]);
      input.addEventListener("input", () => {
        const parsedDisplay = spec.step < 1 ? parseFloat(input.value) : parseInt(input.value, 10);
        const parsed = isTemperature ? fahrenheitToCelsius(parsedDisplay) : parsedDisplay;
        value.textContent = numberFormat(parsedDisplay);
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
    hideTimer = setTimeout(hide, 1500);
  }

  return { show, hide };
}

export function initModeControls(container, modes, currentMode, onModeChange) {
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

function createMathBlock(tex, fallbackText) {
  const wrap = document.createElement("div");
  wrap.className = "eq-math";
  wrap.innerHTML = `\\[${tex}\\]`;
  wrap.dataset.fallback = fallbackText || tex;
  return wrap;
}

function scheduleMathTypeset(scopeEl) {
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise([scopeEl]).catch(() => {});
    return;
  }
  scopeEl.querySelectorAll(".eq-math").forEach((el) => {
    if (!el.dataset.fallback) return;
    el.textContent = el.dataset.fallback;
    el.classList.add("eq-math-fallback");
  });
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

  const formula = createMathBlock(eq.math || eq.formula, eq.formula);

  const explain = document.createElement("p");
  explain.textContent = eq.relevance;

  const vars = document.createElement("ul");
  vars.className = "eq-vars";
  Object.entries(eq.variables || {}).forEach(([k, v]) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong title="${v}">${k}</strong>: ${v}`;
    vars.appendChild(li);
  });

  const impacts = document.createElement("div");
  impacts.className = "eq-impacts";
  eq.affectedGraphs.forEach((g) => impacts.appendChild(makeTag(`Used in ${g} graph`)));

  card.append(header, formula, explain, vars, impacts);
  scheduleMathTypeset(card);
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
        <li>Sensory outputs are weighted blends of chemistry proxies and process heuristics.</li>
        <li>Temperature uses an Arrhenius-like heuristic and is not a fitted kinetic constant.</li>
        <li>Recommended stop window is computed from a balance score (sweetness/aroma/acidity minus bitterness/astringency/burnt), not from lab target extraction yield.</li>
        <li>Method coefficients encode style tendencies rather than measured constants.</li>
      </ul>`;
      note.appendChild(makeTag("Heuristic"));
      secEl.appendChild(note);
    }

    contentEl.appendChild(secEl);
  });

  scheduleMathTypeset(contentEl);
}

export function renderSummary(summaryEl, interpretationEl, statsEl, text, profile, interpretation) {
  summaryEl.textContent = text;
  if (interpretationEl && interpretation) {
    interpretationEl.innerHTML = `
      <strong>${interpretation.title}</strong>
      <div>${interpretation.windowText}</div>
      <ul>${interpretation.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>
    `;
  }

  statsEl.innerHTML = "";
  ["acidity", "sweetness", "bitterness", "body", "polyphenols", "aroma", "clarity", "floralFruit", "chocoNut"].forEach((k) => {
    const stat = document.createElement("div");
    stat.className = "stat";
    stat.innerHTML = `<div class="label">${k}</div><div class="value">${Math.round(profile[k])}</div>`;
    statsEl.appendChild(stat);
  });
}

export function renderEquations(container, equations) {
  const sections = [
    {
      title: "Core timing model",
      entries: [
        {
          name: "Extraction Speed",
          tex: "E = c_{\\mathrm{speed}}\\cdot\\Bigl(0.5 + 0.46g + 0.2f + 0.28a + 0.38\\tau + 0.24p + 0.1\\rho + 0.18r_{s} - 0.12m_{f}\\Bigr)",
          explain: "g = grind fineness, f = fines, a = agitation effect, τ = temperature-rate multiplier, p = useful pressure, ρ = preinfusion ratio."
        },
        {
          name: "Effective Progress",
          tex: "t_{\\mathrm{eff}} = t\\cdot E\\cdot k_{t}",
          explain: "kₜ is contact-time scaling; progress advances faster when extraction speed and contact-time factor are high."
        },
        {
          name: "Clamped Timeline Variable",
          tex: "t_t = \\operatorname{clamp}\\!\\left(t_{\\mathrm{eff}}, 0, 1.25\\right)",
          explain: "The family equations all evaluate on tₜ so early and late extraction phases remain bounded."
        }
      ]
    },
    {
      title: "Extraction families",
      entries: [
        {
          name: "Organic Acids",
          tex: "A_{\\mathrm{org}} = 76\\,\\sigma(t_t;0.13,11)\\,\\Bigl(1-0.36L(t_t;0.54,1.55)\\Bigr)\\,(1-0.22b)\\,(1+0.12m)\\,(1-0.1r)\\,(1+0.16\\Delta_a)",
          explain: "Early-stage acidity family with buffering/mineral/roast/temperature terms."
        },
        {
          name: "Sugars",
          tex: "S = 72\\,\\sigma(t_t;0.31,8.2)\\,\\Bigl(1-0.26L(t_t;0.76,2.5)\\Bigr)\\,(1+0.22\\eta+0.08\\Delta_s)\\,(1-0.25u)\\,(0.92+0.1r)",
          explain: "Mid-phase sweetness family including efficiency η and unevenness u."
        },
        {
          name: "Polyphenols",
          tex: "P = 10\\,\\sigma(t_t;0.5,6.2) + 68\\,L(t_t;0.6,2.25)\\,\\Bigl(1+0.52f+0.42u+0.12c+0.2\\lambda+0.24h\\Bigr)",
          explain: "Late-phase harshness family where fines, unevenness, concentration, and pressure harshness h are amplified."
        }
      ]
    },
    {
      title: "Flavor mapping",
      entries: [
        {
          name: "Bitterness Mapping",
          tex: "B = (0.58P + 0.24M_a + 0.22M_e)\\,(0.84 + 0.3r)\\,(0.92 + 0.08c + 0.12h)",
          explain: "Maps chemistry (polyphenols + Maillard/melanoidins) to perceived bitterness."
        },
        {
          name: "Final Clarity",
          tex: "C_{\\mathrm{final}} = \\operatorname{clamp}\\!\\left(54 + 0.34A - 0.3B_d - 0.2P + 18\\kappa + 0.6\\phi\\right)",
          explain: "A = acidity, B_d = body, κ = clarity emphasis, φ = filter clarity coefficient."
        }
      ]
    },
    {
      title: "Filter adjustments",
      entries: [
        {
          name: "Post-curve Adjustment",
          tex: "\\begin{aligned}B_d' &= B_d + f_{\\mathrm{body}}\\\\
P' &= P + f_{\\mathrm{poly}}\\\\
A_r' &= A_r + f_{\\mathrm{aroma}}\\\\
C' &= C + 0.6\\,f_{\\mathrm{clarity}}\\end{aligned}",
          explain: "Paper/cloth/metal filters apply fixed coefficients after timeline curves are computed."
        }
      ]
    }
  ];

  container.innerHTML = "";
  const intro = document.createElement("p");
  intro.className = "subtitle";
  intro.textContent = "These equations are heuristic teaching relationships (designed to match the simulation logic).";
  container.appendChild(intro);

  sections.forEach((section) => {
    const group = document.createElement("section");
    group.className = "equation-group";

    const title = document.createElement("h3");
    title.textContent = section.title;
    group.appendChild(title);

    section.entries.forEach((entry) => {
      const card = document.createElement("article");
      card.className = "eq-card";

      const name = document.createElement("h4");
      name.textContent = entry.name;

      const math = createMathBlock(entry.tex, entry.tex);

      const where = document.createElement("p");
      where.className = "eq-note";
      where.textContent = `Where: ${entry.explain}`;

      card.append(name, math, where);
      group.appendChild(card);
    });

    container.appendChild(group);
  });

  const legend = document.createElement("div");
  legend.className = "eq-legend";
  legend.innerHTML = "<strong>Legend:</strong> σ(t; a, b) = sigmoid, L(t; s, p) = late-rise term, clamp(·) = bounded normalization.";
  container.appendChild(legend);

  scheduleMathTypeset(container);
}
