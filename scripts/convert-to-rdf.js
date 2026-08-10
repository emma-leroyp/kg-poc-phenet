// MODIFIED VERSION — reads directly from data/raw/*.json.gz.
// No longer requires `npm run filter` (data/wheat-subset/) nor
// `npm run generate-synthetic` (data/synthetic-subset/).
//
// Output: data/rdf/ontology.ttl (shared vocabulary + provenance entities),
//         data/rdf/real.ttl (only — no synthetic.ttl is produced anymore).
//
// NOTE ON SCOPE: this version processes ALL crops found in data/raw (Wheat,
// Maize, Forest tree, and any others), not just wheat. The trait crosswalk
// (TRAIT_MATCH below) is keyed by observationVariableDbId, so it naturally
// only ever fires for wheat's CO_321:*/PHENETPOC:* variable ids and never
// mismatches onto another crop's variables — no change needed there. The
// NCBI taxon, however, WAS hardcoded to wheat for every germplasm record;
// that's fixed below with a per-crop lookup (see CROP_TAXON).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { mapRealAwnValue, mapRealGrainColourValue } = require('./lib/trait-mappings');

const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const OUT_DIR = path.join(__dirname, '..', 'data', 'rdf');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Set to a crop name (e.g. 'Wheat') to scope processing to a single crop,
// reproducing the old filter.js behaviour. Leave null to keep every crop.
const CROP_FILTER = null;

// commonCropName -> verified NCBI Taxonomy IRI. Add entries here as needed.
// Crops not listed here (e.g. FAIDARE's generic "Forest tree" test records,
// which have no single species) fall back to whatever genus/species the raw
// germplasm record itself carries, emitted as plain literals instead of a
// (potentially wrong) taxon IRI — see germplasm loop below.
const CROP_TAXON = {
  Wheat: 'obo:NCBITaxon_4565',  // Triticum aestivum
  Maize: 'obo:NCBITaxon_4577',  // Zea mays
};

// --- Raw loading helpers (moved over from filter.js) -------------------------

function loadGz(filename) {
  const buf = fs.readFileSync(path.join(RAW_DIR, filename));
  return JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
}

function loadShards(prefix) {
  const files = fs.readdirSync(RAW_DIR).filter(f => f.startsWith(prefix + '-') && f.endsWith('.json.gz'));
  if (files.length === 0) console.warn(`  WARNING: no shards found for prefix "${prefix}" in ${RAW_DIR}`);
  return files.flatMap(loadGz);
}

// --- Turtle helpers ---------------------------------------------------------

function esc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}
function str(s) { return `"${esc(s)}"`; }
const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
const COMMA_DECIMAL_RE = /^-?\d+,\d+$/;
function valueLiteral(v) {
  if (v === null || v === undefined) return null;
  let s = String(v);
  // Real FAIDARE data mixes number formats: most are plain "44.85", but some use
  // European comma-decimal "44,85". Without normalizing, these were silently
  // emitted as xsd:string, breaking SPARQL AVG()/xsd:decimal() casts on them.
  if (COMMA_DECIMAL_RE.test(s)) s = s.replace(',', '.');
  return NUMERIC_RE.test(s) ? s : str(s);
}
// Real-data URIs already come as absolute IRIs (urn:INRAE-URGI/...) straight from FAIDARE.
function realIri(uri) { return `<${uri}>`; }

const PREFIXES = `@prefix ppeo:     <http://purl.org/ppeo/PPEO.owl#> .
@prefix phenet:   <https://w3id.org/phenet-poc/ontology#> .
@prefix phenetid: <https://w3id.org/phenet-poc/id/> .
@prefix prov:     <http://www.w3.org/ns/prov#> .
@prefix geo:      <http://www.w3.org/2003/01/geo/wgs84_pos#> .
@prefix skos:     <http://www.w3.org/2004/02/skos/core#> .
@prefix dcat:     <http://www.w3.org/ns/dcat#> .
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix rdf:      <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:     <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:      <http://www.w3.org/2001/XMLSchema#> .
@prefix obo:      <http://purl.obolibrary.org/obo/> .
@prefix agrovoc:  <http://aims.fao.org/aos/agrovoc/> .

`;

// --- Trait crosswalk (docs/schema-design.md "Update 2") ---------------------
// Every IRI below was individually verified to resolve (HTTP 303 -> real page)
// during schema design; see docs/schema-design.md for the check-by-check log.

