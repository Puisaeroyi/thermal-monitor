#!/usr/bin/env bash
# Install cron job for RTSP temperature collector
# Usage: bash scripts/install-cron.sh [API_URL]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${1:-http://localhost:3000/api/temperature-readings}"
CAMERAS_CONFIG="${SCRIPT_DIR}/data/cameras-config.json"
LOG_FILE="/var/log/thermal-collector.log"
PYTHON_SCRIPT="${SCRIPT_DIR}/rtsp_metadata_temp_collector.py"

if [ ! -f "$CAMERAS_CONFIG" ]; then
  echo "ERROR: Camera config not found at $CAMERAS_CONFIG"
  exit 1
fi

if [ ! -f "$PYTHON_SCRIPT" ]; then
  echo "ERROR: Collector script not found at $PYTHON_SCRIPT"
  exit 1
fi

# Build cron entry
CRON_ENTRY="* * * * * cd ${SCRIPT_DIR} && python3 ${PYTHON_SCRIPT} --cameras ${CAMERAS_CONFIG} --workers 8 --once --api-url ${API_URL} >> ${LOG_FILE} 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -qF "rtsp_metadata_temp_collector.py"; then
  echo "Cron job already exists. Removing old entry..."
  crontab -l 2>/dev/null | grep -vF "rtsp_metadata_temp_collector.py" | crontab -
fi

# Install new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "Cron job installed successfully."
echo "Entry: $CRON_ENTRY"
echo "Log file: $LOG_FILE"

# Create log file if it doesn't exist
touch "$LOG_FILE"
echo "Done."
