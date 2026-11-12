#!/bin/sh
# Requires a configured QMK environment and an external Vial-QMK checkout.
# Usage: ./build.sh /path/to/vial-qmk (or set QMK_HOME).
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
QMK_DIR="${1:-${QMK_HOME:-}}"

# Keep the original local environment usable until cleanup is executed.
if [ -z "$QMK_DIR" ] && [ -d "$ROOT/vial-qmk" ]; then
    QMK_DIR="$ROOT/vial-qmk"
fi
if [ -d "$ROOT/toolchain" ]; then
    export PATH="$ROOT/toolchain/shim:$ROOT/toolchain/uv/venv/Scripts:$ROOT/toolchain/xpack-arm-none-eabi-gcc-13.3.1-1.1/bin:$PATH"
fi

if [ -z "$QMK_DIR" ] || [ ! -d "$QMK_DIR/quantum" ] || [ ! -d "$QMK_DIR/keyboards" ]; then
    echo 'Usage: ./build.sh /path/to/vial-qmk' >&2
    echo 'A configured QMK environment and Vial-QMK checkout are required.' >&2
    exit 1
fi

if ! command -v qmk >/dev/null 2>&1; then
    echo 'QMK CLI is missing from PATH. Run from your configured QMK environment.' >&2
    exit 1
fi

QMK_DIR="$(CDPATH= cd -- "$QMK_DIR" && pwd)"
export QMK_HOME="$QMK_DIR"

mkdir -p "$QMK_DIR/keyboards/m57_bcorne"
cp -R "$ROOT/m57_bcorne/." "$QMK_DIR/keyboards/m57_bcorne/"
cp "$ROOT/ld/QF_STM32F401.ld" "$QMK_DIR/platforms/chibios/boards/common/ld/"

cd "$QMK_DIR"
qmk compile -kb m57_bcorne -km layerColors
mkdir -p "$ROOT/firmware"
cp .build/m57_bcorne_layerColors.uf2 "$ROOT/firmware/m57_bcorne_layerColors.uf2"
echo "Firmware ready: $ROOT/firmware/m57_bcorne_layerColors.uf2"
