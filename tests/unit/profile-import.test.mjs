import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseCandidateProfile, validateCandidateProfile } from "../../dist/profile/candidate-profile-file.js";
import { setupCommand } from "../../dist/cli/runtime.js";

function profile() {
  return {
    profileId: "candidate-1",
    version: "v1",
    updatedAt: "2026-09-14T00:00:00.000Z",
    targetRoles: ["TypeScript Backend Developer"],
    targetLevels: ["Entry", "Junior"],
    skills: [
      { name: "Node.js", evidenceIds: ["resume:backend"] },
      { name: "TypeScript", evidenceIds: ["resume:backend"] },
    ],
    experienceEvidence: [
      {
        experienceId: "project:example",
        title: "Backend project",
        summary: "Implemented authorization and transaction-backed REST APIs.",
        capabilities: ["api-design", "authorization", "transaction"],
        technologies: ["Node.js", "TypeScript", "PostgreSQL"],
        evidenceIds: ["portfolio:example", "pr:1"],
      },
    ],
    locations: ["Seoul"],
    mustHaves: [],
    dealBreakers: [],
    documentRefs: ["resume.pdf"],
  };
}

test("candidate profile validator rejects structurally invalid input", () => {
  const errors = validateCandidateProfile({ profileId: "candidate" });
  assert.equal(errors.length > 0, true);
  assert.throws(() => parseCandidateProfile({ profileId: "candidate" }), /invalid candidate profile/);
});

test("candidate profile validator rejects ungrounded or incomplete experience evidence", () => {
  const invalid = {
    ...profile(),
    experienceEvidence: [{
      experienceId: "project:bad",
      title: "Backend project",
      summary: "Missing evidence ids.",
      capabilities: ["api-design"],
      technologies: ["Node.js"],
      evidenceIds: [],
    }],
  };
  const errors = validateCandidateProfile(invalid);
  assert.equal(errors.some((error) => error.includes("experienceEvidence")), true);
});

test("setup imports a private candidate profile with structured experience and protects it from accidental overwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "joblens-profile-workspace-"));
  const sourceDir = await mkdtemp(join(tmpdir(), "joblens-profile-source-"));
  const sourcePath = join(sourceDir, "candidate.json");
  await writeFile(sourcePath, JSON.stringify(profile()), "utf8");

  try {
    const env = { JOBLENS_WORKSPACE: root };
    const output = await setupCommand(["--profile", sourcePath], env);
    assert.match(output, /profile imported/);

    const stored = JSON.parse(await readFile(join(root, "profile", "candidate-profile.json"), "utf8"));
    assert.equal(stored.profileId, "candidate-1");
    assert.deepEqual(stored.locations, ["Seoul"]);
    assert.equal(stored.experienceEvidence[0].experienceId, "project:example");

    await assert.rejects(
      () => setupCommand(["--profile", sourcePath], env),
      /already exists/,
    );

    const replacement = { ...profile(), version: "v2" };
    await writeFile(sourcePath, JSON.stringify(replacement), "utf8");
    const replaced = await setupCommand(["--profile", sourcePath, "--replace"], env);
    assert.match(replaced, /profile version: v2/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(sourceDir, { recursive: true, force: true });
  }
});
