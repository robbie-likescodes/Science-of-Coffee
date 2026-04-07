import { brewMethodPresets } from "./presets.js";
import { getModelDerivatives, runSimulation } from "./simulation.js";
import { GRAPH_MODES, drawRadarChart, drawTimeChart, getDefaultVisibleCurves, getSeriesForMode } from "./charts.js";
import {
  createEquationPopupManager,
  initGraphModeControls,
  initProcessSelector,
  initViewTabs,
  renderControls,
  renderCurveControls,
  renderMethodDescription,
  renderModelDocumentation,
  renderSummary
} from "./ui.js";

const processSelect = document.getElementById("processSelect");
const processDescription = document.getElementById("processDescription");
const controlsContainer = document.getElementById("controlsContainer");
const summaryText = document.getElementById("summaryText");
const statsEl = document.getElementById("stats");
const timeChart = document.getElementById("timeChart");
const radarChart = document.getElementById("radarChart");
const radarOverlay = document.getElementById("radarOverlay");
const graphModeControls = document.getElementById("graphModeControls");
const curveControls = document.getElementById("curveControls");
const viewTabs = document.getElementById("viewTabs");
const simulatorView = document.getElementById("simulatorView");
const modelView = document.getElementById("modelView");
const modelToc = document.getElementById("modelToc");
const modelContent = document.getElementById("modelContent");
const processPickerWrap = document.getElementById("processPickerWrap");

const state = {
  process: "espresso",
  graphMode: "flavor",
  view: "simulator",
  visibleCurves: getDefaultVisibleCurves("flavor"),
  params: { ...brewMethodPresets.espresso.defaults }
};

function syncRadarCanvasSize() {
  const cssSize = Math.max(180, Math.floor(radarChart.clientWidth));
  if (radarChart.width !== cssSize || radarChart.height !== cssSize) {
    radarChart.width = cssSize;
    radarChart.height = cssSize;
  }
}

function initRadarOverlayInteractions() {
  const dragHandle = radarOverlay.querySelector(".radar-overlay-title");
  let dragging = false;
  let pointerOffsetX = 0;
  let pointerOffsetY = 0;

  dragHandle.addEventListener("pointerdown", (event) => {
    dragging = true;
    const bounds = radarOverlay.getBoundingClientRect();
    pointerOffsetX = event.clientX - bounds.left;
    pointerOffsetY = event.clientY - bounds.top;
    radarOverlay.style.left = `${bounds.left}px`;
    radarOverlay.style.top = `${bounds.top}px`;
    radarOverlay.style.right = "auto";
    dragHandle.setPointerCapture(event.pointerId);
  });

  dragHandle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const maxLeft = window.innerWidth - radarOverlay.offsetWidth;
    const maxTop = window.innerHeight - radarOverlay.offsetHeight;
    const nextLeft = Math.min(Math.max(0, event.clientX - pointerOffsetX), Math.max(0, maxLeft));
    const nextTop = Math.min(Math.max(0, event.clientY - pointerOffsetY), Math.max(0, maxTop));
    radarOverlay.style.left = `${nextLeft}px`;
    radarOverlay.style.top = `${nextTop}px`;
  });

  const stopDragging = () => {
    dragging = false;
  };

  dragHandle.addEventListener("pointerup", stopDragging);
  dragHandle.addEventListener("pointercancel", stopDragging);

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => rerender());
    observer.observe(radarOverlay);
  } else {
    window.addEventListener("resize", rerender);
  }
}

