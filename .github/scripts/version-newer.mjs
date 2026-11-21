// Whether one release version is newer than another, by SemVer precedence
// The tap carries a copy of this file in .github/scripts (CLI-189). Change both together.
// (a release is newer than its own pre-releases, unlike `sort -V`):
//
//   node packaging/homebrew/version-newer.mjs <a> <b>   # exit 0 when a > b
import { fileURLToPath } from "node:url";

const parse = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (match === null) throw new Error(`not a release version: ${JSON.stringify(version)}`);
  return { core: match.slice(1, 4).map(BigInt), pre: match[4] === undefined ? [] : match[4].split(".") };
};

const compareIdentifier = (a, b) => {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) return a.length !== b.length ? Math.sign(a.length - b.length) : a < b ? -1 : a > b ? 1 : 0;
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/** -1, 0 or 1 as `a` is older than, equal to or newer than `b`. */
export function compareVersions(a, b) {
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i += 1) if (left.core[i] !== right.core[i]) return left.core[i] < right.core[i] ? -1 : 1;
  if (left.pre.length === 0 || right.pre.length === 0) return Math.sign(right.pre.length - left.pre.length);
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i += 1) {
    if (left.pre[i] === undefined) return -1;
    if (right.pre[i] === undefined) return 1;
    const order = compareIdentifier(left.pre[i], right.pre[i]);
    if (order !== 0) return order;
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [a, b] = process.argv.slice(2);
  process.exit(compareVersions(a, b) > 0 ? 0 : 1);
}
