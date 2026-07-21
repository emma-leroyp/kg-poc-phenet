// Downloads the FAIDARE INRAE-URGI bulk JSON fixture into data/raw/, pinned to one
// exact commit so this step is actually reproducible. The forge's "master" branch is
// a live target that can change, so a plain master URL would silently drift over
// time. This commit was verified against the files this project was built from
// (checked byte for byte, matching SHA256 hashes), not just picked because it's
// recent.
//
// Source project: https://forge.inrae.fr/urgi/is/faidare
// Pinned commit: 095b0054046fc3840ab9183321c7ed897009e15e (master, 2026-07-09)

const fs = require('fs');
const path = require('path');
const https = require('https');

const COMMIT = '095b0054046fc3840ab9183321c7ed897009e15e';
const BASE = `https://forge.inrae.fr/urgi/is/faidare/-/raw/${COMMIT}/data/test/json-bulk/INRAE-URGI`;
const OUT_DIR = path.join(__dirname, '..', 'data', 'raw');

// Only the files filter-wheat.js actually reads. The fixture also has
// datadiscovery-1 and xref-phenotyping-1, unused here, skipped to save time and disk.
const FILES = [
  'germplasm-1', 'germplasmAttribute-1', 'germplasmPedigree-1', 'location-1',
  'observationVariable-1', 'program-1', 'study-1', 'trial-1',
  ...Array.from({ length: 41 }, (_, i) => `observation-${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `observationUnit-${i + 1}`),
].map(name => `${name}.json.gz`);

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, destPath).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`${url} returned HTTP ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let done = 0;
  for (const filename of FILES) {
    const destPath = path.join(OUT_DIR, filename);
    if (fs.existsSync(destPath)) { done++; continue; }
    await download(`${BASE}/${filename}`, destPath);
    done++;
    console.log(`${done}/${FILES.length} ${filename}`);
  }
  console.log('Done. Raw data in data/raw/');
}

main().catch(err => { console.error(err); process.exit(1); });
