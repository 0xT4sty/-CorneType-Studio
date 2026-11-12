import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Download, Fingerprint, Gauge, Play, RotateCcw, SlidersHorizontal, Unplug } from 'lucide-react';
import example from '../recursos_frontal/reporte_t_cnico_de_chatter_bcorne_matrix_debugger.json';
import { number } from './activity';
import type { MatrixEvent } from './hid';
import { download } from './keymap-files';
import { labelFor, positionsFor, resolvedBinding, studioProfile, type Profile } from './keyboard';
import { Empty, KeyboardPanel, Metric, PageIntro, SectionHead } from './ui';

export type TestEvent = MatrixEvent & { label: string; layer: number; virtual?: boolean };
export type TestRun = { events: TestEvent[]; tested: Set<string>; pressed: Set<string>; peak: number; total: number };
export const emptyTest: TestRun = { events: [], tested: new Set(), pressed: new Set(), peak: 0, total: 0 };
const sampleDebounce = example.report_metadata.keyboard_profile.configured_debounce_ms;

export function recordTest(run: TestRun, event: TestEvent): TestRun {
  const pressed = new Set(run.pressed);
  if (event.down) pressed.add(event.id);
  else pressed.delete(event.id);
  const tested = event.down && !run.tested.has(event.id) ? new Set([...run.tested, event.id]) : run.tested;
  return { events: [...run.events.slice(-249), event], tested, pressed, total: run.total + 1, peak: Math.max(run.peak, pressed.size) };
}

export function analyzeChatter(events: TestEvent[], threshold: number) {
  const last = new Map<string, TestEvent>();
  return events.flatMap(event => {
    if (event.virtual) return [];
    const previous = last.get(event.id);
    if (previous?.down === event.down) return [];
    last.set(event.id, event);
    const interval = previous ? event.at - previous.at : Infinity;
    if (interval < 0 || interval >= threshold) return [];
    return [{ ...event, interval, kind: event.down ? 'Rebote tras soltar' : 'Liberación breve' }];
  });
}

function demoEvents() {
  const sampled = ['l2.4', 'r2.1', 'l4.2', 'r4.1', 'l0.4', 'r1.1'];
  const positions = positionsFor(studioProfile);
  const bounce = example.detected_anomalies.slice(1).map(item => 'measured_bounce_ms' in item.metrics ? item.metrics.measured_bounce_ms : 0);
  return sampled.flatMap((id, index) => {
    const at = 180 * (index + 1);
    const label = labelFor(resolvedBinding(studioProfile, 0, positions.findIndex(item => item.id === id)), studioProfile.locale);
    const edges = [{ down: true, at }, { down: false, at: at + 56 }];
    if (index === 2 || index === 3) edges.push({ down: true, at: at + 56 + (bounce[index - 2] ?? 3) }, { down: false, at: at + 112 });
    return edges.map(event => ({ ...event, id, label, layer: 0 }));
  });
}

