import init, * as oxigraph from './vendor/oxigraph/web.js';
import { traitLabel, traitUnit, traitNote, isSyntheticIri } from './trait-info.js';

const PREFIXES = `
PREFIX ppeo: <http://purl.org/ppeo/PPEO.owl#>
PREFIX phenet: <https://w3id.org/phenet-poc/ontology#>
PREFIX phenetid: <https://w3id.org/phenet-poc/id/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
`;

const REAL_GRAPH = 'https://w3id.org/phenet-poc/graph/real';
const SYNTHETIC_GRAPH = 'https://w3id.org/phenet-poc/graph/synthetic';
const REAL_PROV = 'https://w3id.org/phenet-poc/id/RealFaidareDataset';
const SYNTHETIC_PROV = 'https://w3id.org/phenet-poc/id/SyntheticDemoDataset';

// Fixed variable IRIs this UI offers as canned choices. See docs/schema-design.md
// for why these specific ones were picked (real CO codes vs synthetic PHENETPOC ones).
const VAR = {
  TKW: 'urn:INRAE-URGI/observationVariable/CO_321%3A1000177',
  YIELD: 'https://w3id.org/phenet-poc/id/synthetic/variable/YIELD_KGHA',
  HEIGHT: 'https://w3id.org/phenet-poc/id/synthetic/variable/PLANT_HEIGHT_CM',
  AWN: 'https://w3id.org/phenet-poc/id/synthetic/variable/AWN_CLASS',
  GRAIN_COLOUR: 'https://w3id.org/phenet-poc/id/synthetic/variable/GRAIN_COLOUR_CLASS',
};

const TKW_LOW_HIGH = [42, 48]; // g, terciles of this dataset's own weight distribution
const HEIGHT_TOLERANCE_CM = 5;

let store;

async function loadGraph() {
  await init();
  store = new oxigraph.Store();

  const [ontologyText, realText, syntheticText] = await Promise.all(
    ['data/ontology.ttl', 'data/real.ttl', 'data/synthetic.ttl'].map(u => fetch(u, { cache: 'no-store' }).then(r => r.text()))
  );

  store.load(ontologyText, { format: 'text/turtle' });
  store.load(realText, { format: 'text/turtle', to_graph_name: oxigraph.namedNode(REAL_GRAPH) });
  store.load(syntheticText, { format: 'text/turtle', to_graph_name: oxigraph.namedNode(SYNTHETIC_GRAPH) });
}

function includeSynthetic() {
  return document.getElementById('includeSynthetic').checked;
}

function query(sparql) {
  const graphs = [oxigraph.defaultGraph(), oxigraph.namedNode(REAL_GRAPH)];
  if (includeSynthetic()) graphs.push(oxigraph.namedNode(SYNTHETIC_GRAPH));
  return store.query(PREFIXES + sparql, { use_default_graph_as_union: false, default_graph: graphs });
}

function val(binding, key) {
  const t = binding.get(key);
  return t ? t.value : undefined;
}

function provenanceBadge(iri) {
  if (iri === REAL_PROV) return '<span class="badge badge-real">real</span>';
  if (iri === SYNTHETIC_PROV) return '<span class="badge badge-synthetic">synthetic</span>';
  return '';
}

function sourceBadge(isSynthetic) {
  return isSynthetic ? '<span class="badge badge-synthetic">synthetic</span>' : '<span class="badge badge-real">real</span>';
}

function sparqlDetails(sparql) {
  return `<details class="sparql"><summary>View SPARQL query</summary><pre>${sparql.replace(/</g, '&lt;')}</pre></details>`;
}

