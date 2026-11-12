#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
QMK_DIR="${1:-$ROOT/vial-qmk}"
export PATH="$ROOT/toolchain/xpack-windows-build-tools-4.4.1-3/bin:$ROOT/toolchain/shim:$ROOT/toolchain/uv/venv/Scripts:$ROOT/toolchain/xpack-arm-none-eabi-gcc-13.3.1-1.1/bin:$PATH"
if [ -d '/c/Program Files/Git/usr/bin' ]; then
    export PATH="$PATH:/c/Program Files/Git/usr/bin"
elif [ -d 'C:/Program Files/Git/usr/bin' ]; then
    export PATH="$PATH:C:/Program Files/Git/usr/bin"
fi
QMK_DIR="$(CDPATH= cd -- "$QMK_DIR" && pwd)"
export QMK_HOME="$QMK_DIR"
mkdir -p "$QMK_DIR/keyboards/m57_bcorne"
cp -R "$ROOT/m57_bcorne/." "$QMK_DIR/keyboards/m57_bcorne/"
cp "$ROOT/ld/QF_STM32F401.ld" "$QMK_DIR/platforms/chibios/boards/common/ld/"
cd "$QMK_DIR"
qmk compile -kb m57_bcorne -km trainer
mkdir -p "$ROOT/firmware"
cp .build/m57_bcorne_trainer.uf2 "$ROOT/firmware/m57_bcorne_trainer.uf2"
