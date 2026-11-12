# BCORNE

El firmware y la configuración del teclado BCORNE M57 están en `BCORNE/`. Todas las rutas de esta guía parten de la raíz del proyecto.

## Firmware y configuración del teclado

| Ruta | Contenido |
| --- | --- |
| `BCORNE/firmware/` | Directorio de salida local de los binarios `.uf2` para flashear. |
| `BCORNE/m57_bcorne/` | Fuentes del firmware Vial-QMK. La definición del teclado está en `keyboard.json`, la configuración común en `config.h` y cada variante en `keymaps/<variante>/`. |
| `BCORNE/ld/QF_STM32F401.ld` | Script de enlazado del firmware para el bootloader del M57. |
| `BCORNE/config/bcorne-es-espana.vil` | Perfil de Vial con la distribución Español (España). |
| `BCORNE/config/bcorne-sin-raton.vil` | Perfil de Vial con la capa de ratón desactivada. |

Para cargar un perfil `.vil`, usa **File > Load saved layout** en Vial. Los cambios en `BCORNE/m57_bcorne/` se incorporan al firmware al recompilar el keymap correspondiente.

## Compilación

Ejecuta los scripts desde la raíz del proyecto en un entorno QMK configurado. Pasa la ruta a una copia externa de Vial-QMK.

```sh
sh BCORNE/build.sh /ruta/a/vial-qmk
sh BCORNE/build-trainer.sh /ruta/a/vial-qmk
```

El primer script compila `layerColors` y actualiza `BCORNE/firmware/m57_bcorne_layerColors.uf2`. El segundo compila `trainer` y actualiza `BCORNE/firmware/m57_bcorne_trainer.uf2`.

<!-- CODEX-DESIGN-HARNESS START -->
## Codex Design Harness - React
For React frontend work, use the frontend-design skill when available.
Before implementing significant UI changes, define the visual direction and reuse existing design tokens and components.
Prefer accessible, responsive, coherent interfaces. Preserve project architecture and functionality.
Run available lint, type checks, and tests. For significant visual changes, launch the app, inspect it with Playwright CLI at desktop (1440x900) and mobile (390x844), capture screenshots, fix visual defects, and verify again.
Never claim visual verification unless the rendered app was inspected. Do not modify unrelated files.
<!-- CODEX-DESIGN-HARNESS END -->
