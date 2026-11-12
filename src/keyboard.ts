import hardware from '../BCORNE/m57_bcorne/keyboard.json';
import spanishProfile from '../BCORNE/config/bcorne-es-espana.vil?raw';

export type Position = {
  id: string; half: 'left' | 'right'; row: number; col: number; x: number; y: number;
  thumb?: boolean; dial?: boolean; matrix?: readonly number[];
};
export type Layer = { name: string; keys: string[] };
export type Combo = { positions: string[]; action: string };
export type Profile = {
  name: string; geometry: 'studio' | 'm57'; locale: 'es-ES' | 'en-US'; layers: Layer[];
  tappingTerm: number; preference: 'balanced' | 'tap' | 'hold'; combos: Combo[];
  encoders?: string[][][]; vial?: Record<string, unknown>;
};

const leftStagger = [.30, .12, 0, .08, .21, .33];
const rightStagger = [...leftStagger].reverse();
export const studioPositions: Position[] = ['left', 'right'].flatMap(side => {
  const half = side as Position['half'];
  const left = half === 'left';
  const prefix = left ? 'l' : 'r';
  const stagger = left ? leftStagger : rightStagger;
  const main = Array.from({ length: 4 }, (_, row) => stagger.map((offset, col) => ({
    id: `${prefix}${row}.${col}`, half, row, col, x: col + (left ? 0 : 1), y: row + offset,
  }))).flat();
  const thumbs = Array.from({ length: 4 }, (_, col) => ({
    id: `${prefix}4.${col}`, half, row: 4, col,
    x: (left ? 2.9 : .25) + col * .94,
    y: 4.45 + (left ? col : 3 - col) * .13, thumb: true,
  }));
  return [...main, ...thumbs];
});

export const m57Positions: Position[] = hardware.layouts.LAYOUT.layout.map(({ matrix, x, y }) => {
  const [row, col] = matrix;
  const right = row >= 5;
  const physicalRow = row % 5;
  return {
    id: `${row}:${col}`, half: right ? 'right' : 'left', row: physicalRow, col,
    x: right ? x - 7 : x, y, matrix,
    thumb: physicalRow === 4 || (physicalRow === 1 || physicalRow === 2) && (right ? col === 0 : col === 6),
    dial: row === 3 && col === 6 || row === 8 && col === 0,
  };
});

export const positionsFor = (profile: Profile) => profile.geometry === 'm57' ? m57Positions : studioPositions;
export const layerNames = ['Base', 'Lower', 'Raise', 'Nav / Vim', 'Adjust'];
const m57LayerNames = ['Base', 'Símbolos', 'Números / F', 'Ajustes', 'Gaming', 'Ratón'];
const transparent = new Set(['KC_TRNS', 'KC_TRANSPARENT', '_______', '&trans']);
const disabled = new Set(['KC_NO', 'XXXXXXX', '&none']);
const kc = (codes: string) => codes.split(' ').map(code => `KC_${code}`);
const base = [
  ...kc('ESC 1 2 3 4 5 TAB Q W E R T CAPS A S D F G LSFT Z X C V B LCTL LALT'),
  'MO(1)', 'KC_SPC',
  ...kc('6 7 8 9 0 BSPC Y U I O P LBRC H J K L SCLN QUOT N M COMM DOT SLSH RSFT ENT'),
  'MO(2)', 'MO(3)', 'KC_RCTL',
];
const homeMods: Record<string, string> = {
  'l2.1': 'LGUI_T(KC_A)', 'l2.2': 'LALT_T(KC_S)', 'l2.3': 'LCTL_T(KC_D)', 'l2.4': 'LSFT_T(KC_F)',
  'r2.1': 'RSFT_T(KC_J)', 'r2.2': 'RCTL_T(KC_K)', 'r2.3': 'RALT_T(KC_L)', 'r2.4': 'RGUI_T(KC_SCLN)',
};
const overlays: Record<string, string>[] = [
  { 'l0.0': 'KC_GRV', 'l1.1': 'KC_EXLM', 'l1.2': 'KC_AT', 'l1.3': 'KC_HASH', 'l1.4': 'KC_DLR', 'l1.5': 'KC_PERC',
    'r1.0': 'KC_CIRC', 'r1.1': 'KC_AMPR', 'r1.2': 'KC_ASTR', 'r1.3': 'KC_LPRN', 'r1.4': 'KC_RPRN', 'r1.5': 'KC_RBRC',
    'l2.4': 'KC_LCBR', 'l2.5': 'KC_RCBR', 'r2.0': 'KC_MINS', 'r2.1': 'KC_EQL', 'r2.2': 'KC_PLUS',
    'r2.3': 'KC_UNDS', 'r2.4': 'KC_COLN', 'r2.5': 'KC_DQUO', 'r0.5': 'KC_DEL' },
  { ...Object.fromEntries(studioPositions.filter(p => p.row === 0).map((p, index) => [p.id, `KC_F${index + 1}`])),
    'r1.0': 'KC_P7', 'r1.1': 'KC_P8', 'r1.2': 'KC_P9', 'r2.0': 'KC_P4', 'r2.1': 'KC_P5', 'r2.2': 'KC_P6',
    'r3.0': 'KC_P1', 'r3.1': 'KC_P2', 'r3.2': 'KC_P3', 'r4.0': 'KC_P0' },
  { 'r2.0': 'KC_LEFT', 'r2.1': 'KC_DOWN', 'r2.2': 'KC_UP', 'r2.3': 'KC_RGHT', 'r1.0': 'KC_HOME', 'r1.3': 'KC_END',
    'r1.1': 'KC_PGDN', 'r1.2': 'KC_PGUP', 'l2.1': 'KC_LCTL', 'l2.2': 'KC_LGUI', 'l2.3': 'KC_LALT' },
  { 'l0.1': 'RGB_TOG', 'l0.2': 'RGB_MOD', 'l0.3': 'RGB_HUI', 'l0.4': 'RGB_VAI',
    'r0.1': 'KC_MPRV', 'r0.2': 'KC_MPLY', 'r0.3': 'KC_MNXT', 'r2.1': 'KC_VOLD', 'r2.2': 'KC_VOLU', 'r2.3': 'KC_MUTE' },
];

