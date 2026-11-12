import { useState } from 'react';
import { Activity as Pulse, ChartNoAxesCombined, Crosshair, Download, Fingerprint, Layers3, Leaf, Timer } from 'lucide-react';
import { formatTime, number, type Activity, type Session, type Usage } from './activity';
import { download } from './keymap-files';
import { fingerFor, positionsFor, type Profile } from './keyboard';
import { Empty, KeyboardPanel, Metric, PageIntro, SectionHead } from './ui';

const fingers = ['Meñique', 'Anular', 'Medio', 'Índice', 'Pulgar'];
const dateLabel = (date: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(date));

function Evolution({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return <Empty>Guarda una sesión de escritura para ver tu evolución.</Empty>;
  const recent = sessions.slice(-16);
  const limit = Math.max(20, Math.ceil(Math.max(...recent.map(session => session.wpm)) / 20) * 20);
  const x = (index: number) => recent.length === 1 ? 333 : 42 + index * 572 / (recent.length - 1);
  const y = (value: number) => 168 - value * 135;
  const velocity = recent.map((session, index) => [x(index), y(session.wpm / limit)].join(',')).join(' ');
  const precision = recent.map((session, index) => [x(index), y(session.accuracy / 100)].join(',')).join(' ');
  return <div className="evolution">
    <div className="chart-legend"><span><i />Velocidad (PPM)</span><span><i />Precisión (%)</span></div>
    <svg viewBox="0 0 670 199" role="img" aria-label="Evolución de la velocidad y la precisión de las últimas sesiones">
      {[0, .25, .5, .75, 1].map(scale => <g key={scale}>
        <line x1="42" y1={y(scale)} x2="614" y2={y(scale)} stroke="#e5e4da" />
        <text x="32" y={y(scale) + 4} textAnchor="end">{Math.round(scale * limit)}</text>
        <text x="623" y={y(scale) + 4}>{Math.round(scale * 100)}%</text>
      </g>)}
      <polyline points={velocity} fill="none" stroke="#4a7c59" strokeWidth="3" strokeLinejoin="round" />
      <polyline points={precision} fill="none" stroke="#99642d" strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="5 5" />
      {recent.map((session, index) => <g key={index}>
        <circle cx={x(index)} cy={y(session.wpm / limit)} r="4" fill="#4a7c59"><title>{session.wpm} PPM · {dateLabel(session.at)}</title></circle>
        <circle cx={x(index)} cy={y(session.accuracy / 100)} r="3" fill="#99642d"><title>{session.accuracy}% · {dateLabel(session.at)}</title></circle>
      </g>)}
      <text x={x(0)} y="192" textAnchor={recent.length === 1 ? 'middle' : 'start'}>{dateLabel(recent[0].at)}</text>
      {recent.length > 1 && <text x={x(recent.length - 1)} y="192" textAnchor="end">{dateLabel(recent.at(-1)!.at)}</text>}
    </svg>
  </div>;
}

function Balance({ profile, usage }: { profile: Profile; usage: Usage }) {
  const positions = positionsFor(profile);
  const total = Object.values(usage.keys).reduce((sum, count) => sum + count, 0);
  const hands = (['left', 'right'] as const).map(half => fingers.map(finger => positions.filter(position =>
    position.half === half && fingerFor(position) === finger).reduce((sum, position) => sum + (usage.keys[position.id] ?? 0), 0)));
  const thumbHits = hands[0][4] + hands[1][4];
  const left = thumbHits ? Math.round(hands[0][4] * 100 / thumbHits) : null;
  const rows = [0, 1, 2, 3].map(row => positions.filter(position => position.row === row && !position.thumb && !position.dial)
    .reduce((sum, position) => sum + (usage.keys[position.id] ?? 0), 0));
  return <div className="two-columns">
    <section className="panel inset-panel">
      <SectionHead icon={Fingerprint} title="Distribución por dedo" description="Pulsaciones del perfil de matriz seleccionado." />
      {total ? <div className="finger-bars">{fingers.map((finger, index) =>
        <div key={finger}><span>{finger}</span><div className="bar-pair"><meter min={0} max={total} value={hands[0][index]} aria-label={finger + ' izquierdo'} />
          <meter min={0} max={total} value={hands[1][index]} aria-label={finger + ' derecho'} /></div>
          <span>{hands[0][index]} / {hands[1][index]}</span></div>)}</div> : <Empty>Practica para registrar la distribución de pulsaciones.</Empty>}
    </section>
    <section className="panel inset-panel">
      <SectionHead icon={Leaf} title="Equilibrio y alcance" description="Reparto observado de pulsaciones en pulgares y filas." />
      <div className="range-heading"><strong>Pulgares</strong><span>{left === null ? 'Sin datos' : left + '% izq. / ' + (100 - left) + '% der.'}</span></div>
      <div className="balance-bar" role="img" aria-label={left === null ? 'Sin datos de pulgares' : 'Carga del pulgar izquierdo ' + left + '%'}>
        {left !== null && <i style={{ width: left + '%' }} />}<span />
      </div>
      <p className="muted">Referencia de simetría: 45–55% por mano.</p>
      <div className="row-reach">{rows.map((count, row) => <span key={row}><b>R{row}</b>{count} puls.</span>)}</div>
      <p className="muted">El reparto describe el uso de las teclas. La fatiga física requiere una medición independiente.</p>
    </section>
  </div>;
}

export function Metrics({ profile, activity }: { profile: Profile; activity: Activity }) {
  const [days, setDays] = useState(0);
  const sessions = activity.sessions.filter(session => !days || Date.parse(session.at) >= Date.now() - days * 86_400_000);
  const average = (measure: 'wpm' | 'accuracy') => sessions.length ?
    sessions.reduce((sum, session) => sum + session[measure], 0) / sessions.length : null;
  const time = sessions.reduce((sum, session) => sum + session.seconds, 0);
  const usage = activity.usage[profile.geometry];
  return <>
    <PageIntro category="Progreso" title="Métricas y ergonomía" description="Revisa tus sesiones y cómo se reparten las pulsaciones entre manos, dedos y capas.">
      <button type="button" className="button button-secondary" onClick={() => download('cornetype-metricas.json', JSON.stringify(activity, null, 2))}><Download size={17} />Exportar datos</button>
    </PageIntro>
    <div className="metric-strip">
      <Metric label="Velocidad media" value={average('wpm') === null ? '—' : number(average('wpm')!)} unit="PPM" icon={Pulse} />
      <Metric label="Precisión media" value={average('accuracy') === null ? '—' : number(average('accuracy')!, 1) + '%'} icon={Crosshair} />
      <Metric label="Tiempo de práctica" value={formatTime(time)} icon={Timer} />
      <Metric label="Sesiones guardadas" value={sessions.length} icon={ChartNoAxesCombined} />
    </div>
    <KeyboardPanel title="Mapa de carga por tecla" profile={profile} layer={0} heat={usage.keys} dials={false}>
      <span><i className="legend-swatch home" />Menor carga</span><span><i className="legend-swatch target" />Mayor carga</span>
      <span className="legend-note">Acumulado local · {Object.values(usage.keys).reduce((sum, count) => sum + count, 0)} pulsaciones</span>
    </KeyboardPanel>
    <Balance profile={profile} usage={usage} />
    <div className="two-columns">
      <section className="panel inset-panel">
        <SectionHead icon={Layers3} title="Métricas de capas" description={usage.changes + ' cambios de capa registrados'} />
        <div className="table-wrap"><table><thead><tr><th>Capa</th><th>Pulsaciones</th><th>Errores de escritura</th></tr></thead><tbody>
          {profile.layers.map((layer, index) => <tr key={index}><td>L{index} · {layer.name}</td><td>{usage.layers[index] ?? 0}</td><td>{usage.errors?.[index] ?? 0}</td></tr>)}
        </tbody></table></div>
        <p className="muted">Mod-Tap observados: {usage.taps} toques y {usage.holds} retenciones según el umbral del perfil.</p>
      </section>
      <section className="panel inset-panel">
        <SectionHead icon={ChartNoAxesCombined} title="Evolución de escritura">
          <select aria-label="Periodo de sesiones" value={days} onChange={event => setDays(Number(event.target.value))}>
            <option value={0}>Todo el historial</option><option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option>
          </select>
        </SectionHead>
        <Evolution sessions={sessions} />
      </section>
    </div>
    {sessions.length > 0 && <section className="panel inset-panel">
      <SectionHead icon={Timer} title="Historial de sesiones" />
      <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Ejercicio</th><th>Tiempo</th><th>Velocidad</th><th>Precisión</th><th>Errores</th></tr></thead><tbody>
        {sessions.slice(-15).reverse().map((session, index) => <tr key={session.at + ':' + index}><td>{dateLabel(session.at)}</td><td>{session.mode}</td>
          <td>{formatTime(session.seconds)}</td><td>{session.wpm} PPM</td><td>{number(session.accuracy, 1)}%</td><td>{session.errors}</td></tr>)}
      </tbody></table></div>
    </section>}
  </>;
}
