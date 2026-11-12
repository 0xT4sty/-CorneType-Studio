# Project Requirements Document (PRD) & Technical Brief: CorneType

**Project ID:** PRD-CORNETYPE-2025-V2  
**Product Name:** CorneType Studio  
**Target Hardware:** bCorne Split Ergonomic Keyboard (Columnar Stagger 4x6+4, 56 Keys + 2x EC11 Rotary Encoders)  
**Status:** Approved / Active Architecture  
**Author & Lead Architect:** Stitch Design Assistant  
**Design System:** Terra ("Rooted Warmth", Light Mode, Olive/Sage `#4A7C59`, Nunito Sans)  

---

## 1. Executive Summary & Vision

**CorneType** is a specialized, web-based biomechanical training suite, real-time matrix debugger, and hardware-interactive firmware configurator built for low-profile split columnar ergonomic keyboards—specifically customized for the **bCorne 56-key (matriz física 4x6 + clúster de pulgar con dual EC11 rotary dials)** powered by ZMK/QMK and WebHID/WebUSB protocols.

Unlike traditional touch-typing platforms (Monkeytype, Keybr) or generic configurators (VIA, Vial, ZMK Studio), CorneType merges **neuromuscular motor training** (handling columnar stagger, number/function row integration, thumb-cluster workload, and home-row mods) with **deep hardware telemetry** (millisecond-accurate matrix chatter diagnosis, encoder phase health, and layer oscillation analytics).

---

## 2. Core User Personas & Problem Statement

### 2.1 Personas
1. **The Ergonomic Transitioner:** Programmers, writers, and power users moving from staggered ANSI/ISO keyboards to columnar split keyboards (specifically 4x6 layouts with dedicated number/symbol rows) who require layer practice and muscle memory training.
2. **The Hardware Tinkerer / Builder:** Keyboard enthusiasts who handwire or build custom nice!nano split keyboards requiring granular testing of TRRS continuity, cold solder joints, contact bounce (chattering), and rotary encoder calibration across all 4 rows.
3. **The Firmware Power User:** Developers leveraging advanced ZMK/QMK features (Home-Row Mods, Permissive Hold, Tap-Dance, Combo triggers, and multi-state encoder macros).

### 2.2 Key Pain Points
- Adaptation to the 4-row columnar layout (Row 0: Numbers/Media, Row 1: QWERTY/Colemak Top, Row 2: Home Row, Row 3: Bottom Alpha/Mods).
- High cognitive load during layer navigation (Lower, Raise, Nav/Vim, Adjust).
- Unnoticed mechanical chatter in low-profile switches (Kailh Choc v1/v2) causing spurious double-taps.
- Disconnect between typing practice metrics (WPM/Acc) and biomechanical load (ulnar deviation, thumb cluster strain, 4-row vertical stretch).

---

## 3. Product Architecture & Navigation Structure

CorneType is deployed as a single unified web platform sharing a persistent top navigation bar and global status telemetry:

| Module / Screen | Screen ID | Core Functionality | Primary Tech Stack |
| :--- | :--- | :--- | :--- |
| **Práctica de Escritura** | `SCREEN_15` | Ergonomic typing engine with live 4x6 columnar feedback, home-row mod detection, and thumb strain indicator. | Web Audio API, WebHID, DOM Engine |
| **Arena de Minijuegos** | `SCREEN_7` | Biomechanical reflex games: *Symbol Rain* (layer fluency) & *Vim Sprint* (HJKL navigation precision). | Canvas 2D / CSS Animations, Micro-benchmarks |
| **Explorador de Capas** | `SCREEN_13` | Interactive visualizer for L0 (Base), L1 (Lower), L2 (Raise), L3 (Nav/Vim), and L4 (Adjust). | Responsive SVG Matrix, Layer Mapping Engine |
| **Configurador de Teclas** | `SCREEN_5` | Visual 4x6 key remapper, Mod-Tap/Tap-Dance tuner, tapping term calibrator, and EEPROM flasher. | WebHID API, ZMK Keymap Parser/Generator |
| **Cargar Keymap** | `SCREEN_11` | Source code viewer/editor supporting `.keymap` (ZMK), `.json` (VIA/QMK), and direct syntax validation. | Monaco/CodeMirror engine, AST Linter |
| **Métricas & Ergo Stats** | `SCREEN_9` | Ulnar fatigue index, finger distribution heatmaps, layer switch frequency, and vertical row reach. | SVG Vector Charts, Telemetry Analytics |
| **Key Tester & Debugger** | `SCREEN_3` | High-frequency 1,000 Hz matrix scanner (4 rows × 6 cols per half), chatter analyzer, encoder quadrature diagnosis, and JSON report generator. | WebHID Raw 64B Protocol, Event Buffer |

---

## 4. Hardware Specifications & Matrix Configuration