export function Diagnostics({ profile, layer, mask, pressed, run, onReset, source, onVirtual }: {
  profile: Profile; layer: number; mask?: number; pressed: Set<string>; run: TestRun; onReset: () => void;
  source: 'usb' | 'browser'; onVirtual: (id: string) => void;
}) {
  const [threshold, setThreshold] = useState(sampleDebounce);
  const [demo, setDemo] = useState<TestRun>();
  const [running, setRunning] = useState(false);
  const active = demo ?? run;
  const map = demo ? studioProfile : profile;
  const positions = positionsFor(map);
  const anomalies = useMemo(() => analyzeChatter(active.events, threshold), [active.events, threshold]);
  const flagged = new Set(anomalies.map(event => event.id));
  const coverage = Math.round(active.tested.size / positions.length * 100);
  const protocol = demo ? 'Simulación Studio 4×6' : source === 'usb' ? 'WebHID Trainer · 32 B' : 'Eventos de teclado del navegador';
  const exampleEncoder = example.detected_anomalies[0];

  useEffect(() => {
    if (!running) return;
    const events = demoEvents();
    let index = 0;
    const timer = window.setInterval(() => {
      const event = events[index++];
      if (event) setDemo(previous => recordTest(previous ?? emptyTest, event));
      if (index >= events.length) setRunning(false);
    }, 115);
    return () => window.clearInterval(timer);
  }, [running]);

  function exportReport() {
    const at = new Date().toISOString();
    download('cornetype-diagnostico.json', JSON.stringify({
      report_metadata: { report_id: 'BCORNE-' + Date.now(), generator: 'CorneType Matrix Debugger', timestamp_iso: at,
        protocol, keyboard_profile: { model: map.name, geometry: map.geometry, configured_debounce_ms: threshold },
        clock: demo ? 'simulated' : 'browser_event_timestamp', scan_rate_hz: null },
      diagnostic_summary: { keys_tested: active.tested.size, keys_available: positions.length, testing_completion_pct: coverage,
        simultaneous_peak: active.peak, received_events: active.total, chatter_candidates_in_buffer: anomalies.length, rotary_phase_available: false },
      detected_anomalies: anomalies.map(event => ({
        component_id: event.id, key_label: event.label, event: event.kind, measured_interval_ms: Number(event.interval.toFixed(2)),
        cause: 'Transición rápida observada. El origen eléctrico requiere una medición directa del contacto.',
      })),
      raw_event_logger_tail: active.events.map(event => ({ ...event, at: Number(event.at.toFixed(2)) })),
      example_rotary_anomaly: demo ? exampleEncoder : undefined,
      recommended_firmware_patch: demo && anomalies.length ? {
        file_target: example.recommended_firmware_patch.file_target,
        contents: example.detected_anomalies[1].remediation.firmware_zmk.directive,
        source: 'Ejemplo de diagnóstico ZMK suministrado con el PRD',
      } : null,
    }, null, 2));
  }

  return <>
    <PageIntro category="Diagnóstico" title="Matrix Debugger" description="Comprueba la matriz, observa las transiciones rápidas y descarga un informe técnico.">
      <button type="button" className="button button-primary" onClick={exportReport}><Download size={17} />Exportar informe</button>
    </PageIntro>
    <div className="panel debugger-controls">
      <span className="source-label"><i className={'state-dot ' + (source === 'usb' && !demo ? 'live' : '')} />{protocol}</span>
      <div className="button-row">
        <button className="button button-secondary" type="button" disabled={running} onClick={() => { setDemo(emptyTest); setRunning(true); }}><Play size={15} />{running ? 'Simulando…' : 'Simular diagnóstico'}</button>
        <button className="button button-quiet" type="button" onClick={() => { setRunning(false); setDemo(undefined); onReset(); }}><RotateCcw size={16} />Reiniciar</button>
      </div>
    </div>
    <div className="metric-strip">
      <Metric label="Posiciones probadas" value={active.tested.size + ' / ' + positions.length} icon={Fingerprint} />
      <Metric label="Cobertura" value={coverage + '%'} icon={Gauge} />
      <Metric label="Alertas de rebote" value={anomalies.length} icon={AlertTriangle} />
      <Metric label="Simultáneas" value={active.peak} icon={Activity} />
    </div>
    <KeyboardPanel title="Matriz física en vivo" profile={map} layer={demo ? 0 : layer} mask={demo ? undefined : mask}
      pressed={demo ? demo.pressed : pressed} tested={active.tested} flagged={flagged}
      onSelect={!demo && source === 'browser' ? position => onVirtual(position.id) : undefined}>
      <span><i className="legend-swatch target" />Probada</span>
      <span><i className="legend-swatch flag" />Transición rápida</span>
      <span className="legend-note">{demo ? 'Datos del ejemplo de diagnóstico' : source === 'browser' ? 'Pulsa el teclado o selecciona una posición' : 'Eventos posteriores al debounce'}</span>
    </KeyboardPanel>
    <div className="sidebar-grid">
      <section className="panel inset-panel log-panel">
        <SectionHead icon={Activity} title="Registro de eventos" description={'Últimas ' + Math.min(active.events.length, 250) + ' transiciones · ' + active.total + ' recibidas'} />
        {active.events.length ? <div className="table-wrap" tabIndex={0} role="region" aria-label="Últimos eventos de la matriz"><table><thead><tr><th>Tiempo</th><th>Posición</th><th>Tecla</th><th>Evento</th></tr></thead>
          <tbody>{active.events.slice(-25).reverse().map((event, index) => <tr key={event.at + ':' + index}>
            <td>{number(event.at - active.events[0].at, 2)} ms</td><td><code>{event.id}</code></td><td>{event.label}</td>
            <td><span className={'tag ' + (event.down ? 'tag-green' : '')}>{event.down ? 'Pulsada' : 'Liberada'}</span></td>
          </tr>)}</tbody></table></div> : <Empty>Pulsa una tecla o inicia la simulación para ver el registro.</Empty>}
      </section>
      <div className="diagnostic-aside"><section className="panel inset-panel">
        <SectionHead icon={SlidersHorizontal} title="Umbral de rebote" description="Marca transiciones de la misma tecla por debajo del umbral." />
        <div className="range-heading"><label htmlFor="bounce-term">Intervalo</label><strong>{number(threshold, 1)} ms</strong></div>
        <input id="bounce-term" type="range" min={1} max={20} step={.5} value={threshold} onChange={event => setThreshold(Number(event.target.value))} />
        <div className="range-ends"><span>1 ms</span><span>20 ms</span></div>
        <div className="anomaly-list">{anomalies.length ? anomalies.slice(-8).reverse().map((event, index) => <div className="notice error" key={event.at + ':' + index}>
          <AlertTriangle size={17} /><span><strong>{event.label} · {event.kind}</strong><br />{number(event.interval, 2)} ms · {event.id}</span></div>) :
          <div className="notice success"><CheckCircle2 size={17} />Sin transiciones por debajo del umbral.</div>}</div>
        <p className="muted">{source === 'usb' ? 'Los intervalos se calculan en el navegador a partir de eventos filtrados por el firmware.' :
          'Los intervalos del navegador sirven para detectar candidatos a rebote. La simulación usa tiempos de ejemplo.'}</p>
      </section>
      <section className="panel inset-panel">
        <SectionHead icon={Unplug} title="Fases de los diales EC11" />
        {demo ? <p className="notice error">Ejemplo de fase EC11 derecha · {exampleEncoder.metrics.missed_detents_count} saltos en el informe de referencia.</p>
          : <p className="muted">Para medir las fases A/B y los saltos de giro se necesita firmware con telemetría de cuadratura.</p>}
      </section></div>
    </div>
  </>;
}
