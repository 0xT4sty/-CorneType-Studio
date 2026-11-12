import { afterEach, describe, expect, it, vi } from 'vitest';
import profileSource from '../BCORNE/config/bcorne-es-espana.vil?raw';
import { typingStats } from './activity';
import { analyzeChatter, emptyTest, recordTest, type TestEvent } from './diagnostics';
import { decode, KeyboardConnection } from './hid';
import { parseKeymap, studioSource, vialSource } from './keymap-files';
import { labelFor, m57Positions, positionForEvent, resolvedBinding, studioPositions, studioProfile } from './keyboard';

const codes = (first = 'KC_A') => [first, ...Array(55).fill('KC_TRNS')];

describe('geometría e importación', () => {
  it('distingue la vista Studio de las posiciones de matriz del M57', () => {
    expect(studioPositions).toHaveLength(56);
    expect(studioPositions.filter(position => position.thumb)).toHaveLength(8);
    expect(m57Positions).toHaveLength(60);
    expect(m57Positions.filter(position => position.dial).map(position => position.id)).toEqual(['3:6', '8:0']);
    expect(new Set(m57Positions.map(position => position.id)).size).toBe(m57Positions.length);
  });

  it('conserva asignaciones Vial, diales, UID y distribución española', () => {
    const profile = parseKeymap(profileSource, 'm57.vil');
    expect(profile.geometry).toBe('m57');
    expect(profile.encoders?.[0]).toHaveLength(2);
    expect(profile.locale).toBe('es-ES');
    expect(parseKeymap(studioSource(profile), 'perfil.json')).toEqual(profile);
    profile.layers[0].keys[0] = 'KC_F12';
    const native = vialSource(profile);
    expect(native).toContain('"uid": 5010774632021243529');
    const restored = parseKeymap(native, 'bcorne.vil');
    expect(restored.layers[0].keys[0]).toBe('KC_F12');
    expect(restored.vial?.settings).toEqual(profile.vial?.settings);
    expect(() => parseKeymap(profileSource.replace('5010774632021243529', '5010774632021243528'), 'otro.vil')).toThrow('BCORNE M57');
  });

  it('ordena capas QMK/ZMK, resuelve transparencias y rechaza tamaños incorrectos', () => {
    const qmk = parseKeymap(JSON.stringify({ layers: [codes(), codes('KC_TRNS')] }), 'ejemplo.json');
    expect(resolvedBinding(qmk, 1, 0)).toBe('KC_A');
    expect(() => parseKeymap(JSON.stringify({ layers: [['KC_A']] }), 'ejemplo.json')).toThrow('56 asignaciones');
    const first = Array(56).fill('&kp A');
    first[6] = '&mt LSHIFT F';
    const zmk = '/ { keymap { compatible = "zmk,keymap"; base { display-name = "Base"; bindings = <' + first.join(' ') +
      '>; }; }; combos { compatible = "zmk,combos"; esc { key-positions = <0 6>; bindings = <&kp ESC>; }; }; };';
    const profile = parseKeymap(zmk, 'ejemplo.keymap');
    expect(profile.combos).toEqual([{ positions: ['l0.0', 'r0.0'], action: '&kp ESC' }]);
    expect(profile.layers[0].keys[28]).toBe('&mt LSHIFT F');
    expect(labelFor(profile.layers[0].keys[28], profile.locale)).toBe('F');
  });

  it('identifica la posición por código físico para la Ñ', () => {
    expect(positionForEvent(studioProfile, 0, { code: 'Semicolon', key: 'ñ' })?.id).toBe('r2.4');
  });

  it('lee matrices VIA planas y muestra los códigos HID básicos', () => {
    const matrix = Array(70).fill(0);
    matrix[0] = 4;
    const profile = parseKeymap(JSON.stringify({ layers: [matrix, Array(70).fill(1)] }), 'via.json');
    expect(profile.geometry).toBe('m57');
    expect(labelFor(resolvedBinding(profile, 1, 0), profile.locale)).toBe('A');
    expect(labelFor(profile.layers[0].keys[1], profile.locale)).toBe('—');
  });
});

