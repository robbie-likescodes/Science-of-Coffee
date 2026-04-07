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

export function runSimulation(processKey, params) {
  const m = deriveModel(processKey, params);
  const timeline = [];
  const points = 80;

  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const effectiveProgress = t * m.extractionSpeed * m.contactFactor;
    const tt = clamp(effectiveProgress, 0, 1.25);

    const organicAcids = equationLibrary.organicAcids.compute({ tt, buffering: m.buffering, minerals: m.minerals, roast: m.roast, tempAcidShift: m.tempAcidShift });
    const sugars = equationLibrary.sugars.compute({ tt, extractionEff: m.extractionEff, unevenness: m.unevenness, roast: m.roast, tempSweetBoost: m.tempSweetBoost });
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
      sigmoid(tt, 0.34, 8.4) *
      (1 + 0.11 * m.concentration + 0.08 * m.tempSweetBoost) *
      (0.86 + 0.16 * m.extractionEff);

    const melanoidins =
      (10 + 62 * m.roast) *
      sigmoid(tt, 0.5, 6.8) *
      (1 + 0.32 * m.fines + 0.22 * m.concentration + 0.12 * m.tempLateRisk) *
      m.c.body;

    const lipids =
      28 *
      sigmoid(tt, 0.35, 7.5) *
      (1 + 0.5 * m.fines + 0.3 * m.concentration + 0.22 * m.bodyBias) *
      (0.9 + 0.2 * m.c.body);

    const aromatics =
      56 *
      sigmoid(tt, 0.2, 10) *
      (1 - 0.24 * lateRise(tt, 0.74, 2)) *
      (1 + 0.14 * m.agitation + 0.12 * m.c.aroma) *
      (0.94 + 0.12 * m.tempAroma);

    const acidity = organicAcids * (0.83 + 0.16 * m.clarityBias) * (1 - 0.18 * m.roast);
    const sweetness = (0.6 * sugars + 0.34 * maillard) * (0.9 + 0.12 * m.extractionEff) * (1 - 0.14 * m.unevenness);
    const bitterness = equationLibrary.flavorBitterness.compute({ polyphenols, maillard, melanoidins, roast: m.roast, concentration: m.concentration, pressureHarshness: m.pressureHarshness });
    const burnt = (0.36 * maillard + 0.48 * melanoidins + 24 * lateRise(tt, 0.7, 2.1)) * (0.72 + 0.46 * m.roast);
    const body = (0.62 * lipids + 0.26 * melanoidins + 11 * m.concentration) * (0.84 + 0.24 * m.bodyBias);
    const astringency =
      (0.72 * polyphenols + 18 * lateRise(tt, 0.64, 2.4) * (1 + 0.35 * m.tempLateRisk + 0.3 * m.finesMigrationRisk)) *
      (0.84 + 0.28 * m.unevenness);

    timeline.push({
      t,
      timeSec: t * params.contactTime,
      extractionProgress: clamp(tt / 1.25, 0, 1),
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

  const last = timeline[timeline.length - 1];
  const adjusted = { ...last };
  const fe = m.filterCoeff;

  adjusted.body = clamp(adjusted.body + fe.body);
  adjusted.polyphenols = clamp(adjusted.polyphenols + fe.polyphenols + 3 * m.finesMigrationRisk);
  adjusted.aromatics = clamp(adjusted.aromatics + fe.aroma);
  adjusted.lipids = clamp(adjusted.lipids + fe.lipids);
  adjusted.bitterness = clamp(adjusted.bitterness * (1 + 0.2 * m.unevenness + 0.16 * m.pressureHarshness));
  adjusted.astringency = clamp(adjusted.astringency * (1 + 0.2 * m.unevenness + 0.14 * m.finesMigrationRisk));

  adjusted.acidity = clamp(adjusted.acidity * (0.94 + 0.1 * m.minerals));
  adjusted.sweetness = clamp(adjusted.sweetness * (0.92 + 0.2 * m.extractionEff));

  const finalProfile = {
    acidity: adjusted.acidity,
    sweetness: adjusted.sweetness,
    bitterness: adjusted.bitterness,
    body: adjusted.body,
    aroma: adjusted.aromatics,
    clarity: equationLibrary.finalClarity.compute({
      acidity: adjusted.acidity,
      body: adjusted.body,
      polyphenols: adjusted.polyphenols,
      clarityBias: m.clarityBias,
      filterClarity: fe.clarity
    }),
    polyphenols: adjusted.polyphenols,
    roastiness: clamp(adjusted.burnt * 0.8 + adjusted.maillard * 0.22),
    floralFruit: clamp(adjusted.acidity * 0.72 + adjusted.aromatics * 0.26 - adjusted.burnt * 0.24),
    chocoNut: clamp(adjusted.sweetness * 0.24 + adjusted.body * 0.4 + adjusted.maillard * 0.46)
  };

  const recommendedWindow = computeRecommendedWindow(timeline, params.contactTime);
  const summary = buildSummary(processKey, finalProfile, adjusted, recommendedWindow);

  return {
    timeline,
    finalProfile: characteristics.reduce((acc, key) => {
      acc[key] = clamp(finalProfile[key]);
      return acc;
    }, {}),
    summary,
    recommendedWindow
  };
}

function deriveModel(processKey, params) {
  const method = processPresets[processKey];
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
  const concentration = clamp((params.dose / params.brewRatio) / 2.2, 0.35, 3.2);
  const unevenness = clamp((1 - s(params.bedUniformity)) * 0.5 + s(params.channelingRisk) * 0.78, 0, 1.5);
  const preinfusionRatio = clamp(params.preinfusion / Math.max(params.contactTime, 1), 0, 0.65);
  const tempC = params.temperature;
  const tempRate = clamp(Math.exp(0.028 * (tempC - 93)), 0.16, 1.65);
  const tempSweetBoost = clamp((tempC - 88) / 10, 0, 1.2);
  const tempLateRisk = clamp((tempC - 92) / 8, 0, 1.7);
  const tempAcidShift = clamp((90 - tempC) / 14, -0.55, 1.2);
  const tempAroma = clamp((tempC - 80) / 16, 0.2, 1.3);
  const contactNorm = params.contactTime / Math.max(method.defaults.contactTime, 1);
  const contactFactor = clamp(0.72 + 0.62 * Math.sqrt(contactNorm), 0.35, 1.8);
  const roastSolubility = 0.86 + 0.34 * roast;

  const flowResistance = clamp(0.3 + 0.56 * grindFine + 0.52 * fines + 0.18 * unevenness, 0.12, 1.8);
  const pressureUseful = pressureFactor * dynamics.pressure * clamp(1.18 - 0.5 * flowResistance, 0.35, 1.1);
  const pressureAgg = s(params.pressureAggressiveness);
  const pressureHarshness = clamp(
    Math.max(0, pressureUseful - 0.68) * (0.66 + 0.6 * unevenness + 0.3 * pressureAgg) + Math.max(0, flowResistance - 1.08) * 0.5 * dynamics.pressure,
    0,
    1.5
  );

  const agitationEffect = agitation * (0.42 + 0.72 * dynamics.agitation);
  const finesMigrationRisk = clamp(agitation * fines * dynamics.immersion * 1.05 + pressureAgg * 0.25 * dynamics.pressure, 0, 1.45);

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
    method,
    c,
    grindFine,
    fines,
    roast,
    minerals,
    buffering,
    bodyBias,
    clarityBias,
    agitation: agitationEffect,
    pressureFactor,
    extractionEff,
    concentration,
    unevenness,
    preinfusionRatio,
    tempRate,
    tempSweetBoost,
    tempLateRisk,
    tempAcidShift,
    tempAroma,
    contactFactor,
    flowResistance,
    pressureUseful,
    pressureHarshness,
    finesMigrationRisk,
    extractionSpeed,
    filterCoeff: filterEffects[params.filterType] || filterEffects.paper
  };
}

function computeRecommendedWindow(timeline, contactTime) {
  const scores = timeline.map((p) =>
    0.36 * p.sweetness + 0.24 * p.acidity + 0.16 * p.aromatics - 0.24 * p.bitterness - 0.2 * p.astringency - 0.12 * p.burnt
  );
  const peak = Math.max(...scores);
  const threshold = peak * 0.965;

  let start = scores.findIndex((v, i) => v >= threshold && timeline[i].bitterness < timeline[i].sweetness + 8);
  if (start < 0) start = Math.max(0, scores.indexOf(peak) - 4);

  let end = start;
  for (let i = start; i < scores.length; i++) {
    const harshRise = timeline[i].bitterness > 1.08 * timeline[i].sweetness || timeline[i].astringency > 55;
    if (scores[i] >= threshold && !harshRise) end = i;
    else if (i > start) break;
  }

  const toNorm = (idx) => clamp(idx / (timeline.length - 1), 0, 1);
  return {
    startNorm: toNorm(start),
    endNorm: toNorm(Math.max(end, start + 1)),
    startSec: Math.round(toNorm(start) * contactTime),
    endSec: Math.round(toNorm(Math.max(end, start + 1)) * contactTime)
  };
}

export function getModelDerivatives(processKey, params) {
  const model = deriveModel(processKey, params);
  return {
    extractionSpeed: model.extractionSpeed,
    tempFactor: model.tempRate,
    tempLateRisk: model.tempLateRisk,
    pressureFactor: model.pressureFactor,
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

function buildSummary(processKey, p, adjusted, window) {
  const tags = [];
  const name = processPresets[processKey].label;

  if (p.acidity > 62 && p.clarity > 58) tags.push("brightness and clarity");
  if (p.body > 65) tags.push("body-forward texture");
  if (p.bitterness > 62 || p.polyphenols > 60 || adjusted.astringency > 58) tags.push("late-extraction harshness");
  if (p.sweetness > 60 && p.bitterness < 50) tags.push("rounded sweetness");
  if (p.aroma > 60) tags.push("expressive aroma");

  const primary = tags[0] || "balanced extraction";
  const secondary = tags[1] || "moderate intensity";

  return `${name} currently emphasizes ${primary} with ${secondary}. Suggested balance window: ${window.startSec}-${window.endSec}s (${Math.round(
    window.startNorm * 100
  )}-${Math.round(window.endNorm * 100)}% brew progress), based on sweetness/aroma gains before bitterness and astringency accelerate. Acidity ${Math.round(
    p.acidity
  )}, sweetness ${Math.round(p.sweetness)}, bitterness ${Math.round(p.bitterness)}, body ${Math.round(p.body)}, and polyphenols ${Math.round(p.polyphenols)}.`;
}
