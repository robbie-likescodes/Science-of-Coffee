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
  paper: { body: -12, clarity: 14, polyphenols: -14, aroma: 2 },
  cloth: { body: -4, clarity: 8, polyphenols: -6, aroma: 4 },
  metal: { body: 12, clarity: -8, polyphenols: 10, aroma: 0 }
};

const clamp = (x, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const s = (x) => clamp(x / 100, 0, 1);

function sigmoid(t, c, k) {
  return 1 / (1 + Math.exp(-k * (t - c)));
}

function lateRise(t, start = 0.55, power = 2.2) {
  if (t <= start) return 0;
  const x = (t - start) / (1 - start);
  return Math.pow(clamp(x, 0, 1), power);
}

/**
 * Heuristic extraction model notes:
 * - The model is intentionally educational and not chemistry-accurate.
 * - Compounds are represented as families with different extraction timing:
 *   early bright acids/aromatics, mid sweetness/body, late bitterness/polyphenols.
 * - Global extraction speed is influenced by grind, fines, temperature, agitation,
 *   pressure, and method-specific coefficient.
 * - Uneven puck/bed prep (low uniformity + high channeling) adds harshness:
 *   higher late bitterness/polyphenols and reduced sweetness clarity.
 * - Filter media applies post-extraction sensory shaping to cup profile.
 */
export function runSimulation(processKey, params) {
  const method = processPresets[processKey];
  const c = method.coeff;

  const grindFine = 1 - s(params.grindSize);
  const fines = s(params.fines);
  const tempFactor = clamp((params.temperature - 80) / 20, 0.2, 1.2);
  const pressureFactor = clamp((params.pressure - 1) / 9, 0, 1.5);
  const agitation = s(params.agitation);
  const preinfusion = clamp(params.preinfusion / Math.max(params.contactTime, 1), 0, 0.6);

  const extractionSpeed =
    c.speed *
    (0.58 + 0.52 * grindFine + 0.24 * fines + 0.33 * agitation + 0.35 * tempFactor + 0.18 * pressureFactor + 0.1 * preinfusion);

  const concentration = clamp((params.dose / params.brewRatio) / 2.2, 0.35, 3.2);
  const unevenness = clamp((1 - s(params.bedUniformity)) * 0.55 + s(params.channelingRisk) * 0.75, 0, 1.35);
  const extractionEff = clamp((params.extractionEfficiency - 40) / 55, 0, 1.1);
  const roast = s(params.roastLevel);
  const minerals = s(params.mineralStrength);
  const buffering = s(params.acidityBuffering);
  const bodyBias = s(params.bodyEmphasis);
  const clarityBias = s(params.clarityEmphasis);

  const timeline = [];
  const points = 80;

  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const tt = clamp(t * extractionSpeed, 0, 1.2);

    const acidity =
      70 * sigmoid(tt, 0.16, 11) * (1 - 0.38 * lateRise(tt, 0.48, 1.6)) * (1 - 0.22 * buffering) * (1 + 0.16 * minerals);

    const sweetness =
      68 * sigmoid(tt, 0.33, 9) * (1 - 0.38 * lateRise(tt, 0.68, 2.4)) * (1 + 0.2 * extractionEff) * (1 - 0.3 * unevenness);

    const bitterness =
      24 * sigmoid(tt, 0.42, 7) +
      55 * lateRise(tt, 0.58, 2.1) * (1 + 0.45 * roast + 0.34 * unevenness) * c.bitterness;

    const body =
      42 * sigmoid(tt, 0.34, 7) * (1 + 0.34 * fines + 0.36 * concentration + 0.25 * bodyBias) * c.body;

    const polyphenols =
      14 * sigmoid(tt, 0.46, 6) +
      60 * lateRise(tt, 0.63, 2.4) * (1 + 0.56 * fines + 0.38 * unevenness + 0.1 * concentration);

    const aroma =
      52 * sigmoid(tt, 0.2, 10) * (1 - 0.25 * lateRise(tt, 0.72, 2.0)) * (1 + 0.18 * agitation + 0.18 * c.aroma);

    const clarity =
      46 * sigmoid(tt, 0.27, 9) * (1 + 0.32 * clarityBias + 0.18 * c.clarity) * (1 - 0.22 * fines) * (1 - 0.28 * unevenness);

    const roastiness = 24 + 62 * roast * (0.52 + 0.48 * sigmoid(tt, 0.5, 7));

    const floralFruit = acidity * (0.72 + 0.18 * clarityBias) * (1 - 0.38 * roast);
    const chocoNut = (0.62 * body + 0.45 * roastiness + 0.25 * sweetness) * (0.7 + 0.3 * roast);

    timeline.push({
      t,
      acidity: clamp(acidity),
      sweetness: clamp(sweetness),
      bitterness: clamp(bitterness),
      body: clamp(body),
      aroma: clamp(aroma),
      clarity: clamp(clarity),
      polyphenols: clamp(polyphenols),
      roastiness: clamp(roastiness),
      floralFruit: clamp(floralFruit),
      chocoNut: clamp(chocoNut)
    });
  }

  const last = timeline[timeline.length - 1];
  const adjusted = { ...last };
  const fe = filterEffects[params.filterType] || filterEffects.paper;

  adjusted.body = clamp(adjusted.body + fe.body);
  adjusted.clarity = clamp(adjusted.clarity + fe.clarity);
  adjusted.polyphenols = clamp(adjusted.polyphenols + fe.polyphenols);
  adjusted.aroma = clamp(adjusted.aroma + fe.aroma);

  adjusted.acidity = clamp(adjusted.acidity * (1 - 0.2 * buffering) * (0.94 + 0.12 * minerals));
  adjusted.sweetness = clamp(adjusted.sweetness * (0.9 + 0.25 * extractionEff) * (1 - 0.2 * unevenness));
  adjusted.bitterness = clamp(adjusted.bitterness * (1 + 0.28 * unevenness + 0.11 * pressureFactor));

  const summary = buildSummary(processKey, adjusted);

  return {
    timeline,
    finalProfile: characteristics.reduce((acc, key) => {
      acc[key] = clamp(adjusted[key]);
      return acc;
    }, {}),
    summary
  };
}

function buildSummary(processKey, p) {
  const tags = [];
  const name = processPresets[processKey].label;

  if (p.acidity > 62 && p.clarity > 58) tags.push("brightness and clarity");
  if (p.body > 65) tags.push("body-forward texture");
  if (p.bitterness > 62 || p.polyphenols > 60) tags.push("late-extraction harshness");
  if (p.sweetness > 60 && p.bitterness < 50) tags.push("rounded sweetness");
  if (p.aroma > 60) tags.push("expressive aroma");

  const primary = tags[0] || "balanced extraction";
  const secondary = tags[1] || "moderate intensity";

  return `${name} profile currently emphasizes ${primary} with ${secondary}. Acidity ${Math.round(p.acidity)}, sweetness ${Math.round(p.sweetness)}, bitterness ${Math.round(p.bitterness)}, body ${Math.round(p.body)}, and polyphenols ${Math.round(p.polyphenols)}.`;
}
