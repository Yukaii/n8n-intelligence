#!/bin/bash
# Upload all node JSON files in nodes/ to R2 using either rclone or wrangler CLI

set -e

BUCKET="n8n-nodes"
NODES_DIR="$(dirname "$0")/../nodes"

usage() {
  echo "Usage: $0 [rclone|wrangler]"
  echo "  rclone   - Sync all files using rclone"
  echo "  wrangler - Upload each JSON file using wrangler r2 object put"
  exit 1
}

if [ $# -ne 1 ]; then
  usage
fi

METHOD="$1"

if [ "$METHOD" = "rclone" ]; then
  echo "Syncing $NODES_DIR to R2 bucket $BUCKET using rclone..."
  rclone sync "$NODES_DIR" "r2:$BUCKET" --progress
  echo "Sync complete."
elif [ "$METHOD" = "wrangler" ]; then
  echo "Uploading JSON files from $NODES_DIR to R2 bucket $BUCKET using wrangler..."
  for file in "$NODES_DIR"/*.json; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      echo "Uploading $filename..."
      wrangler r2 object put "$BUCKET/$filename" --file "$file" --local
    fi
  done
  echo "Upload complete."
else
  usage
fi
