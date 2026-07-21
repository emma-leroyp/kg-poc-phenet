# KG schema design

Covers the 4 competency questions (CQs) from the project brief, reusing external vocabularies where they're genuinely stable and well-known, and being explicit about the few places I'm not confident enough to assert a specific external IRI.

## Update: four follow-up checks, all resolved with verified evidence (not guesses)

**1. Is MIAPPE-ontology (PPEO) usable? Yes, adopted.** Checked [github.com/MIAPPE/MIAPPE-ontology](https://github.com/MIAPPE/MIAPPE-ontology) directly (not just the README): it produces `PPEO.owl`, real namespace `http://purl.org/ppeo/PPEO.owl#` (PURL-backed, so stable even if hosting moves), registered on AgroPortal. Pulled the actual OWL file and extracted its 46 classes, it genuinely mirrors the MIAPPE checklist: `investigation`, `study`, `biological_material`, `observation_unit`, `observation`, `observed_variable`, `trait`, `method`, `scale`, `environment`, `location`, `sample`, `factor`, `person`, `institution`, `data_file`, etc. Caveat: last modified January 2018, labeled "preliminary v0.9," not on OBO Foundry, minimal activity since, so treat it as stable-because-dormant, not actively maintained. **Decision: adopt `ppeo:` for the core structural classes below**, and keep the project's own `phenet:` namespace only for what PPEO doesn't cover (the descriptor/consistency-check machinery, which isn't part of the MIAPPE checklist to begin with, and the provenance layer).

**2. Crop Ontology linked-data resolution, checked, and it doesn't actually work.** Tested multiple URL patterns against a real CO code from our data (`CO_321:1000177`, TKW). Found that `http://www.cropontology.org/rdf/CO_321:1000177` does redirect (301) to `https://cropontology.org/rdf/CO_321:1000177` and returns HTTP 200 with `Content-Type: text/xml`, so it looks resolvable. But the actual content returned is only six generic property/annotation declarations (`variable_of`, `method_of`, `scale_of`, `entity`, `attribute`, `acronym`) shared across the whole ontology, **not** the specific term's label or definition. Same result querying the whole `CO_321` ontology dump. So the endpoint is live but not functionally useful for dereferencing individual terms right now. **Decision: don't mint CO IRIs as if they were live linked-data resources.** Keep CO codes as plain string literals with a `rdfs:seeAlso` link to the human-readable page (`https://www.cropontology.org/ontology/CO_321/...`) for people, not machines, and don't rely on it resolving to structured data.

**3. Is the units (UO/QUDT) gap a blocker? No.** For a PoC whose job is to prove the KG *approach* answers the 4 CQs, plain-string units (`"kg/ha"`, `"cm"`, `"%"`) don't block any of the CQ1–CQ4 queries, none of them need unit-aware arithmetic or cross-unit conversion, they need grouping/ranking/joins, which work identically over string-tagged literals. It becomes a real blocker only once the KG needs to compare values recorded in different units for the *same* trait (e.g. one study reports yield in kg/ha, another in t/ha), that's a genuine future requirement once real PHENET data (likely multi-institution, less standardized) arrives, not one this PoC's data triggers. Recommend treating it as a tracked follow-up, not something to solve now.

**4. NCBI Taxon linking, done, verified.** All wheat germplasm in the dataset is uniformly `Triticum aestivum subsp. aestivum` (checked: single distinct genus/species/subtaxa combination across all 544 records). Looked up and cross-verified the NCBI Taxonomy ID two ways (search page + direct taxid browser page): **taxid 4565 = Triticum aestivum**. Verified the standard OBO PURL pattern actually resolves: `http://purl.obolibrary.org/obo/NCBITaxon_4565` → HTTP 303 → NCBI's own taxonomy browser for 4565. So every `ppeo:biological_material` instance now gets `phenet:hasTaxon <http://purl.obolibrary.org/obo/NCBITaxon_4565>` as a real, resolvable IRI, plus the literal subtaxon string (`"subsp. aestivum"`) since NCBI Taxonomy doesn't have a separate ID at that infraspecific rank here.

## Update 2: Crop Ontology's broken resolution, actually fixed, via Trait Ontology + Plant Ontology, not Crop Ontology

Investigated two more candidate fixes before landing on the real one:

- **Plant Ontology (PO) alone**: not a substitute. PO covers plant anatomy and developmental stages ("leaf," "spike," "caryopsis fruit," growth stages), it has no terms for measurable traits like yield or disease severity. Confirmed this isn't just a naming issue; the concepts genuinely don't exist in PO's scope.
- **nfdi4plants_ontology (DPBO)**: checked in detail (pulled the actual OWL/OBO files, queried its live TIB terminology API). It doesn't host Crop Ontology at all, a `co` ontology prefix exists there, but it's "CodeOntology" (programming languages, from NFDI4Ing), an unrelated name collision. It does contain a richer MIAPPE v2 checklist file, but only 2 of its terms are actually merged into the live dereferenceable ontology (verified: `MIAPPE_0049` resolves, an ordinary term like `MIAPPE_0011` 404s), not usable as a structural-class replacement for PPEO today.
- **Trait Ontology (TO), the actual fix.** TO is a real OBO Foundry / Planteome-maintained ontology specifically for plant traits (as distinct from PO's anatomy focus), hosted properly on EBI OLS. Searched it for every trait this KG needs and found direct, well-defined matches for nearly all of them, each one verified to actually resolve via `http://purl.obolibrary.org/obo/<ID>` (HTTP 303 → real Planteome term page), not just present in a search index:

| Our variable | Term | Verified resolving |
|---|---|---|
| TKW_g (**real** FAIDARE data, was `CO_321:1000177`) | `TO:0000382` "1000-grain weight" | ✓ |
| Grain protein content, `GPC_%` (**real** FAIDARE data, this is the single most-measured variable in the real dataset) | `TO:0001136` "grain protein content" | ✓ |
| PHENETPOC:YIELD_KGHA (synthetic) | `TO:0000396` "grain yield trait" | ✓ |
| PHENETPOC:PLANT_HEIGHT_CM (synthetic) | `TO:0000207` "plant height" | ✓ |
| PHENETPOC:AWN_CLASS (synthetic) | `PO:0025349` "awn" (entity) + `TO:0002734` "awn presence" + `TO:0000072` "awn length" | ✓ (all three) |
| PHENETPOC:GRAIN_COLOUR_CLASS (synthetic) | `TO:0000385` "milled grain color" / `TO:0000707` "pericarp color" | ✓ |
| PHENETPOC:STRIPE_RUST_SEV_PCT (synthetic) | `TO:0020055` "wheat stripe rust disease response" (wheat-specific!) | ✓ |
| PHENETPOC:SEPTORIA_SEV_PCT (synthetic) | `TO:0020065` "wheat septoria leaf blotch disease response" (wheat-specific!) | ✓ |
| Grain hardness, `HA` (**real** data) | `TO:0000689` "grain tenderness" | ✓, found on a second, broader pass (see below) |
| Alveograph rheology `W`/`P`/`L`/`G`/`P/L`, baking-test variables (real data) | no trait-level match; method-level only via `CHMO:0000915` "rheometry" | ✓ (method term resolves; no trait-level term exists) |

This is a real upgrade, not just a fix: TO's definitions cross-reference PO for the anatomical part (e.g. TO:0000382 explicitly references `PO:0030104` caryopsis fruit and `PO:0006000` hull) and PATO for the quality dimension (e.g. TO:0000207 references `PATO:0000119` height), proper Entity-Quality-style grounding, richer than Crop Ontology's flat codes ever gave us. And it turns out to cover our **real** data too (TKW, grain protein content, and grain hardness, three of the real dataset's actually-measured variables), not just the synthetic layer.

**Correction after a broader second pass**: my first check only searched Trait Ontology and only tried the word "hardness", too narrow. Asked to actually verify all 10 traits, I broadened to (a) TO with the inverse framing ("tenderness" instead of "hardness") and (b) an unrestricted EBI OLS search across every ontology it indexes, plus targeted checks of PATO, FOODON, CHEBI, MeSH, and CHMO (Chemical Methods Ontology). That surfaced `TO:0000689` "grain tenderness", "the degree of softness of the texture of a grain", a direct, verified-resolving match for grain hardness that I'd missed. Bipolar naming (tenderness/hardness, like PATO's hard/soft pair) is a common OBO convention; worth checking both poles next time before calling something a gap.

**Genuine remaining gap, now on a fully broad search rather than one ontology**: the specific Alveograph parameters (W = deformation energy, P = tenacity, L = extensibility, G = swelling index, P/L = configuration ratio) have no dedicated trait term in any ontology I could find, checked TO, PO, PATO, FOODON, CHEBI, MeSH, CHMO, and FAO's AGROVOC thesaurus, plus an unrestricted cross-ontology search for "alveograph," "farinograph," "extensograph," "dough tenacity/strength/extensibility," none returned a specific match. These are outputs of one specific branded lab instrument (the Chopin Alveograph), finer-grained than what any general biology/food/agriculture vocabulary models.

**But a clean, honest correlation is still possible, on four separate axes, none of them claiming the values themselves are "the same as" an existing term:**

| Relation | Target | Why this relation, not `exactMatch` |
|---|---|---|
| `phenet:testedSubstance` → `obo:FOODON_03311552` "dough" | factual, the Alveograph test physically inflates a dough sample | not a trait match, a statement of what's tested |
| `ppeo:method` → `obo:CHMO_0000915` "rheometry" | factual, inflating dough and measuring the pressure/deformation curve *is* a rheological measurement | method-level, not trait-level |
| `skos:broadMatch` → `agrovoc:c_28543` "rheology" | AGROVOC's concept is the broader general field the method sits under | `broadMatch` = target is broader, not equivalent |
| `skos:relatedMatch` → `obo:CHEBI_166887` "glutenin" | the measured values are *influenced by* glutenin content/quality, but a pressure-curve reading isn't glutenin itself, correlation, not identity | SKOS's `relatedMatch` exists precisely for "related, not equivalent" |

All four target IRIs verified resolving. This gives real grounding across "what's tested," "how it's measured," "the broader field," and "the known biological driver," without fabricating a trait-level equivalence that doesn't exist. Same pattern would extend to the baking/crumb-volume variables (`Npain*`/`Nmie*`/`vol*`) if wanted later, not done in this pass, scope was the Alveograph family specifically.

**Decision: drop the Crop Ontology `seeAlso`-only approach for any trait that has a verified TO/PO match** (which is 8 of our 10 traits, including both real ones). Use `skos:exactMatch` to the TO/PO IRI directly, these are genuinely resolvable, unlike the CO codes. Keep the original CO code too, as a literal annotation (`phenet:cropOntologyCode`), purely for traceability back to the FAIDARE source, not as a claim that it resolves.

## Confidence flags, updated

- **High confidence, used directly**: PROV-O (`prov:`), W3C Geo (`geo:`), SKOS (`skos:`), DCAT/Dublin Core (`dcat:`/`dct:`), **PPEO (`ppeo:`)**, **NCBITaxon (`obo:NCBITaxon_4565`)**, **Trait Ontology (`obo:TO_*`) and Plant Ontology (`obo:PO_*`)**, all verified by direct HTTP resolution above, not assumed.
- **Verified and rejected**: Crop Ontology and Plant Ontology (used alone) as live RDF resources for our traits. CO codes kept as traceability literals only; TO/PO used instead where a real match exists.
- **Confirmed non-blocking gap**: UO/QUDT unit terms, plain string literals are fine for this PoC's actual queries.
- **Still an open gap**: germplasm release date/origin country (no schema fix solves missing data); the specific Alveograph rheology parameters (W/P/L/G/P-L) have no trait-level ontology term, method-level grounding only, via `CHMO:0000915` (see Update 2 above). Grain hardness itself is **resolved** (`TO:0000689`), not a gap.

## Namespaces (placeholder base, finalize once hosting URL is confirmed, task 6)

```
@prefix ppeo:     <http://purl.org/ppeo/PPEO.owl#> .          # real, verified, MIAPPE structural classes
@prefix phenet:   <https://w3id.org/phenet-poc/ontology#> .   # PoC-specific extension classes & properties
@prefix phenetid: <https://w3id.org/phenet-poc/id/> .         # minted (synthetic) instance IRIs
@prefix prov:     <http://www.w3.org/ns/prov#> .
@prefix geo:      <http://www.w3.org/2003/01/geo/wgs84_pos#> .
@prefix skos:     <http://www.w3.org/2004/02/skos/core#> .
@prefix dcat:     <http://www.w3.org/ns/dcat#> .
@prefix dct:      <http://purl.org/dc/terms/> .
@prefix obo:      <http://purl.obolibrary.org/obo/> .          # for obo:NCBITaxon_4565, obo:TO_*, obo:PO_*, obo:FOODON_*, obo:CHEBI_*, obo:CHMO_*
@prefix agrovoc:  <http://aims.fao.org/aos/agrovoc/> .          # for agrovoc:c_28543 (rheology), verified resolving
```

Real-data instances reuse the IRIs **already present in the source JSON-LD** (`urn:INRAE-URGI/germplasm/25895` etc.) directly as RDF subjects, rather than minting new ones, preserves traceability to source, standard good practice. Synthetic instances get freshly minted IRIs under `phenetid:synthetic/...`.

## Real vs. synthetic: three layers of separation (not just one)

1. **IRI namespace**, real subjects live under `urn:INRAE-URGI/...`, synthetic ones under `phenetid:synthetic/...`. Visible on sight in any query result.
2. **Named graph**, real triples in one graph, synthetic in another, so a single `FROM`/`GRAPH` clause toggles them.
3. **Explicit property**, every `phenet:Observation` (and `phenet:Study`) carries `phenet:hasProvenance` pointing to one of two `prov:Entity` instances: `phenetid:RealFaidareDataset` or `phenetid:SyntheticDemoDataset`. Queryable, filterable, and impossible to miss even if someone strips graph structure.

## Classes

Structural classes now reuse `ppeo:` directly (verified real namespace, see above). Only what PPEO doesn't cover, the descriptor/crosswalk machinery and provenance layer, stays in the project's own `phenet:` namespace.

| Class | Source | Key properties |
|---|---|---|
| `ppeo:biological_material` | PPEO | `phenet:accessionNumber`, `rdfs:label`, `phenet:hasTaxon` → **`obo:NCBITaxon_4565`** (verified, see above), `phenet:subtaxon` ("subsp. aestivum", literal, no NCBI ID at this rank), `phenet:heldBy` (institute) |
| `phenet:GermplasmDescriptor` | PoC extension (not in PPEO/MIAPPE scope, passport data is out of MIAPPE's remit) | `phenet:ofGermplasm`, `phenet:descriptorCode` (e.g. `CEREALS_GROWTH_CLASS`), `phenet:value` |
| `phenet:Pedigree` | PoC extension | `phenet:ofGermplasm`, `phenet:femaleParent`, `phenet:maleParent`, `phenet:crossingYear` |
| `ppeo:observed_variable` (composed of `ppeo:trait` + `ppeo:method` + `ppeo:scale`) | PPEO | `rdfs:label`, `phenet:traitDescription`, **`skos:exactMatch` → verified `obo:TO_*`/`obo:PO_*` IRI where one exists (8 of 10 traits, see Update 2)**, `phenet:cropOntologyCode` (literal, traceability only, not a live resource), `phenet:unitLabel` (plain string, confirmed non-blocking gap), `phenet:correspondsToDescriptor` (→ matching `GermplasmDescriptor` code, when one exists, the field that makes CQ3 possible) |
| `ppeo:observation` | PPEO | `phenet:ofGermplasm`, `phenet:ofObservationUnit`, `phenet:observedVariable`, `phenet:value`, `phenet:hasProvenance` |
| `ppeo:observation_unit` | PPEO | `phenet:ofGermplasm`, `phenet:partOfStudy`, `phenet:plotNumber`, `phenet:blockNumber`, `phenet:replicate` |
| `ppeo:study` | PPEO | `phenet:conductedAt` (→ Location), `phenet:partOfTrial`, `phenet:season`, `phenet:hasProvenance` |
| `phenet:Trial` | PoC extension (groups Studies; BrAPI concept, no direct PPEO equivalent) | `phenet:hasStudy` |
| `phenet:Program` | PoC extension | `phenet:hasTrial` |
| `ppeo:location` / `ppeo:environment` | PPEO | `geo:lat`, `geo:long`, `rdfs:label`, `phenet:country` |

Note: `GermplasmDescriptor` is deliberately **not** a subclass of `ppeo:observation`, passport descriptors aren't tied to a trial plot (`ppeo:observation_unit`), just to the germplasm itself. CQ3 joins the two classes via `phenet:correspondsToDescriptor`, not via shared class hierarchy.

## The CQ3 crosswalk table (the load-bearing part of this schema)

`phenet:correspondsToDescriptor` links an `ObservationVariable` to the `GermplasmDescriptor` code it should be checked against:

| ObservationVariable | skos:exactMatch | → correspondsToDescriptor | Data reality |
|---|---|---|---|
| `TKW_g` (was CO_321:1000177) | `obo:TO_0000382` | `CEREALS_TKW_SCALE` | **Real**, both sides are real FAIDARE data |
| `PHENETPOC:PLANT_HEIGHT_CM` | `obo:TO_0000207` | `CEREALS_PLANT_HEIGHT` | Synthetic observation vs. real descriptor |
| `PHENETPOC:AWN_CLASS` | `obo:PO_0025349` + `obo:TO_0002734` | `CEREALS_WHEAT_AWNEDNESS_SCALE` | Synthetic observation vs. real descriptor |
| `PHENETPOC:GRAIN_COLOUR_CLASS` | `obo:TO_0000385` | `CEREALS_GRAIN_COLOUR_SCALE` | Synthetic observation vs. real descriptor |

This table itself should probably render in the frontend next to any CQ3 result, so a viewer immediately sees which comparisons are fully real vs. partly synthetic, and now each row also carries a genuinely clickable, resolving ontology term.

## Known gaps carried forward from data assessment (not solved by schema design)

- No `phenet:releaseDate` / `phenet:originCountry` data exists for any germplasm (real or synthetic), property can exist in the schema, but stays empty. CQ4's release-date part is unanswerable until an external source (variety register/genebank passport) is integrated.

(The NCBI Taxon gap noted in the previous version of this doc is resolved, see above.)

## CQ → query pattern sketch

**CQ1, best genotype for a trait:**
```
?obs a ppeo:observation ; phenet:ofGermplasm ?g ; phenet:observedVariable <trait> ; phenet:value ?v .
GROUP BY ?g ORDER BY DESC(AVG(?v)) LIMIT 1
```

**CQ2, best environment for yield, among selected genotypes:**
```
?obs phenet:observedVariable phenetid:synthetic/variable/YIELD_KGHA ; phenet:ofGermplasm ?g ; phenet:ofObservationUnit ?u ; phenet:value ?v .
?u phenet:partOfStudy ?s . ?s phenet:conductedAt ?loc .
VALUES ?g { <selected genotypes> }
GROUP BY ?loc ORDER BY DESC(AVG(?v)) LIMIT 1
```

**CQ3, descriptor vs. observation consistency:**
```
?variable phenet:correspondsToDescriptor ?code .
?obs phenet:observedVariable ?variable ; phenet:ofGermplasm ?g ; phenet:value ?observedVal .
?desc a phenet:GermplasmDescriptor ; phenet:ofGermplasm ?g ; phenet:descriptorCode ?code ; phenet:value ?descriptorVal .
FILTER (?observedVal != ?descriptorVal)   # or a normalized/fuzzy comparison for numeric traits
```

**CQ4, genotype list, release/usage:**
```
SELECT ?g ?label ?releaseDate WHERE {
  ?g a ppeo:biological_material ; rdfs:label ?label .
  OPTIONAL { ?g phenet:releaseDate ?releaseDate }   # will be empty for all rows currently
}
```
Usage locations: `?g` → `ppeo:observation_unit` → `ppeo:study` → `ppeo:location`, straightforward join, already populated for both real and synthetic data.

## Next step

Task 4: write the actual JSON→RDF conversion script implementing this schema against both `data/wheat-subset/` and `data/synthetic-subset/`, producing the Turtle/JSON-LD files the frontend will load.
