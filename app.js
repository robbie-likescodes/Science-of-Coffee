import { brewMethodPresets } from "./presets.js";
import { runSimulation } from "./simulation.js";
import { GRAPH_MODES, drawRadarChart, drawTimeChart, getDefaultVisibleCurves, getSeriesForMode } from "./charts.js";
import {
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
  drawRadarChart(radarChart, result.finalProfile, { compact: true });
  renderSummary(summaryText, statsEl, result.summary, result.finalProfile);
}

function setProcess(processKey) {
  state.process = processKey;
  state.params = { ...brewMethodPresets[processKey].defaults };
  renderMethodDescription(processDescription, processKey);
  renderControls(controlsContainer, state.params, (key, value) => {
    state.params[key] = value;
    rerender();
  });
  rerender();
}

initProcessSelector(processSelect, setProcess);
renderGraphControlState();
renderModelDocumentation(modelToc, modelContent);
renderViewState();
setProcess(state.process);
