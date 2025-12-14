#!/bin/bash
# Download Piper voice models for AI Speaking feature
# Usage: ./scripts/setup-piper-voices.sh

set -euo pipefail

VOICES_DIR="${PIPER_MODEL_DIR:-./piper/models}"
BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"

echo "Creating voice models directory: $VOICES_DIR"
mkdir -p "$VOICES_DIR"

# Voice models with speaker IDs
declare -A VOICES=(
  ["en_US-amy-medium"]="0"
  ["en_US-john-medium"]="0"
  ["en_US-lessac-medium"]="0"
  ["en_GB-alan-medium"]="0"
  ["en_GB-jon-medium"]="0"
  ["en_AU-karla-medium"]="0"
  ["en_US-libritts-medium"]="0,142,508,721"
)

download_voice() {
  local voice=$1

  # Parse voice name: en_US-amy-medium -> en/en_US/amy/medium
  local lang_full=$(echo "$voice" | cut -d'-' -f1)      # en_US
  local lang_short=$(echo "$lang_full" | cut -d'_' -f1)  # en
  local speaker=$(echo "$voice" | cut -d'-' -f2)         # amy
  local quality=$(echo "$voice" | cut -d'-' -f3)         # medium

  # Correct HuggingFace URL structure
  local url_prefix="${BASE_URL}/${lang_short}/${lang_full}/${speaker}/${quality}"

  echo "Downloading $voice..."
  echo "  URL: $url_prefix/${voice}.onnx"

  # Download ONNX model with verbose progress
  wget --progress=bar:force:noscroll \
    --timeout=120 \
    --tries=3 \
    --retry-connrefused \
    "${url_prefix}/${voice}.onnx" \
    -O "${VOICES_DIR}/${voice}.onnx" 2>&1 || {
      echo "❌ Failed to download ${voice}.onnx"
      return 1
    }

  # Download JSON config
  wget --progress=bar:force:noscroll \
    --timeout=30 \
    --tries=3 \
    "${url_prefix}/${voice}.onnx.json" \
    -O "${VOICES_DIR}/${voice}.onnx.json" 2>&1 || {
      echo "❌ Failed to download ${voice}.onnx.json"
      return 1
    }

  echo "✓ $voice downloaded successfully"
}

# Download all voices
for voice in "${!VOICES[@]}"; do
  if [[ -f "${VOICES_DIR}/${voice}.onnx" ]]; then
    echo "⊙ $voice already exists, skipping..."
  else
    download_voice "$voice"
  fi
done

# Verify downloads
echo ""
echo "Verification:"
ls -lh "$VOICES_DIR"

# Calculate total size
total_size=$(du -sh "$VOICES_DIR" | cut -f1)
echo ""
echo "Total models size: $total_size"
echo "Voice models ready for Piper TTS!"