describe('estadísticas y diagnóstico', () => {
  it('calcula PPM, precisión y consistencia con las entradas observadas', () => {
    expect(typingStats(10, 12, 5, [100, 100, 100])).toEqual({ wpm: 24, accuracy: 83.3, consistency: 100 });
    expect(typingStats(0, 0, 0, []).consistency).toBeNull();
  });

  it('señala transiciones de la misma tecla, excluye duplicados y clics virtuales', () => {
    const event = (id: string, down: boolean, at: number, virtual = false): TestEvent => ({ id, down, at, label: id, layer: 0, virtual });
    const events = [event('l0.0', true, 0), event('l0.1', true, 2), event('l0.0', true, 3), event('l0.0', false, 4),
      event('l0.0', true, 7.2), event('l0.1', false, 5, true)];
    const anomalies = analyzeChatter(events, 5);
    expect(anomalies.map(item => item.kind)).toEqual(['Liberación breve', 'Rebote tras soltar']);
    expect(anomalies[1].interval).toBeCloseTo(3.2);
    const state = events.reduce(recordTest, emptyTest);
    expect(state.peak).toBe(2);
    expect(state.tested.size).toBe(2);
    expect(state.total).toBe(6);
  });
});

function frame(sequence: number, identity = false) {
  const bytes = new Uint8Array(32);
  bytes.set([0xb7, 1, identity ? 0x81 : 0x82, sequence & 255, sequence >> 8, 7, 0, 0, 0, 5, 3, 1]);
  bytes[12] = 1;
  bytes[16] = 64;
  if (identity) bytes.set([0x89, 0x36, 0x2a, 0xc7, 0xfa, 0xd8, 0x89, 0x45, 10, 7, 1], 21);
  return new DataView(bytes.buffer);
}

describe('WebHID Trainer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('decodifica las dos mitades y valida el paquete de 32 bytes', () => {
    const packet = decode(frame(65535), 25);
    expect(packet).toMatchObject({ sequence: 65535, mask: 7, event: { id: '5:3', down: true, at: 25 } });
    expect(packet?.pressed).toEqual(new Set(['0:0', '5:3']));
    expect(decode(frame(0, true))?.identity).toBe(true);
    expect(decode(new DataView(new ArrayBuffer(64)))).toBeUndefined();
  });

  it('requiere identidad, acepta el desbordamiento de secuencia y resincroniza tras una pérdida', async () => {
    const document = Object.assign(new EventTarget(), { hidden: false });
    const device = Object.assign(new EventTarget(), {
      opened: true, open: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), sendReport: vi.fn().mockResolvedValue(undefined),
    });
    const hid = Object.assign(new EventTarget(), { requestDevice: vi.fn().mockResolvedValue([device]) });
    vi.stubGlobal('document', document);
    vi.stubGlobal('navigator', { hid });
    const update = vi.fn();
    const status = vi.fn();
    const connection = new KeyboardConnection(update, status);
    const receive = (sequence: number, identity = false) => {
      device.dispatchEvent(Object.assign(new Event('inputreport'), { reportId: 0, data: frame(sequence, identity) }));
    };
    await connection.connect();
    try {
      receive(65534);
      expect(update).not.toHaveBeenCalled();
      receive(65535, true);
      receive(0);
      expect(update).toHaveBeenCalledTimes(2);
      receive(2);
      expect(update).toHaveBeenCalledTimes(2);
      expect(status).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'connecting' }));
      receive(3, true);
      expect(update).toHaveBeenCalledTimes(3);
      expect(status).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'live' }));
    } finally {
      await connection.close();
    }
    expect(device.close).toHaveBeenCalledOnce();
  });
});
