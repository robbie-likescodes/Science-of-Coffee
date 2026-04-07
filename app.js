import { brewMethodPresets, clampValueForControl, controlConfig } from "./presets.js";
import { getControlEquationMeta, getModelDerivatives, runSimulation } from "./simulation.js";
import { GRAPH_MODES, X_AXIS_MODES, drawRadarChart, drawTimeChart, getDefaultVisibleCurves, getSeriesForMode } from "./charts.js";
import {
  createEquationPopupManager,
  initModeControls,
  initProcessSelector,
  initViewTabs,
  renderControls,
  renderCurveControls,
  renderEquations,
  renderMethodDescription,
  renderModelDocumentation,
  renderVariableDocumentation,
  renderSummary
} from "./ui.js";
import { variableDocs } from "./variableDocs.js";

const processSelect = document.getElementById("processSelect");
const processDescription = document.getElementById("processDescription");
const controlsContainer = document.getElementById("controlsContainer");
const resetControlsButton = document.getElementById("resetControlsButton");
const summaryText = document.getElementById("summaryText");
const interpretationBox = document.getElementById("interpretationBox");
const equationsContent = document.getElementById("equationsContent");
const statsEl = document.getElementById("stats");
const timeChart = document.getElementById("timeChart");
const radarChart = document.getElementById("radarChart");
const radarOverlay = document.getElementById("radarOverlay");
const graphModeControls = document.getElementById("graphModeControls");
const axisModeControls = document.getElementById("axisModeControls");
const curveControls = document.getElementById("curveControls");
const viewTabs = document.getElementById("viewTabs");
const simulatorView = document.getElementById("simulatorView");
const modelView = document.getElementById("modelView");
const modelToc = document.getElementById("modelToc");
const modelContent = document.getElementById("modelContent");
const processPickerWrap = document.getElementById("processPickerWrap");
const variableView = document.getElementById("variableView");
const variableContent = document.getElementById("variableContent");

const coreElements = {
  processSelect,
  processDescription,
  controlsContainer,
  summaryText,
  interpretationBox,
  equationsContent,
  statsEl,
  timeChart,
  radarChart,
  graphModeControls,
  axisModeControls,
  curveControls,
  simulatorView,
  processPickerWrap,
  variableView,
  variableContent
};

const missingCoreElements = Object.entries(coreElements)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingCoreElements.length) {
  console.error("[coffee-sim] Missing required DOM elements:", missingCoreElements.join(", "));
}

const state = {
  process: "espresso",
  view: "simulator",
  graphMode: "flavor",
  xMode: "actual",
  visibleCurves: getDefaultVisibleCurves("flavor"),
  params: { ...brewMethodPresets.espresso.defaults }
};

const popup = createEquationPopupManager();

function renderGraphControlState() {
  if (!axisModeControls || !graphModeControls || !curveControls) return;
  initModeControls(axisModeControls, X_AXIS_MODES, state.xMode, (nextMode) => {
    state.xMode = nextMode;
    rerender();
  });

  initModeControls(graphModeControls, GRAPH_MODES, state.graphMode, (nextMode) => {
    state.graphMode = nextMode;
    state.visibleCurves = getDefaultVisibleCurves(nextMode);
    renderGraphControlState();
    rerender();
  });

  const series = getSeriesForMode(state.graphMode);
  renderCurveControls(curveControls, series, state.visibleCurves, (key, checked) => {
    state.visibleCurves[key] = checked;
    rerender();
  });
}

function renderViewState() {
  if (!viewTabs || !simulatorView) return;
  initViewTabs(viewTabs, state.view, (nextView) => {
    window.location.hash = nextView === "model" ? "#model" : "#simulator";
  });

  const showSimulator = state.view === "simulator";
  const showModel = state.view === "model";
  const showVariable = state.view === "variable";
  simulatorView.classList.toggle("hidden", !showSimulator);
  if (modelView) modelView.classList.toggle("hidden", !showModel);
  if (variableView) variableView.classList.toggle("hidden", !showVariable);
  processPickerWrap.classList.toggle("hidden", !showSimulator);
  processDescription.classList.toggle("hidden", !showSimulator);
  if (radarOverlay) radarOverlay.classList.toggle("hidden", !showSimulator);
}

