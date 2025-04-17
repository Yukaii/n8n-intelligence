#!/bin/bash
# Upload all node JSON files in nodes/ to R2 using wrangler

set -e

BUCKET="n8n-nodes"
NODES_DIR="$(dirname "$0")/../nodes"

echo "Syncing $NODES_DIR to R2 bucket $BUCKET..."
rclone sync $NODES_DIR "r2:$BUCKET" --progress
echo "Sync complete."