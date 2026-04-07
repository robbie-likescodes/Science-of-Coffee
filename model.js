export const characteristics = [
  "acidity",
  "sweetness",
  "bitterness",
  "body",
  "aroma",
  "clarity",
  "polyphenols",
  "roastiness",
  "floralFruit",
  "chocoNut"
];

export const filterEffects = {
  paper: { body: -12, clarity: 14, polyphenols: -14, aroma: 2, lipids: -16 },
  cloth: { body: -4, clarity: 8, polyphenols: -6, aroma: 4, lipids: -6 },
  metal: { body: 12, clarity: -8, polyphenols: 10, aroma: 0, lipids: 10 }
};

export const clamp = (x, min = 0, max = 100) => Math.max(min, Math.min(max, x));
export const s = (x) => clamp(x / 100, 0, 1);

export function sigmoid(t, c, k) {
  return 1 / (1 + Math.exp(-k * (t - c)));
}

export function lateRise(t, start = 0.55, power = 2.2) {
  if (t <= start) return 0;
  const x = (t - start) / (1 - start);
  return Math.pow(clamp(x, 0, 1), power);
}

export const equationLibrary = {
  extractionSpeed: {
    id: "extractionSpeed",
    title: "Extraction Rate / Speed",
    formula:
      "extractionSpeed = c.speed × (0.58 + 0.52·grindFine + 0.24·fines + 0.33·agitation + 0.35·tempFactor + 0.18·pressureFactor + 0.10·preinfusion)",
    type: "heuristic",
    affectedGraphs: ["chemical", "flavor"],
    relevance: "Scales normalized brew time into faster/slower extraction progression for all timeline curves.",
    variables: {
      "c.speed": "Brew-method baseline speed coefficient.",
      grindFine: "1 - normalized grindSize.",
      fines: "Normalized fines amount.",
      agitation: "Normalized agitation level.",
      tempFactor: "Clamped temperature intensity factor.",
      pressureFactor: "Clamped pressure intensity factor.",
      preinfusion: "Preinfusion/contact-time ratio capped to 0.6."
    },
    compute: ({ c, grindFine, fines, agitation, tempFactor, pressureFactor, preinfusion }) =>
      c.speed * (0.58 + 0.52 * grindFine + 0.24 * fines + 0.33 * agitation + 0.35 * tempFactor + 0.18 * pressureFactor + 0.1 * preinfusion)
  },
  organicAcids: {
    id: "organicAcids",
    title: "Organic Acids Curve",
    formula: "organicAcids = 78·sigmoid(tt,0.14,11)·(1 - 0.35·lateRise(tt,0.5,1.6))·(1 - 0.2·buffering)·(1 + 0.14·minerals)",
    type: "heuristic",
    affectedGraphs: ["chemical", "flavor(acidity)"],
    relevance: "Early extraction component driving brightness/acidity behavior.",
    variables: {
      tt: "Time scaled by extractionSpeed and clamped.",
      buffering: "Normalized acidity buffering.",
      minerals: "Normalized mineral strength."
    },
    compute: ({ tt, buffering, minerals }) =>
      78 * sigmoid(tt, 0.14, 11) * (1 - 0.35 * lateRise(tt, 0.5, 1.6)) * (1 - 0.2 * buffering) * (1 + 0.14 * minerals)
  },
  sugars: {
    id: "sugars",
    title: "Sugars Curve",
    formula: "sugars = 74·sigmoid(tt,0.3,8.5)·(1 - 0.28·lateRise(tt,0.72,2.6))·(1 + 0.2·extractionEff)·(1 - 0.26·unevenness)",
    type: "heuristic",
    affectedGraphs: ["chemical", "flavor(sweetness)"],
    relevance: "Mid extraction sweetness proxy; reduced by uneven extraction.",
    variables: { tt: "Scaled normalized time.", extractionEff: "Normalized extraction efficiency.", unevenness: "Blend of bed non-uniformity and channeling." },
    compute: ({ tt, extractionEff, unevenness }) =>
      74 * sigmoid(tt, 0.3, 8.5) * (1 - 0.28 * lateRise(tt, 0.72, 2.6)) * (1 + 0.2 * extractionEff) * (1 - 0.26 * unevenness)
  },
  polyphenols: {
    id: "polyphenols",
    title: "Polyphenols Curve",
    formula: "polyphenols = 12·sigmoid(tt,0.48,6) + 62·lateRise(tt,0.62,2.35)·(1 + 0.58·fines + 0.42·unevenness + 0.12·concentration)",
    type: "heuristic",
    affectedGraphs: ["chemical", "flavor(bitterness, astringency)"],
    relevance: "Late extraction harshness proxy with strong fines/unevenness weighting.",
    variables: { fines: "Normalized fines.", unevenness: "Extraction unevenness index.", concentration: "Dose-to-ratio concentration proxy." },
    compute: ({ tt, fines, unevenness, concentration }) =>
      12 * sigmoid(tt, 0.48, 6) + 62 * lateRise(tt, 0.62, 2.35) * (1 + 0.58 * fines + 0.42 * unevenness + 0.12 * concentration)
  },
  flavorBitterness: {
    id: "flavorBitterness",
    title: "Bitterness (Flavor)",
    formula: "bitterness = (0.62·polyphenols + 0.28·maillard + 0.2·melanoidins)·(0.88 + 0.22·roast)",
    type: "heuristic weighting",
    affectedGraphs: ["flavor", "radar(bitterness)"],
    relevance: "Maps extracted compounds to perceived bitterness with roast amplification.",
    variables: { roast: "Normalized roast level." },
    compute: ({ polyphenols, maillard, melanoidins, roast }) => (0.62 * polyphenols + 0.28 * maillard + 0.2 * melanoidins) * (0.88 + 0.22 * roast)
  },
  finalClarity: {
    id: "finalClarity",
    title: "Final Clarity Score",
    formula: "clarity = clamp(56 + 0.34·acidity - 0.28·body - 0.2·polyphenols + 18·clarityBias)",
    type: "heuristic weighting",
    affectedGraphs: ["radar(clarity)"],
    relevance: "Combines acidity/body/polyphenol balance plus user clarity emphasis.",
    variables: { clarityBias: "Normalized clarity emphasis control." },
    compute: ({ acidity, body, polyphenols, clarityBias }) => clamp(56 + 0.34 * acidity - 0.28 * body - 0.2 * polyphenols + 18 * clarityBias)
  }
};

