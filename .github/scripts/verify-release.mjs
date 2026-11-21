// publish.yml: checks the assets downloaded from a release's draft.
//
//   node verify-release.mjs <version> <dir>
import { checkAssetDirectory, fail } from "./common.mjs";

const [version, dir] = process.argv.slice(2);
if (version === undefined || dir === undefined) fail("usage: verify-release.mjs <version> <dir>");
const repo = process.env.GITHUB_REPOSITORY ?? "";
const problems = checkAssetDirectory({ dir, version, repo });
if (problems.length > 0) {
  for (const problem of problems) console.error(`error: ${problem}`);
  process.exit(1);
}
console.log(`infraone-v${version} is consistent`);
