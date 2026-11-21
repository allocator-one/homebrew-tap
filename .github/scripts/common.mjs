// Shared checks for attach.yml and publish.yml.
//
// This repository is public and a branch pushed to it is untrusted input: every
// value read from a ref name or a pushed file is matched against a strict pattern
// here before a workflow step sees it, and the steps only ever receive the result
// through an environment variable, never spliced into a script.
import { createHash } from "node:crypto";
import { appendFileSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLATFORMS, parseSums, renderFormula } from "./render-formula.mjs";

export const SOURCE_REPO = "allocator-one/harness-cli";
export const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/;
export const SHA_PATTERN = /^[0-9a-f]{40}$/;
export const TARGETS = PLATFORMS.map((platform) => platform.target);
/** The assets of a release: the four binaries and the three files beside them. */
export const ASSET_NAMES = [...TARGETS.map((target) => `infraone-${target}`), "SHA256SUMS", "infraone.rb", "install.sh"];
/** A binary larger than this after decompression is refused. */
export const MAX_BINARY_BYTES = 300 * 1024 * 1024;

export function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

/** The version in `<prefix>/infraone-v<version>`, or a failure for any other ref name. */
export function versionOfRef(refName, prefix) {
  const match = new RegExp(`^${prefix}/infraone-v([0-9]+\\.[0-9]+\\.[0-9]+)$`).exec(refName ?? "");
  if (match === null) fail(`${JSON.stringify(refName)} is not a ${prefix}/infraone-v<version> ref`);
  return match[1];
}

/** Exactly the lines `allocator-one/harness-cli@<sha>` and `version=<version>`. */
export function parseSource(text) {
  const match = /^allocator-one\/harness-cli@([0-9a-f]{40})\nversion=([0-9]+\.[0-9]+\.[0-9]+)\n$/.exec(text);
  if (match === null) fail("SOURCE is not `allocator-one/harness-cli@<40 hex>` and `version=<x.y.z>`, one per line");
  return { sha: match[1], version: match[2] };
}

/** The notes line that names the commit the assets were built from. */
export function builtFromLine(sha) {
  return `Built from ${SOURCE_REPO}@${sha}.`;
}

export function regularFile(path) {
  const entry = lstatSync(path, { throwIfNoEntry: false });
  return entry !== undefined && entry.isFile();
}

export function sha256Of(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** The release's own text assets read as bytes from a directory that holds exactly the assets. */
export function checkAssetDirectory({ dir, version, repo }) {
  const problems = [];
  const names = readdirSync(dir).sort();
  const expected = [...ASSET_NAMES].sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    problems.push(`the assets are ${JSON.stringify(names)}, expected ${JSON.stringify(expected)}`);
    return problems;
  }
  for (const name of names) if (!regularFile(join(dir, name))) problems.push(`${name} is not a regular file`);
  if (problems.length > 0) return problems;

  let sums;
  try {
    sums = parseSums(readFileSync(join(dir, "SHA256SUMS"), "utf8"));
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  for (const target of Object.keys(sums)) if (!TARGETS.includes(target)) problems.push(`SHA256SUMS lists infraone-${target}`);
  for (const target of TARGETS) {
    if (sums[target] === undefined) problems.push(`SHA256SUMS has no infraone-${target}`);
    else if (sha256Of(join(dir, `infraone-${target}`)) !== sums[target]) problems.push(`infraone-${target} does not match its checksum`);
  }
  if (problems.length > 0) return problems;

  if (readFileSync(join(dir, "infraone.rb"), "utf8") !== renderFormula({ version, repo, sums })) {
    problems.push(`infraone.rb is not the formula that infraone ${version} and these checksums render`);
  }
  const install = readFileSync(join(dir, "install.sh"), "utf8");
  if (install.includes("__INFRAONE_RELEASES_REPO__")) problems.push("install.sh still has its repository placeholder");
  const repoLines = install.split("\n").filter((line) => /^repo=/.test(line));
  if (repoLines.length !== 1 || repoLines[0] !== `repo="${repo}"`) problems.push(`install.sh does not name ${repo} as its one repo= line`);
  if (!install.startsWith("#!/bin/sh\n")) problems.push("install.sh does not start with #!/bin/sh");
  return problems;
}

/** Appends `name=value` lines to $GITHUB_OUTPUT; every value is one of the validated shapes above, never free text. */
export function output(pairs) {
  const path = process.env.GITHUB_OUTPUT;
  if (path !== undefined) appendFileSync(path, pairs.map(([key, value]) => `${key}=${value}\n`).join(""));
}
