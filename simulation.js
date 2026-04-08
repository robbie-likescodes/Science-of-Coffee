import { processPresets } from "./presets.js";
import { characteristics, clamp, equationLibrary, filterEffects, lateRise, s, sigmoid } from "./model.js";

const METHOD_DYNAMICS = {
  espresso: { pressure: 1.0, agitation: 0.22, immersion: 0.05 },
  pourOver: { pressure: 0.14, agitation: 0.82, immersion: 0.4 },
  frenchPress: { pressure: 0.04, agitation: 0.9, immersion: 1.0 },
  siphon: { pressure: 0.22, agitation: 0.55, immersion: 0.72 },
  aeroPress: { pressure: 0.52, agitation: 0.62, immersion: 0.7 },
  coldBrew: { pressure: 0.0, agitation: 0.32, immersion: 1.0 }
};

const CONTROL_META = {
  dose: {
    title: "Concentration term",
    equation: "concentration = clamp((dose / brewRatio) / 2.4, 0.35, 2.8)",
    variable: "concentrationFactor",
    effect: "Higher dose raises concentration and body while increasing late harshness risk."
  },
  brewRatio: {
    title: "Concentration term",
    equation: "concentration = clamp((dose / brewRatio) / 2.4, 0.35, 2.8)",
    variable: "concentrationFactor",
    effect: "Higher brew ratio lowers concentration and generally softens body/harshness."
  },
  grindSize: {
    title: "Grind-flow coupling",
    equation: "grindFine = 1 - s(grindSize)",
    variable: "grindFineFactor",
    effect: "Finer grind accelerates extraction and can increase resistance sensitivity."
  },
  temperature: {
    title: "Temperature kinetics",
    equation: "tempRate = clamp(exp(0.03×(T-93)), 0.2, 1.75), viscosityFactor = clamp(exp(-0.02×(T-93)), 0.7, 1.35)",
    variable: "tempFactor",
    effect: "Higher temperature speeds diffusion and lowers viscosity, increasing extraction flow while also raising late-stage risk."
  },
  pressure: {
    title: "Method-weighted pressure",
    equation: "pressureUseful = pressureFactor × methodPressure × flow damping",
    variable: "pressureUseful",
    effect: "Pressure impact depends on brew method and flow resistance."
  },
  contactTime: {
    title: "Contact-time progression",
    equation: "contactFactor = clamp(0.55 + 0.45×sqrt(contactNorm), 0.4, 1.55)",
    variable: "contactFactor",
    effect: "Longer contact moves extraction further into late compounds."
  },
  filterType: {
    title: "Filter output adjustment",
    equation: "finalAdjustments += filterEffects[filterType]",
    variable: "filterEffect",
    effect: "Filter type shifts body, clarity, oils, and polyphenol expression.",
    format: (v) => `body ${v.body}, clarity ${v.clarity}, polyphenols ${v.polyphenols}, aroma ${v.aroma}, lipids ${v.lipids}`
  }
};

export function getControlEquationMeta(key) {
  return CONTROL_META[key] || null;
}

