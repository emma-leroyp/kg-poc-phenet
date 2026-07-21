// Generates a small, clearly-flagged SYNTHETIC multi-environment wheat trial to fill
// the gaps the real FAIDARE data can't demo: yield (CQ2), and descriptor-vs-observation
// pairs for plant height / awn / grain colour (CQ3, beyond the one real TKW pair).
//
// Every record carries dataProvenance: "synthetic:demo" so it can be filtered out or
// visually flagged downstream, see docs/synthetic-data.md for the full rationale,
// statistical model, and a plain listing of what's real vs fabricated.
//
// Deterministic: seeded PRNG, no Math.random(), so re-running reproduces identical output.

const fs = require('fs');
const path = require('path');
const { AWN_CLASSES, mapRealAwnValue, GRAIN_COLOUR_CLASSES, mapRealGrainColourValue } = require('./lib/trait-mappings');

const WHEAT_DIR = path.join(__dirname, '..', 'data', 'wheat-subset');
const OUT_DIR = path.join(__dirname, '..', 'data', 'synthetic-subset');

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260721);
const rand = () => rng();
const randn = (mean, sd) => {
  const u1 = rand() || 1e-9, u2 = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(WHEAT_DIR, name), 'utf8'));
}

const germplasm = load('germplasm.json');
const germplasmAttribute = load('germplasmAttribute.json');
const location = load('location.json');

const DESCRIPTOR_CODES = ['CEREALS_PLANT_HEIGHT', 'CEREALS_WHEAT_AWNEDNESS_SCALE', 'CEREALS_GRAIN_COLOUR_SCALE'];
const descriptorsByGermplasm = new Map();
for (const a of germplasmAttribute) {
  const relevant = a.data.filter(d => DESCRIPTOR_CODES.includes(d.attributeCode));
  if (relevant.length) descriptorsByGermplasm.set(a.germplasmDbId, relevant);
}

// Genotype panel: all 18 genotypes with a real height/awn/grain-colour descriptor
// (so those CQ3 pairs have something real to compare against), padded to 40 with
// other real wheat germplasm that at least has a growth-class attribute recorded.
const descriptorRichIds = [...descriptorsByGermplasm.keys()];
const growthClassIds = germplasmAttribute
  .filter(a => a.data.some(d => d.attributeCode === 'CEREALS_GROWTH_CLASS'))
  .map(a => a.germplasmDbId);
const fillerPool = growthClassIds.filter(id => !descriptorRichIds.includes(id));
const TARGET_PANEL_SIZE = 40;
const panelIds = new Set(descriptorRichIds);
const fillerShuffled = [...fillerPool].sort(() => rand() - 0.5);
for (const id of fillerShuffled) {
  if (panelIds.size >= TARGET_PANEL_SIZE) break;
  panelIds.add(id);
}
const germplasmById = new Map(germplasm.map(g => [g.germplasmDbId, g]));
const panel = [...panelIds].map(id => germplasmById.get(id)).filter(Boolean);
console.log(`Genotype panel: ${panel.length} (${descriptorRichIds.length} descriptor-rich + ${panel.length - descriptorRichIds.length} filler)`);

const SEASONS = ['2019', '2020', '2021'];
const locations = location; // all 8 real wheat locations

// Latent per-genotype potentials (fixed properties of the genotype, not the trial)
const genotypeYieldPotential = new Map(panel.map(g => [g.germplasmDbId, clip(randn(7000, 900), 3500, 9800)]));
const genotypeHeightBaseline = new Map(panel.map(g => {
  const descs = descriptorsByGermplasm.get(g.germplasmDbId) || [];
  const heightDesc = descs.find(d => d.attributeCode === 'CEREALS_PLANT_HEIGHT');
  const real = heightDesc ? parseFloat(heightDesc.value) : null;
  return [g.germplasmDbId, real !== null ? real : clip(randn(85, 9), 55, 115)];
}));
const genotypeDiseaseResistance = new Map(panel.map(g => [g.germplasmDbId, clip(randn(0.5, 0.2), 0.05, 0.95)])); // 0=susceptible .. 1=resistant

const genotypeAwnClass = new Map(panel.map(g => {
  const descs = descriptorsByGermplasm.get(g.germplasmDbId) || [];
  const d = descs.find(x => x.attributeCode === 'CEREALS_WHEAT_AWNEDNESS_SCALE');
  return [g.germplasmDbId, d ? mapRealAwnValue(d.value) : pick(AWN_CLASSES)];
}));
const genotypeGrainColourClass = new Map(panel.map(g => {
  const descs = descriptorsByGermplasm.get(g.germplasmDbId) || [];
  const d = descs.find(x => x.attributeCode === 'CEREALS_GRAIN_COLOUR_SCALE');
  return [g.germplasmDbId, d ? mapRealGrainColourValue(d.value) : pick(GRAIN_COLOUR_CLASSES)];
}));

