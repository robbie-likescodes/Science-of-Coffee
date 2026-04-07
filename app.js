import { brewMethodPresets } from "./presets.js";
import { getControlEquationMeta, getModelDerivatives, runSimulation } from "./simulation.js";
import { GRAPH_MODES, X_AXIS_MODES, drawRadarChart, drawTimeChart, getDefaultVisibleCurves, getSeriesForMode } from "./charts.js";
import {
  createEquationPopupManager,
  initModeControls,
  initProcessSelector,
  renderControls,
  renderCurveControls,
  renderEquations,
  renderMethodDescription,
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
const graphModeControls = document.getElementById("graphModeControls");
const axisModeControls = document.getElementById("axisModeControls");
const curveControls = document.getElementById("curveControls");
const processPicker = document.querySelector(".process-picker");
const popup = createEquationPopupManager();

const state = {
  process: "espresso",
  graphMode: "flavor",
  xMode: "actual",
  visibleCurves: getDefaultVisibleCurves("flavor"),
  params: { ...brewMethodPresets.espresso.defaults }
};

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
setProcess(state.process);
