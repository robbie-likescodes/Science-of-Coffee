export const GRAPH_MODES = {
  flavor: "Flavor Characteristics",
  chemical: "Chemical Characteristics",
  overlay: "Overlay"
};

export const X_AXIS_MODES = {
  actual: "Actual time (s)",
  normalized: "Normalized progress"
};

const SERIES = {
  flavor: [
    { key: "sweetness", label: "Sweetness", color: "#7ff59b", family: "flavor" },
    { key: "acidity", label: "Sourness / Acidity", color: "#4cc9f0", family: "flavor" },
    { key: "bitterness", label: "Bitterness", color: "#f4a261", family: "flavor" },
    { key: "burnt", label: "Burnt / Roast", color: "#ff7b54", family: "flavor" },
    { key: "body", label: "Body", color: "#e9c46a", family: "flavor" },
    { key: "astringency", label: "Astringency", color: "#ef476f", family: "flavor" }
  ],
  chemical: [
    { key: "organicAcids", label: "Organic Acids", color: "#5ec8ff", family: "chemical" },
    { key: "sugars", label: "Sugars", color: "#93f57b", family: "chemical" },
    { key: "polyphenols", label: "Polyphenols", color: "#ff4d6d", family: "chemical" },
    { key: "maillard", label: "Maillard / Caramelized", color: "#ffb703", family: "chemical" },
    { key: "melanoidins", label: "Melanoidins", color: "#d48a39", family: "chemical" },
    { key: "lipids", label: "Lipids / Oils", color: "#cdb4db", family: "chemical" },
    { key: "aromatics", label: "Aromatic Compounds", color: "#9d4edd", family: "chemical" }
  ]
};

function clear(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0a1224";
  ctx.fillRect(0, 0, w, h);
}

export function getSeriesForMode(mode) {
  if (mode === "overlay") return [...SERIES.flavor, ...SERIES.chemical];
  return SERIES[mode] || SERIES.flavor;
}

export function getDefaultVisibleCurves(mode) {
  const visible = {};
  const all = getSeriesForMode(mode);
  all.forEach((s, i) => {
    visible[s.key] = mode !== "overlay" ? true : i < 9;
  });
  return visible;
}

function xFromPoint(point, xMode) {
  return xMode === "actual" ? point.seconds : point.progress;
}

function formatSecondsLabel(seconds) {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}


function drawGuidanceZones(ctx, pad, cw, ch, guidance, xMax, xMode) {
  const zones = [
    { ...guidance.early, color: "rgba(71, 133, 255, 0.15)" },
    { ...guidance.balanced, color: "rgba(84, 221, 152, 0.16)" },
    { ...guidance.late, color: "rgba(255, 121, 121, 0.15)" }
  ];

  zones.forEach((zone) => {
    const start = xMode === "actual" ? zone.start : zone.start / xMax;
    const end = xMode === "actual" ? zone.end : zone.end / xMax;
    const x0 = pad.l + Math.max(0, start) / xMax * cw;
    const x1 = pad.l + Math.min(xMax, end) / xMax * cw;
    ctx.fillStyle = zone.color;
    ctx.fillRect(x0, pad.t, Math.max(0, x1 - x0), ch);
  });
}

function drawMarkers(ctx, pad, cw, ch, guidance, xMax, xMode) {
  const toX = (v) => {
    const x = xMode === "actual" ? v : v / xMax;
    return pad.l + (x / xMax) * cw;
  };

  const targetX = toX(guidance.targetStop);
  ctx.strokeStyle = "#71e39e";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(targetX, pad.t);
  ctx.lineTo(targetX, pad.t + ch);
  ctx.stroke();

  const sweetX = toX(guidance.sweetPeakTime);
  ctx.strokeStyle = "#9ae6b4";
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(sweetX, pad.t);
  ctx.lineTo(sweetX, pad.t + ch);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#cde7ff";
  ctx.font = "11px sans-serif";
  ctx.fillText("Balanced zone", toX((guidance.balanced.start + guidance.balanced.end) / 2) - 34, pad.t + 14);
  ctx.fillText("Sweetness plateau", sweetX + 4, pad.t + 28);
  ctx.fillText("Bitterness rising", toX(guidance.late.start) + 4, pad.t + 42);
}

