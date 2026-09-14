import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverCommand,
  materializeCommand,
  prepareCommand,
  researchCommand,
  reviewCommand,
} from "../../dist/cli/runtime.js";
import { outcomeCommand } from "../../dist/cli/outcome-command.js";

const env = {};

test("release audit: discover rejects missing or incomplete source selection", async () => {
  await assert.rejects(() => discoverCommand([], env), /posting JSON path or --source/);
  await assert.rejects(() => discoverCommand(["--source"], env), /--source requires a value/);
  await assert.rejects(() => discoverCommand(["--source", "saramin"], env), /at least one --keyword/);
});

test("release audit: materialize validates stable id and input path before workspace mutation", async () => {
  await assert.rejects(() => materializeCommand([], env), /discovery hit id/);
  await assert.rejects(() => materializeCommand(["hit:1"], env), /--input/);
  await assert.rejects(() => materializeCommand(["hit:1", "--input"], env), /--input/);
});

test("release audit: research and review require stable ids plus input files", async () => {
  await assert.rejects(() => researchCommand([], env), /opportunity id/);
  await assert.rejects(() => researchCommand(["opp:1"], env), /--input/);
  await assert.rejects(() => reviewCommand([], env), /application id/);
  await assert.rejects(() => reviewCommand(["app:1"], env), /--input/);
});

test("release audit: prepare never infers approval", async () => {
  await assert.rejects(() => prepareCommand([], env), /opportunity id/);
  await assert.rejects(() => prepareCommand(["opp:1"], env), /explicit --approve/);
  await assert.rejects(() => prepareCommand(["opp:1", "--approve"], env), /--input/);
});

test("release audit: outcome requires stable application id and an input file", async () => {
  await assert.rejects(() => outcomeCommand([], env), /application id/);
  await assert.rejects(() => outcomeCommand(["app:1"], env), /--input/);
  await assert.rejects(() => outcomeCommand(["app:1", "--input"], env), /--input/);
});
