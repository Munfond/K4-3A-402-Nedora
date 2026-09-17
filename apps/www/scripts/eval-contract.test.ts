import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseEvalContract,
  statusMatches,
  toAnalyzeInput,
} from "./eval-contract";

const workspaceRoot = resolve(process.cwd());
const repoRoot = existsSync(resolve(workspaceRoot, "eval"))
  ? workspaceRoot
  : resolve(workspaceRoot, "../..");
const contract = parseEvalContract(
  readFileSync(resolve(repoRoot, "eval/golden/golden-set.v1.json"), "utf8"),
);

assert.equal(contract.cases.length, 20);
assert.equal(contract.metadata.canonical, true);

const n01 = contract.cases.find((candidate) => candidate.caseId === "N-01");
assert.ok(n01);
const n01Input = toAnalyzeInput(n01);
assert.equal(n01Input.includeD1Feedback, false);
assert.deepEqual(
  n01Input.newFeedback?.map((feedback) => feedback.id),
  ["v1-n01-a", "v1-n01-b"],
);
assert.equal(statusMatches("done", "xong"), true);

const legacy = parseEvalContract(
  readFileSync(resolve(repoRoot, "eval_v0/golden-set.v1.json"), "utf8"),
);
assert.equal(legacy.cases.length, 20);

console.log("eval-contract: ok");