- **Keyboard Architecture:** Split Ergonomic Columnar Stagger.
- **Physical Matrix Layout:** **4 Rows × 6 Columns per half** (distribución 4x6):
  - **4 rows × 6 columns per half:**
    - Fila 0 (R0): Fila numérica / funciones (`1-6` / `7-0, Backspace/Del`).
    - Fila 1 (R1): Fila superior alfanumérica (`Q-T` / `Y-P`).
    - Fila 2 (R2): Fila base / Home row (`A-G` / `H-Enter` con *Home-Row Mods*).
    - Fila 3 (R3): Fila inferior alfanumérica (`Z-B` / `N-Slash/Mods`).
    - *Total por mano:* 24 teclas en matriz principal (4x6) + 4 teclas dedicadas de pulgar = 28 teclas por lado.
    - *Total ambas mitades:* 56 mechanical switch positions.
  - **Diales rotatorios:** 2x EC11 Rotary Encoders con push button (Left Master: Zoom/Volume, Right Slave: Vertical Scroll/Mute).
- **Controllers:** Dual nice!nano v2 (Nordic Semiconductor nRF52840 SoC) with BLE 5.0 and TRRS 3.3V Half-Duplex bus.
- **Polling Rate:** 1,000 Hz (1.0 ms temporal resolution).
- **Default Debounce Algorithm:** Eager PR (Per-Row) baseline at 5.0 ms.

---

## 5. Functional Requirements & Key Features

### 5.1 Real-Time Diagnostics & Telemetry (Matrix Debugger)
- **FR-01 (1kHz WebHID Hook):** Read raw 64-byte HID input reports directly from the controller via browser WebHID across all 4 rows.
- **FR-02 (Chatter Detection Engine):** Flag switch contact releases occurring with bounce duration `< 5.0 ms` (configurable). Detect release chatter, hold chatter, and false secondary taps across R0–R3 and thumb clusters.
- **FR-03 (Quadrature Encoder Tracking):** Monitor Phase A / Phase B pulse timing on EC11 encoders to detect skipped detents and contact wear.
- **FR-04 (Diagnostic Export):** Real-time generation of structured telemetry reports (`.json`) containing root cause analysis and auto-generated ZMK firmware patch directives (`config/bcorne.conf`).

### 5.2 Interactive Remapping & Biomechanical Calibration (Keymap Studio)
- **FR-05 (Behavior Configuration):** Support for standard tap, Mod-Tap (`&mt`), Layer-Tap (`&lt`), Tap-Dance, and Combos across the 4x6 grid.
- **FR-06 (Tapping Term Tuner):** Biomechanical slider to adjust tap-preferred vs hold-preferred thresholds (100 ms to 300 ms, default optimal 175 ms).
- **FR-07 (Thumb Balance Auditor):** Real-time computation of workload balance across left vs. right thumb clusters (target range: 45% - 55% symmetry).

### 5.3 Neuromuscular Gamification & Biomechanical Training
- **FR-08 (Symbol Rain):** Falls targeting symbol and number keys (R0 and sub-layers L1/L2) requiring instantaneous modifier synchronization.
- **FR-09 (Vim Sprint):** Directional navigation challenges exclusively using the Vim cluster (HJKL) mapped across the navigation layer (L3).

---

## 6. Design System & UI/UX Standards

- **Theme Identity:** *Terra — Organic Design ("Rooted Warmth")*.
- **Palette Tokens:**
  - `primary`: `#4a7c59` (Deep Forest Olive)
  - `surface-light`: `#f7f8f5` (Warm Alabaster Stone)
  - `surface-card`: `#ffffff` with subtle olive border `#e2e8df`
  - `accent-amber`: `#d97736` (Debounce Warnings & Hold States)
  - `accent-coral`: `#c84c4c` (Chatter Critical Anomalies)
- **Typography:** `Nunito Sans` (High legibility, humanist sans-serif with rounded accents matching keycap curvature).
- **Layout Constraints:** Desktop viewport standard (1440px grid), sticky top-navigation bar, zero distraction split layout mirrors.

---

## 7. Delivery Milestones & Current Progress

- [x] **Milestone 1:** Suite IA, Design System (Terra), and Shell Navigation Standardization.
- [x] **Milestone 2:** Typing Practice (`SCREEN_15`) & Layer Explorer (`SCREEN_13`) generation.
- [x] **Milestone 3:** Biomechanical Minigames Arena (`SCREEN_7`) & Ergo Metrics Dashboard (`SCREEN_9`).
- [x] **Milestone 4:** Visual Keymap Studio (`SCREEN_5`) with Mod-Tap inspection.
- [x] **Milestone 5:** Key Tester & Real-Time Matrix Debugger (`SCREEN_3`) with 1 kHz WebHID simulation.
- [x] **Milestone 6:** Diagnostic JSON generator & chatter test protocol (`DOCUMENT_3`).
- [x] **Milestone 7:** Corrección de Matriz Física a **4x6 + 4 pulgares por mitad (56 teclas + 2 EC11)** en especificación y PRD.
- [ ] **Milestone 8 (Next Step):** Direct WebUSB WebHID flashing bridge implementation & community presets repository.
