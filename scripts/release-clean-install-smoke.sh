#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
TARBALL="$(npm pack --silent | tail -n 1)"
SMOKE_DIR="$(mktemp -d)"
trap 'rm -rf "$SMOKE_DIR" "$ROOT/$TARBALL"' EXIT

cd "$SMOKE_DIR"
npm init -y >/dev/null 2>&1
npm install "$ROOT/$TARBALL" >/dev/null 2>&1

export JOBLENS_WORKSPACE="$SMOKE_DIR/private-workspace"
export JOBLENS_WORKSPACE_ID="release-smoke"
PACKAGE_ROOT="$SMOKE_DIR/node_modules/joblens"

./node_modules/.bin/joblens --help | grep -q "JobLens"
./node_modules/.bin/joblens setup --profile "$PACKAGE_ROOT/workspace-template/profile/candidate.example.json" >/dev/null
test -f "$JOBLENS_WORKSPACE/profile/candidate-profile.json"
node -e 'const p=require(process.env.JOBLENS_WORKSPACE+"/profile/candidate-profile.json"); if(p.profileId!=="candidate-example") process.exit(1)'

node "$ROOT/scripts/mcp-installed-smoke.mjs" "$SMOKE_DIR/node_modules/.bin/joblens-mcp" "$JOBLENS_WORKSPACE"

echo "release clean-install smoke: PASS"
