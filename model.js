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
      "extractionSpeed = c.speed × (0.34 + 0.42·grindFine + 0.14·fines + 0.24·agitationEffect + 0.44·tempRate + 0.20·pressureUseful + 0.08·preinfusion + 0.20·roastSolubility - 0.16·finesMigrationRisk)",
    math:
      "E = c_{\\mathrm{speed}}\\cdot\\Bigl(0.34 + 0.42g + 0.14f + 0.24a + 0.44\\tau + 0.20p + 0.08\\rho + 0.20r_s - 0.16m_f\\Bigr)",
    type: "heuristic",
    affectedGraphs: ["chemical", "flavor"],
    relevance: "Combines grind, temperature, pressure coupling, contact flow and roast solubility into extraction progression speed.",
    variables: {
      "c.speed": "Brew-method baseline speed coefficient.",
      grindFine: "1 - normalized grindSize.",
      fines: "Normalized fines amount.",
      agitationEffect: "Agitation scaled by method relevance (immersion/percolation sensitive).",
      tempRate: "Temperature kinetic multiplier from an Arrhenius-like exponential term.",
      pressureUseful: "Method-weighted pressure term damped by flow resistance.",
      preinfusion: "Preinfusion/contact-time ratio capped to 0.65.",
      roastSolubility: "Darker roast solubility boost term.",
      finesMigrationRisk: "Penalty for aggressive agitation/pressure driving fines movement."
    },
    compute: ({ c, grindFine, fines, agitationEffect, tempRate, pressureUseful, preinfusion, roastSolubility, finesMigrationRisk }) =>
      c.speed *
      (0.34 +
        0.42 * grindFine +
        0.14 * fines +
        0.24 * agitationEffect +
        0.44 * tempRate +
        0.2 * pressureUseful +
        0.08 * preinfusion +
        0.2 * roastSolubility -
        0.16 * finesMigrationRisk)
  },
  organicAcids: {
    id: "organicAcids",
    title: "Organic Acids Curve",
    formula:
      "organicAcids = 74·sigmoid(tt,0.16,10)·(1 - 0.34·lateRise(tt,0.57,1.6))·(1 - 0.22·buffering)·(1 + 0.12·minerals)·(1 - 0.1·roast)·(1 + 0.16·tempAcidShift)",
    math:
      "A_{\\mathrm{org}} = 74\\,\\sigma(t_t;0.16,10)\\,\\Bigl(1 - 0.34L(t_t;0.57,1.6)\\Bigr)\\,(1-0.22b)\\,(1+0.12m)\\,(1-0.1r)\\,(1+0.16\\Delta_a)",
    type: "heuristic",
    affectedGraphs: ["chemical", "flavor(acidity)"],
    relevance: "Early extraction acidity proxy with buffering and temperature-dependent retention/muting behavior.",
    variables: {
      tt: "Time scaled by extractionSpeed × contactFactor and clamped.",
      buffering: "Normalized acidity buffering.",
      minerals: "Normalized mineral strength.",
      roast: "Normalized roast level.",
      tempAcidShift: "Colder extraction increases retained sourness; hotter extraction reduces sharp acidity."
    },
    compute: ({ tt, buffering, minerals, roast, tempAcidShift }) =>
      74 * sigmoid(tt, 0.16, 10) * (1 - 0.34 * lateRise(tt, 0.57, 1.6)) * (1 - 0.22 * buffering) * (1 + 0.12 * minerals) * (1 - 0.1 * roast) * (1 + 0.16 * tempAcidShift)
  },
  sugars: {
    id: "sugars",
    title: "Sugars Curve",
    formula:
      "sugars = 74·sigmoid(tt,0.39,8)·(1 - 0.3·lateRise(tt,0.8,2.4))·(1 + 0.24·extractionEff + 0.1·tempSweetBoost)·(1 - 0.28·unevenness)·(0.9 + 0.12·roast)",
    math:
      "S = 74\\,\\sigma(t_t;0.39,8)\\,\\Bigl(1-0.3L(t_t;0.8,2.4)\\Bigr)\\,(1+0.24\\eta+0.1\\Delta_s)\\,(1-0.28u)\\,(0.9+0.12r)",
    type: "heuristic",
    affectedGraphs: ["chemical", "flavor(sweetness)"],
    relevance: "Mid-stage sweetness proxy with realistic plateau and late decline under prolonged extraction.",
    variables: {
      tt: "Scaled normalized time.",
      extractionEff: "Normalized extraction efficiency.",
      unevenness: "Blend of bed non-uniformity and channeling.",
      roast: "Normalized roast level.",
      tempSweetBoost: "Moderate-hot extraction raises sugar/caramel extraction up to a limit."
    },
    compute: ({ tt, extractionEff, unevenness, roast, tempSweetBoost }) =>
      74 * sigmoid(tt, 0.39, 8) * (1 - 0.3 * lateRise(tt, 0.8, 2.4)) * (1 + 0.24 * extractionEff + 0.1 * tempSweetBoost) * (1 - 0.28 * unevenness) * (0.9 + 0.12 * roast)
  },
  polyphenols: {
    id: "polyphenols",
    title: "Polyphenols Curve",
    formula:
      "polyphenols = 8·sigmoid(tt,0.54,6) + 72·lateRise(tt,0.66,2.35)·(1 + 0.55·fines + 0.5·unevenness + 0.1·concentration + 0.24·tempLateRisk + 0.28·pressureHarshness)",
    math:
      "P = 8\\,\\sigma(t_t;0.54,6) + 72\\,L(t_t;0.66,2.35)\\,\\Bigl(1 + 0.55f + 0.5u + 0.1c + 0.24\\lambda + 0.28h\\Bigr)",
    type: "heuristic",
    affectedGraphs: ["chemical", "flavor(bitterness, astringency)"],
    relevance: "Late extraction harshness proxy increased by fines, uneven flow, high temperature, and over-aggressive pressure.",
    variables: {
      fines: "Normalized fines.",
      unevenness: "Extraction unevenness index.",
      concentration: "Dose-to-ratio concentration proxy.",
      tempLateRisk: "High-temperature late-stage harshness accelerator.",
      pressureHarshness: "Pressure/flow mismatch harshness penalty."
    },
    compute: ({ tt, fines, unevenness, concentration, tempLateRisk, pressureHarshness }) =>
      8 * sigmoid(tt, 0.54, 6) +
      72 * lateRise(tt, 0.66, 2.35) * (1 + 0.55 * fines + 0.5 * unevenness + 0.1 * concentration + 0.24 * tempLateRisk + 0.28 * pressureHarshness)
  },
  flavorBitterness: {
    id: "flavorBitterness",
    title: "Bitterness (Flavor)",
    formula: "bitterness = (0.5·polyphenols + 0.2·maillard + 0.18·melanoidins)·(0.82 + 0.28·roast)·(0.9 + 0.05·concentration + 0.1·pressureHarshness)",
    math: "B = (0.5P + 0.2M_a + 0.18M_e)\\,(0.82 + 0.28r)\\,(0.9 + 0.05c + 0.1h)",
    type: "heuristic weighting",
    affectedGraphs: ["flavor", "radar(bitterness)"],
    relevance: "Maps late-stage chemistry to perceived bitterness with roast and concentration/pressure harshness amplification.",
    variables: {
      roast: "Normalized roast level.",
      concentration: "Dose-to-ratio concentration proxy.",
      pressureHarshness: "Extra bitterness from aggressive pressure under high resistance/uneven conditions."
    },
    compute: ({ polyphenols, maillard, melanoidins, roast, concentration, pressureHarshness }) =>
      (0.5 * polyphenols + 0.2 * maillard + 0.18 * melanoidins) * (0.82 + 0.28 * roast) * (0.9 + 0.05 * concentration + 0.1 * pressureHarshness)
  },
  finalClarity: {
    id: "finalClarity",
    title: "Final Clarity Score",
    formula: "clarity = clamp(54 + 0.34·acidity - 0.3·body - 0.2·polyphenols + 18·clarityBias + 0.6·filterClarity)",
    math: "C_{\\mathrm{final}} = \\operatorname{clamp}\\!\\left(54 + 0.34A - 0.3B_d - 0.2P + 18\\kappa + 0.6\\phi\\right)",
    type: "heuristic weighting",
    affectedGraphs: ["radar(clarity)"],
    relevance: "Combines chemistry/body balance and explicit filter clarity contribution.",
    variables: { clarityBias: "Normalized clarity emphasis control.", filterClarity: "Filter-dependent clarity coefficient (paper > cloth > metal)." },
    compute: ({ acidity, body, polyphenols, clarityBias, filterClarity }) => clamp(54 + 0.34 * acidity - 0.3 * body - 0.2 * polyphenols + 18 * clarityBias + 0.6 * filterClarity)
  }
};

