const commonControlConfig = {
  dose: { label: "Dose (g)", type: "range", min: 8, max: 90, step: 1 },
  brewRatio: { label: "Brew Ratio (water:coffee)", type: "range", min: 1.5, max: 20, step: 0.1 },
  grindSize: { label: "Grind Size", type: "range", min: 0, max: 100, step: 1 },
  fines: { label: "Fines Amount", type: "range", min: 0, max: 100, step: 1 },
  roastLevel: { label: "Roast Level", type: "range", min: 0, max: 100, step: 1 },
  temperature: { label: "Water Temperature (°F)", type: "range", min: 20, max: 100, step: 1 },
  contactTime: { label: "Contact Time (s)", type: "range", min: 20, max: 1200, step: 5 },
  pressure: { label: "Pressure (bar)", type: "range", min: 1, max: 12, step: 0.1 },
  pressureAggressiveness: { label: "Pressure Profile Aggressiveness", type: "range", min: 0, max: 100, step: 1 },
  preinfusion: { label: "Preinfusion Time (s)", type: "range", min: 0, max: 60, step: 1 },
  agitation: { label: "Agitation", type: "range", min: 0, max: 100, step: 1 },
  filterType: { label: "Filter Type", type: "select", options: ["paper", "cloth", "metal"] },
  bedUniformity: { label: "Bed Uniformity", type: "range", min: 0, max: 100, step: 1 },
  channelingRisk: { label: "Channeling Risk", type: "range", min: 0, max: 100, step: 1 },
  extractionEfficiency: { label: "Extraction Efficiency", type: "range", min: 40, max: 95, step: 1 },
  mineralStrength: { label: "Water Mineral Strength", type: "range", min: 0, max: 100, step: 1 },
  acidityBuffering: { label: "Acidity Buffering", type: "range", min: 0, max: 100, step: 1 },
  bodyEmphasis: { label: "Body Emphasis", type: "range", min: 0, max: 100, step: 1 },
  clarityEmphasis: { label: "Clarity Emphasis", type: "range", min: 0, max: 100, step: 1 }
};

const buildMethodRanges = (overrides = {}) => {
  const merged = {};
  Object.entries(commonControlConfig).forEach(([key, cfg]) => {
    if (cfg.type === "select") {
      merged[key] = { options: [...cfg.options] };
    } else {
      merged[key] = { min: cfg.min, max: cfg.max, step: cfg.step };
    }
  });

  Object.entries(overrides).forEach(([key, value]) => {
    merged[key] = { ...merged[key], ...value };
  });

  return merged;
};

