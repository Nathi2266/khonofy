import fs from 'node:fs';

const runNumber = Number(process.env.GITHUB_RUN_NUMBER || process.env.BUILD_NUMBER || 0);
const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7);
const semver = `1.0.${runNumber || 1}`;
const full = `khonofy@${semver}+${sha}`;
const updatedAt = new Date().toISOString();

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function updateJson(path, mutator) {
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  mutator(data);
  writeJson(path, data);
}

updateJson('package.json', (pkg) => {
  pkg.version = semver;
});

updateJson('package-lock.json', (lock) => {
  lock.version = semver;
  if (lock.packages?.['']) {
    lock.packages[''].version = semver;
  }
});

updateJson('backend/package.json', (pkg) => {
  pkg.version = semver;
});

writeJson('public/app-version.json', {
  version: semver,
  full,
  build: runNumber,
  sha,
  updatedAt,
});

console.log(`khonofy-app@${semver} (${full})`);
