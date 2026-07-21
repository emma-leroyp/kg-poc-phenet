# Source data assessment

Source: [FAIDARE INRAE-URGI bulk JSON test fixture](https://forge.inrae.fr/urgi/is/faidare/-/tree/095b0054046fc3840ab9183321c7ed897009e15e/data/test/json-bulk/INRAE-URGI), BrAPI-derived JSON-LD (`@id`/`@type`/`schema:*` present on every record). Pinned to commit `095b0054`, not `master`, since the live branch can change. `npm run download-raw` fetches exactly this commit; see `scripts/download-raw.js`.

## Files present

`germplasm`, `germplasmAttribute`, `germplasmPedigree`, `germplasmProgeny`, `location`, `observation` (41 shards), `observationUnit` (4 shards), `observationVariable`, `program`, `study`, `trial`, `datadiscovery`, `xref-phenotyping`. No genotype/marker/variant files, phenotyping only, as expected.

## Crop coverage

`germplasm` level: Maize (256), Wheat (544), Forest tree (332). No apple anywhere in germplasm, study, or observationVariable data. `observationVariable` alone spans far more crops (Vitis, Pea, Sugar beet, Walnut, Brassica, Melon, Miscanthus, Lentil, Prunus...) than the germplasm set does, it's the whole GnpIS trait dictionary, not scoped to this fixture's germplasm. Path (`data/test/json-bulk`) and crop mismatch both point to this being a generic FAIDARE export test fixture, not a PHENET-curated dataset.

## Why wheat was chosen for the PoC

- **Ontology alignment**: 823 wheat `observationVariable` records carry real Crop Ontology IRIs (`CO_321:*`, `CO_322:*`), same ID space as the project's MIAPPE↔ICASA mapping sheet. Maize, by contrast, mostly uses local/internal ontology IDs (`GNPISO_1`, "project Amaizing") with `xref` null, would need manual crosswalk work.
- **`germplasmAttribute` (descriptor) records exist only for wheat** in this fixture: `CEREALS_GROWTH_CLASS`, `CEREALS_HEADING`, `CEREALS_PLANT_HEIGHT`, `CEREALS_TKW_SCALE`, `CEREALS_SPIKE_DENSITY_SCALE`, awnedness/glume/grain colour, lodging, disease-resistance scales (head blight, stripe rust, leaf rust, powdery mildew, leaf blotch). These are DUS/passport-style descriptors, joined to germplasm via `germplasmDbId`, directly needed for CQ3. Maize and Forest tree have no attribute records at all here.
- **Trial/study spread**: wheat trials (e.g. "INRA Wheat Network technological variables") span multiple years and locations, needed for CQ1/CQ2 (genotype-by-environment comparison).

## Known gap

No release-date or country-of-origin field exists anywhere in the `germplasm` or `germplasmPedigree` schema (checked directly against real records, not just field names). `germplasmPedigree` gives parentage (`parent1DbId`/`parent2DbId`, `crossingPlan`, `familyCode`, `crossingYear`, often null) but not official variety release info. **CQ4's release-date/place is not answerable from this dataset alone**, regardless of crop; would need an external source (e.g. a national variety register or genebank passport database) in a future iteration.

## Competency-question fit summary

| CQ | Entities needed | Status in this dataset |
|----|------------------|------------------------|
| 1. Best-performing genotype | `germplasm` + `observation` + `observationVariable` | Good |
| 2. Best environment for yield | `location` + `study`/`trial` + `observation` (yield variable) | Good, pending confirmation a yield variable exists in the wheat subset |
| 3. Descriptor vs. observation consistency | `germplasmAttribute` + `observation`, joined on `germplasmDbId` + matching trait | Good, this is the one CQ this fixture demonstrates best |
| 4. Genotype list, release date/place, usage | `germplasm` + `germplasmPedigree` + `study` (usage location) | Partial, usage location yes, release date/place no (see gap above) |