export const modelSections = [
  {
    id: "core-extraction",
    title: "Core Extraction Model",
    description: "Primary extraction-speed logic plus method-specific pressure/agitation relevance and contact-time scaling.",
    equations: ["extractionSpeed"]
  },
  {
    id: "flavor-equations",
    title: "Flavor Characteristic Equations",
    description: "Sensory curves are derived from chemistry proxies (not copied directly) and include roast/concentration/harshness coupling.",
    equations: ["flavorBitterness"]
  },
  {
    id: "chemical-equations",
    title: "Chemical Characteristic Equations",
    description: "Physically inspired extraction-family proxies over normalized progress.",
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
    description: "Temperature alters kinetics and late-stage harshness; pressure only matters strongly where method dynamics allow.",
    equations: ["extractionSpeed", "polyphenols", "flavorBitterness"]
  },
  {
    id: "roast-fines-contact",
    title: "Roast / Fines / Contact Time Effects",
    description: "Roast shifts solubility and flavor emphasis; fines/body benefits are traded against migration harshness and late extraction risk.",
    equations: ["extractionSpeed", "sugars", "polyphenols"]
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
      "Curves are physically inspired heuristics (not lab concentration predictions), intended to teach extraction tradeoffs and directional behavior.",
    equations: []
  }
];