const TRAIT_MATCH = {
  'CO_321:1000177': { exactMatch: ['obo:TO_0000382'], correspondsToDescriptor: 'CEREALS_TKW_SCALE' }, // TKW_g
  'CO_321:1000070': { exactMatch: ['obo:TO_0001136'] }, // GPC_% grain protein content
  'CO_321:1000216': { exactMatch: ['obo:TO_0000689'] }, // HA grain hardness -> "grain tenderness"
  'PHENETPOC:PLANT_HEIGHT_CM': { exactMatch: ['obo:TO_0000207'], correspondsToDescriptor: 'CEREALS_PLANT_HEIGHT' },
  'PHENETPOC:AWN_CLASS': { exactMatch: ['obo:PO_0025349', 'obo:TO_0002734'], correspondsToDescriptor: 'CEREALS_WHEAT_AWNEDNESS_SCALE' },
  'PHENETPOC:GRAIN_COLOUR_CLASS': { exactMatch: ['obo:TO_0000385'], correspondsToDescriptor: 'CEREALS_GRAIN_COLOUR_SCALE' },
  'PHENETPOC:YIELD_KGHA': { exactMatch: ['obo:TO_0000396'] },
  'PHENETPOC:STRIPE_RUST_SEV_PCT': { exactMatch: ['obo:TO_0020055'] },
  'PHENETPOC:SEPTORIA_SEV_PCT': { exactMatch: ['obo:TO_0020065'] },
};
// Alveograph family: no trait-level match exists (see docs), four-axis correlation instead.
const ALVEOGRAPH_IDS = new Set(['CO_321:1000226', 'CO_321:1000227', 'CO_321:1000228', 'CO_321:1000229', 'CO_321:1000230']);
const ALVEOGRAPH_CORRELATION = `  phenet:testedSubstance obo:FOODON_03311552 ;
  ppeo:method obo:CHMO_0000915 ;
  skos:broadMatch agrovoc:c_28543 ;
  skos:relatedMatch obo:CHEBI_166887 ;
`;

// --- Shared ontology/provenance file -----------------------------------------

function writeOntologyFile() {
  const out = [PREFIXES];
  out.push(`phenetid:RealFaidareDataset a prov:Entity ;
  rdfs:label "Real FAIDARE INRAE-URGI data" ;
  dct:source <https://forge.inrae.fr/urgi/is/faidare/-/tree/master/data/test/json-bulk/INRAE-URGI> .

phenet:hasProvenance a rdf:Property ; rdfs:label "has provenance" .
phenet:commonCropName a rdf:Property ; rdfs:label "common crop name" ;
  rdfs:comment "FAIDARE's commonCropName field, kept as a plain literal since data/raw spans several crops." .
phenet:genus a rdf:Property ; rdfs:label "genus" ;
  rdfs:comment "Fallback for germplasm whose crop has no entry in CROP_TAXON (no verified NCBI taxon IRI)." .
phenet:species a rdf:Property ; rdfs:label "species" .
phenet:ofGermplasm a rdf:Property ; rdfs:label "of germplasm" .
phenet:ofObservationUnit a rdf:Property ; rdfs:label "of observation unit" .
phenet:observedVariable a rdf:Property ; rdfs:label "observed variable" .
phenet:value a rdf:Property ; rdfs:label "value" .
phenet:correspondsToDescriptor a rdf:Property ; rdfs:label "corresponds to descriptor" ;
  rdfs:comment "Links an observed variable to the GermplasmDescriptor code it should be checked against for consistency (CQ3)." .
phenet:testedSubstance a rdf:Property ; rdfs:label "tested substance" .
phenet:Trial a rdfs:Class ; rdfs:label "Trial" .
phenet:Program a rdfs:Class ; rdfs:label "Program" .
phenet:GermplasmDescriptor a rdfs:Class ; rdfs:label "Germplasm Descriptor" ;
  rdfs:comment "Passport/DUS descriptor value, not a MIAPPE/PPEO concept, out of that checklist's scope." .
`);
  fs.writeFileSync(path.join(OUT_DIR, 'ontology.ttl'), out.join('\n'));
  console.log('ontology.ttl written');
}

// --- Emit helpers for observationVariable -----------------------------------

function variableTurtle(iri, id, name, description, unit) {
  const lines = [`${iri} a ppeo:observed_variable ;`];
  lines.push(`  rdfs:label ${str(name)} ;`);
  if (description) lines.push(`  phenet:traitDescription ${str(description)} ;`);
  if (unit) lines.push(`  phenet:unitLabel ${str(unit)} ;`);
  if (/^CO_/.test(id)) lines.push(`  phenet:cropOntologyCode ${str(id)} ;`);
  const match = TRAIT_MATCH[id];
  if (match) {
    for (const m of match.exactMatch) lines.push(`  skos:exactMatch ${m} ;`);
    if (match.correspondsToDescriptor) lines.push(`  phenet:correspondsToDescriptor ${str(match.correspondsToDescriptor)} ;`);
  }
  if (ALVEOGRAPH_IDS.has(id)) lines.push(ALVEOGRAPH_CORRELATION.trimEnd() + ' ;');
  lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
  return lines.join('\n') + '\n\n';
}

