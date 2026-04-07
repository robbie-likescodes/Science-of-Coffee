const COLORS = {
  acidity: "#4cc9f0",
  sweetness: "#7ff59b",
  bitterness: "#f4a261",
  body: "#e9c46a",
  polyphenols: "#ef476f",
  aroma: "#c77dff",
  clarity: "#90e0ef",
  roastiness: "#ff9f1c",
  floralFruit: "#73fbd3",
  chocoNut: "#c08552"
};

function clear(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0a1224";
  ctx.fillRect(0, 0, w, h);
}

export function drawTimeChart(canvas, timeline) {
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

  const seriesKeys = ["acidity", "sweetness", "bitterness", "body", "polyphenols"];
  for (const key of seriesKeys) {
    ctx.strokeStyle = COLORS[key];
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    timeline.forEach((point, index) => {
      const x = pad.l + point.t * cw;
      const y = pad.t + (1 - point[key] / 100) * ch;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.fillStyle = "#9db3da";
  ctx.fillText("Normalized brew progress", w / 2 - 60, h - 12);

  let lx = pad.l;
  const ly = 10;
  for (const key of seriesKeys) {
    ctx.fillStyle = COLORS[key];
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = "#dbe7ff";
    ctx.fillText(key, lx + 14, ly + 9);
    lx += 120;
  }
}

export function drawRadarChart(canvas, profile) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  clear(ctx, w, h);

  const keys = ["acidity", "sweetness", "bitterness", "body", "aroma", "clarity", "polyphenols", "roastiness", "floralFruit", "chocoNut"];
  const cx = w / 2;
  const cy = h / 2 + 15;
  const radius = Math.min(w, h) * 0.34;

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

    ctx.fillStyle = "#cfe0ff";
    ctx.font = "12px sans-serif";
    ctx.fillText(key, cx + Math.cos(a) * (radius + 14) - 20, cy + Math.sin(a) * (radius + 14));
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