export const brewMethodPresets = {
  espresso: {
    label: "Espresso",
    description: "Short, concentrated pressure brew with high intensity and body.",
    defaults: {
      dose: 18,
      brewRatio: 2.2,
      grindSize: 18,
      fines: 62,
      roastLevel: 58,
      temperature: 94,
      contactTime: 30,
      pressure: 9,
      pressureAggressiveness: 60,
      preinfusion: 6,
      agitation: 25,
      filterType: "paper",
      bedUniformity: 72,
      channelingRisk: 28,
      extractionEfficiency: 83,
      mineralStrength: 58,
      acidityBuffering: 38,
      bodyEmphasis: 70,
      clarityEmphasis: 45
    },
    ranges: buildMethodRanges({
      dose: { min: 14, max: 24, step: 0.5 },
      brewRatio: { min: 1.6, max: 3.2, step: 0.1 },
      grindSize: { min: 5, max: 35, step: 1 },
      contactTime: { min: 18, max: 50, step: 1 },
      pressure: { min: 6, max: 11, step: 0.1 },
      pressureAggressiveness: { min: 20, max: 100, step: 1 },
      preinfusion: { min: 0, max: 15, step: 1 },
      agitation: { min: 0, max: 45, step: 1 },
      filterType: { options: ["paper", "metal"] },
      temperature: { min: 88, max: 98, step: 1 }
    }),
    coeff: { speed: 1.32, clarity: 0.52, body: 1.22, bitterness: 1.15, aroma: 1.0, immersion: 0.08, windowWidth: 0.32 }
  },
  pourOver: {
    label: "Pour Over",
    description: "Clean, clarity-focused percolation brew with longer contact and controlled flow.",
    defaults: {
      dose: 20,
      brewRatio: 16,
      grindSize: 62,
      fines: 34,
      roastLevel: 42,
      temperature: 93,
      contactTime: 205,
      pressure: 1,
      pressureAggressiveness: 10,
      preinfusion: 35,
      agitation: 48,
      filterType: "paper",
      bedUniformity: 84,
      channelingRisk: 18,
      extractionEfficiency: 75,
      mineralStrength: 60,
      acidityBuffering: 30,
      bodyEmphasis: 42,
      clarityEmphasis: 82
    },
    ranges: buildMethodRanges({
      dose: { min: 12, max: 36, step: 1 },
      brewRatio: { min: 12, max: 18, step: 0.1 },
      grindSize: { min: 45, max: 85, step: 1 },
      contactTime: { min: 120, max: 420, step: 5 },
      pressure: { min: 1, max: 2.2, step: 0.1 },
      pressureAggressiveness: { min: 0, max: 30, step: 1 },
      preinfusion: { min: 15, max: 75, step: 1 },
      agitation: { min: 15, max: 80, step: 1 },
      filterType: { options: ["paper", "cloth"] },
      temperature: { min: 88, max: 98, step: 1 }
    }),
    coeff: { speed: 0.82, clarity: 1.28, body: 0.74, bitterness: 0.92, aroma: 1.06, immersion: 0.22, windowWidth: 0.58 }
  },
  frenchPress: {
    label: "French Press",
    description: "Immersion brew with fuller texture, heavier body, and reduced clarity.",
    defaults: {
      dose: 30,
      brewRatio: 15,
      grindSize: 78,
      fines: 45,
      roastLevel: 50,
      temperature: 94,
      contactTime: 250,
      pressure: 1,
      pressureAggressiveness: 0,
      preinfusion: 0,
      agitation: 58,
      filterType: "metal",
      bedUniformity: 60,
      channelingRisk: 8,
      extractionEfficiency: 72,
      mineralStrength: 56,
      acidityBuffering: 45,
      bodyEmphasis: 82,
      clarityEmphasis: 34
    },
    ranges: buildMethodRanges({
      dose: { min: 20, max: 60, step: 1 },
      brewRatio: { min: 10, max: 18, step: 0.1 },
      grindSize: { min: 65, max: 95, step: 1 },
      contactTime: { min: 180, max: 600, step: 5 },
      pressure: { min: 1, max: 1.6, step: 0.1 },
      pressureAggressiveness: { min: 0, max: 10, step: 1 },
      preinfusion: { min: 0, max: 20, step: 1 },
      agitation: { min: 20, max: 85, step: 1 },
      filterType: { options: ["metal"] },
      temperature: { min: 88, max: 98, step: 1 }
    }),
    coeff: { speed: 0.75, clarity: 0.68, body: 1.38, bitterness: 1.03, aroma: 0.96, immersion: 0.95, windowWidth: 0.62 }
  },
  siphon: {
    label: "Siphon",
    description: "Vacuum immersion/percolation hybrid with aromatic emphasis and balanced body.",
    defaults: {
      dose: 22,
      brewRatio: 14,
      grindSize: 56,
      fines: 36,
      roastLevel: 44,
      temperature: 92,
      contactTime: 100,
      pressure: 1.2,
      pressureAggressiveness: 18,
      preinfusion: 12,
      agitation: 36,
      filterType: "cloth",
      bedUniformity: 80,
      channelingRisk: 14,
      extractionEfficiency: 77,
      mineralStrength: 59,
      acidityBuffering: 28,
      bodyEmphasis: 50,
      clarityEmphasis: 69
    },
    ranges: buildMethodRanges({
      dose: { min: 14, max: 36, step: 1 },
      brewRatio: { min: 10, max: 16, step: 0.1 },
      grindSize: { min: 45, max: 75, step: 1 },
      contactTime: { min: 70, max: 210, step: 5 },
      pressure: { min: 1, max: 2.5, step: 0.1 },
      pressureAggressiveness: { min: 5, max: 40, step: 1 },
      preinfusion: { min: 5, max: 25, step: 1 },
      agitation: { min: 15, max: 60, step: 1 },
      filterType: { options: ["cloth", "paper"] },
      temperature: { min: 88, max: 97, step: 1 }
    }),
    coeff: { speed: 0.95, clarity: 1.08, body: 0.92, bitterness: 0.96, aroma: 1.2, immersion: 0.45, windowWidth: 0.48 }
  },
  aeroPress: {
    label: "AeroPress",
    description: "Fast immersion-pressure hybrid with versatile strength and flavor balance.",
    defaults: {
      dose: 17,
      brewRatio: 13,
      grindSize: 48,
      fines: 40,
      roastLevel: 46,
      temperature: 90,
      contactTime: 95,
      pressure: 2,
      pressureAggressiveness: 42,
      preinfusion: 10,
      agitation: 52,
      filterType: "paper",
      bedUniformity: 78,
      channelingRisk: 12,
      extractionEfficiency: 76,
      mineralStrength: 57,
      acidityBuffering: 34,
      bodyEmphasis: 58,
      clarityEmphasis: 62
    },
    ranges: buildMethodRanges({
      dose: { min: 11, max: 24, step: 0.5 },
      brewRatio: { min: 8, max: 17, step: 0.1 },
      grindSize: { min: 30, max: 75, step: 1 },
      contactTime: { min: 45, max: 210, step: 5 },
      pressure: { min: 1, max: 3.5, step: 0.1 },
      pressureAggressiveness: { min: 5, max: 75, step: 1 },
      preinfusion: { min: 0, max: 30, step: 1 },
      agitation: { min: 15, max: 90, step: 1 },
      filterType: { options: ["paper", "metal"] },
      temperature: { min: 80, max: 96, step: 1 }
    }),
    coeff: { speed: 1.02, clarity: 0.98, body: 1.0, bitterness: 0.98, aroma: 1.03, immersion: 0.52, windowWidth: 0.44 }
  },
  coldBrew: {
    label: "Cold Brew",
    description: "Low-temperature long extraction emphasizing smoothness and lower perceived acidity.",
    defaults: {
      dose: 80,
      brewRatio: 10,
      grindSize: 82,
      fines: 20,
      roastLevel: 52,
      temperature: 22,
      contactTime: 720,
      pressure: 1,
      pressureAggressiveness: 0,
      preinfusion: 0,
      agitation: 12,
      filterType: "metal",
      bedUniformity: 70,
      channelingRisk: 5,
      extractionEfficiency: 64,
      mineralStrength: 55,
      acidityBuffering: 60,
      bodyEmphasis: 76,
      clarityEmphasis: 40
    },
    ranges: buildMethodRanges({
      dose: { min: 40, max: 120, step: 1 },
      brewRatio: { min: 6, max: 14, step: 0.1 },
      grindSize: { min: 65, max: 95, step: 1 },
      contactTime: { min: 360, max: 1440, step: 15 },
      pressure: { min: 1, max: 1.2, step: 0.1 },
      pressureAggressiveness: { min: 0, max: 5, step: 1 },
      preinfusion: { min: 0, max: 30, step: 1 },
      agitation: { min: 0, max: 35, step: 1 },
      filterType: { options: ["metal", "cloth", "paper"] },
      temperature: { min: 4, max: 30, step: 1 }
    }),
    coeff: { speed: 0.36, clarity: 0.82, body: 1.12, bitterness: 0.7, aroma: 0.74, immersion: 1.05, windowWidth: 0.74 }
  }
};

