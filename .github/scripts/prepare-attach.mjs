// attach.yml: validates a pushed incoming branch and restores the release assets.
//
//   node prepare-attach.mjs <ref name> <payload dir> <out dir>
//
// The payload holds SOURCE, SHA256SUMS (of the uncompressed binaries), install.sh,
// infraone.rb and each binary as infraone-<os>-<arch>.gz, or, when that would pass
// the size GitHub takes per file, as infraone-<os>-<arch>.gz.part00, .part01, …
// Nothing else is accepted. The restored binaries are checked against SHA256SUMS,
// and the formula and install.sh against what the version and this repository render.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { TARGETS, MAX_BINARY_BYTES, checkAssetDirectory, fail, output, parseSource, regularFile, versionOfRef } from "./common.mjs";

const [refName, payload, out] = process.argv.slice(2);
if (refName === undefined || payload === undefined || out === undefined) fail("usage: prepare-attach.mjs <ref> <payload dir> <out dir>");
const repo = process.env.GITHUB_REPOSITORY ?? "";
if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) fail("GITHUB_REPOSITORY is not an owner/repo");

const refVersion = versionOfRef(refName, "incoming");

const NAME = /^(SOURCE|SHA256SUMS|install\.sh|infraone\.rb|infraone-(?:darwin|linux)-(?:arm64|x64)\.gz(?:\.part[0-9]{2})?)$/;
const names = readdirSync(payload).sort();
for (const name of names) {
  if (!NAME.test(name)) fail(`the payload holds ${JSON.stringify(name)}, which is not one of its files`);
  if (!regularFile(join(payload, name))) fail(`${name} is not a regular file`);
}

for (const name of ["SOURCE", "SHA256SUMS", "install.sh", "infraone.rb"]) {
  if (!names.includes(name)) fail(`${name} is missing from the payload`);
}
const source = parseSource(readFileSync(join(payload, "SOURCE"), "utf8"));
if (source.version !== refVersion) fail(`SOURCE names version ${source.version}, the ref ${refVersion}`);

mkdirSync(out, { recursive: true });
for (const name of ["SHA256SUMS", "install.sh", "infraone.rb"]) copyFileSync(join(payload, name), join(out, name));

for (const target of TARGETS) {
  const whole = `infraone-${target}.gz`;
  const parts = names.filter((name) => name.startsWith(`${whole}.part`));
  const hasWhole = names.includes(whole);
  if (hasWhole === parts.length > 0) fail(`infraone-${target} must come as ${whole} or as numbered parts, exactly one of them`);
  if (!hasWhole) {
    parts.forEach((name, index) => {
      if (name !== `${whole}.part${String(index).padStart(2, "0")}`) fail(`the parts of infraone-${target} are not numbered 00, 01, … without a gap`);
    });
  }
  const pieces = (hasWhole ? [whole] : parts).map((name) => join(payload, name));
  // The compressed bytes are bounded before anything reads them, and are never held in memory.
  const compressedBytes = pieces.reduce((total, path) => total + statSync(path).size, 0);
  if (compressedBytes > MAX_BINARY_BYTES) fail(`infraone-${target} is larger than ${MAX_BINARY_BYTES} bytes compressed`);
  // gzip must succeed; only a stop caused by the size bound (head closing the pipe, SIGPIPE) is read as "too large".
  const binary = join(out, `infraone-${target}`);
  const script = 'set +e; cat "${@:3}" | gzip -dc | head -c "$2" > "$1"; status=${PIPESTATUS[1]}; if [ "$status" = 0 ] || [ "$status" = 141 ]; then exit 0; fi; exit "$status"';
  const result = spawnSync("bash", ["-c", script, "bash", binary, String(MAX_BINARY_BYTES), ...pieces], { stdio: ["ignore", "inherit", "inherit"] });
  if (result.status !== 0) fail(`infraone-${target} is not a valid gzip stream`);
  if (statSync(binary).size >= MAX_BINARY_BYTES) fail(`infraone-${target} is larger than ${MAX_BINARY_BYTES} bytes uncompressed`);
}

const problems = checkAssetDirectory({ dir: out, version: refVersion, repo });
if (problems.length > 0) {
  for (const problem of problems) console.error(`error: ${problem}`);
  process.exit(1);
}
output([
  ["version", refVersion],
  ["sha", source.sha],
]);
console.log(`infraone-v${refVersion} restored and verified (built from ${source.sha})`);
