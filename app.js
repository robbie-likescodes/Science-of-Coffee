import { processPresets } from "./presets.js";
import { runSimulation } from "./simulation.js";
import { drawRadarChart, drawTimeChart } from "./charts.js";
import { initProcessSelector, renderControls, renderSummary } from "./ui.js";

const processSelect = document.getElementById("processSelect");
const controlsContainer = document.getElementById("controlsContainer");
const summaryText = document.getElementById("summaryText");
const statsEl = document.getElementById("stats");
const timeChart = document.getElementById("timeChart");
const radarChart = document.getElementById("radarChart");

const state = {
  process: "espresso",
  params: { ...processPresets.espresso.defaults }
};

function rerender() {
  const result = runSimulation(state.process, state.params);
  drawTimeChart(timeChart, result.timeline);
  drawRadarChart(radarChart, result.finalProfile);
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
setProcess(state.process);
