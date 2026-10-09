#!/usr/bin/env bash

set -euo pipefail

APP="${1:-}"
URL="${2:-}"

if [[ "$APP" != "extractor" && "$APP" != "admin" ]]; then
  echo "Usage:"
  echo "  ./scripts/setup-android-twa.sh extractor https://your-extractor-domain.example"
  echo "  ./scripts/setup-android-twa.sh admin https://your-admin-domain.example"
  exit 1
fi

if [[ -z "$URL" ]]; then
  echo "Error: HTTPS application URL is required."
  exit 1
fi

if [[ "$URL" != https://* ]]; then
  echo "Error: Android production apps must use an HTTPS origin."
  exit 1
fi

case "$APP" in
  extractor)
    MANIFEST_URL="${URL%/}/manifest.webmanifest"
    OUTPUT_DIR="android/extractor"
    ;;
  admin)
    MANIFEST_URL="${URL%/}/manifest.webmanifest"
    OUTPUT_DIR="android/admin"
    ;;
esac

echo
echo "=========================================="
echo " Data Extractor Android TWA Setup"
echo "=========================================="
echo
echo "Application : $APP"
echo "PWA URL     : $URL"
echo "Manifest    : $MANIFEST_URL"
echo "Output      : $OUTPUT_DIR"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required."
  exit 1
fi

if ! command -v bubblewrap >/dev/null 2>&1; then
  echo "Bubblewrap is not installed."
  echo
  echo "Install it with:"
  echo
  echo "  npm install --global @bubblewrap/cli"
  echo
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

if [[ -f "$OUTPUT_DIR/twa-manifest.json" ]]; then
  echo "Existing Bubblewrap project detected."
  echo "Use:"
  echo "  bubblewrap update --manifest=\"$OUTPUT_DIR/twa-manifest.json\""
  exit 0
fi

echo "Initializing Bubblewrap project..."

bubblewrap init \
  --manifest="$MANIFEST_URL" \
  --directory="$OUTPUT_DIR"

echo
echo "Android TWA project created successfully."
echo
echo "Next:"
echo "  cd $OUTPUT_DIR"
echo "  bubblewrap doctor"
echo "  bubblewrap validate --url=\"$URL\""
echo