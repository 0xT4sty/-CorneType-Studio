import { layerNames, m57Positions, parseJson, positionsFor, profileFromVil, studioPositions, tapCode, type Combo, type Profile } from './keyboard';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isBinding = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 128;
const rowOrder = [0, 1, 2, 3, 4].flatMap(row => studioPositions.filter(position => position.row === row));

function normalizeKeys(values: unknown[], geometry: Profile['geometry'], layer: number, inRowOrder: boolean) {
  const positions = geometry === 'm57' ? m57Positions : studioPositions;
  if (values.length !== positions.length || !values.every(isBinding)) {
    throw new Error('La capa ' + layer + ' debe tener ' + positions.length + ' asignaciones válidas.');
  }
  if (geometry === 'm57' || !inRowOrder) return values;
  return positions.map(position => values[rowOrder.indexOf(position)]);
}

function readCombos(data: unknown, geometry: Profile['geometry']): Combo[] {
  if (data === undefined) return [];
  const ids = new Set((geometry === 'm57' ? m57Positions : studioPositions).map(position => position.id));
  if (!Array.isArray(data) || data.length > 128 || data.some(combo => !isRecord(combo) || !isBinding(combo.action) ||
    !Array.isArray(combo.positions) || combo.positions.length < 2 || new Set(combo.positions).size !== combo.positions.length ||
    combo.positions.some(id => typeof id !== 'string' || !ids.has(id)))) throw new Error('Cada combo requiere dos o más posiciones distintas y una acción.');
  return data;
}

function studioJson(data: Record<string, unknown>, name: string): Profile {
  const layers = data.layers;
  const geometry = data.geometry;
  if ((geometry !== 'studio' && geometry !== 'm57') || !Array.isArray(layers) || !layers.length || layers.length > 32) {
    throw new Error('Se requiere una geometría Studio o M57 y entre 1 y 32 capas.');
  }
  const tappingTerm = data.tappingTerm ?? 175;
  if (typeof tappingTerm !== 'number' || !Number.isInteger(tappingTerm) || tappingTerm < 100 || tappingTerm > 300) {
    throw new Error('El tapping term debe estar entre 100 y 300 ms.');
  }
  const encoders = data.encoders;
  if (encoders !== undefined && (!Array.isArray(encoders) || encoders.length !== layers.length || encoders.some(layer =>
    !Array.isArray(layer) || layer.length !== 2 || layer.some(pair => !Array.isArray(pair) || pair.length !== 2 || !pair.every(isBinding))))) {
    throw new Error('Cada capa debe tener dos direcciones por dial.');
  }
  const vial = data.vial;
  if (vial !== undefined && (geometry !== 'm57' || !isRecord(vial) || profileFromVil(vial, name).layers.length !== layers.length)) {
    throw new Error('Los datos de origen Vial deben coincidir con las capas del M57.');
  }
  return {
    name: isBinding(data.name) ? data.name : name, geometry, locale: data.locale === 'en-US' ? 'en-US' : 'es-ES', tappingTerm,
    preference: data.preference === 'tap' || data.preference === 'hold' ? data.preference : 'balanced',
    layers: layers.map((layer, index) => {
      if (!isRecord(layer) || !isBinding(layer.name) || !Array.isArray(layer.keys)) throw new Error('Falta el nombre o las teclas de la capa ' + index + '.');
      return { name: layer.name, keys: normalizeKeys(layer.keys, geometry, index, false) };
    }),
    combos: readCombos(data.combos, geometry), encoders: encoders as string[][][] | undefined,
    ...(isRecord(vial) ? { vial } : {}),
  };
}

function qmkJson(data: Record<string, unknown>, name: string): Profile {
  const layers = data.layers;
  if (!Array.isArray(layers) || !layers.length || layers.length > 32 || !layers.every(Array.isArray)) {
    throw new Error('El JSON QMK/VIA debe incluir un arreglo layers de entre 1 y 32 capas.');
  }
  const isMatrix = Array.isArray(layers[0][0]);
  const isFlatMatrix = !isMatrix && layers[0].length === 70;
  const geometry = isMatrix || isFlatMatrix || layers[0].length === m57Positions.length ? 'm57' : 'studio';
  return {
    name: isBinding(data.name) ? data.name : name, geometry, locale: 'en-US', tappingTerm: 175, preference: 'balanced', combos: [],
    layers: layers.map((layer: unknown[], index) => {
      let keys = layer;
      if (isMatrix) {
        if (layer.length !== 10 || layer.some(row => !Array.isArray(row) || row.length !== 7)) throw new Error('VIA requiere una matriz de 10 × 7.');
        keys = m57Positions.map(({ matrix }) => (layer[matrix![0]] as unknown[])[matrix![1]]);
      }
      if (isFlatMatrix) {
        if (layer.length !== 70) throw new Error('Todas las capas VIA deben tener 70 posiciones de matriz.');
        keys = m57Positions.map(({ matrix }) => layer[matrix![0] * 7 + matrix![1]]);
      }
      return {
        name: layerNames[index] ?? 'Capa ' + index,
        keys: normalizeKeys(keys.map(value => value === -1 ? 'KC_NO' : typeof value === 'number' && Number.isInteger(value) &&
          value >= 0 && value <= 65535 ? '0x' + value.toString(16).toUpperCase() : value), geometry, index, true),
      };
    }),
  };
}

