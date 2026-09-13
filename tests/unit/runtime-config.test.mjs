import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeConfig } from "../../dist/config/runtime-config.js";

test("runtime config keeps secrets out unless explicitly supplied through input/env", () => {
  const config = resolveRuntimeConfig({}, {});
  assert.equal(config.workspaceDir, ".joblens");
  assert.equal(config.sourceTimeoutMs, 10_000);
  assert.equal(config.sources.saramin.enabled, false);
  assert.equal("accessKey" in config.sources.saramin, false);
});

test("Saramin is enabled automatically when an access key is configured", () => {
  const config = resolveRuntimeConfig({}, { SARAMIN_ACCESS_KEY: "  test-key  " });
  assert.equal(config.sources.saramin.enabled, true);
  assert.equal(config.sources.saramin.accessKey, "test-key");
});
