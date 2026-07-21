// Human-readable labels, units, and methods for every trait in the graph.
// Taken from the FAIDARE observationVariable records themselves (trait.name,
// method.name, scale.name) wherever available, not invented. Where the source
// left a field blank ("N.A.") or the method wasn't recorded, that's stated
// plainly instead of guessing a unit.
//
// One field is a correction, not a copy of the source: the "P/L" variable's
// source description talks about an unrelated test (Pelshenke), which looks
// like a labelling mistake upstream. P/L is labelled here by what the
// Alveograph Chopin method actually reports, the tenacity/extensibility
// ratio, and the note field explains why.

function realIri(coCode) {
  return `urn:INRAE-URGI/observationVariable/${encodeURIComponent(coCode)}`;
}
function syntheticIri(code) {
  return `https://w3id.org/phenet-poc/id/synthetic/variable/${code}`;
}

export const TRAIT_INFO = {
  [realIri('CO_321:1000070')]: { label: 'Grain Protein Content', unit: '%', method: 'NIRS (near-infrared spectroscopy)' },
  [realIri('CO_321:1000177')]: { label: 'Thousand Kernel Weight', unit: 'g', method: '1200-grain direct measure' },
  [realIri('CO_321:1000216')]: { label: 'Grain Hardness', unit: 'unit not recorded in source', method: 'grading factor for wheat classification' },
  [realIri('CO_321:1000220')]: { label: 'Test Weight (Hectolitre Weight)', unit: 'kg/hl', method: 'weight of 100 L of grain' },
  [realIri('CO_321:1000222')]: { label: 'Zeleny Sedimentation Index', unit: 'mL', method: 'Zeleny sedimentation test' },
  [realIri('CO_321:1000223')]: { label: 'Alveograph Tenacity/Extensibility Ratio', unit: 'ratio', method: 'Alveograph Chopin', note: 'Same concept as P/L, submitted under a separate variable code in the source data.' },
  [realIri('CO_321:1000224')]: { label: 'SDS Sedimentation Index', unit: 'mL', method: 'SDS sedimentation test' },
  [realIri('CO_321:1000225')]: { label: 'Ethanol-Potential Viscosity', unit: 'unit not recorded in source' },
  [realIri('CO_321:1000226')]: { label: 'Alveograph Deformation Energy (W)', unit: 'unit not recorded in source', method: 'Alveograph Chopin' },
  [realIri('CO_321:1000227')]: { label: 'Alveograph Tenacity (P)', unit: 'unit not recorded in source', method: 'Alveograph Chopin' },
  [realIri('CO_321:1000228')]: { label: 'Alveograph Extensibility (L)', unit: 'unit not recorded in source', method: 'Alveograph Chopin' },
  [realIri('CO_321:1000229')]: { label: 'Alveograph Configuration Ratio (P/L)', unit: 'ratio', method: 'Alveograph Chopin', note: 'The source metadata for this field describes an unrelated test (Pelshenke). Treated here as the standard Alveograph P/L ratio, since that is what the method name actually indicates.' },
  [realIri('CO_321:1000230')]: { label: 'Alveograph Swelling Index (G)', unit: 'unit not recorded in source', method: 'Alveograph Chopin' },
  [realIri('CO_321:1000231')]: { label: 'Hagberg Falling Number', unit: 'typically seconds, not recorded in source', note: 'A standard test for sprout damage and alpha-amylase activity. The code "hag" strongly suggests Hagberg, though this isn\'t confirmed against a formal scale definition.' },
  [realIri('CO_321:1000232')]: { label: 'Dough Score (CNERNA method)', unit: '%', method: 'Breadmaking test, CNERNA' },
  [realIri('CO_321:1000233')]: { label: 'Bread Score (CNERNA method)', unit: '%', method: 'Breadmaking test, CNERNA' },
  [realIri('CO_321:1000234')]: { label: 'Total Score (CNERNA method)', unit: '%', method: 'Breadmaking test, CNERNA' },
  [realIri('CO_321:1000235')]: { label: 'Bread Volume (CNERNA method)', unit: '%', method: 'Breadmaking test, CNERNA' },
  [realIri('CO_321:1000236')]: { label: 'Dough Score (BIPEA method G)', unit: '%', method: 'Breadmaking test, BIPEA (G)' },
  [realIri('CO_321:1000237')]: { label: 'Bread Score (BIPEA method G)', unit: '%', method: 'Breadmaking test, BIPEA (G)' },
  [realIri('CO_321:1000238')]: { label: 'Crumb Score (BIPEA method G)', unit: '%', method: 'Breadmaking test, BIPEA (G)' },
  [realIri('CO_321:1000239')]: { label: 'Total Score (BIPEA method G)', unit: 'unit not recorded in source', method: 'Breadmaking test, BIPEA (G)' },
  [realIri('CO_321:1000240')]: { label: 'Bread Volume (BIPEA method G)', unit: 'unit not recorded in source', method: 'Breadmaking test, BIPEA (G)' },
  [realIri('CO_321:1000241')]: { label: 'Dough Score (BIPEA method L)', unit: '%', method: 'Breadmaking test, BIPEA (L)' },
  [realIri('CO_321:1000242')]: { label: 'Bread Score (BIPEA method L)', unit: '%', method: 'Breadmaking test, BIPEA (L)' },
  [realIri('CO_321:1000243')]: { label: 'Crumb Score (BIPEA method L)', unit: '%', method: 'Breadmaking test, BIPEA (L)' },
  [realIri('CO_321:1000244')]: { label: 'Total Score (BIPEA method L)', unit: 'unit not recorded in source', method: 'Breadmaking test, BIPEA (L)' },
  [realIri('CO_321:1000245')]: { label: 'Bread Volume (BIPEA method L)', unit: 'unit not recorded in source', method: 'Breadmaking test, BIPEA (L)' },
  [realIri('CO_321:1000246')]: { label: 'Dough Score (BIPEA method S)', unit: '%', method: 'Breadmaking test, BIPEA (S)' },
  [realIri('CO_321:1000247')]: { label: 'Bread Score (BIPEA method S)', unit: '%', method: 'Breadmaking test, BIPEA (S)' },
  [realIri('CO_321:1000248')]: { label: 'Crumb Score (BIPEA method S)', unit: '%', method: 'Breadmaking test, BIPEA (S)' },
  [realIri('CO_321:1000249')]: { label: 'Total Score (BIPEA method S)', unit: 'unit not recorded in source', method: 'Breadmaking test, BIPEA (S)' },
  [realIri('CO_321:1000250')]: { label: 'Bread Volume (BIPEA method S)', unit: 'unit not recorded in source', method: 'Breadmaking test, BIPEA (S)' },
  [realIri('CO_321:1000253')]: { label: 'Dough Score (Gallardon method)', unit: '%', method: 'Breadmaking test, Gallardon' },
  [realIri('CO_321:1000254')]: { label: 'Bread Score (Gallardon method)', unit: '%', method: 'Breadmaking test, Gallardon' },
  [realIri('CO_321:1000255')]: { label: 'Crumb Score (Gallardon method)', unit: '%', method: 'Breadmaking test, Gallardon' },
  [realIri('CO_321:1000256')]: { label: 'Total Score (Gallardon method)', unit: 'unit not recorded in source', method: 'Breadmaking test, Gallardon' },
  [realIri('CO_321:1000257')]: { label: 'Bread Volume (Gallardon method)', unit: 'unit not recorded in source', method: 'Breadmaking test, Gallardon' },

  [syntheticIri('YIELD_KGHA')]: { label: 'Grain Yield', unit: 'kg/ha' },
  [syntheticIri('PLANT_HEIGHT_CM')]: { label: 'Plant Height', unit: 'cm' },
  [syntheticIri('AWN_CLASS')]: { label: 'Awn Type', unit: 'category: awnless / awnletted / awned' },
  [syntheticIri('GRAIN_COLOUR_CLASS')]: { label: 'Grain Colour', unit: 'category' },
  [syntheticIri('STRIPE_RUST_SEV_PCT')]: { label: 'Stripe Rust Severity', unit: '%' },
  [syntheticIri('SEPTORIA_SEV_PCT')]: { label: 'Septoria Leaf Blotch Severity', unit: '%' },
};

export function traitLabel(iri, fallback) {
  return (TRAIT_INFO[iri] && TRAIT_INFO[iri].label) || fallback || iri;
}
export function traitUnit(iri) {
  return (TRAIT_INFO[iri] && TRAIT_INFO[iri].unit) || '';
}
export function traitNote(iri) {
  return (TRAIT_INFO[iri] && TRAIT_INFO[iri].note) || '';
}
export function isSyntheticIri(iri) {
  return iri.startsWith('https://w3id.org/phenet-poc/id/synthetic/');
}
