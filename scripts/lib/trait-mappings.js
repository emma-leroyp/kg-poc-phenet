// Shared normalization used by BOTH generate-synthetic.js (to derive "ground truth"
// from real descriptors) and convert-to-rdf.js (to annotate real descriptors with a
// comparable value for the CQ3 frontend query). Keeping this in one place means the
// two can never silently drift apart.

const AWN_CLASSES = ['awnless', 'awnletted', 'awned'];
function mapRealAwnValue(v) {
  if (/awnless/i.test(v)) return 'awnless';
  if (/awnlet/i.test(v) || /intermediate/i.test(v)) return 'awnletted';
  return 'awned';
}

const GRAIN_COLOUR_CLASSES = ['amber yellow', 'light brown/light red', 'brown/red', 'dark brown/dark red'];
function mapRealGrainColourValue(v) {
  if (/amber/i.test(v)) return 'amber yellow';
  if (/light brown|light red/i.test(v)) return 'light brown/light red';
  if (/dark/i.test(v)) return 'dark brown/dark red';
  return 'brown/red';
}

module.exports = { AWN_CLASSES, mapRealAwnValue, GRAIN_COLOUR_CLASSES, mapRealGrainColourValue };