// Environment effects (fixed per location, e.g. soil/climate quality) and per-season
// effects (e.g. weather year) plus a disease-pressure level per location x season.
const locationYieldEffect = new Map(locations.map(l => [l.locationDbId, randn(0, 650)]));
const seasonYieldEffect = new Map(SEASONS.map(s => [s, randn(0, 300)]));
const locationSeasonDiseasePressure = new Map();
for (const l of locations) for (const s of SEASONS) {
  locationSeasonDiseasePressure.set(`${l.locationDbId}|${s}`, clip(rand(), 0.1, 0.9));
}

const MISMATCH_RATE = 0.12; // deliberate scoring-noise rate for categorical descriptor comparisons
function withMismatch(trueClass, classes) {
  if (rand() >= MISMATCH_RATE) return trueClass;
  const others = classes.filter(c => c !== trueClass);
  return pick(others);
}

const TRIAL_ID = 'phenet-poc:trial/synthetic-yield-quality-2019-2021';
const PROGRAM_ID = 'phenet-poc:program/synthetic-demo';

const VARIABLES = [
  { id: 'PHENETPOC:YIELD_KGHA', name: 'Yield_kgha', unit: 'kg/ha', description: 'Grain yield (synthetic, illustrative).' },
  { id: 'PHENETPOC:PLANT_HEIGHT_CM', name: 'PlantHeight_cm', unit: 'cm', description: 'Plant height, ground to spike tip (synthetic, illustrative).' },
  { id: 'PHENETPOC:AWN_CLASS', name: 'AwnClass', unit: 'category', description: 'Awn presence/length class, scored in-field (synthetic, illustrative).' },
  { id: 'PHENETPOC:GRAIN_COLOUR_CLASS', name: 'GrainColourClass', unit: 'category', description: 'Grain colour class, scored in-field (synthetic, illustrative).' },
  { id: 'PHENETPOC:STRIPE_RUST_SEV_PCT', name: 'StripeRustSeverity_pct', unit: '%', description: 'Stripe rust severity (synthetic, illustrative).' },
  { id: 'PHENETPOC:SEPTORIA_SEV_PCT', name: 'SeptoriaSeverity_pct', unit: '%', description: 'Septoria tritici blotch severity (synthetic, illustrative).' },
];

const observation = [];
const observationUnit = [];
const study = [];
let obsCounter = 0, unitCounter = 0;