function renderTable(headers, rows) {
  if (!rows.length) return '<p class="empty">No results.</p>';
  const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const tbody = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function numberInputValue(id) {
  const raw = document.getElementById(id).value.trim();
  return raw === '' ? null : Number(raw);
}

// --- Best-performing genotype ------------------------------------------------

async function populateCq1Traits() {
  const sparql = `
SELECT DISTINCT ?variable ?label WHERE {
  ?obs phenet:observedVariable ?variable ; phenet:value ?val .
  ?variable rdfs:label ?label .
  FILTER(isNumeric(?val))
} ORDER BY ?label`;
  const rows = query(sparql);
  const options = rows.map(b => ({ iri: val(b, 'variable'), label: traitLabel(val(b, 'variable'), val(b, 'label')) }));
  options.sort((a, b) => a.label.localeCompare(b.label));
  const real = options.filter(o => !isSyntheticIri(o.iri));
  const synthetic = options.filter(o => isSyntheticIri(o.iri));
  const select = document.getElementById('cq1-trait');
  const previousValue = select.value;
  select.innerHTML =
    `<optgroup label="Real traits">${real.map(o => `<option value="${o.iri}">${o.label}</option>`).join('')}</optgroup>` +
    (synthetic.length ? `<optgroup label="Synthetic demo traits">${synthetic.map(o => `<option value="${o.iri}">${o.label}</option>`).join('')}</optgroup>` : '');
  // Keep the same trait selected across a toggle change if it's still available.
  // Otherwise fall back to the first option, so the dropdown never shows a stale
  // selection that has disappeared from the list.
  if ([...select.options].some(o => o.value === previousValue)) select.value = previousValue;
}

async function populateCq1Locations() {
  const sparql = `SELECT ?loc ?locLabel WHERE { ?loc a ppeo:location ; rdfs:label ?locLabel } ORDER BY ?locLabel`;
  const rows = query(sparql);
  const select = document.getElementById('cq1-locations');
  const previouslySelected = new Set([...select.selectedOptions].map(o => o.value));
  select.innerHTML = rows.map(b => `<option value="${val(b, 'loc')}">${val(b, 'locLabel')}</option>`).join('');
  for (const option of select.options) option.selected = previouslySelected.has(option.value);
}

function runCq1() {
  const variable = document.getElementById('cq1-trait').value;
  const unit = traitUnit(variable);
  const minValue = numberInputValue('cq1-min-value');
  const maxValue = numberInputValue('cq1-max-value');
  const minObs = numberInputValue('cq1-min-obs');
  const maxObs = numberInputValue('cq1-max-obs');
  const selectedLocations = [...document.getElementById('cq1-locations').selectedOptions].map(o => o.value);

  // Oxigraph's HAVING needs the aggregate expression restated, it does not resolve
  // the SELECT alias (?avgVal / ?n) here, confirmed by testing directly against the
  // store: referencing the alias silently returns zero rows instead of an error.
  const having = [];
  if (minValue !== null) having.push(`AVG(xsd:decimal(?val)) >= ${minValue}`);
  if (maxValue !== null) having.push(`AVG(xsd:decimal(?val)) <= ${maxValue}`);
  if (minObs !== null) having.push(`COUNT(?val) >= ${minObs}`);
  if (maxObs !== null) having.push(`COUNT(?val) <= ${maxObs}`);
  const havingClause = having.length ? `\nHAVING (${having.join(' && ')})` : '';

  const locationTriples = selectedLocations.length ? `
  ?obs phenet:ofObservationUnit ?u .
  ?u phenet:partOfStudy ?study .
  ?study phenet:conductedAt ?loc .
  VALUES ?loc { ${selectedLocations.map(l => `<${l}>`).join(' ')} }` : '';

  const sparql = `
SELECT ?genotype ?label (AVG(xsd:decimal(?val)) AS ?avgVal) (COUNT(?val) AS ?n) WHERE {
  ?obs a ppeo:observation ; phenet:observedVariable <${variable}> ; phenet:ofGermplasm ?genotype ; phenet:value ?val .
  ?genotype rdfs:label ?label .${locationTriples}
}
GROUP BY ?genotype ?label${havingClause}
ORDER BY DESC(?avgVal)
LIMIT 15`;
  const rows = query(sparql);
  const valueHeader = unit && !unit.startsWith('unit not recorded') ? `Mean value (${unit})` : 'Mean value';
  const table = renderTable(
    ['Genotype', valueHeader, '# observations'],
    rows.map(b => [val(b, 'label'), Number(val(b, 'avgVal')).toFixed(2), val(b, 'n')])
  );
  const synthetic = isSyntheticIri(variable);
  const sourceNote = `<p class="note">Showing ${sourceBadge(synthetic)} data for <strong>${traitLabel(variable)}</strong>. ${synthetic ? 'This trait only exists in the synthetic layer, so it disappears from the list if you turn synthetic data off.' : 'This trait is real. Turning synthetic data on or off never changes these numbers, it only changes which extra traits show up in the dropdown.'}</p>`;
  const locationNote = selectedLocations.length
    ? `<p class="note">Restricted to ${selectedLocations.length} chosen location${selectedLocations.length > 1 ? 's' : ''}. These numbers only cover that subset, not the whole dataset.</p>`
    : '';
  const note = traitNote(variable);
  const noteHtml = note ? `<p class="note">${note}</p>` : '';
  document.getElementById('cq1-result').innerHTML = sourceNote + locationNote + noteHtml + table + sparqlDetails(sparql);
}

// --- Best environment for yield -----------------------------------------------

async function populateCq2Genotypes() {
  const sparql = `
SELECT DISTINCT ?genotype ?label WHERE {
  ?obs phenet:observedVariable <${VAR.YIELD}> ; phenet:ofGermplasm ?genotype .
  ?genotype rdfs:label ?label .
} ORDER BY ?label`;
  const rows = query(sparql);
  const select = document.getElementById('cq2-genotypes');
  select.innerHTML = rows.map(b => `<option value="${val(b, 'genotype')}">${val(b, 'label')}</option>`).join('');
}

function runCq2() {
  if (!includeSynthetic()) {
    document.getElementById('cq2-result').innerHTML = '<p class="empty">Yield only exists in the synthetic layer. Turn "Include synthetic demo data" back on to use this check.</p>';
    return;
  }
  const selected = [...document.getElementById('cq2-genotypes').selectedOptions].map(o => `<${o.value}>`);
  if (!selected.length) {
    document.getElementById('cq2-result').innerHTML = '<p class="empty">Pick at least one genotype.</p>';
    return;
  }
  const sparql = `
SELECT ?loc ?locLabel (AVG(xsd:decimal(?val)) AS ?avgYield) (COUNT(?val) AS ?n) WHERE {
  ?obs a ppeo:observation ; phenet:observedVariable <${VAR.YIELD}> ;
       phenet:ofGermplasm ?g ; phenet:ofObservationUnit ?u ; phenet:value ?val .
  ?u phenet:partOfStudy ?study .
  ?study phenet:conductedAt ?loc .
  ?loc rdfs:label ?locLabel .
  VALUES ?g { ${selected.join(' ')} }
}
GROUP BY ?loc ?locLabel
ORDER BY DESC(?avgYield)`;
  const rows = query(sparql);
  const table = renderTable(
    ['Location', `Mean ${traitLabel(VAR.YIELD).toLowerCase()} (${traitUnit(VAR.YIELD)})`, '# observations'],
    rows.map(b => [val(b, 'locLabel'), Number(val(b, 'avgYield')).toFixed(0), val(b, 'n')])
  );
  document.getElementById('cq2-result').innerHTML = table + sparqlDetails(sparql);
}

// --- Descriptor consistency check ---------------------------------------------

const CQ3_PAIRS = {
  tkw: {
    label: `${traitLabel(VAR.TKW)}: field-measured (real) vs passport descriptor (real)`,
    variable: VAR.TKW, descriptorCode: 'CEREALS_TKW_SCALE', needsSynthetic: false,
    caveat: `Both sides real. The field measurement is a gram value; the passport descriptor is a 3-level scale (low, intermediate, high). The field average is bucketed the same way, using terciles of this dataset's own weight distribution: below ${TKW_LOW_HIGH[0]}g is low, ${TKW_LOW_HIGH[0]} to ${TKW_LOW_HIGH[1]}g is intermediate, above ${TKW_LOW_HIGH[1]}g is high. That's an approximation for this demo, not an official scale definition.`,
    kind: 'numeric-bucket',
  },
  height: {
    label: `${traitLabel(VAR.HEIGHT)}: field-measured (synthetic) vs passport descriptor (real)`,
    variable: VAR.HEIGHT, descriptorCode: 'CEREALS_PLANT_HEIGHT', needsSynthetic: true,
    caveat: `The field-measured side is synthetic. Counted as a match if it falls within ${HEIGHT_TOLERANCE_CM} cm of the passport value.`,
    kind: 'numeric-tolerance',
  },
  awn: {
    label: `${traitLabel(VAR.AWN)}: field-observed (synthetic) vs passport descriptor (real)`,
    variable: VAR.AWN, descriptorCode: 'CEREALS_WHEAT_AWNEDNESS_SCALE', needsSynthetic: true,
    caveat: 'The field-observed side is synthetic, made with a deliberate 12% mismatch rate so this check has something real to find. See docs/synthetic-data.md.',
    kind: 'categorical',
  },
  grainColour: {
    label: `${traitLabel(VAR.GRAIN_COLOUR)}: field-observed (synthetic) vs passport descriptor (real)`,
    variable: VAR.GRAIN_COLOUR, descriptorCode: 'CEREALS_GRAIN_COLOUR_SCALE', needsSynthetic: true,
    caveat: 'The field-observed side is synthetic, made with a deliberate 12% mismatch rate. See docs/synthetic-data.md.',
    kind: 'categorical',
  },
};

function populateCq3Pairs() {
  const select = document.getElementById('cq3-pair');
  const previousValue = select.value;
  const available = Object.entries(CQ3_PAIRS).filter(([, p]) => includeSynthetic() || !p.needsSynthetic);
  select.innerHTML = available.map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
  if (available.some(([k]) => k === previousValue)) select.value = previousValue;
  updateCq3Caveat();
}

function updateCq3Caveat() {
  const select = document.getElementById('cq3-pair');
  document.getElementById('cq3-caveat').textContent = CQ3_PAIRS[select.value].caveat;
}

function bucketTkw(n) {
  return n < TKW_LOW_HIGH[0] ? 'low' : n < TKW_LOW_HIGH[1] ? 'intermediate' : 'high';
}

function numericAverage(values) {
  const nums = values.map(Number).filter(n => !Number.isNaN(n));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function runCq3() {
  const key = document.getElementById('cq3-pair').value;
  const pair = CQ3_PAIRS[key];
  const sparql = `
SELECT ?genotype ?label ?observedVal ?descVal ?descRaw WHERE {
  ?obs a ppeo:observation ; phenet:observedVariable <${pair.variable}> ; phenet:ofGermplasm ?genotype ; phenet:value ?observedVal .
  ?genotype rdfs:label ?label .
  ?desc a phenet:GermplasmDescriptor ; phenet:ofGermplasm ?genotype ;
        phenet:descriptorCode "${pair.descriptorCode}" ; phenet:normalizedValue ?descVal ; phenet:value ?descRaw .
}`;
  const rows = query(sparql);

  // Grouped per genotype in JS. The comparison logic differs by pair kind (see CQ3_PAIRS).
  const byGenotype = new Map();
  for (const b of rows) {
    const label = val(b, 'label');
    if (!byGenotype.has(label)) byGenotype.set(label, { descVal: val(b, 'descVal'), descRaw: val(b, 'descRaw'), values: [] });
    // Real data has about 40% "NA"/empty observations, missing measurements, not a
    // bug, see docs/data-assessment.md. The raw value is kept for categorical
    // matching, and numeric-parseability is checked separately so a stray "NA"
    // can't quietly corrupt an average through string concatenation.
    byGenotype.get(label).values.push(val(b, 'observedVal'));
  }

  const tableRows = [];
  for (const [label, data] of byGenotype) {
    if (pair.kind === 'numeric-bucket') {
      const avg = numericAverage(data.values);
      if (avg === null) { tableRows.push([label, 'no valid observations', data.descVal, `low &lt;${TKW_LOW_HIGH[0]}, intermediate ${TKW_LOW_HIGH[0]}-${TKW_LOW_HIGH[1]}, high &gt;${TKW_LOW_HIGH[1]} ${traitUnit(pair.variable)}`, '<span class="mismatch">no data</span>']); continue; }
      const observedBucket = bucketTkw(avg);
      const isMatch = observedBucket === data.descVal;
      tableRows.push([
        label,
        `${avg.toFixed(1)} ${traitUnit(pair.variable)} (${observedBucket})`,
        data.descVal,
        `low &lt;${TKW_LOW_HIGH[0]}, intermediate ${TKW_LOW_HIGH[0]}-${TKW_LOW_HIGH[1]}, high &gt;${TKW_LOW_HIGH[1]} ${traitUnit(pair.variable)}`,
        isMatch ? '<span class="match">match</span>' : '<span class="mismatch">mismatch</span>',
      ]);
    } else if (pair.kind === 'numeric-tolerance') {
      const avg = numericAverage(data.values);
      const target = Number(data.descVal);
      if (avg === null || Number.isNaN(target)) { tableRows.push([label, 'no valid observations', data.descVal, `${HEIGHT_TOLERANCE_CM} ${traitUnit(pair.variable)}`, '<span class="mismatch">no data</span>']); continue; }
      const isMatch = Math.abs(avg - target) <= HEIGHT_TOLERANCE_CM;
      const unit = traitUnit(pair.variable);
      tableRows.push([
        label,
        `${avg.toFixed(1)} ${unit}`,
        `${target} ${unit}`,
        `±${HEIGHT_TOLERANCE_CM} ${unit}`,
        isMatch ? '<span class="match">match</span>' : '<span class="mismatch">mismatch</span>',
      ]);
    } else {
      const total = data.values.length;
      const matches = data.values.filter(v => v === data.descVal).length;
      const pct = (100 * matches / total).toFixed(0);
      tableRows.push([label, data.descVal, `${matches}/${total} observations match (${pct}%)`, matches === total ? '<span class="match">fully consistent</span>' : '<span class="mismatch">some inconsistency</span>']);
    }
  }
  tableRows.sort((a, b) => a[0].localeCompare(b[0]));

  const headers = pair.kind === 'categorical'
    ? ['Genotype', 'Descriptor value', 'Observation match rate', 'Verdict']
    : ['Genotype', 'Field average', 'Descriptor', 'Accepted range', 'Verdict'];
  document.getElementById('cq3-result').innerHTML = renderTable(headers, tableRows) + sparqlDetails(sparql);
}

// --- Genotype directory & usage ------------------------------------------------

let genotypeCache = [];

async function populateCq4() {
  const sparql = `SELECT ?g ?label WHERE { ?g a ppeo:biological_material ; rdfs:label ?label } ORDER BY ?label`;
  const rows = query(sparql);
  genotypeCache = rows.map(b => ({ iri: val(b, 'g'), label: val(b, 'label') }));
  const select = document.getElementById('cq4-genotype');
  const previousValue = select.value;
  select.innerHTML = genotypeCache.map(g => `<option value="${g.iri}">${g.label}</option>`).join('');
  if ([...select.options].some(o => o.value === previousValue)) select.value = previousValue;
}

function runCq4() {
  const iri = document.getElementById('cq4-genotype').value;
  const match = genotypeCache.find(g => g.iri === iri);
  if (!match) return;
  const sparql = `
SELECT ?accession ?taxon ?subtaxon (SAMPLE(?releaseDate) AS ?release) WHERE {
  <${match.iri}> phenet:accessionNumber ?accession ; phenet:hasTaxon ?taxon ; phenet:subtaxon ?subtaxon .
  OPTIONAL { <${match.iri}> phenet:releaseDate ?releaseDate }
} GROUP BY ?accession ?taxon ?subtaxon`;
  const infoRows = query(sparql);

  const usageSparql = `
SELECT DISTINCT ?locLabel ?provenance WHERE {
  ?u phenet:ofGermplasm <${match.iri}> ; phenet:partOfStudy ?study ; phenet:hasProvenance ?provenance .
  ?study phenet:conductedAt ?loc .
  ?loc rdfs:label ?locLabel .
} ORDER BY ?locLabel`;
  const usageRows = query(usageSparql);

  const traitsSparql = `
SELECT ?variable (AVG(xsd:decimal(?val)) AS ?avgVal) (SAMPLE(?val) AS ?sampleVal) (COUNT(?val) AS ?n) (SAMPLE(?provenance) AS ?prov) WHERE {
  ?obs a ppeo:observation ; phenet:observedVariable ?variable ; phenet:ofGermplasm <${match.iri}> ;
       phenet:value ?val ; phenet:hasProvenance ?provenance .
}
GROUP BY ?variable
ORDER BY ?variable`;
  const traitRows = query(traitsSparql);

  let html = '';
  if (infoRows.length) {
    const b = infoRows[0];
    html += `<table>
      <tr><th>Label</th><td>${match.label}</td></tr>
      <tr><th>Accession number</th><td>${val(b, 'accession') || ''}</td></tr>
      <tr><th>Taxon</th><td><a href="${val(b, 'taxon')}">${val(b, 'taxon')}</a></td></tr>
      <tr><th>Subtaxon</th><td>${val(b, 'subtaxon') || ''}</td></tr>
      <tr><th>Release date</th><td>${val(b, 'release') || 'not available in this dataset, a known gap, see data assessment'}</td></tr>
    </table>`;
  }

  html += '<h3>Measured traits</h3>';
  html += '<p class="explain">Every trait recorded for this genotype, real and synthetic together. This is exactly what the synthetic toggle adds or removes for a given genotype.</p>';
  const traitTableRows = traitRows.map(b => {
    const iri = val(b, 'variable');
    const unit = traitUnit(iri);
    const isNumeric = val(b, 'avgVal') !== undefined;
    const sample = val(b, 'sampleVal');
    const displayValue = isNumeric
      ? `${Number(val(b, 'avgVal')).toFixed(2)}${unit && !unit.startsWith('unit not recorded') && unit !== 'ratio' ? ' ' + unit : ''}`
      : (!sample || sample === 'NA' ? 'no valid measurement recorded (source marked "NA")' : sample);
    return [traitLabel(iri), displayValue, val(b, 'n'), provenanceBadge(val(b, 'prov'))];
  });
  html += renderTable(['Trait', 'Value shown', '# observations', 'Source'], traitTableRows);
  html += '<p class="note">Numeric traits show the mean of all observations. Categorical traits (awn type, grain colour) show one representative observation, not a majority vote. Check the descriptor consistency check tab if a trait has several observations that might disagree.</p>';

  html += '<h3>Used at</h3>';
  html += renderTable(['Location', 'Source'], usageRows.map(b => [val(b, 'locLabel'), provenanceBadge(val(b, 'provenance'))]));
  html += sparqlDetails([sparql, usageSparql, traitsSparql].join('\n\n'));
  document.getElementById('cq4-result').innerHTML = html;
}

// --- Wiring --------------------------------------------------------------------

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

async function refreshDropdowns() {
  await Promise.all([populateCq1Traits(), populateCq1Locations(), populateCq2Genotypes(), populateCq4()]);
  populateCq3Pairs();
}

// Re-runs whichever panel is currently visible, so toggling "include synthetic
// data" visibly changes something right away instead of quietly updating a
// dropdown the user isn't looking at.
function rerunActivePanel() {
  const activeId = document.querySelector('.tab-panel.active').id;
  if (activeId === 'cq1') runCq1();
  else if (activeId === 'cq2') runCq2();
  else if (activeId === 'cq3') runCq3();
  else if (activeId === 'cq4' && document.getElementById('cq4-genotype').value) runCq4();
}

async function main() {
  await loadGraph();
  setupTabs();
  await refreshDropdowns();

  document.getElementById('cq1-run').addEventListener('click', runCq1);
  document.getElementById('cq1-clear-filters').addEventListener('click', () => {
    for (const id of ['cq1-min-value', 'cq1-max-value', 'cq1-min-obs', 'cq1-max-obs']) document.getElementById(id).value = '';
    for (const option of document.getElementById('cq1-locations').options) option.selected = false;
    runCq1();
  });
  document.getElementById('cq2-run').addEventListener('click', runCq2);
  document.getElementById('cq3-run').addEventListener('click', runCq3);
  document.getElementById('cq4-run').addEventListener('click', runCq4);
  document.getElementById('cq3-pair').addEventListener('change', updateCq3Caveat);
  document.getElementById('includeSynthetic').addEventListener('change', async () => {
    await refreshDropdowns();
    rerunActivePanel();
  });

  document.getElementById('status').hidden = true;
  document.getElementById('app').hidden = false;
  runCq1();
}

main().catch(err => {
  document.getElementById('status').textContent = 'Failed to load: ' + err.message;
  console.error(err);
});