export const processPresets = brewMethodPresets;

export const controlConfig = Object.entries(commonControlConfig).map(([key, config]) => ({
  key,
  ...config
}));

export function getControlDefinition(key) {
  return commonControlConfig[key];
}

export function getControlSpec(processKey, key) {
  const methodPreset = brewMethodPresets[processKey];
  const base = commonControlConfig[key];
  const override = methodPreset?.ranges?.[key];

  if (!base) return null;

  if (base.type === "select") {
    return {
      ...base,
      options: override?.options ? [...override.options] : [...base.options]
    };
  }

  return {
    ...base,
    min: override?.min ?? base.min,
    max: override?.max ?? base.max,
    step: override?.step ?? base.step
  };
}

export function clampValueForControl(processKey, key, value) {
  const spec = getControlSpec(processKey, key);
  if (!spec) return value;

  if (spec.type === "select") {
    return spec.options.includes(value) ? value : spec.options[0];
  }

  const numericValue = Number(value);
  const clamped = Math.max(spec.min, Math.min(spec.max, Number.isFinite(numericValue) ? numericValue : spec.min));

  if (!spec.step || spec.step <= 0) return clamped;
  const snapped = Math.round((clamped - spec.min) / spec.step) * spec.step + spec.min;
  return Number(snapped.toFixed(spec.step < 1 ? 2 : 0));
}