// --- Real data, loaded directly from data/raw --------------------------------

function writeRealFile() {
  const out = fs.createWriteStream(path.join(OUT_DIR, 'real.ttl'));
  out.write(PREFIXES);

  console.log('Loading germplasm...');
  let germplasm = loadGz('germplasm-1.json.gz');
  if (CROP_FILTER) germplasm = germplasm.filter(g => g.commonCropName === CROP_FILTER);
  const germplasmIds = new Set(germplasm.map(g => g.germplasmDbId));
  console.log(`  germplasm: ${germplasm.length}`);

  console.log('Loading germplasmAttribute...');
  const germplasmAttribute = loadGz('germplasmAttribute-1.json.gz')
    .filter(a => germplasmIds.has(a.germplasmDbId));
  console.log(`  germplasmAttribute: ${germplasmAttribute.length}`);

  console.log('Loading observation shards (this is the big one)...');
  const observation = loadShards('observation').filter(o => germplasmIds.has(o.germplasmDbId));
  console.log(`  observation: ${observation.length}`);

  const studyIds = new Set(observation.map(o => o.studyDbId));
  const trialIds = new Set(observation.map(o => o.trialDbId));
  const locationIds = new Set(observation.map(o => o.studyLocationDbId));
  const observationUnitIds = new Set(observation.map(o => o.observationUnitDbId));

  console.log('Loading observationUnit shards...');
  const observationUnit = loadShards('observationUnit')
    .filter(u => germplasmIds.has(u.germplasmDbId) || observationUnitIds.has(u.observationUnitDbId));
  console.log(`  observationUnit: ${observationUnit.length}`);
  const programIds = new Set(observationUnit.map(u => u.programDbId).filter(Boolean));

  console.log('Loading observationVariable...');
  const usedVariableIds = new Set(observation.map(o => o.observationVariableDbId));
  const observationVariable = loadGz('observationVariable-1.json.gz')
    .filter(v => usedVariableIds.has(v.observationVariableDbId));
  console.log(`  observationVariable: ${observationVariable.length}`);

  // study-1.json.gz does not cover every study referenced by observations (a
  // referential gap in the source test data — see filter.js history). Studies
  // are reconstructed from the fields BrAPI already denormalizes onto each
  // observation (studyName, studyLocationDbId/Name, trialDbId/Name), one row
  // per unique studyDbId, then any record that *does* exist in the official
  // study file is merged in on top.
  console.log('Loading study...');
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
  console.log(`  study: ${study.length} (${study.filter(s => s.derived).length} derived, ${study.filter(s => !s.derived).length} from official study file)`);

  console.log('Loading trial...');
  const trial = loadGz('trial-1.json.gz').filter(t => trialIds.has(t.trialDbId));
  console.log(`  trial: ${trial.length}`);

  console.log('Loading location...');
  const location = loadGz('location-1.json.gz').filter(l => locationIds.has(l.locationDbId));
  console.log(`  location: ${location.length}`);

  console.log('Loading program...');
  const program = loadGz('program-1.json.gz').filter(p => programIds.has(p.programDbId));
  console.log(`  program: ${program.length}`);

  for (const g of germplasm) {
    const lines = [`${realIri(g.germplasmURI)} a ppeo:biological_material ;`];
    lines.push(`  rdfs:label ${str(g.germplasmName)} ;`);
    lines.push(`  phenet:accessionNumber ${str(g.accessionNumber)} ;`);
    lines.push(`  phenet:commonCropName ${str(g.commonCropName || '')} ;`);
    const taxon = CROP_TAXON[g.commonCropName];
    if (taxon) {
      // Known crop: verified NCBI Taxonomy IRI.
      lines.push(`  phenet:hasTaxon ${taxon} ;`);
    } else {
      // Unmapped crop (e.g. "Forest tree"): no single verified taxon IRI, so
      // fall back to whatever genus/species the raw record itself carries
      // rather than fabricate a link. Add these to CROP_TAXON above once
      // you've confirmed the correct NCBI id for the crop.
      if (g.genus) lines.push(`  phenet:genus ${str(g.genus)} ;`);
      if (g.species) lines.push(`  phenet:species ${str(g.species)} ;`);
    }
    lines.push(`  phenet:subtaxon ${str(g.subtaxa || '')} ;`);
    lines.push(`  phenet:heldBy ${str(g.instituteName || '')} .`);
    out.write(lines.join('\n') + '\n\n');
  }

  // For the two categorical CQ3 pairs, the real descriptor's free text ("awned (<=
  // length of spike) | barbu... - 2004") can't be string-compared against a
  // simplified class directly, so also store the normalized class via
  // scripts/lib/trait-mappings.js (guaranteed identical mapping, no drift).
  const NORMALIZERS = {
    CEREALS_WHEAT_AWNEDNESS_SCALE: mapRealAwnValue,
    CEREALS_GRAIN_COLOUR_SCALE: mapRealGrainColourValue,
    CEREALS_PLANT_HEIGHT: v => String(parseFloat(v)),
    CEREALS_TKW_SCALE: v => v.split('|')[0].trim().toLowerCase(),
  };

  let descCounter = 0;
  for (const a of germplasmAttribute) {
    for (const d of a.data) {
      descCounter++;
      const iri = `<https://w3id.org/phenet-poc/id/descriptor/${descCounter}>`;
      const lines = [`${iri} a phenet:GermplasmDescriptor ;`];
      lines.push(`  phenet:ofGermplasm ${realIri(a.germplasmURI)} ;`);
      lines.push(`  phenet:descriptorCode ${str(d.attributeCode)} ;`);
      lines.push(`  rdfs:label ${str(d.attributeName || d.attributeCode)} ;`);
      const normalize = NORMALIZERS[d.attributeCode];
      if (normalize) lines.push(`  phenet:normalizedValue ${str(normalize(d.value))} ;`);
      lines.push(`  phenet:value ${str(d.value)} .`);
      out.write(lines.join('\n') + '\n\n');
    }
  }

  for (const v of observationVariable) {
    const iri = realIri(v.observationVariableURI);
    out.write(variableTurtle(iri, v.observationVariableDbId, v.name, v.trait && v.trait.description, null));
  }

  for (const u of observationUnit) {
    out.write(`${realIri(u.observationUnitURI)} a ppeo:observation_unit ;
  phenet:ofGermplasm ${realIri(u.germplasmURI)} ;
  phenet:partOfStudy ${realIri(u.studyURI)} ;
  phenet:hasProvenance phenetid:RealFaidareDataset .

`);
  }

  for (const o of observation) {
    const val = valueLiteral(o.value);
    const variableIri = `<urn:INRAE-URGI/observationVariable/${encodeURIComponent(o.observationVariableDbId)}>`;
    out.write(`${realIri(o.observationURI)} a ppeo:observation ;
  phenet:ofGermplasm ${realIri(o.germplasmURI)} ;
  phenet:ofObservationUnit ${realIri(o.observationUnitURI)} ;
  phenet:observedVariable ${variableIri} ;
  phenet:value ${val === null ? '""' : val} ;
  phenet:season ${str(o.season && o.season.seasonName || '')} ;
  phenet:hasProvenance phenetid:RealFaidareDataset .

`);
  }

  for (const s of study) {
    const lines = [`${realIri(s.studyURI || s.studyDbId)} a ppeo:study ;`];
    lines.push(`  rdfs:label ${str(s.studyName)} ;`);
    if (s.trialDbId) lines.push(`  phenet:partOfTrial ${realIri(s.trialURI || s.trialDbId)} ;`);
    if (s.locationDbId) lines.push(`  phenet:conductedAt ${realIri(s.locationURI || s.locationDbId)} ;`);
    for (const season of (s.seasons || [])) lines.push(`  phenet:season ${str(season)} ;`);
    lines.push(`  phenet:hasProvenance phenetid:RealFaidareDataset .`);
    out.write(lines.join('\n') + '\n\n');
  }

  for (const t of trial) {
    out.write(`${realIri(t.trialURI)} a phenet:Trial ;
  rdfs:label ${str(t.trialName)} ;
  phenet:hasProvenance phenetid:RealFaidareDataset .

`);
  }

  for (const l of location) {
    out.write(`${realIri(l.locationURI)} a ppeo:location ;
  rdfs:label ${str(l.locationName)} ;
  geo:lat ${l.latitude ?? ''} ;
  geo:long ${l.longitude ?? ''} ;
  phenet:country ${str(l.countryName || '')} .

`);
  }

  for (const p of program) {
    out.write(`${realIri(p.programURI)} a phenet:Program ;
  rdfs:label ${str(p.programName)} ;
  phenet:hasProvenance phenetid:RealFaidareDataset .

`);
  }

  out.end();
  console.log('real.ttl written:', { germplasm: germplasm.length, descriptors: descCounter, observation: observation.length, observationUnit: observationUnit.length, study: study.length });
}

writeOntologyFile();
writeRealFile();