export function runSimulation(processKey, params) {
  const m = deriveModel(processKey, params);
  const timeline = [];
  const points = 120;

  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const effectiveProgress = t * m.extractionSpeed * m.contactFactor;
    const tt = clamp(effectiveProgress, 0, 1.25);

    const organicAcids = equationLibrary.organicAcids.compute({
      tt,
      buffering: m.buffering,
      minerals: m.minerals,
      roast: m.roast,
      tempAcidShift: m.tempAcidShift
    });

    const sugars = equationLibrary.sugars.compute({
      tt,
      extractionEff: m.extractionEff,
      unevenness: m.unevenness,
      roast: m.roast,
      tempSweetBoost: m.tempSweetBoost
    });

    const polyphenols = equationLibrary.polyphenols.compute({
      tt,
      fines: m.fines,
      unevenness: m.unevenness,
      concentration: m.concentration,
      tempLateRisk: m.tempLateRisk,
      pressureHarshness: m.pressureHarshness
    });

    const maillard =
      (16 + 66 * m.roast) *
      sigmoid(tt, 0.38, 8.1) *
      (1 + 0.11 * m.concentration + 0.08 * m.tempSweetBoost) *
      (0.86 + 0.16 * m.extractionEff);

    const melanoidins =
      (10 + 62 * m.roast) *
      sigmoid(tt, 0.54, 6.6) *
      (1 + 0.34 * m.fines + 0.22 * m.concentration + 0.14 * m.tempLateRisk) *
      m.c.body;

    const lipids =
      28 *
      sigmoid(tt, 0.35, 7.5) *
      (1 + 0.5 * m.fines + 0.3 * m.concentration + 0.22 * m.bodyBias) *
      (0.9 + 0.2 * m.c.body);

    const aromatics =
      56 *
      sigmoid(tt, 0.24, 9.8) *
      (1 - 0.24 * lateRise(tt, 0.74, 2)) *
      (1 + 0.14 * m.agitation + 0.12 * m.c.aroma) *
      (0.94 + 0.12 * m.tempAroma);

    const acidity = organicAcids * (0.83 + 0.16 * m.clarityBias) * (1 - 0.18 * m.roast);
    const sweetness = (0.6 * sugars + 0.34 * maillard) * (0.9 + 0.12 * m.extractionEff) * (1 - 0.14 * m.unevenness);
    const bitterness = equationLibrary.flavorBitterness.compute({
      polyphenols,
      maillard,
      melanoidins,
      roast: m.roast,
      concentration: m.concentration,
      pressureHarshness: m.pressureHarshness
    });
    const burnt = (0.34 * maillard + 0.5 * melanoidins + 28 * lateRise(tt, 0.72, 2.2)) * (0.7 + 0.5 * m.roast);
    const body = (0.62 * lipids + 0.26 * melanoidins + 11 * m.concentration) * (0.84 + 0.24 * m.bodyBias);
    const astringency =
      (0.74 * polyphenols + 20 * lateRise(tt, 0.67, 2.45) * (1 + 0.38 * m.tempLateRisk + 0.34 * m.finesMigrationRisk)) *
      (0.84 + 0.28 * m.unevenness);

    timeline.push({
      t,
      seconds: t * params.contactTime,
      progress: t,
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

  const guidance = computeGuidance(timeline, params.contactTime);
  const targetPoint = findNearestPointBySeconds(timeline, guidance.targetStop);
  const adjusted = applyFilterAdjustments(targetPoint, m);

  const finalProfile = {
    acidity: clamp(adjusted.acidity * (0.92 + 0.16 * m.minerals)),
    sweetness: clamp(adjusted.sweetness * (0.92 + 0.22 * m.extractionEff)),
    bitterness: clamp(adjusted.bitterness * (1 + 0.2 * m.unevenness + 0.1 * m.pressureHarshness)),
    body: adjusted.body,
    aroma: adjusted.aromatics,
    clarity: equationLibrary.finalClarity.compute({
      acidity: adjusted.acidity,
      body: adjusted.body,
      polyphenols: adjusted.polyphenols,
      clarityBias: m.clarityBias,
      filterClarity: m.filterCoeff.clarity
    }),
    polyphenols: adjusted.polyphenols,
    roastiness: clamp(adjusted.burnt * 0.8 + adjusted.maillard * 0.22),
    floralFruit: clamp(adjusted.acidity * 0.72 + adjusted.aromatics * 0.26 - adjusted.burnt * 0.24),
    chocoNut: clamp(adjusted.sweetness * 0.24 + adjusted.body * 0.4 + adjusted.maillard * 0.46)
  };

  const clampedProfile = characteristics.reduce((acc, key) => {
    acc[key] = clamp(finalProfile[key]);
    return acc;
  }, {});

  return {
    timeline,
    finalProfile: clampedProfile,
    guidance,
    summary: buildSummary(processKey, clampedProfile, guidance),
    interpretation: buildInterpretation(processKey, m, guidance),
    equations: {
      core: [equationLibrary.extractionSpeed.formula, "effectiveProgress = t × extractionSpeed × contactFactor", "tt = clamp(effectiveProgress, 0, 1.25)"],
      families: [equationLibrary.organicAcids.formula, equationLibrary.sugars.formula, equationLibrary.polyphenols.formula, equationLibrary.flavorBitterness.formula]
    }
  };
}

function deriveModel(processKey, params) {
  const method = processPresets[processKey] || processPresets.pourOver;
  const c = method.coeff;
  const dynamics = METHOD_DYNAMICS[processKey] || METHOD_DYNAMICS.pourOver;
  const grindFine = 1 - s(params.grindSize);
  const fines = s(params.fines);
  const roast = s(params.roastLevel);
  const minerals = s(params.mineralStrength);
  const buffering = s(params.acidityBuffering);
  const bodyBias = s(params.bodyEmphasis);
  const clarityBias = s(params.clarityEmphasis);
  const agitation = s(params.agitation);
  const pressureRaw = Math.max(0, params.pressure - 1) / 9;
  const pressureFactor = clamp(pressureRaw, 0, 1.6);
  const extractionEff = clamp((params.extractionEfficiency - 40) / 55, 0, 1.1);
  const concentration = clamp((params.dose / params.brewRatio) / 2.4, 0.35, 2.8);
  const unevenness = clamp((1 - s(params.bedUniformity)) * 0.5 + s(params.channelingRisk) * 0.78, 0, 1.5);
  const preinfusionRatio = clamp(params.preinfusion / Math.max(params.contactTime, 1), 0, 0.65);
  const tempC = params.temperature;
  const tempRate = clamp(Math.exp(0.03 * (tempC - 93)), 0.2, 1.75);
  const viscosityFactor = clamp(Math.exp(-0.02 * (tempC - 93)), 0.7, 1.35);
  const tempSweetBoost = clamp((tempC - 88) / 10, 0, 1.2);
  const tempLateRisk = clamp((tempC - 92) / 8, 0, 1.7);
  const tempAcidShift = clamp((90 - tempC) / 14, -0.55, 1.2);
  const tempAroma = clamp((tempC - 80) / 16, 0.2, 1.3);
  const contactNorm = params.contactTime / Math.max(method.defaults.contactTime, 1);
  const contactFactor = clamp(0.55 + 0.45 * Math.sqrt(contactNorm), 0.4, 1.55);
  const roastSolubility = 0.86 + 0.34 * roast;

  const flowResistance = clamp((0.24 + 0.64 * grindFine + 0.58 * fines + 0.26 * unevenness) * viscosityFactor, 0.1, 2.1);
  const permeability = clamp(1.2 - 0.44 * flowResistance, 0.2, 1.08);
  const pressureUseful = pressureFactor * dynamics.pressure * permeability;
  const pressureAgg = s(params.pressureAggressiveness);
  const pressureHarshness = clamp(
    Math.max(0, pressureUseful - 0.62) * (0.62 + 0.75 * unevenness + 0.34 * pressureAgg) +
      Math.max(0, flowResistance - 1.05) * 0.62 * dynamics.pressure,
    0,
    1.5
  );

  const agitationEffect = agitation * (0.42 + 0.72 * dynamics.agitation);
  const finesMigrationRisk = clamp(agitation * fines * dynamics.immersion * 1.05 + pressureAgg * 0.28 * dynamics.pressure, 0, 1.45);

  const extractionSpeed = equationLibrary.extractionSpeed.compute({
    c,
    grindFine,
    fines,
    agitationEffect,
    tempRate,
    pressureUseful,
    preinfusion: preinfusionRatio,
    roastSolubility,
    finesMigrationRisk
  });

  return {
    c,
    grindFine,
    fines,
    roast,
    minerals,
    buffering,
    bodyBias,
    clarityBias,
    agitation: agitationEffect,
    extractionEff,
    concentration,
    unevenness,
    tempSweetBoost,
    tempLateRisk,
    tempRate,
    tempAcidShift,
    tempAroma,
    contactFactor,
    preinfusionRatio,
    pressureUseful,
    pressureHarshness,
    finesMigrationRisk,
    extractionSpeed,
    filterCoeff: filterEffects[params.filterType] || filterEffects.paper
  };
}

function computeGuidance(timeline, contactTime) {
  const minFraction = contactTime <= 60 ? 0.78 : contactTime <= 240 ? 0.28 : 0.12;
  const minIndex = Math.floor((timeline.length - 1) * minFraction);
  const scores = timeline.map((p, idx) => {
    const underExtractionPenalty = idx < minIndex ? (minIndex - idx) * 0.9 : 0;
    return 0.42 * p.sweetness + 0.18 * p.acidity + 0.14 * p.aromatics - 0.26 * p.bitterness - 0.26 * p.astringency - 0.14 * p.burnt - underExtractionPenalty;
  });
  const peakScore = Math.max(...scores);
  const peakIndex = scores.indexOf(peakScore);

  let startIndex = Math.max(minIndex, peakIndex - 8);
  let endIndex = Math.min(timeline.length - 1, peakIndex + 8);

  for (let i = peakIndex; i >= 0; i--) {
    if (scores[i] < peakScore * 0.95 && i >= minIndex) {
      startIndex = i;
      break;
    }
  }

  for (let i = peakIndex; i < scores.length; i++) {
    const harsh = timeline[i].bitterness > timeline[i].sweetness + 8 || timeline[i].astringency > 55;
    if (scores[i] < peakScore * 0.95 || harsh) {
      endIndex = i;
      break;
    }
  }

  if (startIndex > endIndex) {
    const mid = Math.round((startIndex + endIndex) / 2);
    startIndex = Math.max(minIndex, mid - 3);
    endIndex = Math.max(startIndex + 2, Math.min(timeline.length - 1, mid + 3));
  }

  const minWindowIdx = Math.max(2, Math.round((timeline.length - 1) * (contactTime <= 60 ? 0.14 : contactTime <= 240 ? 0.1 : 0.06)));
  if (endIndex - startIndex < minWindowIdx) {
    const mid = Math.round((startIndex + endIndex) / 2);
    startIndex = Math.max(minIndex, mid - Math.floor(minWindowIdx / 2));
    endIndex = Math.min(timeline.length - 1, startIndex + minWindowIdx);
  }

  const toSec = (idx) => clamp((idx / (timeline.length - 1)) * contactTime, 0, contactTime);
  const sweetPeakIndex = timeline.reduce((bestIdx, p, idx, arr) => (p.sweetness > arr[bestIdx].sweetness ? idx : bestIdx), 0);
  const sweetnessAtPeak = timeline[sweetPeakIndex]?.sweetness || 0;
  const earlyEnd = Math.max(1, Math.floor(startIndex * 0.78));
  const lateStart = Math.min(timeline.length - 1, Math.ceil(endIndex * 1.02));

  const bitternessSlope = timeline.map((point, idx, arr) => {
    if (idx === 0) return 0;
    const prev = arr[idx - 1];
    const dt = Math.max((point.seconds || 0) - (prev.seconds || 0), 1e-6);
    return (point.bitterness - prev.bitterness) / dt;
  });
  const maxBitternessSlope = Math.max(...bitternessSlope);
  const bitternessRiseThreshold = maxBitternessSlope > 0 ? maxBitternessSlope * 0.66 : 0;
  let bitternessRiseIndex = Math.max(lateStart, minIndex);
  for (let i = Math.max(1, startIndex); i < bitternessSlope.length; i++) {
    if (bitternessSlope[i] >= bitternessRiseThreshold && timeline[i].bitterness >= timeline[i].sweetness * 0.8) {
      bitternessRiseIndex = i;
      break;
    }
  }
  const bitternessRiseValue = timeline[bitternessRiseIndex]?.bitterness || 0;

  return {
    early: { start: 0, end: toSec(Math.max(earlyEnd, minIndex - 2)) },
    balanced: { start: toSec(startIndex), end: toSec(endIndex) },
    late: { start: toSec(lateStart), end: contactTime },
    targetStop: toSec(Math.round((startIndex + endIndex) / 2)),
    sweetPeakTime: toSec(sweetPeakIndex),
    sweetPeakValue: sweetnessAtPeak,
    bitternessRiseTime: toSec(bitternessRiseIndex),
    bitternessRiseValue
  };
}

function findNearestPointBySeconds(timeline, seconds) {
  return timeline.reduce((closest, point) => {
    if (!closest) return point;
    return Math.abs(point.seconds - seconds) < Math.abs(closest.seconds - seconds) ? point : closest;
  }, null);
}

function applyFilterAdjustments(point, model) {
  const adjusted = { ...(point || {}) };
  const fe = model.filterCoeff;
  adjusted.body = clamp((adjusted.body || 0) + fe.body);
  adjusted.polyphenols = clamp((adjusted.polyphenols || 0) + fe.polyphenols + 3 * model.finesMigrationRisk);
  adjusted.aromatics = clamp((adjusted.aromatics || 0) + fe.aroma);
  adjusted.lipids = clamp((adjusted.lipids || 0) + fe.lipids);
  adjusted.bitterness = clamp((adjusted.bitterness || 0) * (1 + 0.2 * model.unevenness + 0.16 * model.pressureHarshness));
  adjusted.astringency = clamp((adjusted.astringency || 0) * (1 + 0.2 * model.unevenness + 0.14 * model.finesMigrationRisk));
  adjusted.acidity = clamp((adjusted.acidity || 0) * (0.94 + 0.1 * model.minerals));
  adjusted.sweetness = clamp((adjusted.sweetness || 0) * (0.92 + 0.2 * model.extractionEff));
  return adjusted;
}

export function getModelDerivatives(processKey, params) {
  const model = deriveModel(processKey, params);
  return {
    extractionSpeed: model.extractionSpeed,
    tempFactor: model.tempRate,
    tempLateRisk: model.tempLateRisk,
    pressureUseful: model.pressureUseful,
    pressureHarshness: model.pressureHarshness,
    agitationFactor: model.agitation,
    finesFactor: model.fines,
    grindFineFactor: model.grindFine,
    preinfusionFactor: model.preinfusionRatio,
    concentrationFactor: model.concentration,
    unevennessFactor: model.unevenness,
    extractionEffFactor: model.extractionEff,
    roastFactor: model.roast,
    mineralFactor: model.minerals,
    bufferingFactor: model.buffering,
    bodyBiasFactor: model.bodyBias,
    clarityBiasFactor: model.clarityBias,
    contactFactor: model.contactFactor,
    finesMigrationRisk: model.finesMigrationRisk,
    methodCoeff: model.c,
    filterEffect: model.filterCoeff
  };
}

function buildSummary(processKey, profile, guidance) {
  const methodName = (processPresets[processKey] && processPresets[processKey].label) || "Brew";
  return `${methodName}: balanced window ${Math.round(guidance.balanced.start)}-${Math.round(guidance.balanced.end)}s. Acidity ${Math.round(
    profile.acidity
  )}, sweetness ${Math.round(profile.sweetness)}, bitterness ${Math.round(profile.bitterness)}, body ${Math.round(profile.body)}.`;
}

function buildInterpretation(processKey, model, guidance) {
  const methodName = (processPresets[processKey] && processPresets[processKey].label) || "brew";
  const bullets = [];

  if (model.tempLateRisk > 0.7) bullets.push("High temperature increases late extraction harshness; stop slightly earlier.");
  if (model.pressureHarshness > 0.35) bullets.push("Pressure/flow mismatch risk is elevated; coarsen grind or reduce pressure aggressiveness.");
  if (model.unevenness > 0.5) bullets.push("Uneven flow is amplifying bitterness/astringency; improve puck/bed uniformity.");
  if (model.finesMigrationRisk > 0.45) bullets.push("Fines migration is high; reduce agitation to smooth the cup.");
  if (bullets.length === 0) bullets.push("Current settings are in a stable extraction zone with balanced sweetness and clarity.");

  return {
    title: `${methodName} interpretation`,
    windowText: `Recommended stop window: ${Math.round(guidance.balanced.start)}-${Math.round(guidance.balanced.end)}s (target ${Math.round(guidance.targetStop)}s).`,
    bullets
  };
}