function block(source: string, match: RegExpMatchArray) {
  const start = (match.index ?? 0) + match[0].length;
  let depth = 1;
  const braces = /"(?:\\.|[^"\\])*"|[{}]/g;
  braces.lastIndex = start;
  for (let token = braces.exec(source); token; token = braces.exec(source)) {
    if (token[0] === '{') depth++;
    if (token[0] === '}' && --depth === 0) return source.slice(start, token.index);
  }
  throw new Error('Falta una llave de cierre en el keymap ZMK.');
}

function zmkKeymap(raw: string, name: string): Profile {
  const source = raw.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, match => match.startsWith('"') ? match : match.replace(/[^\n]/g, ' '));
  const root = source.match(/\bkeymap\s*\{/);
  if (!root) throw new Error('El archivo ZMK debe contener un nodo keymap.');
  const keymap = block(source, root);
  const nodes = Array.from(keymap.matchAll(/(?:[;\n]|^)\s*([\w-]+)\s*(?::\s*[\w-]+\s*)?\{/g));
  const layers = nodes.flatMap(node => {
    const body = block(keymap, node);
    const bindings = body.match(/\bbindings\s*=\s*<([^<>]*)>\s*;/s);
    if (!bindings) throw new Error('Falta bindings = <…>; en la capa ' + node[1] + '.');
    const keys = Array.from(bindings[1].matchAll(/&[\w-]+[^&]*/g), match => match[0].trim().replace(/\s+/g, ' '));
    return [{ name: body.match(/\bdisplay-name\s*=\s*"([^"]+)"/)?.[1] ?? node[1], keys }];
  });
  if (!layers.length || layers.length > 32) throw new Error('El archivo debe tener entre 1 y 32 capas ZMK.');
  const geometry = layers[0].keys.length === m57Positions.length ? 'm57' : 'studio';
  const combosNode = source.match(/\bcombos\s*\{/);
  const combos = combosNode ? Array.from(block(source, combosNode).matchAll(/\bkey-positions\s*=\s*<([\d\s]+)>\s*;\s*bindings\s*=\s*<([^<>]+)>/g),
    ([, indices, action]) => ({
      positions: indices.trim().split(/\s+/).map(index => (geometry === 'm57' ? m57Positions : rowOrder)[Number(index)]?.id),
      action: action.trim().replace(/\s+/g, ' '),
    })) : undefined;
  return {
    name, geometry, locale: 'en-US', tappingTerm: 175, preference: 'balanced', combos: readCombos(combos, geometry),
    layers: layers.map((layer, index) => ({ ...layer, keys: normalizeKeys(layer.keys, geometry, index, true) })),
  };
}

export function parseKeymap(source: string, filename: string): Profile {
  const name = filename.replace(/\.(?:json|vil|keymap)$/i, '').slice(0, 96) || 'Keymap importado';
  if (!source.trim()) throw new Error('Añade el código de tu keymap para validarlo.');
  if (source.length > 1_000_000) throw new Error('Usa un archivo de hasta 1 MB.');
  if (/\.keymap$/i.test(filename)) return zmkKeymap(source, name);
  if (!/\.(json|vil)$/i.test(filename)) throw new Error('Selecciona un archivo .json, .vil o .keymap.');
  let data: unknown;
  try {
    data = parseJson(source.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('El JSON tiene un error de sintaxis. Revisa las comas, comillas y llaves.');
  }
  if (!isRecord(data)) throw new Error('El archivo debe contener un objeto JSON.');
  if ('uid' in data || /\.vil$/i.test(filename)) return profileFromVil(data, name);
  if (data.schema === 'cornetype/v1') return studioJson(data, name);
  return qmkJson(data, name);
}

export function studioSource(profile: Profile) {
  return JSON.stringify({ schema: 'cornetype/v1', ...profile }, null, 2);
}

export function vialSource(profile: Profile) {
  if (profile.geometry !== 'm57' || !profile.vial) throw new Error('Se requiere un perfil de origen Vial.');
  const original = profile.vial.layout as (string | number)[][][];
  const layout = profile.layers.map(({ keys }, layer) => {
    const matrix = original[layer].map(row => [...row]);
    m57Positions.forEach((position, index) => {
      const [row, col] = position.matrix!;
      matrix[row][col] = keys[index] === 'KC_NO' && matrix[row][col] === -1 ? -1 : keys[index];
    });
    return matrix;
  });
  const data = { uid: '', ...profile.vial, layout, encoder_layout: profile.encoders };
  return JSON.stringify(data, null, 2).replace(/^(\{\n {2}"uid": )"(\d+)"/, '$1$2');
}

export function download(filename: string, source: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([source], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function defaultSelection(profile: Profile) {
  const positions = positionsFor(profile);
  return positions.find((_, index) => tapCode(profile.layers[0].keys[index]) === 'KC_F')?.id ?? positions[0].id;
}
