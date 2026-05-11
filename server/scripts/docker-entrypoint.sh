#!/bin/bash
set -e

# Start hermes dashboard plugin in the background.
# NOTE: --insecure is required because the dashboard refuses 0.0.0.0 by default.
# In this Docker container the network is isolated (e2e-only).
echo "[entrypoint] starting hermes dashboard on :9119"
hermes dashboard --port 9119 --host 0.0.0.0 --insecure &
HERMES_PID=$!

# Clean up dashboard on exit
trap 'echo "[entrypoint] shutting down dashboard (pid $HERMES_PID)"; kill $HERMES_PID 2>/dev/null || true' EXIT

# Wait for the dashboard API to be reachable
for i in $(seq 1 30); do
  if curl -fsSL http://127.0.0.1:9119 >/dev/null 2>&1; then
    echo "[entrypoint] hermes dashboard ready at :9119"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "[entrypoint] WARNING: hermes dashboard did not become ready in time; MCP will use CLI fallback"
  fi
  sleep 1
done

# Ensure the E2E test board exists
hermes kanban boards create e2e-test 2>/dev/null || true

# Start the MCP server (runs in foreground)
echo "[entrypoint] starting hermes-board-mcp on :7332"
exec node dist/src/cli.js start