function renderGraphControlState() {
  initGraphModeControls(graphModeControls, GRAPH_MODES, state.graphMode, (nextMode) => {
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
  initViewTabs(viewTabs, state.view, (nextView) => {
    state.view = nextView;
    renderViewState();
  });

  const showSimulator = state.view === "simulator";
  simulatorView.classList.toggle("hidden", !showSimulator);
  modelView.classList.toggle("hidden", showSimulator);
  processPickerWrap.classList.toggle("hidden", !showSimulator);
  processDescription.classList.toggle("hidden", !showSimulator);
}

function rerender() {
  const result = runSimulation(state.process, state.params);
  drawTimeChart(timeChart, result.timeline, state.graphMode, state.visibleCurves);
  syncRadarCanvasSize();
  drawRadarChart(radarChart, result.finalProfile, { compact: true });
  renderSummary(summaryText, statsEl, result.summary, result.finalProfile);
}

const sliderEquationMap = {
  dose: {
    title: "Concentration term",
    equation: "concentration = clamp((dose / brewRatio) / 2.2, 0.35, 3.2)",
    variable: "concentration",
    read: (d) => d.concentrationFactor,
    effect: "Higher dose increases concentration, which lifts body, melanoidins, and polyphenol carryover."
  },
  brewRatio: {
    title: "Concentration term",
    equation: "concentration = clamp((dose / brewRatio) / 2.2, 0.35, 3.2)",
    variable: "concentration",
    read: (d) => d.concentrationFactor,
    effect: "Higher brew ratio lowers concentration, usually reducing body intensity and late extraction heaviness."
  },
  grindSize: {
    title: "Grind contribution",
    equation: "grindFine = 1 - s(grindSize); extractionSpeed includes +0.52×grindFine",
    variable: "grindFine",
    read: (d) => d.grindFineFactor,
    effect: "Finer grind (lower grindSize) increases grindFine and accelerates extraction."
  },
  temperature: {
    title: "Extraction speed relationship",
    equation: "extractionSpeed = c.speed × (0.58 + 0.52×grindFine + 0.24×fines + 0.33×agitation + 0.35×tempFactor + 0.18×pressureFactor + 0.10×preinfusion)",
    variable: "tempFactor",
    read: (d) => d.tempFactor,
    effect: "Higher temperature raises tempFactor, increasing extraction speed and pushing stronger late-stage bitterness/polyphenol extraction."
  },
  pressure: {
    title: "Pressure term",
    equation: "pressureFactor = clamp((pressure - 1) / 9, 0, 1.5); extractionSpeed includes +0.18×pressureFactor",
    variable: "pressureFactor",
    read: (d) => d.pressureFactor,
    effect: "Higher pressure increases extraction speed and also scales final bitterness through (1 + 0.08×pressureFactor)."
  },
  fines: {
    title: "Fines-driven extraction",
    equation: "polyphenols = 12×sigmoid(tt,0.48,6) + 62×lateRise(tt,0.62,2.35)×(1 + 0.58×fines + 0.42×unevenness + 0.12×concentration)",
    variable: "fines",
    read: (d) => d.finesFactor,
    effect: "More fines strongly increase polyphenols and also raise lipids/melanoidins, usually increasing body and bitterness while reducing clarity."
  },
  roastLevel: {
    title: "Roast scaling",
    equation: "roast = s(roastLevel); bitterness *= (0.88 + 0.22×roast), burnt *= (0.75 + 0.35×roast)",
    variable: "roast",
    read: (d) => d.roastFactor,
    effect: "Higher roast level increases bitterness and roastiness scaling while muting some acidity."
  },
  contactTime: {
    title: "Preinfusion ratio",
    equation: "preinfusion = clamp(preinfusion / max(contactTime,1), 0, 0.6); extractionSpeed includes +0.10×preinfusion",
    variable: "preinfusionRatio",
    read: (d) => d.preinfusionFactor,
    effect: "Longer contact time lowers the preinfusion ratio contribution for the same preinfusion seconds."
  },
  agitation: {
    title: "Agitation contribution",
    equation: "extractionSpeed includes +0.33×agitation; aromatics scales with (1 + 0.16×agitation + 0.12×c.aroma)",
    variable: "agitation",
    read: (d) => d.agitationFactor,
    effect: "More agitation accelerates extraction and tends to boost aromatic intensity."
  },
  pressureAggressiveness: {
    title: "Current model note",
    equation: "pressureAggressiveness is present in UI params but not currently used in runSimulation equations",
    variable: "pressureAggressiveness",
    read: () => "unused",
    effect: "This control is currently inert in the implemented heuristic model."
  },
  preinfusion: {
    title: "Preinfusion ratio",
    equation: "preinfusion = clamp(preinfusion / max(contactTime,1), 0, 0.6); extractionSpeed includes +0.10×preinfusion",
    variable: "preinfusionRatio",
    read: (d) => d.preinfusionFactor,
    effect: "More preinfusion raises extractionSpeed slightly through the preinfusion ratio."
  },
  filterType: {
    title: "Filter output adjustment",
    equation: "finalAdjustments: body += fe.body, polyphenols += fe.polyphenols, aroma += fe.aroma, lipids += fe.lipids",
    variable: "filterEffect",
    read: (d) => d.filterEffect,
    format: (v) => `body ${v.body}, clarity ${v.clarity}, polyphenols ${v.polyphenols}, aroma ${v.aroma}, lipids ${v.lipids}`,
    effect: "Filter type directly shifts body/clarity/polyphenols/lipids after extraction."
  },
  bedUniformity: {
    title: "Unevenness mix",
    equation: "unevenness = clamp((1 - s(bedUniformity))×0.55 + s(channelingRisk)×0.75, 0, 1.35)",
    variable: "unevenness",
    read: (d) => d.unevennessFactor,
    effect: "Better bed uniformity lowers unevenness, reducing harsh bitterness/astringency scaling."
  },
  channelingRisk: {
    title: "Unevenness mix",
    equation: "unevenness = clamp((1 - s(bedUniformity))×0.55 + s(channelingRisk)×0.75, 0, 1.35)",
    variable: "unevenness",
    read: (d) => d.unevennessFactor,
    effect: "More channeling risk raises unevenness, increasing bitterness and astringency multipliers."
  },
  extractionEfficiency: {
    title: "Extraction efficiency scaling",
    equation: "extractionEff = clamp((extractionEfficiency - 40)/55, 0, 1.1); sweetness *= (0.92 + 0.20×extractionEff)",
    variable: "extractionEff",
    read: (d) => d.extractionEffFactor,
    effect: "Higher extraction efficiency boosts sugars/sweetness weighting."
  },
  mineralStrength: {
    title: "Water mineral scaling",
    equation: "minerals = s(mineralStrength); organicAcids × (1 + 0.14×minerals), acidity × (0.94 + 0.12×minerals)",
    variable: "minerals",
    read: (d) => d.mineralFactor,
    effect: "Higher mineral strength boosts acid extraction and final acidity slightly."
  },
  acidityBuffering: {
    title: "Acid buffering term",
    equation: "buffering = s(acidityBuffering); organicAcids × (1 - 0.2×buffering)",
    variable: "buffering",
    read: (d) => d.bufferingFactor,
    effect: "Higher buffering suppresses organic acid expression."
  },
  bodyEmphasis: {
    title: "Body bias term",
    equation: "bodyBias = s(bodyEmphasis); body × (0.86 + 0.2×bodyBias), lipids × (1 + 0.25×bodyBias)",
    variable: "bodyBias",
    read: (d) => d.bodyBiasFactor,
    effect: "Higher body emphasis boosts lipids/body weighting."
  },
  clarityEmphasis: {
    title: "Clarity bias term",
    equation: "clarityBias = s(clarityEmphasis); acidity × (0.82 + 0.16×clarityBias), final clarity += 18×clarityBias",
    variable: "clarityBias",
    read: (d) => d.clarityBiasFactor,
    effect: "Higher clarity emphasis increases acidity definition and final clarity score."
  }
};

function formatValue(value) {
  return typeof value === "number" ? value.toFixed(3) : String(value);
}

function emitEquationPopup(key, previousParams, nextParams, anchorEl) {
  const mapping = sliderEquationMap[key];
  if (!mapping || !anchorEl) return;
  const prev = getModelDerivatives(state.process, previousParams);
  const next = getModelDerivatives(state.process, nextParams);
  const beforeRaw = mapping.read(prev);
  const afterRaw = mapping.read(next);
  const before = mapping.format ? mapping.format(beforeRaw) : formatValue(beforeRaw);
  const after = mapping.format ? mapping.format(afterRaw) : formatValue(afterRaw);

  popup.show({
    anchorEl,
    title: mapping.title,
    equation: mapping.equation,
    variable: mapping.variable,
    before,
    after,
    effect: mapping.effect
  });
}

function emitProcessPopup(processKey, previousProcessKey) {
  if (!processPicker || !previousProcessKey || previousProcessKey === processKey) return;
  const prevCoeff = brewMethodPresets[previousProcessKey].coeff;
  const nextCoeff = brewMethodPresets[processKey].coeff;
  popup.show({
    anchorEl: processPicker,
    title: "Brew method baseline coefficients",
    equation: "method.coeff = { speed, clarity, body, bitterness, aroma }",
    variable: "coeff",
    before: `speed ${prevCoeff.speed}, clarity ${prevCoeff.clarity}, body ${prevCoeff.body}, bitterness ${prevCoeff.bitterness}, aroma ${prevCoeff.aroma}`,
    after: `speed ${nextCoeff.speed}, clarity ${nextCoeff.clarity}, body ${nextCoeff.body}, bitterness ${nextCoeff.bitterness}, aroma ${nextCoeff.aroma}`,
    effect: "Changing brew method swaps the baseline coefficient preset used across extraction and flavor equations."
  });
}

function setProcess(processKey) {
  const previousProcess = state.process;
  state.process = processKey;
  state.params = { ...brewMethodPresets[processKey].defaults };
  renderMethodDescription(processDescription, processKey);
  renderControls(controlsContainer, state.params, (key, value, meta) => {
    const previousParams = { ...state.params };
    state.params[key] = value;
    emitEquationPopup(key, previousParams, state.params, meta?.anchorEl);
    rerender();
  });
  emitProcessPopup(processKey, previousProcess);
  rerender();
}

initProcessSelector(processSelect, setProcess);
renderGraphControlState();
initRadarOverlayInteractions();
setProcess(state.process);