function rerender() {
  const result = runSimulation(state.process, state.params);
  drawTimeChart(timeChart, result.timeline, state.graphMode, state.visibleCurves, {
    xMode: state.xMode,
    guidance: result.guidance
  });
  drawRadarChart(radarChart, result.finalProfile, { compact: true });
  if (summaryText && interpretationBox && statsEl) {
    renderSummary(summaryText, interpretationBox, statsEl, result.summary, result.finalProfile, result.interpretation);
  }
  if (equationsContent && result.equations) {
    renderEquations(equationsContent, result.equations);
  }
}

function initRadarOverlayInteractions() {
  if (!radarOverlay) return;
  const title = radarOverlay.querySelector(".radar-overlay-title") || radarOverlay.querySelector("h2");
  if (!title) return;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let baseLeft = 0;
  let baseTop = 0;

  const onMove = (event) => {
    if (!dragging) return;
    const nextLeft = Math.min(
      Math.max(8, baseLeft + (event.clientX - startX)),
      window.innerWidth - radarOverlay.offsetWidth - 8
    );
    const nextTop = Math.min(
      Math.max(8, baseTop + (event.clientY - startY)),
      window.innerHeight - radarOverlay.offsetHeight - 8
    );
    radarOverlay.style.left = `${nextLeft}px`;
    radarOverlay.style.top = `${nextTop}px`;
    radarOverlay.style.right = "auto";
  };

  const onUp = () => {
    dragging = false;
    title.classList.remove("dragging");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  title.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    baseLeft = radarOverlay.offsetLeft;
    baseTop = radarOverlay.offsetTop;
    title.classList.add("dragging");
    title.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  });
}

