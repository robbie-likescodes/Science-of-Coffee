import { processPresets } from "./presets.js";
import { characteristics, clamp, equationLibrary, filterEffects, s } from "./model.js";

/**
 * Heuristic extraction model notes:
 * - "Chemical" curves are extraction-family proxies over normalized time.
 * - "Flavor" curves are NOT direct copies; they are derived from chemical families
 *   plus recipe/process factors (roast, concentration, fines, unevenness, etc.)
 *   to create believable sensory outcomes.
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

  const extractionSpeed = equationLibrary.extractionSpeed.compute({
    c,
    grindFine,
    fines,
    agitation,
    tempFactor,
    pressureFactor,
    preinfusion
  });

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

    const organicAcids = equationLibrary.organicAcids.compute({ tt, buffering, minerals });
    const sugars = equationLibrary.sugars.compute({ tt, extractionEff, unevenness });
    const polyphenols = equationLibrary.polyphenols.compute({ tt, fines, unevenness, concentration });

    const maillard =
      (22 + 62 * roast) *
      (1 / (1 + Math.exp(-7.5 * (tt - 0.36)))) *
      (1 + 0.1 * concentration) *
      (0.88 + 0.12 * extractionEff);

    const melanoidins =
      (12 + 58 * roast) *
      (1 / (1 + Math.exp(-6.4 * (tt - 0.52)))) *
      (1 + 0.34 * fines + 0.25 * concentration) *
      c.body;

    const lipids =
      30 *
      (1 / (1 + Math.exp(-7 * (tt - 0.34)))) *
      (1 + 0.55 * fines + 0.34 * concentration + 0.25 * bodyBias) *
      (0.9 + 0.2 * c.body);

    const aromatics =
      58 *
      (1 / (1 + Math.exp(-10 * (tt - 0.19)))) *
      (1 - 0.2 * (tt <= 0.76 ? 0 : Math.pow(clamp((tt - 0.76) / (1 - 0.76), 0, 1), 2.1))) *
      (1 + 0.16 * agitation + 0.12 * c.aroma);

    const acidity = organicAcids * (0.82 + 0.16 * clarityBias) * (1 - 0.12 * roast);
    const sweetness = (0.62 * sugars + 0.3 * maillard) * (0.9 + 0.1 * extractionEff) * (1 - 0.12 * unevenness);
    const bitterness = equationLibrary.flavorBitterness.compute({ polyphenols, maillard, melanoidins, roast });
    const burnt = (0.44 * maillard + 0.46 * melanoidins + 28 * (tt <= 0.7 ? 0 : Math.pow(clamp((tt - 0.7) / (1 - 0.7), 0, 1), 2.2))) * (0.75 + 0.35 * roast);
    const body = (0.64 * lipids + 0.24 * melanoidins + 10 * concentration) * (0.86 + 0.2 * bodyBias);
    const astringency =
      (0.76 * polyphenols + 16 * (tt <= 0.66 ? 0 : Math.pow(clamp((tt - 0.66) / (1 - 0.66), 0, 1), 2.4))) *
      (0.86 + 0.24 * unevenness);

    timeline.push({
      t,
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
  const fe = filterEffects[params.filterType] || filterEffects.paper;

  adjusted.body = clamp(adjusted.body + fe.body);
  adjusted.polyphenols = clamp(adjusted.polyphenols + fe.polyphenols);
  adjusted.aromatics = clamp(adjusted.aromatics + fe.aroma);
  adjusted.lipids = clamp(adjusted.lipids + fe.lipids);

  adjusted.acidity = clamp(adjusted.acidity * (0.94 + 0.12 * minerals));
  adjusted.sweetness = clamp(adjusted.sweetness * (0.92 + 0.2 * extractionEff));
  adjusted.bitterness = clamp(adjusted.bitterness * (1 + 0.22 * unevenness + 0.08 * pressureFactor));
  adjusted.astringency = clamp(adjusted.astringency * (1 + 0.22 * unevenness));

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
      clarityBias
    }),
    polyphenols: adjusted.polyphenols,
    roastiness: clamp(adjusted.burnt * 0.78 + adjusted.maillard * 0.24),
    floralFruit: clamp(adjusted.acidity * 0.74 + adjusted.aromatics * 0.22 - adjusted.burnt * 0.2),
    chocoNut: clamp(adjusted.sweetness * 0.28 + adjusted.body * 0.4 + adjusted.maillard * 0.42)
  };

  const summary = buildSummary(processKey, finalProfile, adjusted);

  return {
    timeline,
    finalProfile: characteristics.reduce((acc, key) => {
      acc[key] = clamp(finalProfile[key]);
      return acc;
    }, {}),
    summary
  };
}

function buildSummary(processKey, p, adjusted) {
  const tags = [];
  const name = processPresets[processKey].label;

  if (p.acidity > 62 && p.clarity > 58) tags.push("brightness and clarity");
  if (p.body > 65) tags.push("body-forward texture");
  if (p.bitterness > 62 || p.polyphenols > 60 || adjusted.astringency > 58) tags.push("late-extraction harshness");
  if (p.sweetness > 60 && p.bitterness < 50) tags.push("rounded sweetness");
  if (p.aroma > 60) tags.push("expressive aroma");

  const primary = tags[0] || "balanced extraction";
  const secondary = tags[1] || "moderate intensity";

  return `${name} profile currently emphasizes ${primary} with ${secondary}. Acidity ${Math.round(p.acidity)}, sweetness ${Math.round(
    p.sweetness
  )}, bitterness ${Math.round(p.bitterness)}, body ${Math.round(p.body)}, and polyphenols ${Math.round(p.polyphenols)}.`;
}
