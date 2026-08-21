#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-agent}"
HERMES_BIN="hermes"
PLUGIN_NAME="hermes-webui"
LEGACY_PLUGIN_NAME="hermes-ui"
REMOTE_PLUGIN_DIR="\$HOME/.hermes/plugins/$PLUGIN_NAME"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

npm ci
npm run build

mkdir -p "$STAGE_DIR/$PLUGIN_NAME/dashboard/dist"
cp deploy/plugin/plugin.yaml "$STAGE_DIR/$PLUGIN_NAME/plugin.yaml"
cp deploy/plugin/__init__.py "$STAGE_DIR/$PLUGIN_NAME/__init__.py"
cp deploy/plugin/manifest.json "$STAGE_DIR/$PLUGIN_NAME/dashboard/manifest.json"
cp deploy/plugin/loader.js "$STAGE_DIR/$PLUGIN_NAME/dashboard/loader.js"
cp -R dist/. "$STAGE_DIR/$PLUGIN_NAME/dashboard/dist/"

ssh "$TARGET" "mkdir -p \"$REMOTE_PLUGIN_DIR\""
rsync -az --delete "$STAGE_DIR/$PLUGIN_NAME/" "$TARGET:$REMOTE_PLUGIN_DIR/"

ssh "$TARGET" "'$HERMES_BIN' plugins remove '$LEGACY_PLUGIN_NAME' >/dev/null 2>&1 || true; '$HERMES_BIN' plugins enable --no-allow-tool-override '$PLUGIN_NAME'; XDG_RUNTIME_DIR=/run/user/\$(id -u) systemctl --user restart hermes-dashboard.service"

echo "Hermes Web UI deployed at /webui."
