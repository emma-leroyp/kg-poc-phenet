# kg-poc-phenet

Proof-of-concept knowledge graph for the [PHENET](https://www.phenet.eu/en/about-phenet) project (Horizon Europe grant 101094587), built to test whether a KG approach can answer PHENET's target questions before real PHENET data is available.

## Status

This is a **technical feasibility PoC**, not the production PHENET KG. It uses public test/demo data from INRAE-URGI's [FAIDARE](https://forge.inrae.fr/urgi/is/faidare) bulk JSON export (BrAPI format), scoped to **wheat only** (the best-aligned crop in that dataset, see `docs/data-assessment.md`). Real PHENET phenotyping data (wheat, apple) will replace this once available.

## Competency questions

The KG is designed to answer:

1. Which genotype has performed best (for a given trait)?
2. Which environment has the highest yield among selected genotypes?
3. Are cultivar descriptors (passport/DUS data) consistent with observations made in experiments?
4. What is the list of genotypes used, when were they released, and where were they used?

Note: CQ4's "release date" is not answerable from the FAIDARE dataset alone (no release-date/origin field exists in its germplasm model), flagged as a known gap for this PoC.

## Architecture

- **Data**: static Turtle files in `site/data/`, no database server.
- **Query**: in-browser SPARQL via Oxigraph-WASM, loading the static RDF at page load. Real and synthetic data sit in separate named graphs, with a toggle to include or exclude the synthetic one.
- **Frontend**: `site/`, a static page with a form per competency question (trait pickers, genotype pickers, filters) that runs canned SPARQL. No raw SPARQL exposed to end users, though each result panel has a "view SPARQL query" toggle for anyone curious.
- **Hosting**: GitHub Pages. On a personal/free GitHub account, Pages content is technically public at an unlisted URL, not access-controlled.

## Repo layout

```
scripts/    Conversion pipeline (FAIDARE JSON -> filtered wheat subset -> RDF)
site/       Static frontend, published to GitHub Pages, including the final RDF in site/data/
docs/       Design notes: data assessment, schema/ontology mapping, CQ-to-query mapping
```

The intermediate build folders (`data/raw`, `data/wheat-subset`, `data/synthetic-subset`, `data/rdf`) aren't committed, the biggest one alone is over GitHub's file size limit. They're regenerated locally with:

```
npm install
npm run download-raw        # fetches data/raw/*.json.gz from a pinned FAIDARE commit
npm run filter
npm run generate-synthetic
npm run convert-to-rdf
cp data/rdf/*.ttl site/data/
```

`generate-synthetic.js` uses a seeded random number generator, so given the same `data/raw` files it always produces the exact same synthetic numbers. Confirmed by re-running it twice and diffing the output.

`site/data/*.ttl` is the only RDF that actually needs to be committed, that's what the frontend loads.

## Ontologies reused

Full reasoning and verification steps are in `docs/schema-design.md`. Short version:

- [PPEO](https://github.com/MIAPPE/MIAPPE-ontology), the MIAPPE checklist as OWL classes (study, observation unit, observed variable, and so on)
- [Trait Ontology](https://browser.planteome.org/amigo) and [Plant Ontology](https://browser.planteome.org/amigo), real trait terms for 9 of the 10 traits used here, checked one by one against a live resolver rather than assumed
- [NCBI Taxonomy](https://www.ncbi.nlm.nih.gov/taxonomy), for the wheat taxon ID
- Crop Ontology codes are kept as plain text labels, not linked IRIs. Its linked-data endpoint doesn't actually resolve to real term data, tested directly, not assumed

## Reproducing this exactly

Given the same inputs, every step after the download is deterministic: `filter-wheat.js` is a
plain filter with no randomness, and `generate-synthetic.js` uses a seeded random number
generator (confirmed by running it twice and diffing the output byte for byte). The one thing
that used to be unpinned was the download itself, `download-raw.js` used to point at FAIDARE's
`master` branch, a moving target. It's now pinned to a specific commit and the 53 files it
fetches were checked against the exact files this project was built from (SHA256, byte for
byte). So running the four `npm run` steps above from a clean checkout reproduces this
repository's data exactly, not just something similar.

What this does **not** mean: this pipeline is a general PHENET data importer. It was written
against one specific dataset's shape (FAIDARE's BrAPI JSON export) and its specific gaps (no
yield, only one real trait pair for the descriptor check). Treat it as a worked example of the
process, not a tool that takes a different input and does the right thing automatically.

## Adapting this once real PHENET data arrives

Real data will need its own pass through most of this, not a find-and-replace on file paths.
Roughly, in order:

1. **Redo the data assessment first**, `docs/data-assessment.md` is a template for the kind of
   questions to ask (what fields exist, what's missing, which crop or subset is best suited to a
   proof of concept), not something to reuse directly. Real PHENET data will have a different
   shape than FAIDARE's BrAPI JSON, so expect the file format, field names, and the identifier
   scheme to all be different.
2. **Check whether synthetic data is still needed.** The synthetic layer in this PoC exists only
   because the specific FAIDARE trial used here never measured yield and only had passport
   descriptors for a few traits. Real PHENET data may cover this properly, in which case the
   whole `generate-synthetic.js` step and the real/synthetic separation in the schema can likely
   be dropped rather than adapted.
3. **Reuse what's genuinely general:**
   - The ontology research in `docs/schema-design.md`, the verified Trait Ontology and Plant
     Ontology terms for common wheat traits (yield, height, kernel weight, disease severity, and
     so on) will very likely still apply, since these are properties of the traits themselves,
     not of FAIDARE.
   - The RDF schema shape (`ppeo:` classes for the MIAPPE structure, `phenet:` for the parts
     MIAPPE doesn't cover) is a reasonable starting point regardless of source format.
   - The frontend (`site/`) and its SPARQL query patterns per competency question are reusable
     largely as is, once the underlying data uses the same class and property names. The trait
     dictionary in `site/trait-info.js` is the one piece that's fully tied to this dataset's
     specific variable IDs and would need to be rebuilt for new data.
4. **Rewrite, don't patch, `filter-wheat.js` and `convert-to-rdf.js`.** Both are written against
   FAIDARE's specific field names (`germplasmDbId`, `observationVariableDbId`, and so on). A
   different source format means rewriting the parsing logic, not adjusting a few strings.

If you're a future Claude instance reading this: don't assume the specific scripts apply to new
data just because the shape looks similar. Re-run the assessment step for real, the same way
this PoC did, and check claims like "this field exists" or "this term resolves" against the
actual new data and the actual live ontology endpoints rather than carrying assumptions over
from this dataset.
