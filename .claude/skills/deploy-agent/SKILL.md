---
name: deploy-agent
description: Build hermes-webui and deploy it to the remote Hermes dashboard agent host. Use when the user asks to deploy, ship, or push this app to the agent/dashboard.
disable-model-invocation: true
---

Run `npm run deploy:agent`, which invokes `scripts/deploy-plugin.sh agent`. This:

1. Runs `npm ci && npm run build` locally.
2. Stages `deploy/plugin/plugin.yaml`, `deploy/plugin/manifest.json`, `deploy/plugin/loader.js`, and the built `dist/` into a temp dir.
3. `rsync`s that temp dir to `agent:/home/agent/.hermes/plugins/hermes-webui/` over SSH.
4. Over the same SSH connection: removes the legacy `hermes-ui` plugin, enables `hermes-webui` via `hermes plugins enable --no-allow-tool-override`, and restarts the `hermes-dashboard.service` user systemd unit.

## Prerequisites

- SSH host alias `agent` must be configured in `~/.ssh/config`, resolving to a Linux box running the Hermes agent as user `agent`.
- The remote host needs `hermes` at `/home/agent/.hermes/hermes-agent/venv/bin/hermes` and a user-level systemd service `hermes-dashboard.service`.

If the `agent` SSH alias isn't configured or unreachable, the deploy will fail at the rsync step — check `ssh agent true` first if deploy fails unexpectedly.

## After deploying

The dashboard's `/webui` tab loads `deploy/plugin/loader.js`, a vanilla-JS stub that redirects to the freshly built app at `/dashboard-plugins/hermes-webui/dist/index.html?v=<timestamp>`, so the app runs as a top-level document (same origin as the dashboard) rather than embedded in its shell.