const sliderEquationMap = {
  dose: {
    title: "Concentration term",
    equation: "concentration = clamp((dose / brewRatio) / 2.2, 0.35, 3.2)",
    variable: "concentration",
    read: (d) => d.concentrationFactor,
    effect: "Higher dose increases concentration, lifting body and intensity while amplifying late bitterness/astringency potential."
  },
  brewRatio: {
    title: "Concentration term",
    equation: "concentration = clamp((dose / brewRatio) / 2.2, 0.35, 3.2)",
    variable: "concentration",
    read: (d) => d.concentrationFactor,
    effect: "Higher brew ratio lowers concentration, usually reducing heavy body and harsh late extraction."
  },
  grindSize: {
    title: "Grind-flow coupling",
    equation: "grindFine = 1 - s(grindSize); extractionSpeed includes +0.46×grindFine, while high grindFine also raises flowResistance in pressure coupling",
    variable: "grindFine",
    read: (d) => d.grindFineFactor,
    effect: "Finer grind speeds extraction but increases resistance, making pressure shots more sensitive to harshness and channeling risk."
  },
  temperature: {
    title: "Temperature kinetics",
    equation: "tempRate = clamp(exp(0.028×(T-93)),0.16,1.65); extractionSpeed includes +0.38×tempRate and polyphenols include +0.20×tempLateRisk",
    variable: "tempRate",
    read: (d) => d.tempFactor,
    effect: "Higher temperature accelerates extraction and can improve sweetness until late-stage bitterness/astringency ramps faster."
  },
  pressure: {
    title: "Method-weighted pressure",
    equation: "pressureUseful = pressureFactor×methodPressure×clamp(1.18 - 0.5×flowResistance,0.35,1.1)",
    variable: "pressureUseful",
    read: (d) => d.pressureUseful,
    effect: "Pressure strongly affects espresso-like methods, but has limited effect in immersion brews; too much useful pressure can increase harshness."
  },
  fines: {
    title: "Fines vs harshness",
    equation: "polyphenols late term includes (1 + 0.52×fines + ...); finesMigrationRisk also penalizes extractionSpeed and raises astringency",
    variable: "fines",
    read: (d) => d.finesFactor,
    effect: "More fines increase extraction intensity and body but also raise clogging/migration risk and late bitterness/astringency."
  },
  roastLevel: {
    title: "Roast solubility and flavor",
    equation: "roastSolubility = 0.86 + 0.34×roast; bitterness scales with (0.84 + 0.30×roast)",
    variable: "roast",
    read: (d) => d.roastFactor,
    effect: "Darker roasts extract faster and skew flavor toward roastiness/bitterness with reduced sharp acidity."
  },
  contactTime: {
    title: "Contact-time progression",
    equation: "contactFactor = clamp(0.72 + 0.62×sqrt(contactTime / methodDefaultTime), 0.35, 1.8)",
    variable: "contactFactor",
    read: (d) => d.contactFactor,
    effect: "Longer contact time advances extraction into later phases (from acids to sweetness to bitterness/astringency), not just uniform scaling."
  },
  agitation: {
    title: "Method-aware agitation",
    equation: "agitationEffect = agitation × (0.42 + 0.72×methodAgitationRelevance)",
    variable: "agitationEffect",
    read: (d) => d.agitationFactor,
    effect: "Agitation has stronger effect in immersion/pour-over, weaker in compact espresso pucks; excessive agitation raises fines migration risk."
  },
  pressureAggressiveness: {
    title: "Pressure profile harshness",
    equation: "pressureHarshness increases with max(pressureUseful-0.68,0) and pressureAggressiveness under high flow resistance",
    variable: "pressureHarshness",
    read: (d) => d.pressureHarshness,
    effect: "Aggressive pressure profiles can increase channeling/harshness risk when grind and puck resistance are mismatched."
  },
  preinfusion: {
    title: "Preinfusion ratio",
    equation: "preinfusionRatio = clamp(preinfusion / max(contactTime,1), 0, 0.65); extractionSpeed includes +0.10×preinfusionRatio",
    variable: "preinfusionRatio",
    read: (d) => d.preinfusionFactor,
    effect: "More preinfusion can improve early wetting and extraction consistency, especially in percolation methods."
  },
  filterType: {
    title: "Filter output adjustment",
    equation: "finalAdjustments: body += fe.body, polyphenols += fe.polyphenols, aroma += fe.aroma, clarity gets +0.6×fe.clarity",
    variable: "filterEffect",
    read: (d) => d.filterEffect,
    format: (v) => `body ${v.body}, clarity ${v.clarity}, polyphenols ${v.polyphenols}, aroma ${v.aroma}, lipids ${v.lipids}`,
    effect: "Paper generally increases clarity and lowers oils/solids; metal raises body and suspended polyphenols."
  },
  bedUniformity: {
    title: "Unevenness mix",
    equation: "unevenness = clamp((1 - s(bedUniformity))×0.5 + s(channelingRisk)×0.78, 0, 1.5)",
    variable: "unevenness",
    read: (d) => d.unevennessFactor,
    effect: "Better bed uniformity lowers unevenness and reduces late harshness."
  },
  channelingRisk: {
    title: "Unevenness mix",
    equation: "unevenness = clamp((1 - s(bedUniformity))×0.5 + s(channelingRisk)×0.78, 0, 1.5)",
    variable: "unevenness",
    read: (d) => d.unevennessFactor,
    effect: "Higher channeling risk worsens extraction imbalance and bitterness/astringency amplification."
  },
  extractionEfficiency: {
    title: "Extraction efficiency scaling",
    equation: "extractionEff = clamp((extractionEfficiency - 40)/55, 0, 1.1); sugars include +0.22×extractionEff",
    variable: "extractionEff",
    read: (d) => d.extractionEffFactor,
    effect: "Higher extraction efficiency helps sweetness until late-stage compounds begin dominating."
  },
  mineralStrength: {
    title: "Water mineral scaling",
    equation: "organicAcids × (1 + 0.12×minerals), acidity × (0.94 + 0.10×minerals)",
    variable: "minerals",
    read: (d) => d.mineralFactor,
    effect: "Moderate mineral strength can improve extraction and perceived structure."
  },
  acidityBuffering: {
    title: "Acid buffering term",
    equation: "organicAcids × (1 - 0.22×buffering)",
    variable: "buffering",
    read: (d) => d.bufferingFactor,
    effect: "Higher buffering suppresses sharp acidity expression."
  },
  bodyEmphasis: {
    title: "Body bias term",
    equation: "body × (0.84 + 0.24×bodyBias)",
    variable: "bodyBias",
    read: (d) => d.bodyBiasFactor,
    effect: "Higher body emphasis boosts heavier tactile profile outcomes."
  },
  clarityEmphasis: {
    title: "Clarity bias term",
    equation: "final clarity includes +18×clarityBias",
    variable: "clarityBias",
    read: (d) => d.clarityBiasFactor,
    effect: "Higher clarity emphasis favors cleaner, brighter profile mapping."
  }
};

