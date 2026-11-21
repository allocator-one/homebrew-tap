// publish.yml: validates a pushed publish marker.
//
//   node prepare-publish.mjs <ref name> <marker file>
//
// The marker is the file PUBLISH on the branch: `allocator-one/harness-cli@<sha>`
// and `version=<version>`, the commit the release must have been built from.
import { readFileSync } from "node:fs";
import { fail, output, parseSource, versionOfRef } from "./common.mjs";

const [refName, marker] = process.argv.slice(2);
if (refName === undefined || marker === undefined) fail("usage: prepare-publish.mjs <ref> <marker file>");
const refVersion = versionOfRef(refName, "publish");
const source = parseSource(readFileSync(marker, "utf8"));
if (source.version !== refVersion) fail(`the marker names version ${source.version}, the ref ${refVersion}`);
output([
  ["version", refVersion],
  ["sha", source.sha],
]);
console.log(`publish marker for infraone-v${refVersion}, expected source ${source.sha}`);