export const studioProfile: Profile = {
  name: 'QWERTY español', geometry: 'studio', locale: 'es-ES', tappingTerm: 175, preference: 'balanced', combos: [],
  layers: layerNames.map((name, index) => ({
    name, keys: studioPositions.map((position, key) => index === 0 ?
      homeMods[position.id] ?? base[key] : overlays[index - 1][position.id] ?? 'KC_TRNS'),
  })),
  encoders: [
    [['KC_VOLD', 'KC_VOLU'], ['KC_UP', 'KC_DOWN']],
    [['KC_LEFT', 'KC_RGHT'], ['KC_PGUP', 'KC_PGDN']],
    [['KC_MPRV', 'KC_MNXT'], ['KC_VOLD', 'KC_VOLU']],
    [['KC_LEFT', 'KC_RGHT'], ['KC_UP', 'KC_DOWN']],
    [['RGB_HUD', 'RGB_HUI'], ['KC_VOLD', 'KC_VOLU']],
  ],
};

const aliases: Record<string, string> = {
  ESCAPE: 'ESC', BSPACE: 'BSPC', BKSP: 'BSPC', SPACE: 'SPC', ENTER: 'ENT', RETURN: 'ENT',
  LSHIFT: 'LSFT', RSHIFT: 'RSFT', LCTRL: 'LCTL', RCTRL: 'RCTL', RIGHT: 'RGHT',
  SCOLON: 'SCLN', SEMICOLON: 'SCLN', QUOTE: 'QUOT', GRAVE: 'GRV', MINUS: 'MINS', EQUAL: 'EQL',
  LBRACKET: 'LBRC', RBRACKET: 'RBRC', BACKSLASH: 'BSLS', BSLASH: 'BSLS', COMMA: 'COMM', SLASH: 'SLSH',
  DELETE: 'DEL', PGDOWN: 'PGDN', CAPSLOCK: 'CAPS', VOLU: 'VOLU', VOLD: 'VOLD',
};
const glyphs: Record<string, string> = {
  ESC: 'Esc', BSPC: '⌫', TAB: 'Tab', SPC: 'Espacio', ENT: 'Enter', CAPS: 'Bloq', LSFT: 'Shift', RSFT: 'Shift',
  LCTL: 'Ctrl', RCTL: 'Ctrl', LALT: 'Alt', RALT: 'AltGr', LGUI: 'Super', RGUI: 'Super',
  SCLN: ';', QUOT: "'", LBRC: '[', RBRC: ']', MINS: '-', EQL: '=', COMM: ',', DOT: '.', SLSH: '/', GRV: '`', BSLS: '\\',
  LEFT: '←', RGHT: '→', UP: '↑', DOWN: '↓', HOME: 'Inicio', END: 'Fin', PGUP: 'RePág', PGDN: 'AvPág', DEL: 'Supr',
  EXLM: '!', AT: '@', HASH: '#', DLR: '$', PERC: '%', CIRC: '^', AMPR: '&', ASTR: '*', LPRN: '(', RPRN: ')',
  LCBR: '{', RCBR: '}', COLN: ':', DQUO: '"', PLUS: '+', UNDS: '_',
  MUTE: 'Silencio', VOLD: 'Vol −', VOLU: 'Vol +', MPLY: '⏯', MPRV: '⏮', MNXT: '⏭',
};
const spanishGlyphs: Record<string, string> = { SCLN: 'Ñ', QUOT: '´', LBRC: '`', RBRC: '+', MINS: "'", EQL: '¡', GRV: 'º', SLSH: '-', BSLS: 'Ç', NONUS_BSLASH: '<' };
const spanishModified: Record<string, string> = {
  'LSFT(KC_EQUAL)': '¿', 'LSFT(KC_MINUS)': '?', 'LSFT(KC_1)': '!', 'RALT(KC_2)': '@',
  'RALT(KC_3)': '#', 'RALT(KC_5)': '€', 'LSFT(KC_4)': '$', 'LSFT(KC_5)': '%', 'LSFT(KC_6)': '&',
  'LSFT(KC_2)': '"', 'LSFT(KC_COMMA)': ';', 'LSFT(KC_DOT)': ':', 'RALT(KC_1)': '|',
  'LSFT(KC_8)': '(', 'LSFT(KC_9)': ')', 'RALT(KC_LBRACKET)': '[', 'RALT(KC_RBRACKET)': ']',
  'RALT(KC_GRAVE)': '\\', 'RALT(KC_QUOTE)': '{', 'RALT(KC_NONUS_HASH)': '}', 'LSFT(KC_0)': '=',
  'LSFT(KC_7)': '/', 'LSFT(KC_RBRACKET)': '*', 'LSFT(KC_SLASH)': '_', 'LSFT(KC_NONUS_BSLASH)': '>',
};
const browserCodes: Record<string, string> = {
  ESC: 'Escape', BSPC: 'Backspace', ENT: 'Enter', SPC: 'Space', CAPS: 'CapsLock', TAB: 'Tab',
  LSFT: 'ShiftLeft', RSFT: 'ShiftRight', LALT: 'AltLeft', RALT: 'AltRight', LCTL: 'ControlLeft', RCTL: 'ControlRight',
  LGUI: 'MetaLeft', RGUI: 'MetaRight', LEFT: 'ArrowLeft', RGHT: 'ArrowRight', UP: 'ArrowUp', DOWN: 'ArrowDown',
  SCLN: 'Semicolon', QUOT: 'Quote', LBRC: 'BracketLeft', RBRC: 'BracketRight', SLSH: 'Slash', DOT: 'Period',
  COMM: 'Comma', GRV: 'Backquote', MINS: 'Minus', EQL: 'Equal', BSLS: 'Backslash', NONUS_BSLASH: 'IntlBackslash',
  DEL: 'Delete', HOME: 'Home', END: 'End', PGUP: 'PageUp', PGDN: 'PageDown',
};
const basicHidCodes = 'ENT ESC BSPC TAB SPC MINS EQL LBRC RBRC BSLS NONUS_HASH SCLN QUOT GRV COMM DOT SLSH CAPS'.split(' ');
const modifierHidCodes = ['LCTL', 'LSFT', 'LALT', 'LGUI', 'RCTL', 'RSFT', 'RALT', 'RGUI'];

