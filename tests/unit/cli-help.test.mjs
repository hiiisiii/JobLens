import assert from "node:assert/strict";
import test from "node:test";
import { isHelpRequest, JOBLENS_CLI_USAGE, parseCommand } from "../../dist/index.js";

test("CLI shows help for empty argv and explicit help flags", () => {
  assert.equal(isHelpRequest([]), true);
  assert.equal(isHelpRequest(["--help"]), true);
  assert.equal(isHelpRequest(["-h"]), true);
  assert.equal(isHelpRequest(["help"]), true);
  assert.equal(isHelpRequest(["rank"]), false);
});

test("CLI help documents the complete v0.1 command flow", () => {
  for (const command of ["setup", "discover", "materialize", "rank", "research", "prepare", "review", "outcome"]) {
    assert.match(JOBLENS_CLI_USAGE, new RegExp(`\\b${command}\\b`));
  }
  assert.match(JOBLENS_CLI_USAGE, /JOBLENS_WORKSPACE/);
  assert.match(JOBLENS_CLI_USAGE, /SARAMIN_ACCESS_KEY/);
});

test("unknown commands point users to help", () => {
  assert.throws(() => parseCommand(["unknown"]), /joblens --help/);
});
