// Converts data/wheat-subset/ (real FAIDARE data) and data/synthetic-subset/ (fabricated
// demo layer) into Turtle RDF, per docs/schema-design.md.
//
// Output: data/rdf/ontology.ttl (shared vocabulary + provenance entities),
//         data/rdf/real.ttl, data/rdf/synthetic.ttl, kept as separate files so the
//         frontend can load each into its own named graph (real vs. synthetic
//         separation layer 2 of 3; layer 1 is the IRI namespace below; layer 3 is the
//         phenet:hasProvenance property on every real/synthetic-layer instance).

const fs = require('fs');
const path = require('path');
const { mapRealAwnValue, mapRealGrainColourValue } = require('./lib/trait-mappings');

const WHEAT_DIR = path.join(__dirname, '..', 'data', 'wheat-subset');
const SYNTH_DIR = path.join(__dirname, '..', 'data', 'synthetic-subset');
const OUT_DIR = path.join(__dirname, '..', 'data', 'rdf');
fs.mkdirSync(OUT_DIR, { recursive: true });

function load(dir, name) {
  return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
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
  // Real FAIDARE data mixes number formats: most are plain "44.85", but 18,283 of
  // 100,043 real observations use European comma-decimal "44,85", checked across the
  // whole dataset (see convert-to-rdf.js commit notes). Without normalizing, these were
  // silently emitted as xsd:string, breaking SPARQL AVG()/xsd:decimal() casts on them.
  if (COMMA_DECIMAL_RE.test(s)) s = s.replace(',', '.');
  return NUMERIC_RE.test(s) ? s : str(s);
}
// Real-data URIs already come as absolute IRIs (urn:INRAE-URGI/...) straight from FAIDARE.
function realIri(uri) { return `<${uri}>`; }
// Synthetic IDs were minted as "phenet-poc:kind/N" strings by generate-synthetic.js;
// promote them to real IRIs under the project's placeholder id namespace.
function synthIri(id) { return `<https://w3id.org/phenet-poc/id/synthetic/${id.replace(/^phenet-poc:/, '')}>`; }

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

phenetid:SyntheticDemoDataset a prov:Entity ;
  rdfs:label "Synthetic PoC demo data (NOT real measurements)" ;
  rdfs:comment "See docs/synthetic-data.md for full generation methodology." .

phenet:hasProvenance a rdf:Property ; rdfs:label "has provenance" .
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

// --- Emit helpers for observationVariable, shared by real + synthetic -------

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

// --- Real data ---------------------------------------------------------------