export const modelSections = [
  {
    id: "core-extraction",
    title: "Core Extraction Model",
    description: "Primary time normalization and extraction-speed logic.",
    equations: ["extractionSpeed"]
  },
  {
    id: "flavor-equations",
    title: "Flavor Characteristic Equations",
    description: "Sensory curves derived from chemical proxies and process factors.",
    equations: ["flavorBitterness"]
  },
  {
    id: "chemical-equations",
    title: "Chemical Characteristic Equations",
    description: "Chemical-family proxies over normalized extraction progress.",
    equations: ["organicAcids", "sugars", "polyphenols"]
  },
  {
    id: "presets",
    title: "Brew Method Presets / Baseline Coefficients",
    description: "Method defaults and baseline coefficients (speed, body, clarity, aroma).",
    equations: []
  },
  {
    id: "filter-effects",
    title: "Filter / Body / Polyphenol Effects",
    description: "Post-timeline adjustments by filter type.",
    equations: []
  },
  {
    id: "temp-pressure-agitation",
    title: "Temperature / Pressure / Agitation Effects",
    description: "Inputs folded into extraction speed and final bitterness weighting.",
    equations: ["extractionSpeed"]
  },
  {
    id: "roast-fines-contact",
    title: "Roast / Fines / Contact Time Effects",
    description: "Roast and fines alter late extraction compounds and flavor harshness.",
    equations: ["polyphenols", "flavorBitterness"]
  },
  {
    id: "normalization",
    title: "Normalization / Weighting Logic",
    description: "Control normalization, clamping and weighted blends used throughout.",
    equations: ["finalClarity"]
  },
  {
    id: "limitations",
    title: "Model Limitations / Educational Assumptions",
    description:
      "Curves are heuristic proxies (not laboratory concentration predictions), intended for educational intuition and relative trend exploration.",
    equations: []
  }
];
