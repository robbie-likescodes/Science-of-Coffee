async function fallbackInit() {
  const [{ brewMethodPresets, controlConfig }, sim, charts] = await Promise.all([
    import("./presets.js"),
    import("./simulation.js"),
    import("./charts.js")
  ]);

  const processSelect = document.getElementById("processSelect");
  const processDescription = document.getElementById("processDescription");
  const controlsContainer = document.getElementById("controlsContainer");
  const summaryText = document.getElementById("summaryText");
  const interpretationBox = document.getElementById("interpretationBox");
  const statsEl = document.getElementById("stats");
  const equationsContent = document.getElementById("equationsContent");
  const timeChart = document.getElementById("timeChart");
  const radarChart = document.getElementById("radarChart");
  const graphModeControls = document.getElementById("graphModeControls");
  const axisModeControls = document.getElementById("axisModeControls");
  const curveControls = document.getElementById("curveControls");

  if (!processSelect || !controlsContainer || !timeChart || !radarChart) return;

  const state = {
    process: "espresso",
    graphMode: "flavor",
    xMode: "actual",
    visibleCurves: charts.getDefaultVisibleCurves("flavor"),
    params: { ...brewMethodPresets.espresso.defaults }
  };

  function renderSummary(result) {
    if (summaryText) summaryText.textContent = result.summary || "";
    if (interpretationBox && result.interpretation) {
      interpretationBox.innerHTML = `
        <strong>${result.interpretation.title || ""}</strong>
        <div>${result.interpretation.windowText || ""}</div>
        <ul>${(result.interpretation.bullets || []).map((b) => `<li>${b}</li>`).join("")}</ul>
      `;
    }

    if (statsEl) {
      statsEl.innerHTML = "";
      ["acidity", "sweetness", "bitterness", "body", "polyphenols", "aroma", "clarity", "floralFruit", "chocoNut"].forEach((k) => {
        const card = document.createElement("div");
        card.className = "stat";
        card.innerHTML = `<div class="label">${k}</div><div class="value">${Math.round(result.finalProfile?.[k] ?? 0)}</div>`;
        statsEl.appendChild(card);
      });
    }

    if (equationsContent && result.equations) {
      equationsContent.innerHTML = `
        <p class="subtitle">These equations are intentionally heuristic teaching relationships, not precision chemistry.</p>
        <h3>Core timing model</h3>
        <ul>${result.equations.core.map((line) => `<li>${line}</li>`).join("")}</ul>
        <h3>Extraction families</h3>
        <ul>${result.equations.families.map((line) => `<li>${line}</li>`).join("")}</ul>
      `;
    }
  }

  function rerender() {
    const result = sim.runSimulation(state.process, state.params);
    charts.drawTimeChart(timeChart, result.timeline, state.graphMode, state.visibleCurves, { xMode: state.xMode, guidance: result.guidance });
    charts.drawRadarChart(radarChart, result.finalProfile, { compact: true });
    renderSummary(result);
    if (processDescription) processDescription.textContent = brewMethodPresets[state.process]?.description || "";
  }

  function renderControls() {
    controlsContainer.innerHTML = "";
    controlConfig.forEach((cfg) => {
      const { key, label, type } = cfg;
      const wrap = document.createElement("div");
      wrap.className = "control";

      const head = document.createElement("div");
      head.className = "control-head";
      const title = document.createElement("strong");
      title.textContent = label;
      const val = document.createElement("small");
      val.textContent = state.params[key];
      head.append(title, val);
      wrap.appendChild(head);

      if (type === "select") {
        const select = document.createElement("select");
        const options = Array.isArray(cfg.options) ? cfg.options : [];
        options.forEach((optVal) => {
          const opt = document.createElement("option");
          opt.value = optVal;
          opt.textContent = optVal;
          select.appendChild(opt);
        });
        select.value = state.params[key];
        select.addEventListener("change", () => {
          state.params[key] = select.value;
          val.textContent = select.value;
          rerender();
        });
        wrap.appendChild(select);
      } else {
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(cfg.min);
        input.max = String(cfg.max);
        input.step = String(cfg.step);
        input.value = String(state.params[key]);
        input.addEventListener("input", () => {
          const next = cfg.step < 1 ? parseFloat(input.value) : parseInt(input.value, 10);
          state.params[key] = next;
          val.textContent = next;
          rerender();
        });
        wrap.appendChild(input);
      }

      controlsContainer.appendChild(wrap);
    });
  }

  function renderModeControls() {
    if (axisModeControls) {
      axisModeControls.innerHTML = "";
      Object.entries(charts.X_AXIS_MODES).forEach(([key, label]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `mode-btn ${key === state.xMode ? "active" : ""}`;
        btn.textContent = label;
        btn.addEventListener("click", () => {
          state.xMode = key;
          renderModeControls();
          rerender();
        });
        axisModeControls.appendChild(btn);
      });
    }

    if (graphModeControls) {
      graphModeControls.innerHTML = "";
      Object.entries(charts.GRAPH_MODES).forEach(([key, label]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `mode-btn ${key === state.graphMode ? "active" : ""}`;
        btn.textContent = label;
        btn.addEventListener("click", () => {
          state.graphMode = key;
          state.visibleCurves = charts.getDefaultVisibleCurves(key);
          renderModeControls();
          renderCurveControls();
          rerender();
        });
        graphModeControls.appendChild(btn);
      });
    }
  }

  function renderCurveControls() {
    if (!curveControls) return;
    curveControls.innerHTML = "";
    charts.getSeriesForMode(state.graphMode).forEach((series) => {
      const label = document.createElement("label");
      label.className = "curve-chip";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state.visibleCurves[series.key] !== false;
      cb.addEventListener("change", () => {
        state.visibleCurves[series.key] = cb.checked;
        rerender();
      });
      const swatch = document.createElement("span");
      swatch.className = `swatch ${series.family || ""}`;
      swatch.style.setProperty("--swatch", series.color);
      const text = document.createElement("span");
      text.textContent = series.label;
      label.append(cb, swatch, text);
      curveControls.appendChild(label);
    });
  }

  processSelect.innerHTML = "";
  Object.entries(brewMethodPresets).forEach(([key, preset]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = preset.label;
    processSelect.appendChild(option);
  });
  processSelect.value = state.process;
  processSelect.addEventListener("change", () => {
    state.process = processSelect.value;
    state.params = { ...brewMethodPresets[state.process].defaults };
    renderControls();
    rerender();
  });

  renderControls();
  renderModeControls();
  renderCurveControls();
  rerender();
  console.warn("[coffee-bootstrap] Fallback UI init applied.");
}

window.addEventListener("load", () => {
  setTimeout(() => {
    const processSelect = document.getElementById("processSelect");
    const controlsContainer = document.getElementById("controlsContainer");
    const summaryText = document.getElementById("summaryText");

    const needsFallback =
      !processSelect ||
      processSelect.options.length === 0 ||
      !controlsContainer ||
      controlsContainer.children.length === 0 ||
      !summaryText ||
      summaryText.textContent.trim() === "";

    if (needsFallback) {
      fallbackInit().catch((e) => console.error("[coffee-bootstrap] Fallback init failed:", e));
    }
  }, 120);
});
