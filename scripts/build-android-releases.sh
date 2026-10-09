#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

build_app() {
  local app="$1"
  local dir="$ROOT_DIR/android/$app"

  echo
  echo "=========================================="
  echo " Building Android release: $app"
  echo "=========================================="

  if [[ ! -f "$dir/twa-manifest.json" ]]; then
    echo "Missing $dir/twa-manifest.json"
    echo "Initialize the TWA first."
    exit 1
  fi

  cd "$dir"

  bubblewrap doctor

  bubblewrap build

  mkdir -p "$ROOT_DIR/releases/android/$app"

  if [[ -f app-release-signed.apk ]]; then
    cp app-release-signed.apk \
      "$ROOT_DIR/releases/android/$app/${app}-release.apk"
  fi

  if [[ -f app-release-bundle.aab ]]; then
    cp app-release-bundle.aab \
      "$ROOT_DIR/releases/android/$app/${app}-release.aab"
  fi

  echo
  echo "Artifacts:"
  ls -lh "$ROOT_DIR/releases/android/$app"
}

mkdir -p "$ROOT_DIR/releases/android"

build_app extractor
build_app admin

echo
echo "=========================================="
echo " Android release builds complete"
echo "=========================================="
echo
echo "Releases:"
find "$ROOT_DIR/releases/android" \
  -maxdepth 2 \
  -type f \
  -print