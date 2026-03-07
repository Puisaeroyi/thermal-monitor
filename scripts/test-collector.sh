#!/usr/bin/env bash
# Test the RTSP temperature collector with a single camera
# Usage: bash scripts/test-collector.sh [CAMERAS_CONFIG]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CAMERAS_CONFIG="${1:-${SCRIPT_DIR}/data/cameras-config.json}"
API_URL="${2:-http://localhost:3000/api/temperature-readings}"

echo "=== Thermal Collector Test ==="
echo "Config: $CAMERAS_CONFIG"
echo "API URL: $API_URL"
echo ""

if [ ! -f "$CAMERAS_CONFIG" ]; then
  echo "ERROR: Camera config not found at $CAMERAS_CONFIG"
  exit 1
fi

echo "--- Running single collection cycle ---"
python3 "${SCRIPT_DIR}/rtsp_metadata_temp_collector.py" \
  --cameras "$CAMERAS_CONFIG" \
  --workers 4 \
  --once \
  --api-url "$API_URL"

echo ""
echo "--- Test complete ---"
