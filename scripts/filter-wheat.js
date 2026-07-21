// Filters the FAIDARE INRAE-URGI bulk JSON test fixture (data/raw/*.json.gz) down to
// a wheat-only, referentially-consistent subset, written to data/wheat-subset/*.json.
//
// Source: https://forge.inrae.fr/urgi/is/faidare/-/tree/master/data/test/json-bulk/INRAE-URGI
// See docs/data-assessment.md for why wheat was chosen for this PoC.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const OUT_DIR = path.join(__dirname, '..', 'data', 'wheat-subset');

function loadGz(filename) {
  const buf = fs.readFileSync(path.join(RAW_DIR, filename));
  return JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
}

function loadShards(prefix) {
  const files = fs.readdirSync(RAW_DIR).filter(f => f.startsWith(prefix + '-') && f.endsWith('.json.gz'));
  return files.flatMap(loadGz);
}

function writeOut(filename, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, filename), JSON.stringify(data));
}

console.log('Loading germplasm...');
const germplasm = loadGz('germplasm-1.json.gz').filter(g => g.commonCropName === 'Wheat');
const wheatGermplasmIds = new Set(germplasm.map(g => g.germplasmDbId));
console.log(`  wheat germplasm: ${germplasm.length}`);

console.log('Loading germplasmAttribute...');
const germplasmAttribute = loadGz('germplasmAttribute-1.json.gz')
  .filter(a => wheatGermplasmIds.has(a.germplasmDbId));
console.log(`  wheat germplasmAttribute: ${germplasmAttribute.length}`);

console.log('Loading germplasmPedigree...');
const germplasmPedigree = loadGz('germplasmPedigree-1.json.gz')
  .filter(p => wheatGermplasmIds.has(p.germplasmDbId));
console.log(`  wheat germplasmPedigree: ${germplasmPedigree.length}`);

console.log('Loading observation shards (this is the big one)...');
const observation = loadShards('observation').filter(o => wheatGermplasmIds.has(o.germplasmDbId));
console.log(`  wheat observation: ${observation.length}`);

const studyIds = new Set(observation.map(o => o.studyDbId));
const trialIds = new Set(observation.map(o => o.trialDbId));
const locationIds = new Set(observation.map(o => o.studyLocationDbId));
const variableIds = new Set(observation.map(o => o.observationVariableDbId));
const observationUnitIds = new Set(observation.map(o => o.observationUnitDbId));

console.log('Loading observationUnit shards...');
const observationUnit = loadShards('observationUnit')
  .filter(u => wheatGermplasmIds.has(u.germplasmDbId) || observationUnitIds.has(u.observationUnitDbId));
console.log(`  wheat observationUnit: ${observationUnit.length}`);
const programIds = new Set(observationUnit.map(u => u.programDbId).filter(Boolean));

console.log('Loading observationVariable...');
const observationVariable = loadGz('observationVariable-1.json.gz')
  .filter(v => variableIds.has(v.observationVariableDbId) || v.crop === 'Wheat');
console.log(`  wheat observationVariable: ${observationVariable.length}`);

console.log('Loading study...');
// NOTE: study-1.json.gz (78 records) does not cover the wheat trial's studies at all
// (its studyDbIds belong to a different, maize-only demo slice of the fixture), a
// referential gap in the source test data, not a bug here. Studies are instead
// reconstructed from the fields BrAPI already denormalizes onto each observation
// (studyName, studyLocationDbId/Name, trialDbId/Name), one row per unique studyDbId.
// Any record that *does* exist in the official study file is merged in on top.
const officialStudyById = new Map(
  loadGz('study-1.json.gz').filter(s => studyIds.has(s.studyDbId)).map(s => [s.studyDbId, s])
);
const derivedStudyById = new Map();
for (const o of observation) {
  if (!derivedStudyById.has(o.studyDbId)) {
    derivedStudyById.set(o.studyDbId, {
      studyDbId: o.studyDbId,
      studyName: o.studyName,
      studyURI: o.studyURI,
      trialDbId: o.trialDbId,
      trialURI: o.trialURI,
      trialName: o.trialName,
      locationDbId: o.studyLocationDbId,
      locationURI: o.studyLocationURI,
      locationName: o.studyLocation,
      seasons: new Set(),
      derived: true,
    });
  }
  const s = derivedStudyById.get(o.studyDbId);
  if (o.season && o.season.seasonName) s.seasons.add(o.season.seasonName);
}
const study = [...studyIds].map(id => {
  if (officialStudyById.has(id)) return officialStudyById.get(id);
  const d = derivedStudyById.get(id);
  return { ...d, seasons: [...d.seasons] };
});
console.log(`  wheat study: ${study.length} (${study.filter(s => s.derived).length} derived, ${study.filter(s => !s.derived).length} from official study file)`);

console.log('Loading trial...');
const trial = loadGz('trial-1.json.gz').filter(t => trialIds.has(t.trialDbId));
console.log(`  wheat trial: ${trial.length}`);

console.log('Loading location...');
const location = loadGz('location-1.json.gz').filter(l => locationIds.has(l.locationDbId));
console.log(`  wheat location: ${location.length}`);

console.log('Loading program...');
const program = loadGz('program-1.json.gz').filter(p => programIds.has(p.programDbId));
console.log(`  wheat program: ${program.length}`);

writeOut('germplasm.json', germplasm);
writeOut('germplasmAttribute.json', germplasmAttribute);
writeOut('germplasmPedigree.json', germplasmPedigree);
writeOut('observation.json', observation);
writeOut('observationUnit.json', observationUnit);
writeOut('observationVariable.json', observationVariable);
writeOut('study.json', study);
writeOut('trial.json', trial);
writeOut('location.json', location);
writeOut('program.json', program);

console.log('\nDone. Output in data/wheat-subset/');