export function tapCode(binding: string) {
  if (/^0x[0-9a-f]+$/i.test(binding)) {
    const value = Number(binding);
    if (value === 0) return 'KC_NO';
    if (value === 1) return 'KC_TRNS';
    if (value >= 4 && value <= 29) return 'KC_' + String.fromCharCode(65 + value - 4);
    if (value >= 30 && value <= 39) return 'KC_' + ((value - 29) % 10);
    if (value >= 40 && value <= 57) return 'KC_' + basicHidCodes[value - 40];
    if (value >= 58 && value <= 69) return 'KC_F' + (value - 57);
    if (value >= 224 && value <= 231) return 'KC_' + modifierHidCodes[value - 224];
  }
  const qmk = binding.match(/^(?:LT|MT)\([^,]+,\s*([^,)]+)\)$/) ?? binding.match(/^[A-Z][A-Z0-9_]*_T\(([^,)]+)\)$/);
  if (qmk) return qmk[1];
  if (/^&(?:kp|mt|lt)\s/.test(binding)) return `KC_${binding.split(/\s+/).at(-1)}`;
  return binding;
}

export function labelFor(binding: string, locale: Profile['locale']) {
  const tap = tapCode(binding);
  if (transparent.has(tap)) return '▽';
  if (disabled.has(tap)) return '—';
  const layer = binding.match(/^(?:MO|TG|TO|DF|TT|OSL)\((\d+)\)$/) ?? binding.match(/^&(?:mo|tog|to) (\d+)$/);
  if (layer) return `L${layer[1]}`;
  if (locale === 'es-ES' && spanishModified[binding]) return spanishModified[binding];
  const code = tap.replace(/^KC_/, '');
  const key = aliases[code] ?? code;
  return (locale === 'es-ES' ? spanishGlyphs[key] : undefined) ?? glyphs[key] ?? (key.match(/^P(\d)$/)?.[1]) ?? key;
}

