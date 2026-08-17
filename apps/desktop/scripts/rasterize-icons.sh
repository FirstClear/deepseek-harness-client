#!/bin/bash
# Rasterize apps/desktop/build/icon.svg into png / icns / ico.
# Requires: rsvg-convert, sips, iconutil, Python with Pillow.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build"
SVG="$BUILD/icon.svg"
PNG="$BUILD/icon.png"
ICONSET="$BUILD/icon.iconset"

rsvg-convert -w 1024 -h 1024 "$SVG" -o "$PNG"
python3 - <<PY
from PIL import Image
im = Image.open("$PNG")
if im.mode != "RGBA":
    raise SystemExit(f"icon.png must be RGBA with transparent corners, got {im.mode}")
# Corners of a full-bleed square would be opaque; the squircle must punch them out.
if im.getpixel((0, 0))[3] != 0:
    raise SystemExit("icon.png corner is not transparent; the macOS Dock will draw a square")
im.save("$BUILD/icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icon.png", im.mode, im.size)
PY

rm -rf "$ICONSET"
mkdir "$ICONSET"
for spec in 16:16x16 32:16x16@2x 32:32x32 64:32x32@2x 128:128x128 256:128x128@2x 256:256x256 512:256x256@2x 512:512x512 1024:512x512@2x; do
  size="${spec%%:*}"
  name="${spec#*:}"
  sips -z "$size" "$size" "$PNG" --out "$ICONSET/icon_${name}.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$BUILD/icon.icns"
rm -rf "$ICONSET"
echo "wrote $BUILD/icon.{png,icns,ico}"