function writeRealFile() {
  const out = fs.createWriteStream(path.join(OUT_DIR, 'real.ttl'));
  out.write(PREFIXES);

  const germplasm = load(WHEAT_DIR, 'germplasm.json');
  const germplasmAttribute = load(WHEAT_DIR, 'germplasmAttribute.json');
  const observation = load(WHEAT_DIR, 'observation.json');
  const observationUnit = load(WHEAT_DIR, 'observationUnit.json');
  const observationVariable = load(WHEAT_DIR, 'observationVariable.json');
  const study = load(WHEAT_DIR, 'study.json');
  const trial = load(WHEAT_DIR, 'trial.json');
  const location = load(WHEAT_DIR, 'location.json');
  const program = load(WHEAT_DIR, 'program.json');

  const NCBI_TAXON = 'obo:NCBITaxon_4565'; // Triticum aestivum, verified, see docs/schema-design.md

  for (const g of germplasm) {
    out.write(`${realIri(g.germplasmURI)} a ppeo:biological_material ;
  rdfs:label ${str(g.germplasmName)} ;
  phenet:accessionNumber ${str(g.accessionNumber)} ;
  phenet:hasTaxon ${NCBI_TAXON} ;
  phenet:subtaxon ${str(g.subtaxa || '')} ;
  phenet:heldBy ${str(g.instituteName || '')} .

`);
  }

  // For the two categorical CQ3 pairs, the real descriptor's free text ("awned (<=
  // length of spike) | barbu... - 2004") can't be string-compared against the
  // synthetic observation's simplified class directly, so also store the same
  // normalized class the generator used to derive its "ground truth", via the
  // shared scripts/lib/trait-mappings.js (guaranteed identical mapping, no drift).
  const NORMALIZERS = {
    CEREALS_WHEAT_AWNEDNESS_SCALE: mapRealAwnValue,
    CEREALS_GRAIN_COLOUR_SCALE: mapRealGrainColourValue,
    // "88 cm" -> "88" (matches the synthetic PLANT_HEIGHT_CM number for a direct numeric compare)
    CEREALS_PLANT_HEIGHT: v => String(parseFloat(v)),
    // "intermediate  | moyen - 2004" -> "intermediate" (matches the SPARQL-side bucketing of TKW_g)
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

  // Only emit variables actually referenced by a real observation (38 of the 909
  // in the wheat trait dictionary), see docs/data-assessment.md.
  const usedVariableIds = new Set(observation.map(o => o.observationVariableDbId));
  for (const v of observationVariable) {
    if (!usedVariableIds.has(v.observationVariableDbId)) continue;
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
    // Observation records only carry observationVariableDbId, not a URI, rebuild the
    // same percent-encoded IRI form the variable definitions themselves use (verified
    // against the source JSON's own observationVariableURI field, e.g. "CO_321:1000177"
    // -> ".../observationVariable/CO_321%3A1000177").
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

// --- Synthetic data ------------------------------------------------------------

function writeSyntheticFile() {
  const out = fs.createWriteStream(path.join(OUT_DIR, 'synthetic.ttl'));
  out.write(PREFIXES);

  const observation = load(SYNTH_DIR, 'observation.json');
  const observationUnit = load(SYNTH_DIR, 'observationUnit.json');
  const observationVariable = load(SYNTH_DIR, 'observationVariable.json');
  const study = load(SYNTH_DIR, 'study.json');
  const trial = load(SYNTH_DIR, 'trial.json');
  const program = load(SYNTH_DIR, 'program.json');

  for (const v of observationVariable) {
    out.write(variableTurtle(synthIri(`variable/${v.observationVariableDbId.replace(/^PHENETPOC:/, '')}`), v.observationVariableDbId, v.name, v.trait && v.trait.description, v.unit));
  }

  for (const u of observationUnit) {
    out.write(`${synthIri(u.observationUnitDbId)} a ppeo:observation_unit ;
  phenet:ofGermplasm ${realIri(u.germplasmURI)} ;
  phenet:partOfStudy ${synthIri(u.studyDbId)} ;
  phenet:hasProvenance phenetid:SyntheticDemoDataset .

`);
  }

  for (const o of observation) {
    const val = valueLiteral(o.value);
    const variableIri = synthIri(`variable/${o.observationVariableDbId.replace(/^PHENETPOC:/, '')}`);
    out.write(`${synthIri(o.observationDbId)} a ppeo:observation ;
  phenet:ofGermplasm ${realIri(o.germplasmURI)} ;
  phenet:ofObservationUnit ${synthIri(o.observationUnitDbId)} ;
  phenet:observedVariable ${variableIri} ;
  phenet:value ${val === null ? '""' : val} ;
  phenet:season ${str(o.season && o.season.seasonName || '')} ;
  phenet:hasProvenance phenetid:SyntheticDemoDataset .

`);
  }

  for (const s of study) {
    out.write(`${synthIri(s.studyDbId)} a ppeo:study ;
  rdfs:label ${str(s.studyName)} ;
  phenet:partOfTrial ${synthIri(s.trialDbId)} ;
  phenet:conductedAt ${realIri(s.locationURI)} ;
  phenet:season ${str(s.seasons[0])} ;
  phenet:hasProvenance phenetid:SyntheticDemoDataset .

`);
  }

  for (const t of trial) {
    out.write(`${synthIri(t.trialDbId)} a phenet:Trial ;
  rdfs:label ${str(t.trialName)} ;
  phenet:hasProvenance phenetid:SyntheticDemoDataset .

`);
  }

  for (const p of program) {
    out.write(`${synthIri(p.programDbId)} a phenet:Program ;
  rdfs:label ${str(p.programName)} ;
  phenet:hasProvenance phenetid:SyntheticDemoDataset .

`);
  }

  out.end();
  console.log('synthetic.ttl written:', { observation: observation.length, observationUnit: observationUnit.length, study: study.length });
}

writeOntologyFile();
writeRealFile();
writeSyntheticFile();
