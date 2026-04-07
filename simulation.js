import { processPresets } from "./presets.js";

const characteristics = [
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

const filterEffects = {
  paper: { body: -12, clarity: 16, polyphenols: -16, aroma: 3, lipids: -18, harshness: -8 },
  cloth: { body: -4, clarity: 8, polyphenols: -7, aroma: 5, lipids: -8, harshness: -3 },
  metal: { body: 12, clarity: -9, polyphenols: 12, aroma: 1, lipids: 12, harshness: 7 }
};

const clamp = (x, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const s = (x) => clamp(x / 100, 0, 1);

function sigmoid(t, c, k) {
  return 1 / (1 + Math.exp(-k * (t - c)));
}

function gaussian(t, mu, sigma) {
  const z = (t - mu) / Math.max(0.001, sigma);
  return Math.exp(-0.5 * z * z);
}

function lateRise(t, start = 0.55, power = 2.2) {
  if (t <= start) return 0;
  const x = (t - start) / (1 - start);
  return Math.pow(clamp(x, 0, 1), power);
}

function findPeakTime(timeline, key) {
  let max = -Infinity;
  let time = timeline[0]?.seconds || 0;
  timeline.forEach((point) => {
    if (point[key] > max) {
      max = point[key];
      time = point.seconds;
    }
  });
  return time;
}

export const MODEL_EQUATIONS = {
  core: [
    "pace = method.speed × (0.48 + 0.44×grindFine + 0.22×fines + 0.24×agitation + 0.32×temp + 0.28×pressure + 0.16×pressureAgg + 0.14×preinfusionRatio)",
    "effectiveTime = normalizedProgress × contactTime × pace",
    "recommendedWindow = [sweetPeak - earlyTolerance, sweetPeak + lateTolerance] with tolerance scaled by method, roast, fines, pressure and temperature",
    "Model is educational + heuristic (shape-first), not lab-validated precision"
  ],
  families: [
    "Organic acids: early rise then soften later",
    "Sugars: mid-phase rise and peak",
    "Polyphenols: late-skewed growth; stronger with fines/aggressive extraction/immersion",
    "Maillard + melanoidins: mid-late roast/body contribution",
    "Lipids/oils: elevated with immersion and low-paper filtration",
    "Aromatics: early-mid and method-dependent retention"
  ]
};

export const CONTROL_EQUATION_MAP = {
  dose: {
    title: "Concentration & body loading",
    equation: "concentration = clamp((dose / brewRatio)/2.25, 0.3, 3.4)",
    variable: "concentrationFactor",
    effect: "Higher dose raises concentration loading, increasing body, lipids, and late heaviness."
  },
  brewRatio: {
    title: "Dilution counterpart",
    equation: "concentration = clamp((dose / brewRatio)/2.25, 0.3, 3.4)",
    variable: "concentrationFactor",
    effect: "Higher brew ratio lowers concentration and reduces body weight / harsh carryover."
  },
  grindSize: {
    title: "Grind-driven pace",
    equation: "grindFine = 1 - s(grindSize); pace includes +0.44×grindFine",
    variable: "grindFineFactor",
    effect: "Finer grind compresses extraction into earlier seconds and narrows timing margin."
  },
  temperature: {
    title: "Thermal acceleration",
    equation: "pace includes +0.32×tempFactor and late harshness terms scale with temp",
    variable: "tempFactor",
    effect: "Higher temperature advances sweetness and also advances bitterness/polyphenols."
  },
  pressure: {
    title: "Pressure acceleration",
    equation: "pace includes +0.28×pressureFactor; bitter/astringent slope increases with pressure",
    variable: "pressureFactor",
    effect: "Higher pressure is useful for short brews but can steepen late harshness if run too long."
  },
  pressureAggressiveness: {
    title: "Pressure profile shape",
    equation: "pressureImpact = pressureFactor × (0.7 + 0.6×pressureAggressiveness)",
    variable: "pressureAggFactor",
    effect: "More aggressive pressure profile pushes more extraction work earlier in the shot."
  },
  fines: {
    title: "Fines and late carryover",
    equation: "polyphenols scales with (1 + 0.75×fines + 0.55×immersionBias)",
    variable: "finesFactor",
    effect: "Fines strongly amplify late astringent/polyphenol extraction."
  },
  contactTime: {
    title: "Actual timeline",
    equation: "seconds = normalizedProgress × contactTime",
    variable: "contactTimeSeconds",
    effect: "Longer contact time widens the real-time axis and can move harsh extraction later in seconds."
  },
  preinfusion: {
    title: "Pre-wetting ratio",
    equation: "preinfusionRatio = clamp(preinfusion/contactTime, 0, 0.65)",
    variable: "preinfusionFactor",
    effect: "More preinfusion slightly smooths early extraction and helps sweet window stability."
  },
  agitation: {
    title: "Mass transfer boost",
    equation: "pace includes +0.24×agitation; polyphenols scale with strong agitation",
    variable: "agitationFactor",
    effect: "Higher agitation increases extraction pace and can intensify late harshness in immersion."
  },
  filterType: {
    title: "Filtration adjustment",
    equation: "final += filterEffect on clarity/body/polyphenols/lipids/harshness",
    variable: "filterEffect",
    effect: "Paper increases clarity and lowers oils/harsh solids; metal does the opposite."
  },
  roastLevel: {
    title: "Roast-dependent late roastiness",
    equation: "burnt ~ lateRise × (0.65 + 0.55×roast)",
    variable: "roastFactor",
    effect: "Darker roast pushes more roast bitterness/harshness in late extraction."
  }
};

function getControlEquation(key) {
  return CONTROL_EQUATION_MAP[key] || {
    title: "Heuristic relationship",
    equation: "Parameter influences pace, phase timing, or sensory weighting in the model",
    variable: key,
    effect: "This slider contributes to extraction-window position and flavor balance heuristics."
  };
}

export function runSimulation(processKey, params) {
  const model = deriveModel(processKey, params);
  const {
    method,
    c,
    grindFine,
    fines,
    tempFactor,
    pressureImpact,
    agitation,
    preinfusion,
    pace,
    concentration,
    unevenness,
    extractionEff,
    roast,
    minerals,
    buffering,
    bodyBias,
    clarityBias,
    immersionBias,
    paperBias,
    contactTime,
    filterCoeff
  } = model;

  const timeline = [];
  const points = 120;

  for (let i = 0; i <= points; i++) {
    const progress = i / points;
    const seconds = progress * contactTime;
    const effective = clamp(progress * pace, 0, 1.35);

    const organicAcids =
      84 * sigmoid(effective, 0.13, 10.8) * (1 - 0.42 * lateRise(effective, 0.47, 1.55)) * (1 - 0.24 * buffering) * (1 + 0.14 * minerals);

    const sugars =
      72 * gaussian(effective, 0.44 + 0.06 * (1 - extractionEff), 0.2 + 0.06 * (1 - c.clarity)) * (1 + 0.15 * extractionEff) * (1 - 0.16 * unevenness);

    const polyphenols =
      8 * sigmoid(effective, 0.45, 7) +
      78 * lateRise(effective, 0.58, 2.2) * (1 + 0.75 * fines + 0.48 * unevenness + 0.3 * pressureImpact + 0.55 * immersionBias + 0.2 * agitation);

    const maillard =
      (20 + 62 * roast) * sigmoid(effective, 0.35, 6.8) * (1 + 0.1 * concentration) * (0.9 + 0.14 * extractionEff);

    const melanoidins =
      (10 + 55 * roast) * sigmoid(effective, 0.53, 5.8) * (1 + 0.28 * fines + 0.22 * concentration) * c.body;

    const lipids =
      24 * sigmoid(effective, 0.35, 7.4) * (1 + 0.7 * immersionBias + 0.45 * fines + 0.28 * concentration + 0.28 * bodyBias - 0.45 * paperBias);

    const aromatics =
      62 * sigmoid(effective, 0.2, 9.8) * (1 - 0.24 * lateRise(effective, 0.78, 2.1)) * (1 + 0.15 * c.aroma + 0.12 * agitation - 0.08 * concentration);

    const acidity = organicAcids * (0.8 + 0.2 * clarityBias) * (1 - 0.14 * roast);
    const sweetness = (0.76 * sugars + 0.24 * maillard) * (0.9 + 0.14 * extractionEff) * (1 - 0.14 * unevenness);
    const bitterness =
      (0.58 * polyphenols + 0.24 * maillard + 0.22 * melanoidins) * (0.86 + 0.28 * roast + 0.1 * pressureImpact + 0.08 * tempFactor);
    const burnt = (0.48 * maillard + 0.52 * melanoidins + 35 * lateRise(effective, 0.68, 2.3)) * (0.68 + 0.55 * roast);
    const body = (0.62 * lipids + 0.24 * melanoidins + 10 * concentration) * (0.86 + 0.2 * bodyBias);
    const astringency =
      (0.75 * polyphenols + 18 * lateRise(effective, 0.64, 2.5)) *
      (0.84 + 0.28 * unevenness + 0.18 * pressureImpact + 0.16 * tempFactor + 0.2 * immersionBias);

    timeline.push({
      progress,
      seconds,
      effective,
      organicAcids: clamp(organicAcids),
      sugars: clamp(sugars),
      polyphenols: clamp(polyphenols),
      maillard: clamp(maillard),
      melanoidins: clamp(melanoidins),
      lipids: clamp(lipids),
      aromatics: clamp(aromatics),
      acidity: clamp(acidity),
      sweetness: clamp(sweetness),
      bitterness: clamp(bitterness),
      burnt: clamp(burnt),
      body: clamp(body),
      astringency: clamp(astringency)
    });
  }

  const sweetPeakTime = findPeakTime(timeline, "sweetness");
  const earlyTolerance = Math.max(6, contactTime * (0.09 + 0.03 * c.windowWidth));
  const lateTolerance = Math.max(
    8,
    contactTime * (0.11 + 0.05 * c.windowWidth - 0.03 * pressureImpact - 0.02 * tempFactor + 0.03 * paperBias)
  );

  const balancedStart = clamp(sweetPeakTime - earlyTolerance, 0, contactTime);
  const balancedEnd = clamp(sweetPeakTime + lateTolerance, 0, contactTime);
  const targetStop = clamp((balancedStart + balancedEnd) / 2, 0, contactTime);

  const guidance = {
    early: { start: 0, end: balancedStart, label: "Early / underextracted" },
    balanced: { start: balancedStart, end: balancedEnd, label: "Balanced / sweet spot" },
    late: { start: balancedEnd, end: contactTime, label: "Late / bitter / harsh" },
    sweetPeakTime,
    targetStop
  };

  const targetPoint = timeline.reduce((closest, point) => {
    if (!closest) return point;
    return Math.abs(point.seconds - targetStop) < Math.abs(closest.seconds - targetStop) ? point : closest;
  }, null);

  const adjusted = { ...targetPoint };
  const fe = filterCoeff;
  adjusted.body = clamp(adjusted.body + fe.body);
  adjusted.polyphenols = clamp(adjusted.polyphenols + fe.polyphenols);
  adjusted.aromatics = clamp(adjusted.aromatics + fe.aroma);
  adjusted.lipids = clamp(adjusted.lipids + fe.lipids);
  adjusted.astringency = clamp(adjusted.astringency + fe.harshness);

  const finalProfile = {
    acidity: clamp(adjusted.acidity * (0.92 + 0.16 * minerals)),
    sweetness: clamp(adjusted.sweetness * (0.92 + 0.22 * extractionEff)),
    bitterness: clamp(adjusted.bitterness * (1 + 0.2 * unevenness + 0.1 * pressureImpact)),
    body: adjusted.body,
    aroma: adjusted.aromatics,
    clarity: clamp(55 + 0.32 * adjusted.acidity - 0.27 * adjusted.body - 0.22 * adjusted.polyphenols + 18 * clarityBias + fe.clarity),
    polyphenols: adjusted.polyphenols,
    roastiness: clamp(adjusted.burnt * 0.8 + adjusted.maillard * 0.26),
    floralFruit: clamp(adjusted.acidity * 0.74 + adjusted.aromatics * 0.28 - adjusted.burnt * 0.2),
    chocoNut: clamp(adjusted.sweetness * 0.3 + adjusted.body * 0.42 + adjusted.maillard * 0.4)
  };

  const interpretation = buildInterpretation(processKey, model, guidance, timeline);
  const summary = `${method.label}: recommended stop around ${Math.round(targetStop)}s (window ${Math.round(
    balancedStart
  )}-${Math.round(balancedEnd)}s). Sweetness peaks near ${Math.round(sweetPeakTime)}s before bitterness/polyphenols steepen.`;

  return {
    timeline,
    finalProfile: characteristics.reduce((acc, key) => {
      acc[key] = clamp(finalProfile[key]);
      return acc;
    }, {}),
    summary,
    guidance,
    interpretation,
    model,
    equations: MODEL_EQUATIONS
  };
}

function deriveModel(processKey, params) {
  const method = processPresets[processKey];
  const c = method.coeff;
  const grindFine = 1 - s(params.grindSize);
  const fines = s(params.fines);
  const tempFactor = clamp((params.temperature - 80) / 20, 0.1, 1.25);
  const pressureFactor = clamp((params.pressure - 1) / 9, 0, 1.4);
  const pressureAgg = s(params.pressureAggressiveness);
  const pressureImpact = pressureFactor * (0.7 + 0.6 * pressureAgg);
  const agitation = s(params.agitation);
  const preinfusion = clamp(params.preinfusion / Math.max(params.contactTime, 1), 0, 0.65);
  const pace =
    c.speed *
    (0.48 + 0.44 * grindFine + 0.22 * fines + 0.24 * agitation + 0.32 * tempFactor + 0.28 * pressureImpact + 0.14 * preinfusion);
  const concentration = clamp((params.dose / params.brewRatio) / 2.25, 0.3, 3.4);
  const unevenness = clamp((1 - s(params.bedUniformity)) * 0.58 + s(params.channelingRisk) * 0.8, 0, 1.4);
  const extractionEff = clamp((params.extractionEfficiency - 40) / 55, 0, 1.1);
  const roast = s(params.roastLevel);
  const minerals = s(params.mineralStrength);
  const buffering = s(params.acidityBuffering);
  const bodyBias = s(params.bodyEmphasis);
  const clarityBias = s(params.clarityEmphasis);
  const immersionBias = clamp(c.immersion + (params.filterType === "metal" ? 0.2 : 0), 0, 1.3);
  const paperBias = params.filterType === "paper" ? 1 : params.filterType === "cloth" ? 0.45 : 0;

  return {
    method,
    c,
    grindFine,
    fines,
    tempFactor,
    pressureFactor,
    pressureAgg,
    pressureImpact,
    agitation,
    preinfusion,
    pace,
    concentration,
    unevenness,
    extractionEff,
    roast,
    minerals,
    buffering,
    bodyBias,
    clarityBias,
    immersionBias,
    paperBias,
    contactTime: params.contactTime,
    filterCoeff: filterEffects[params.filterType] || filterEffects.paper
  };
}

export function getModelDerivatives(processKey, params) {
  const model = deriveModel(processKey, params);
  return {
    paceFactor: model.pace,
    tempFactor: model.tempFactor,
    pressureFactor: model.pressureFactor,
    pressureAggFactor: model.pressureAgg,
    pressureImpact: model.pressureImpact,
    agitationFactor: model.agitation,
    finesFactor: model.fines,
    grindFineFactor: model.grindFine,
    preinfusionFactor: model.preinfusion,
    concentrationFactor: model.concentration,
    unevennessFactor: model.unevenness,
    extractionEffFactor: model.extractionEff,
    roastFactor: model.roast,
    mineralFactor: model.minerals,
    bufferingFactor: model.buffering,
    bodyBiasFactor: model.bodyBias,
    clarityBiasFactor: model.clarityBias,
    immersionBias: model.immersionBias,
    paperBias: model.paperBias,
    contactTimeSeconds: model.contactTime,
    methodCoeff: model.c,
    filterEffect: model.filterCoeff
  };
}

export function getControlEquationMeta(key) {
  return getControlEquation(key);
}

function buildInterpretation(processKey, model, guidance) {
  const notes = [];
  const m = processPresets[processKey];

  if (model.tempFactor > 0.8) notes.push("Higher temperature is accelerating both sweetness extraction and late bitterness rise.");
  if (model.pressureImpact > 0.45) notes.push("Pressure is compressing extraction into a shorter, more urgent decision window.");
  if (model.grindFine > 0.55 && model.pressureImpact > 0.3) notes.push("Fine grind plus pressure can cause fast early yield but harshness if pulled long.");
  if (model.immersionBias > 0.7) notes.push("This method emphasizes body and suspended late compounds more than clarity.");
  if (model.paperBias > 0.8) notes.push("Paper filtration reduces oils and harsh solids, improving clarity but lowering body weight.");

  const width = guidance.balanced.end - guidance.balanced.start;
  if (width < model.contactTime * 0.2) notes.push("Current settings create a narrow sweet spot: stopping time matters a lot.");
  else notes.push("Current settings create a broader sweet window with more forgiveness.");

  return {
    title: `${m.label} teaching readout`,
    bullets: notes,
    windowText: `Recommended extraction window: ${Math.round(guidance.balanced.start)}-${Math.round(guidance.balanced.end)}s; target stop ≈ ${Math.round(
      guidance.targetStop
    )}s.`
  };
}