function formatValue(value) {
  return typeof value === "number" ? value.toFixed(3) : String(value);
}

function emitEquationPopup(key, previousParams, nextParams, anchorEl) {
  const mapping = getControlEquationMeta(key);
  if (!mapping || !anchorEl) return;

  const prev = getModelDerivatives(state.process, previousParams);
  const next = getModelDerivatives(state.process, nextParams);
  const metric = mapping.variable;
  const beforeRaw = prev[metric] ?? "n/a";
  const afterRaw = next[metric] ?? "n/a";
  const before = mapping.format ? mapping.format(beforeRaw) : formatValue(beforeRaw);
  const after = mapping.format ? mapping.format(afterRaw) : formatValue(afterRaw);

  popup.show({
    anchorEl,
    title: mapping.title,
    equation: mapping.equation,
    variable: metric,
    before,
    after,
    effect: mapping.effect
  });
}

function emitProcessPopup(processKey, previousProcessKey) {
  if (!processSelect || !previousProcessKey || previousProcessKey === processKey) return;
  const prevCoeff = brewMethodPresets[previousProcessKey].coeff;
  const nextCoeff = brewMethodPresets[processKey].coeff;
  popup.show({
    anchorEl: processSelect,
    title: "Brew method baseline coefficients",
    equation: "method.coeff = { speed, clarity, body, bitterness, aroma }",
    variable: "coeff",
    before: `speed ${prevCoeff.speed}, clarity ${prevCoeff.clarity}, body ${prevCoeff.body}, bitterness ${prevCoeff.bitterness}, aroma ${prevCoeff.aroma}`,
    after: `speed ${nextCoeff.speed}, clarity ${nextCoeff.clarity}, body ${nextCoeff.body}, bitterness ${nextCoeff.bitterness}, aroma ${nextCoeff.aroma}`,
    effect: "Changing brew method swaps baseline coefficients used across extraction and flavor equations."
  });
}

function setProcess(processKey) {
  const previousProcess = state.process;
  state.process = processKey;
  renderMethodDescription(processDescription, processKey);
  applyMethodDefaults(processKey);
  emitProcessPopup(processKey, previousProcess);
}

function applyMethodDefaults(processKey) {
  const defaults = brewMethodPresets[processKey]?.defaults;
  if (!defaults || !controlsContainer) return;
  state.params = { ...defaults };
  processSelect.value = processKey;

  renderControls(
    controlsContainer,
    state.params,
    processKey,
    (key, value, details = {}) => {
      const previousParams = { ...state.params };
      state.params[key] = clampValueForControl(state.process, key, value);
      emitEquationPopup(key, previousParams, state.params, details.anchorEl);
      rerender();
    },
    (key) => {
      window.location.hash = `#variable/${key}`;
    }
  );

  if (resetControlsButton) {
    resetControlsButton.onclick = () => applyMethodDefaults(state.process);
  }

  rerender();
}

function renderVariableView(variableKey) {
  if (!variableContent) return;
  const doc = variableDocs[variableKey];
  if (!doc) {
    state.view = "simulator";
    renderViewState();
    return;
  }
  const processLabel = brewMethodPresets[state.process]?.label || state.process;
  renderVariableDocumentation(variableContent, doc, processLabel, () => {
    window.location.hash = "#simulator";
  });
}

function applyRouteFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash || hash === "simulator") {
    state.view = "simulator";
    renderViewState();
    return;
  }
  if (hash === "model") {
    state.view = "model";
    renderViewState();
    return;
  }
  if (hash.startsWith("variable/")) {
    state.view = "variable";
    renderViewState();
    renderVariableView(hash.split("/")[1]);
    return;
  }
  state.view = "simulator";
  renderViewState();
}

if (missingCoreElements.length === 0) {
  initProcessSelector(processSelect, setProcess);
  renderGraphControlState();
  if (viewTabs && modelView) {
    if (modelToc && modelContent) renderModelDocumentation(modelToc, modelContent);
  }
  initRadarOverlayInteractions();
  setProcess(state.process);
  window.addEventListener("hashchange", applyRouteFromHash);
  if (!window.location.hash) window.location.hash = "#simulator";
  applyRouteFromHash();
}
