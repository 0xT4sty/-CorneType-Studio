# CorneType Studio

Aplicación web en español para el teclado dividido BCORNE M57. Incluye práctica de escritura, cinco minijuegos, exploración de capas, edición e importación de keymaps, métricas y diagnóstico de matriz.

| Ruta | Contenido |
| --- | --- |
| [`src/`](src/) | Aplicación React y cliente WebHID. |
| [`BCORNE/m57_bcorne/`](BCORNE/m57_bcorne/) | Fuentes del firmware Vial-QMK y variantes de keymap. |
| [`BCORNE/config/`](BCORNE/config/) | Perfiles Vial de Español (España) y sin capa de ratón. |
| [`recursos_frontal/`](recursos_frontal/) | Brief, plantillas de referencia Terra e informe de diagnóstico de ejemplo. |

## Ejecutar en local

Usa Node.js 24, la versión de la integración continua.

```sh
npm ci
npm run dev
```

Abre [http://127.0.0.1:5173](http://127.0.0.1:5173). Para servir una compilación estática, ejecuta `npm run build` y publica el contenido de `dist/`. El perfil, las sesiones y los récords se guardan en el navegador por origen. Puedes exportar el perfil desde **Configurador** y el historial desde **Métricas**.

## Perfiles y hardware

- **Studio 4×6** reproduce el diseño del PRD, con 56 teclas y dos diales EC11. Puedes practicar y probar los minijuegos con el teclado del navegador.
- **M57** usa las posiciones de `BCORNE/m57_bcorne/keyboard.json`, incluidas las pulsaciones de ambos diales. Para recibir la matriz y las capas activas por WebHID, usa Chrome o Edge de escritorio en localhost o HTTPS y conecta el M57 con el firmware Trainer.
- **Cargar keymap** admite perfiles Vial del M57, JSON QMK/VIA con geometría compatible y ZMK con capas de bindings explícitos. Para que la vista coincida con el dispositivo, importa el mismo `.vil` que tienes cargado en Vial.
- **Configurador** exporta un perfil de Studio con las asignaciones, los combos y la calibración. Para perfiles de origen Vial, **Exportar Vial** guarda las asignaciones y los diales en un `.vil` que puedes cargar con **File > Load saved layout**.

El firmware Trainer envía reportes de 32 bytes con eventos posteriores al debounce. El diagnóstico en vivo usa los tiempos de recepción del navegador. El escaneo crudo a 1 kHz, la lectura de fases A/B y el flasheo directo requieren un protocolo de firmware adicional. **Simular diagnóstico** reproduce los intervalos del ejemplo incluido en `recursos_frontal/`.

## Compilar el firmware

Usa un entorno con QMK CLI y una copia externa de Vial-QMK. Los scripts instalan la definición del M57 y su script de enlazado en esa copia antes de compilar. [Vial-QMK](https://github.com/vial-kb/vial-qmk)

```sh
sh BCORNE/build-trainer.sh /ruta/a/vial-qmk
sh BCORNE/build.sh /ruta/a/vial-qmk
```

El primer comando genera `BCORNE/firmware/m57_bcorne_trainer.uf2` para la telemetría WebHID. El segundo genera `BCORNE/firmware/m57_bcorne_layerColors.uf2`. Los `.uf2` son resultados locales de compilación.

## Comprobar

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions ejecuta estas comprobaciones al enviar cambios a `main` y al abrir una pull request.

## Licencias

El firmware conserva los avisos de sus archivos y el texto de la GPL en [`BCORNE/LICENSE`](BCORNE/LICENSE). El script de enlazado de ChibiOS conserva Apache 2.0. [Licencia del script de enlazado](BCORNE/ld/LICENSE)

La aplicación web y las referencias de diseño quedan pendientes de una licencia explícita de reutilización.
