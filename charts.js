export const GRAPH_MODES = {
  flavor: "Flavor Characteristics",
  chemical: "Chemical Characteristics",
  overlay: "Overlay"
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
    { key: "sugars", label: "Sucrose / Sugars", color: "#93f57b", family: "chemical" },
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
    if (mode !== "overlay") {
      visible[s.key] = true;
    } else {
      visible[s.key] = i < 8 || ["sweetness", "acidity", "bitterness", "body", "polyphenols"].includes(s.key);
    }
  });
  return visible;
}

export function drawTimeChart(canvas, timeline, mode, visibleCurves) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  clear(ctx, w, h);

  const pad = { l: 54, r: 16, t: 24, b: 42 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  ctx.strokeStyle = "#213253";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = pad.t + (ch / 5) * i;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
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
      const x = pad.l + point.t * cw;
      const y = pad.t + (1 - (point[seriesItem.key] || 0) / 100) * ch;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.fillStyle = "#9db3da";
  ctx.fillText("Normalized brew progress", w / 2 - 60, h - 12);
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
      const a = (-Math.PI / 2) + (i * Math.PI * 2) / keys.length;
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
    const a = (-Math.PI / 2) + (i * Math.PI * 2) / keys.length;
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
    const a = (-Math.PI / 2) + (i * Math.PI * 2) / keys.length;
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