export function drawTimeChart(canvas, timeline, mode, visibleCurves, chartContext) {
  const { xMode = "actual", guidance } = chartContext || {};
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  clear(ctx, w, h);

  const pad = { l: 54, r: 20, t: 24, b: 42 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const xMax = xMode === "actual" ? Math.max(timeline[timeline.length - 1]?.seconds || 1, 1) : 1;

  if (guidance) drawGuidanceZones(ctx, pad, cw, ch, guidance, xMode === "actual" ? xMax : guidance.late.end, xMode);

  ctx.strokeStyle = "#213253";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pad.t + (ch / 5) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
  }

  for (let i = 0; i <= 6; i++) {
    const x = pad.l + (cw / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + ch);
    ctx.strokeStyle = "rgba(33,50,83,0.45)";
    ctx.stroke();
  }

  ctx.fillStyle = "#8ea5cf";
  ctx.font = "11px sans-serif";
  for (let i = 0; i <= 6; i++) {
    const tickValue = (xMax / 6) * i;
    const x = pad.l + (cw / 6) * i;
    const label = xMode === "actual" ? formatSecondsLabel(tickValue) : tickValue.toFixed(2);
    ctx.fillText(label, x - 12, h - pad.b + 16);
  }

  ctx.fillStyle = "#8ea5cf";
  ctx.font = "12px sans-serif";
  for (let i = 0; i <= 5; i++) {
    const value = 100 - i * 20;
    const y = pad.t + (ch / 5) * i;
    ctx.fillText(`${value}`, 10, y + 4);
  }

  const series = getSeriesForMode(mode).filter((s) => visibleCurves[s.key] !== false);

  for (const seriesItem of series) {
    ctx.strokeStyle = seriesItem.color;
    ctx.lineWidth = 2.15;
    ctx.setLineDash(seriesItem.family === "chemical" && mode === "overlay" ? [7, 5] : []);
    ctx.beginPath();
    timeline.forEach((point, index) => {
      const x = pad.l + (xFromPoint(point, xMode) / xMax) * cw;
      const y = pad.t + (1 - (point[seriesItem.key] || 0) / 100) * ch;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  if (guidance) drawMarkers(ctx, pad, cw, ch, guidance, xMode === "actual" ? xMax : guidance.late.end, xMode);

  ctx.setLineDash([]);
  ctx.fillStyle = "#9db3da";
  ctx.fillText(xMode === "actual" ? "Extraction time" : "Normalized extraction progress", w / 2 - 56, h - 12);
}

export function drawRadarChart(canvas, profile, options = {}) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  clear(ctx, w, h);

  const keys = ["acidity", "sweetness", "bitterness", "body", "aroma", "clarity", "polyphenols", "roastiness", "floralFruit", "chocoNut"];
  const compactLabels = {
    acidity: "Acid",
    sweetness: "Sweet",
    bitterness: "Bitter",
    body: "Body",
    aroma: "Aroma",
    clarity: "Clear",
    polyphenols: "Poly",
    roastiness: "Roast",
    floralFruit: "Floral",
    chocoNut: "Choco"
  };
  const compact = options.compact === true;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * (compact ? 0.35 : 0.34);

  ctx.strokeStyle = "#223a61";
  for (let ring = 1; ring <= 5; ring++) {
    ctx.beginPath();
    for (let i = 0; i < keys.length; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / keys.length;
      const r = (radius / 5) * ring;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.strokeStyle = "#2e4d7c";
  keys.forEach((key, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / keys.length;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.fillStyle = compact ? "#b7c8e6" : "#cfe0ff";
    ctx.font = compact ? "10px sans-serif" : "12px sans-serif";
    const label = compact ? compactLabels[key] : key;
    ctx.fillText(label, cx + Math.cos(a) * (radius + 10) - 16, cy + Math.sin(a) * (radius + 10));
  });

  ctx.beginPath();
  keys.forEach((key, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / keys.length;
    const r = (profile[key] / 100) * radius;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(90,176,255,0.28)";
  ctx.strokeStyle = "#5ab0ff";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
}
