export const variableDocs = {
  dose: {
    title: "Dose (g)",
    definition: "The mass of dry coffee used in the brew.",
    relevance: "Dose sets baseline concentration and extraction load. It is one of the strongest levers for intensity and mouthfeel.",
    methods: {
      current: "In pressure methods, small dose changes can strongly shift concentration and flow resistance.",
      general: [
        "Espresso: dose influences puck depth and resistance, affecting shot balance.",
        "Pour-over: higher dose with fixed water increases perceived strength and body.",
        "Immersion methods: dose mainly changes concentration and texture more than flow behavior."
      ]
    },
    flavorEffects: [
      "Increase dose: fuller body, stronger cup, higher bitterness risk if over-extracted.",
      "Decrease dose: lighter body and intensity, often cleaner but can taste thin."
    ]
  },
  brewRatio: {
    title: "Brew Ratio (water:coffee)",
    definition: "The proportion of brew water relative to coffee mass.",
    relevance: "Ratio is the main concentration dial and determines whether the cup tastes dense versus dilute.",
    methods: {
      current: "For espresso-style brewing, lower ratio gives ristretto-like intensity; higher ratio can push toward over-extracted bitterness.",
      general: [
        "Percolation brews often target higher ratios for clarity.",
        "Immersion brews can use lower ratios for richer texture."
      ]
    },
    flavorEffects: [
      "Increase ratio: cleaner, lighter, less body, sometimes sharper acidity.",
      "Decrease ratio: heavier body, stronger sweetness/bitterness expression."
    ]
  },
  grindSize: {
    title: "Grind Size",
    definition: "Average particle size of ground coffee.",
    relevance: "Grind controls surface area and flow resistance, making it central to extraction speed and uniformity.",
    methods: {
      current: "In the selected method, finer grinds generally speed extraction but raise resistance and harshness risk.",
      general: [
        "Espresso uses finer grind to reach target extraction in short time.",
        "Pour-over/french press usually require coarser settings to avoid over-extraction and fines migration."
      ]
    },
    flavorEffects: [
      "Finer: more extraction, more body/sweetness at first, then bitterness/astringency if too fine.",
      "Coarser: brighter and lighter, but can become sour/underdeveloped if too coarse."
    ]
  },
  fines: {
    title: "Fines Amount",
    definition: "The proportion of very small particles in the grind.",
    relevance: "Fines extract quickly and can migrate, increasing unevenness and late-stage harshness.",
    methods: {
      current: "Higher fines in this method increase extraction intensity but can elevate clogging or channeling tendencies.",
      general: ["Paper filters mute some fines impact; metal filters often let more solids through."]
    },
    flavorEffects: [
      "Increase fines: heavier texture and intensity, but more bitterness/astringency risk.",
      "Reduce fines: cleaner finish and clarity, potentially less body."
    ]
  },
  roastLevel: {
    title: "Roast Level",
    definition: "Relative development of the coffee from light to dark roast.",
    relevance: "Roast changes solubility and flavor precursors, affecting extraction speed and perceived balance.",
    methods: {
      current: "In this model, darker roasts extract faster and emphasize roast-derived bitterness.",
      general: ["Light roasts generally need tighter extraction control to avoid sourness.", "Dark roasts can become harsh quickly if pushed too far."]
    },
    flavorEffects: ["Lighter: brighter acidity and origin clarity.", "Darker: more body, chocolate/roast notes, more bitterness."]
  },
  temperature: {
    title: "Water Temperature",
    definition: "Brewing water temperature during extraction.",
    relevance: "Temperature accelerates extraction kinetics and strongly shifts balance between sweetness and bitterness.",
    methods: {
      current: "For the selected method, higher temperature raises extraction speed and late-stage harsh compounds.",
      general: ["Low-temperature methods extract slowly and usually taste smoother."]
    },
    flavorEffects: ["Increase temperature: more sweetness and strength up to a point, then harsher finish.", "Decrease temperature: softer cup, but sour/under-extracted risk."]
  },
  contactTime: {
    title: "Contact Time (s)",
    definition: "How long water stays in meaningful contact with coffee.",
    relevance: "Time determines how far extraction progresses from acids to sugars to later bitter compounds.",
    methods: {
      current: "In this method, extra time mainly advances later extraction phases, not just total strength.",
      general: ["Short contact favors acidity and aroma.", "Long contact favors body and bitterness."]
    },
    flavorEffects: ["Longer time: increased sweetness then bitterness/astringency if excessive.", "Shorter time: brighter but can be thin/sour."]
  },
  pressure: {
    title: "Pressure (bar)",
    definition: "Applied pressure driving water through coffee.",
    relevance: "Pressure modifies flow and extraction intensity, especially in espresso and hybrid methods.",
    methods: {
      current: "The selected method weights pressure impact according to how pressure-driven the brew style is.",
      general: ["High-pressure methods are sensitive to grind and puck prep.", "Immersion methods are minimally affected."]
    },
    flavorEffects: ["Increase pressure: denser texture and faster extraction, with channeling/harshness risk if mismatched.", "Lower pressure: softer extraction and potentially cleaner cup."]
  },
  pressureAggressiveness: {
    title: "Pressure Profile Aggressiveness",
    definition: "How abruptly and forcefully pressure is applied over the brew.",
    relevance: "Aggressive pressure can amplify uneven flow when puck or bed resistance is unstable.",
    methods: {
      current: "Most relevant in pressure-involved methods; less relevant in passive immersion.",
      general: ["Smoother ramps can improve balance and reduce harsh channeling artifacts."]
    },
    flavorEffects: ["More aggressive: higher intensity and possible bitterness spikes.", "Less aggressive: calmer, often sweeter and rounder extraction."]
  },
  preinfusion: {
    title: "Preinfusion Time (s)",
    definition: "Initial low-force wetting period before full extraction.",
    relevance: "Preinfusion improves saturation and can reduce uneven extraction start-up.",
    methods: {
      current: "In the selected method, preinfusion contributes to early extraction stability.",
      general: ["Commonly used in espresso and pour-over blooms.", "Less critical in long immersion brews."]
    },
    flavorEffects: ["Longer preinfusion: improved balance and sweetness when moderate.", "Too little preinfusion: higher risk of channeling and uneven cup."]
  },
  agitation: {
    title: "Agitation",
    definition: "Physical movement of water/coffee slurry during brewing.",
    relevance: "Agitation refreshes boundary layers and can speed extraction, but may increase fines migration.",
    methods: {
      current: "This method applies agitation with method-specific strength.",
      general: ["Immersion and pour-over are highly sensitive to agitation style.", "Espresso is less agitation-driven once puck is set."]
    },
    flavorEffects: ["More agitation: higher extraction and body, sometimes muddier finish.", "Less agitation: cleaner but potentially weaker/sour."]
  },
  filterType: {
    title: "Filter Type",
    definition: "Filter material (paper, cloth, metal) shaping oil and solids carryover.",
    relevance: "Filter type directly changes clarity, body, and perceived bitterness by altering what reaches the cup.",
    methods: {
      current: "The selected method uses filter coefficients to post-adjust body, clarity, aroma, and polyphenol carryover.",
      general: ["Paper usually maximizes clarity.", "Metal typically increases body and suspended solids.", "Cloth often sits between paper and metal."]
    },
    flavorEffects: ["Paper: cleaner cup, lighter body.", "Metal: richer mouthfeel, lower clarity."]
  },
  bedUniformity: {
    title: "Bed Uniformity",
    definition: "How even the puck/coffee bed is in density and distribution.",
    relevance: "Uniform beds extract more evenly, improving sweetness and reducing harsh channels.",
    methods: {
      current: "In the selected method, better uniformity lowers unevenness penalties.",
      general: ["Most critical in percolation and pressure brewing.", "Still helpful in immersion for consistency."]
    },
    flavorEffects: ["Higher uniformity: smoother sweetness and clarity.", "Lower uniformity: mixed extraction with sour + bitter coexistence."]
  },
  channelingRisk: {
    title: "Channeling Risk",
    definition: "Likelihood of water finding fast pathways instead of extracting evenly.",
    relevance: "Channeling drives simultaneous under- and over-extraction, reducing cup quality.",
    methods: {
      current: "This method uses channeling risk in unevenness calculations.",
      general: ["Most severe in espresso/percolation.", "Lower but still possible in uneven immersion setups."]
    },
    flavorEffects: ["Higher risk: harsher finish and hollow center.", "Lower risk: sweeter, more coherent flavor profile."]
  },
  extractionEfficiency: {
    title: "Extraction Efficiency",
    definition: "Relative ability to dissolve desirable compounds from grounds.",
    relevance: "Efficiency influences sweetness capture and overall balance ceiling.",
    methods: {
      current: "In this simulator, efficiency improves sugar extraction until late compounds dominate.",
      general: ["Efficiency depends on grinder quality, water chemistry, and method execution."]
    },
    flavorEffects: ["Increase efficiency: more sweetness and complexity at moderate levels.", "Excessively high extraction: bitterness/astringency rise."]
  },
  mineralStrength: {
    title: "Water Mineral Strength",
    definition: "Overall dissolved mineral concentration in brew water.",
    relevance: "Minerals affect extraction behavior and perceived structure of acidity/body.",
    methods: {
      current: "Current method applies mineral scaling to acidity and extraction proxies.",
      general: ["Very low minerals can taste flat/under-extracted.", "Very high minerals can mute nuance."]
    },
    flavorEffects: ["Moderate increase: better structure and sweetness support.", "Too high: muted acidity and reduced clarity."]
  },
  acidityBuffering: {
    title: "Acidity Buffering",
    definition: "Water tendency to neutralize or soften perceived acidity.",
    relevance: "Buffering changes how bright or sharp acids present in the final cup.",
    methods: {
      current: "The selected method applies buffering as an acidity suppression term.",
      general: ["Higher buffering can help harsh coffees taste smoother.", "Too much buffering may flatten lively coffees."]
    },
    flavorEffects: ["Increase buffering: softer acidity, rounder cup.", "Decrease buffering: brighter and sharper acidity expression."]
  },
  bodyEmphasis: {
    title: "Body Emphasis",
    definition: "Preference weighting toward tactile heaviness in final mapping.",
    relevance: "This is a profile-bias control that shifts final sensory interpretation toward weight and texture.",
    methods: {
      current: "Applies as a body bias multiplier in flavor mapping.",
      general: ["Useful for tuning output style without changing core extraction mechanics."]
    },
    flavorEffects: ["Increase body emphasis: richer, heavier sensory profile.", "Decrease body emphasis: lighter tactile presentation."]
  },
  clarityEmphasis: {
    title: "Clarity Emphasis",
    definition: "Preference weighting toward clean and separated flavor perception.",
    relevance: "This output-bias control increases the final clarity interpretation of the brew profile.",
    methods: {
      current: "Applied as a final clarity bias term.",
      general: ["Pairs well with paper filtration and lower fines for transparent cups."]
    },
    flavorEffects: ["Increase clarity emphasis: brighter, cleaner, more distinct notes.", "Decrease clarity emphasis: denser and more blended flavor impression."]
  }
};
