// attach.yml: validates a pushed incoming branch and restores the release assets.
//
//   node prepare-attach.mjs <ref name> <payload dir> <out dir>
//
// The payload holds SOURCE, SHA256SUMS (of the uncompressed binaries), install.sh,
// infraone.rb and each binary as infraone-<os>-<arch>.gz, or, when that would pass
// the size GitHub takes per file, as infraone-<os>-<arch>.gz.part00, .part01, …
// Nothing else is accepted. The restored binaries are checked against SHA256SUMS,
// and the formula and install.sh against what the version and this repository render.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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

const scratch = join(out, "..", "scratch");
mkdirSync(scratch, { recursive: true });
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
  const compressed = join(scratch, `${target}.gz`);
  writeFileSync(compressed, Buffer.concat((hasWhole ? [whole] : parts).map((name) => readFileSync(join(payload, name)))));
  // head -c bounds what a hostile archive can write; reaching the bound is a refusal.
  const binary = join(out, `infraone-${target}`);
  execFileSync("sh", ["-c", 'gzip -dc < "$1" | head -c "$2" > "$3"; exit 0', "sh", compressed, String(MAX_BINARY_BYTES), binary], { stdio: ["ignore", "inherit", "inherit"] });
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
