import { processPresets } from "./presets.js";
import { runSimulation } from "./simulation.js";
import { GRAPH_MODES, drawRadarChart, drawTimeChart, getDefaultVisibleCurves, getSeriesForMode } from "./charts.js";
import { initGraphModeControls, initProcessSelector, renderControls, renderCurveControls, renderSummary } from "./ui.js";

const processSelect = document.getElementById("processSelect");
const controlsContainer = document.getElementById("controlsContainer");
const summaryText = document.getElementById("summaryText");
const statsEl = document.getElementById("stats");
const timeChart = document.getElementById("timeChart");
const radarChart = document.getElementById("radarChart");
const graphModeControls = document.getElementById("graphModeControls");
const curveControls = document.getElementById("curveControls");

const state = {
  process: "espresso",
  graphMode: "flavor",
  visibleCurves: getDefaultVisibleCurves("flavor"),
  params: { ...processPresets.espresso.defaults }
};

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

function rerender() {
  const result = runSimulation(state.process, state.params);
  drawTimeChart(timeChart, result.timeline, state.graphMode, state.visibleCurves);
  drawRadarChart(radarChart, result.finalProfile, { compact: true });
  renderSummary(summaryText, statsEl, result.summary, result.finalProfile);
}

function setProcess(processKey) {
  state.process = processKey;
  state.params = { ...processPresets[processKey].defaults };
  renderControls(controlsContainer, state.params, (key, value) => {
    state.params[key] = value;
    rerender();
  });
  rerender();
}

initProcessSelector(processSelect, setProcess);
renderGraphControlState();
setProcess(state.process);
