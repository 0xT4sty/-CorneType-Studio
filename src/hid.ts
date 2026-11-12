import { useEffect, useRef, useState } from 'react';

const uid = [0x89, 0x36, 0x2a, 0xc7, 0xfa, 0xd8, 0x89, 0x45];
const magic = 0xb7;
const filter = { vendorId: 0x6401, productId: 0x45d4, usagePage: 0xff60, usage: 0x61 };
type HidDevice = EventTarget & { opened: boolean; open(): Promise<void>; close(): Promise<void>; sendReport(id: number, data: Uint8Array): Promise<void> };
type Hid = EventTarget & { requestDevice(options: { filters: typeof filter[] }): Promise<HidDevice[]> };
type InputReport = Event & { data: DataView; reportId: number };
type DeviceEvent = Event & { device: HidDevice };
export type MatrixEvent = { id: string; down: boolean; at: number };
export type Telemetry = { sequence: number; mask: number; pressed: Set<string>; event?: MatrixEvent; snapshot: boolean; identity: boolean };
type Status = { phase: 'offline' | 'connecting' | 'live' | 'error'; message: string };

export function decode(data: DataView, at = performance.now()): Telemetry | undefined {
  if (data.byteLength !== 32 || data.getUint8(0) !== magic || data.getUint8(1) !== 1) return;
  const kind = data.getUint8(2);
  if (kind !== 0x81 && kind !== 0x82) return;
  const pressed = new Set<string>();
  for (let index = 0; index < 70; index++) {
    if (data.getUint8(12 + (index >> 3)) & (1 << (index % 8))) pressed.add(Math.floor(index / 7) + ':' + (index % 7));
  }
  const row = data.getUint8(9);
  const col = data.getUint8(10);
  return {
    sequence: data.getUint16(3, true), mask: data.getUint32(5, true), pressed, snapshot: kind === 0x81,
    identity: kind === 0x81 && uid.every((byte, index) => data.getUint8(21 + index) === byte) &&
      data.getUint8(29) === 10 && data.getUint8(30) === 7 && !!(data.getUint8(31) & 1),
    event: kind === 0x82 && row < 10 && col < 7 ? { id: row + ':' + col, down: !!data.getUint8(11), at } : undefined,
  };
}

export class KeyboardConnection {
  private device?: HidDevice;
  private hid?: Hid;
  private timer?: ReturnType<typeof setInterval>;
  private sequence?: number;
  private last = 0;
  private attempt = 0;
  private wanted = false;

  constructor(private update: (telemetry: Telemetry) => void, private status: (status: Status) => void) {}

  private async send(command: number, device = this.device) {
    if (!device?.opened) return;
    const packet = new Uint8Array(32);
    packet.set([magic, 1, command]);
    await device.sendReport(0, packet);
  }

  private sync = () => {
    this.sequence = undefined;
    this.last = Date.now();
    if (document.hidden || !this.device?.opened) return;
    this.status({ phase: 'connecting', message: 'Esperando la telemetría del firmware Trainer…' });
    void this.send(1).catch(this.fail);
  };

  private fail = () => {
    void this.close(false);
    this.status({ phase: 'error', message: 'Se interrumpió la conexión USB. Vuelve a conectar el teclado.' });
  };

  private input = (event: Event) => {
    const report = event as InputReport;
    if (report.reportId !== 0 || document.hidden) return;
    const telemetry = decode(report.data, event.timeStamp);
    if (!telemetry) return;
    if (this.sequence === undefined) {
      if (!telemetry.identity) return;
      this.status({ phase: 'live', message: 'M57 conectado · Telemetría Trainer' });
    } else if (telemetry.sequence !== ((this.sequence + 1) & 65535)) {
      this.sync();
      return;
    }
    this.last = Date.now();
    this.sequence = telemetry.sequence;
    this.update(telemetry);
  };

  private disconnect = (event: Event) => {
    if ((event as DeviceEvent).device === this.device) this.fail();
  };

  private visibility = () => {
    if (!document.hidden) this.sync();
    else {
      this.sequence = undefined;
      void this.send(3).catch(this.fail);
      this.status({ phase: 'connecting', message: 'Telemetría en pausa mientras la pestaña está oculta.' });
    }
  };

  async connect() {
    if (this.wanted) return;
    const hid = (navigator as Navigator & { hid?: Hid }).hid;
    if (!hid) {
      this.status({ phase: 'error', message: 'WebHID requiere Chrome o Edge de escritorio en HTTPS o localhost.' });
      return;
    }
    this.wanted = true;
    const attempt = ++this.attempt;
    this.status({ phase: 'connecting', message: 'Selecciona tu BCORNE M57 en el diálogo USB.' });
    try {
      const [device] = await hid.requestDevice({ filters: [filter] });
      if (attempt !== this.attempt) return;
      if (!device) {
        await this.close();
        return;
      }
      this.device = device;
      await device.open();
      if (attempt !== this.attempt) {
        if (device.opened) await device.close();
        return;
      }
      this.hid = hid;
      device.addEventListener('inputreport', this.input);
      hid.addEventListener('disconnect', this.disconnect);
      document.addEventListener('visibilitychange', this.visibility);
      this.sync();
      this.timer = setInterval(() => {
        if (document.hidden) return;
        if (Date.now() - this.last > 3200) {
          void this.close(false);
          this.status({ phase: 'error', message: 'El M57 no envía telemetría. Comprueba que usa el firmware Trainer.' });
          return;
        }
        if (this.sequence !== undefined) void this.send(2).catch(this.fail);
      }, 1000);
    } catch {
      if (attempt === this.attempt) this.fail();
    }
  }

  async close(showStatus = true) {
    this.attempt++;
    this.wanted = false;
    clearInterval(this.timer);
    this.sequence = undefined;
    this.hid?.removeEventListener('disconnect', this.disconnect);
    document.removeEventListener('visibilitychange', this.visibility);
    const device = this.device;
    this.device = undefined;
    device?.removeEventListener('inputreport', this.input);
    if (showStatus) this.status({ phase: 'offline', message: 'Teclado del navegador' });
    if (device?.opened) {
      await this.send(3, device).catch(() => {});
      await device.close().catch(() => {});
    }
  }
}

export function useHardware(onEvent: (event: MatrixEvent, mask: number) => void) {
  const [status, setStatus] = useState<Status>({ phase: 'offline', message: 'Teclado del navegador' });
  const [telemetry, setTelemetry] = useState<Telemetry>();
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const [connection] = useState(() => new KeyboardConnection(report => {
    setTelemetry(report);
    if (report.event) eventRef.current(report.event, report.mask);
  }, value => {
    setStatus(value);
    if (value.phase !== 'live') setTelemetry(undefined);
  }));
  useEffect(() => () => { void connection.close(false); }, [connection]);
  return { status, telemetry, connection };
}
