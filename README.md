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
npm run filter              # needs data/raw/*.json.gz, the FAIDARE fixture, downloaded separately
npm run generate-synthetic
npm run convert-to-rdf
cp data/rdf/*.ttl site/data/
```

`site/data/*.ttl` is the only RDF that actually needs to be committed, that's what the frontend loads.

## Ontologies reused

Full reasoning and verification steps are in `docs/schema-design.md`. Short version:

- [PPEO](https://github.com/MIAPPE/MIAPPE-ontology), the MIAPPE checklist as OWL classes (study, observation unit, observed variable, and so on)
- [Trait Ontology](https://browser.planteome.org/amigo) and [Plant Ontology](https://browser.planteome.org/amigo), real trait terms for 9 of the 10 traits used here, checked one by one against a live resolver rather than assumed
- [NCBI Taxonomy](https://www.ncbi.nlm.nih.gov/taxonomy), for the wheat taxon ID
- Crop Ontology codes are kept as plain text labels, not linked IRIs. Its linked-data endpoint doesn't actually resolve to real term data, tested directly, not assumed
