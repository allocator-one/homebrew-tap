// Whether the tap already has a newer infraone formula than the release being
// published (CLI-165):
//
//   node packaging/homebrew/check-tap.mjs <version> <path to the tap's Formula/infraone.rb>
//
// Prints `stale=true` when the tap's formula is newer than <version>, so the
// publication does nothing, and `stale=false` when there is no formula yet
// (the first release) or it is not newer. A formula that is there but whose
// version cannot be read stops the publication (exit 1, nothing printed): an
// unreadable tap is not an empty one, and treating it as empty could replace a
// newer formula with an older one.
import { lstatSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compareVersions } from "./version-newer.mjs";

/** `stale=true` or `stale=false`, or a thrown error when the tap's formula has no readable version. */
export function checkTap({ version, formulaPath }) {
  let entry;
  try {
    entry = lstatSync(formulaPath);
  } catch (error) {
    // Only a path that is not there is absent; a link that leads nowhere is there.
    if (error.code === "ENOENT") return "stale=false";
    throw error;
  }
  if (!entry.isFile()) throw new Error(`${formulaPath} is not a regular file`);
  const declared = /^[ \t]*version "([^"]+)"[ \t]*$/m.exec(readFileSync(formulaPath, "utf8"));
  if (declared === null) throw new Error(`${formulaPath} has no version line`);
  return compareVersions(declared[1], version) > 0 ? "stale=true" : "stale=false";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [version, formulaPath] = process.argv.slice(2);
  if (version === undefined || formulaPath === undefined) {
    console.error("usage: check-tap.mjs <version> <path to infraone.rb>");
    process.exit(2);
  }
  try {
    console.log(checkTap({ version, formulaPath }));
  } catch (error) {
    console.error(`check-tap: ${formulaPath}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
