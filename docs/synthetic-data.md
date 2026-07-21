# Synthetic demo data

The real FAIDARE wheat data (see `data-assessment.md`) only measures grain-quality/technological traits (protein content, hardness, alveograph rheology, TKW), no yield, and only TKW overlaps with a real passport descriptor. To demo all 4 competency questions, `scripts/generate-synthetic.js` adds a small, fabricated multi-environment trial on top of the real data.

**This is illustrative data, not a real trial.** Every record it produces carries `dataProvenance: "synthetic:demo"`. It must stay filterable/visually flagged in the final KG and frontend, never presented as a finding.

## What's real vs. fabricated in the synthetic trial

- **Real**: the 40 genotypes (actual wheat `germplasmDbId`/accession names from the FAIDARE fixture), the 8 trial locations (real FAIDARE location records, real coordinates), and, for 18 of the 40 genotypes, real passport descriptor values (growth class, plant height, awn class, grain colour) pulled from `germplasmAttribute.json`.
- **Fabricated**: 3 seasons (2019–2021, chosen to postdate the real descriptor years so nothing overlaps confusingly), and all measured values: yield, plant height, awn class, grain colour, stripe rust severity, septoria severity.

## Statistical model (seeded, deterministic, see script for exact numbers)

- Each genotype gets a fixed latent yield potential, height baseline (real value used directly where a descriptor exists), and disease resistance level.
- Each location gets a fixed yield effect (some sites are systematically better/worse); each season gets a small yield effect; each location×season gets a disease-pressure level.
- An observation = genotype baseline + environment effect + noise, so "best genotype" and "best environment" queries return a *consistent, structured* answer rather than pure noise, the way a real trial would.
- Awn class and grain colour: the genotype's real descriptor value (where one exists) is used as ground truth, with a **12% deliberate mismatch rate** simulating field-scoring noise. This gives the CQ3 "descriptor vs. observation" consistency check something real to find, a run produced an 85.9% awn match rate and 88.4% grain-colour match rate, i.e. roughly 1 in 7–8 genotype×environment combos flagged as inconsistent. Without this deliberate noise, the check would trivially return "100% consistent," which wouldn't demonstrate anything.

## Output

`data/synthetic-subset/`, same file shapes as `data/wheat-subset/` (`observation.json`, `observationUnit.json`, `observationVariable.json`, `study.json`, `trial.json`, `program.json`), so the RDF conversion script (task 4) can process both with the same logic, distinguished only by the `dataProvenance` field. Counts from the current run: 5,760 observations, 960 observation units, 6 synthetic variables, 24 studies, 1 trial, 1 program.
