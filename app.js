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
const radarOverlay = document.getElementById("radarOverlay");
const graphModeControls = document.getElementById("graphModeControls");
const curveControls = document.getElementById("curveControls");

const state = {
  process: "espresso",
  graphMode: "flavor",
  visibleCurves: getDefaultVisibleCurves("flavor"),
  params: { ...processPresets.espresso.defaults }
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

function rerender() {
  const result = runSimulation(state.process, state.params);
  drawTimeChart(timeChart, result.timeline, state.graphMode, state.visibleCurves);
  syncRadarCanvasSize();
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
initRadarOverlayInteractions();
setProcess(state.process);
