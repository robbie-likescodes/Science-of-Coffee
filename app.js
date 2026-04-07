import { brewMethodPresets } from "./presets.js";
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
  renderSummary
} from "./ui.js";

const processSelect = document.getElementById("processSelect");
const processDescription = document.getElementById("processDescription");
const controlsContainer = document.getElementById("controlsContainer");
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

const state = {
  process: "espresso",
  graphMode: "flavor",
  xMode: "actual",
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
  drawTimeChart(timeChart, result.timeline, state.graphMode, state.visibleCurves, {
    xMode: state.xMode,
    guidance: result.guidance
  });
  drawRadarChart(radarChart, result.finalProfile, { compact: true });
  renderSummary(summaryText, interpretationBox, statsEl, result.summary, result.finalProfile, result.interpretation);
  renderEquations(equationsContent, result.equations);
}

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
  if (!processPicker || !previousProcessKey || previousProcessKey === processKey) return;
  const prevCoeff = brewMethodPresets[previousProcessKey].coeff;
  const nextCoeff = brewMethodPresets[processKey].coeff;
  popup.show({
    anchorEl: processPicker,
    title: "Brew method baseline coefficients",
    equation: "coeff = { speed, clarity, body, bitterness, aroma, immersion, windowWidth }",
    variable: "method.coeff",
    before: JSON.stringify(prevCoeff),
    after: JSON.stringify(nextCoeff),
    effect: "Each brew method gets a distinct baseline timeline shape, body/clarity balance, and sweet-window width."
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