for (const season of SEASONS) {
  for (const loc of locations) {
    const studyId = `phenet-poc:study/synthetic-${loc.locationDbId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}-${season}`;
    study.push({
      studyDbId: studyId,
      studyName: `Synthetic demo study, ${loc.locationName} ${season}`,
      trialDbId: TRIAL_ID,
      trialName: 'PHENET PoC synthetic yield & quality trial (NOT real data)',
      locationDbId: loc.locationDbId,
      locationURI: loc.locationURI,
      locationName: loc.locationName,
      seasons: [season],
      dataProvenance: 'synthetic:demo',
    });
    const diseasePressure = locationSeasonDiseasePressure.get(`${loc.locationDbId}|${season}`);

    for (const g of panel) {
      unitCounter++;
      const unitId = `phenet-poc:observationUnit/${unitCounter}`;
      observationUnit.push({
        observationUnitDbId: unitId,
        observationUnitName: `synthetic-plot-${unitCounter}`,
        germplasmDbId: g.germplasmDbId,
        germplasmURI: g.germplasmURI,
        germplasmName: g.germplasmName,
        studyDbId: studyId,
        studyLocationDbId: loc.locationDbId,
        studyLocation: loc.locationName,
        programDbId: PROGRAM_ID,
        dataProvenance: 'synthetic:demo',
      });

      const yieldVal = Math.round(clip(
        genotypeYieldPotential.get(g.germplasmDbId) + locationYieldEffect.get(loc.locationDbId) +
        seasonYieldEffect.get(season) + randn(0, 250),
        1500, 11000
      ));
      const heightVal = Math.round(clip(genotypeHeightBaseline.get(g.germplasmDbId) + randn(0, 3), 40, 130) * 10) / 10;
      const trueAwn = genotypeAwnClass.get(g.germplasmDbId);
      const observedAwn = withMismatch(trueAwn, AWN_CLASSES);
      const trueGrainColour = genotypeGrainColourClass.get(g.germplasmDbId);
      const observedGrainColour = withMismatch(trueGrainColour, GRAIN_COLOUR_CLASSES);
      const resistance = genotypeDiseaseResistance.get(g.germplasmDbId);
      const stripeRust = Math.round(clip((1 - resistance) * diseasePressure * 100 + randn(0, 6), 0, 100));
      const septoria = Math.round(clip((1 - resistance) * diseasePressure * 90 + randn(0, 6), 0, 100));

      const values = [
        [VARIABLES[0], yieldVal],
        [VARIABLES[1], heightVal],
        [VARIABLES[2], observedAwn],
        [VARIABLES[3], observedGrainColour],
        [VARIABLES[4], stripeRust],
        [VARIABLES[5], septoria],
      ];
      for (const [variable, value] of values) {
        obsCounter++;
        observation.push({
          observationDbId: `phenet-poc:observation/${obsCounter}`,
          observationVariableDbId: variable.id,
          observationVariableName: variable.name,
          season: { seasonName: season },
          value: String(value),
          observationUnitDbId: unitId,
          germplasmDbId: g.germplasmDbId,
          germplasmURI: g.germplasmURI,
          germplasmName: g.germplasmName,
          studyDbId: studyId,
          trialDbId: TRIAL_ID,
          trialName: 'PHENET PoC synthetic yield & quality trial (NOT real data)',
          studyLocationDbId: loc.locationDbId,
          studyLocation: loc.locationName,
          dataProvenance: 'synthetic:demo',
        });
      }
    }
  }
}

const observationVariable = VARIABLES.map(v => ({
  observationVariableDbId: v.id,
  name: v.name,
  unit: v.unit,
  trait: { description: v.description },
  ontologyName: 'PHENET PoC synthetic (illustrative only, not a published ontology term)',
  dataProvenance: 'synthetic:demo',
}));

const trial = [{
  trialDbId: TRIAL_ID,
  trialName: 'PHENET PoC synthetic yield & quality trial (NOT real data)',
  programDbId: PROGRAM_ID,
  dataProvenance: 'synthetic:demo',
}];
const program = [{
  programDbId: PROGRAM_ID,
  programName: 'PHENET PoC synthetic demo program (NOT real data)',
  dataProvenance: 'synthetic:demo',
}];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, data] of Object.entries({ observation, observationUnit, observationVariable, study, trial, program })) {
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(data));
  console.log(`${name}: ${data.length} records`);
}

// Quick sanity summary
const byGenotypeYield = new Map();
for (const o of observation) {
  if (o.observationVariableDbId !== 'PHENETPOC:YIELD_KGHA') continue;
  const arr = byGenotypeYield.get(o.germplasmName) || [];
  arr.push(Number(o.value));
  byGenotypeYield.set(o.germplasmName, arr);
}
const avgYieldByGenotype = [...byGenotypeYield.entries()]
  .map(([name, vals]) => [name, vals.reduce((a, b) => a + b, 0) / vals.length])
  .sort((a, b) => b[1] - a[1]);
console.log('\nTop 5 genotypes by mean synthetic yield:', avgYieldByGenotype.slice(0, 5));
console.log('Bottom 3:', avgYieldByGenotype.slice(-3));

let awnMatches = 0, awnTotal = 0, gcMatches = 0, gcTotal = 0;
for (const o of observation) {
  if (o.observationVariableDbId === 'PHENETPOC:AWN_CLASS' && descriptorsByGermplasm.has(o.germplasmDbId)) {
    awnTotal++; if (o.value === genotypeAwnClass.get(o.germplasmDbId)) awnMatches++;
  }
  if (o.observationVariableDbId === 'PHENETPOC:GRAIN_COLOUR_CLASS' && descriptorsByGermplasm.has(o.germplasmDbId)) {
    gcTotal++; if (o.value === genotypeGrainColourClass.get(o.germplasmDbId)) gcMatches++;
  }
}
console.log(`\nAwn observed-vs-descriptor match rate: ${awnMatches}/${awnTotal} (${(100*awnMatches/awnTotal).toFixed(1)}%)`);
console.log(`Grain colour observed-vs-descriptor match rate: ${gcMatches}/${gcTotal} (${(100*gcMatches/gcTotal).toFixed(1)}%)`);