export function resolvedBinding(profile: Profile, layer: number, index: number, mask = (1 << layer) | 1) {
  for (let level = profile.layers.length - 1; level >= 0; level--) {
    if (level > 0 && !(mask & (1 << level))) continue;
    const binding = profile.layers[level]?.keys[index];
    if (binding && !transparent.has(tapCode(binding))) return binding;
  }
  return 'KC_NO';
}

export function behaviorFor(binding: string) {
  if (/^(?:MT\(|\w+_T\(|&mt )/.test(binding)) return 'Mod-Tap';
  if (/^(?:LT\(|&lt )/.test(binding)) return 'Layer-Tap';
  if (/^(?:TD\(|&td\b)/.test(binding)) return 'Tap-Dance';
  if (/^(?:MO\(|TG\(|TO\(|DF\(|TT\(|OSL\(|&(?:mo|tog|to) )/.test(binding)) return 'Capa';
  if (transparent.has(tapCode(binding))) return 'Transparente';
  if (disabled.has(tapCode(binding))) return 'Desactivada';
  return 'Pulsación';
}

export function fingerFor(position: Position) {
  if (position.thumb || position.dial) return 'Pulgar';
  const offset = position.half === 'left' ? position.col : (position.matrix ? 6 : 5) - position.col;
  return ['Meñique', 'Meñique', 'Anular', 'Medio', 'Índice', 'Índice', 'Índice'][offset];
}

export function positionForEvent(profile: Profile, layer: number, event: { code: string; key: string }) {
  const positions = positionsFor(profile);
  const bindings = positions.map((_, index) => resolvedBinding(profile, layer, index));
  const index = bindings.findIndex(binding => {
    const code = tapCode(binding).replace(/^KC_/, '');
    const key = aliases[code] ?? code;
    const named = /^[A-Z]$/.test(key) ? `Key${key}` : /^\d$/.test(key) ? `Digit${key}` :
      /^P\d$/.test(key) ? `Numpad${key[1]}` : browserCodes[key] ?? key;
    return named === event.code;
  });
  if (index >= 0) return positions[index];
  if (event.key.length !== 1) return;
  return positions[bindings.findIndex(binding => labelFor(binding, profile.locale).toLowerCase() === event.key.toLowerCase())];
}

export function positionForTarget(profile: Profile, layer: number, target: string) {
  const lookup = target === ' ' ? 'espacio' : target.toLowerCase();
  const index = profile.layers[layer]?.keys.findIndex((_, i) =>
    labelFor(resolvedBinding(profile, layer, i), profile.locale).toLowerCase() === lookup) ?? -1;
  return positionsFor(profile)[index]?.id;
}

export function profileFromVil(data: Record<string, unknown>, name: string): Profile {
  const matrices = data.layout;
  if (!Array.isArray(matrices) || !matrices.length || matrices.length > 32) throw new Error('El archivo Vial debe contener de 1 a 32 capas.');
  if (data.version !== 1 || String(data.uid) !== '5010774632021243529') throw new Error('El perfil Vial debe corresponder al BCORNE M57.');
  const layers = matrices.map((matrix, index) => {
    if (!Array.isArray(matrix) || matrix.length !== 10 || matrix.some(row => !Array.isArray(row) || row.length !== 7 ||
      row.some(value => value !== -1 && (typeof value !== 'string' || !value.trim() || value.length > 128)))) {
      throw new Error(`La capa ${index} debe ser una matriz Vial de 10 × 7.`);
    }
    return {
      name: m57LayerNames[index] ?? `Capa ${index}`,
      keys: m57Positions.map(({ matrix: address }) => {
        const [row, col] = address!;
        return matrix[row][col] === -1 ? 'KC_NO' : matrix[row][col] as string;
      }),
    };
  });
  const encoders = data.encoder_layout;
  if (encoders !== undefined && (!Array.isArray(encoders) || encoders.length !== layers.length ||
      encoders.some(layer => !Array.isArray(layer) || layer.length !== 2 || layer.some(pair => !Array.isArray(pair) ||
        pair.length !== 2 || pair.some(value => typeof value !== 'string' || !value.trim() || value.length > 128))))) {
    throw new Error('Cada capa Vial debe incluir dos direcciones por dial.');
  }
  return {
    name, geometry: 'm57', locale: data.keyboard_locale === 'es-ES' ? 'es-ES' : 'en-US',
    layers, tappingTerm: 175, preference: 'balanced', combos: [], encoders: encoders as string[][][] | undefined, vial: data,
  };
}

export const parseJson = (source: string) => JSON.parse(source.replace(/("uid"\s*:\s*)(\d+)(?=\s*[,}])/g, '$1"$2"'));
export const m57Profile = profileFromVil(parseJson(spanishProfile), 'M57 · Español de España');
