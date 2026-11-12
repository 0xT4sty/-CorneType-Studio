import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, CircleHelp, Keyboard, RotateCcw, RotateCw, type LucideIcon } from 'lucide-react';
import { behaviorFor, fingerFor, labelFor, positionsFor, resolvedBinding, type Position, type Profile } from './keyboard';

export function Mark() {
  return <span className="brand-mark" aria-hidden="true">
    <span>{[0, 1, 2, 3, 4, 5].map(i => <i key={i} />)}</span>
    <span>{[0, 1, 2, 3, 4, 5].map(i => <i key={i} />)}</span>
  </span>;
}

export function PageIntro({ category, title, description, children }: {
  category: string; title: string; description: string; children?: ReactNode;
}) {
  return <header className="page-intro">
    <div><div className="category"><span />{category}</div><h1>{title}</h1><p>{description}</p></div>
    {children && <div className="intro-action">{children}</div>}
  </header>;
}

export function SectionHead({ icon: Icon, title, description, children }: {
  icon?: LucideIcon; title: string; description?: string; children?: ReactNode;
}) {
  return <div className="section-head">
    <div className="section-name">
      {Icon && <span className="icon-tile"><Icon size={18} /></span>}
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
    </div>
    {children && <div className="section-actions">{children}</div>}
  </div>;
}

export function LayerSelect({ profile, layer, onChange }: { profile: Profile; layer: number; onChange: (layer: number) => void }) {
  return <label className="select-pill"><span>Capa</span>
    <select aria-label="Capa del teclado" value={layer} onChange={event => onChange(Number(event.target.value))}>
      {profile.layers.map((item, index) => <option key={index} value={index}>L{index} · {item.name}</option>)}
    </select><ChevronDown size={14} aria-hidden="true" />
  </label>;
}

export function LayerCards({ profile, layer, onChange }: { profile: Profile; layer: number; onChange: (layer: number) => void }) {
  return <div className="layer-cards" aria-label="Capas del perfil">
    {profile.layers.map((item, index) => <button type="button" key={index} className={index === layer ? 'active' : ''} aria-pressed={index === layer} onClick={() => onChange(index)}>
      <span>L{index}</span><strong>{item.name}</strong>
    </button>)}
  </div>;
}

type BoardProps = {
  profile: Profile; layer: number; mask?: number; pressed?: Set<string>; target?: string;
  selected?: string; tested?: Set<string>; flagged?: Set<string>; heat?: Record<string, number>;
  onSelect?: (position: Position) => void; dials?: boolean; onDial?: (half: number, direction: 0 | 1) => void;
};

export function Board({ profile, layer, mask, pressed, target, selected, tested, flagged, heat, onSelect, dials = true, onDial }: BoardProps) {
  const [dialInfo, setDialInfo] = useState<number>();
  const positions = positionsFor(profile);
  const max = Math.max(1, ...Object.values(heat ?? {}));
  return <div className="board">
    <div className="board-halves">
      {(['left', 'right'] as const).map((half, hand) => <div className={'board-half ' + half} key={half}>
        <div className="hand-label"><span />{hand === 0 ? 'Mano izquierda' : 'Mano derecha'}</div>
        <div className="key-field">
          {positions.map((position, index) => {
            if (position.half !== half || position.dial && !dials) return null;
            const raw = profile.layers[layer]?.keys[index] ?? 'KC_NO';
            const binding = resolvedBinding(profile, layer, index, mask);
            const behavior = behaviorFor(raw);
            const label = labelFor(binding, profile.locale);
            const className = ['keycap', position.row === 2 && !position.thumb && 'home-key', position.thumb && 'thumb-key',
              position.dial && 'physical-dial', pressed?.has(position.id) && 'pressed-key', target === position.id && 'target-key',
              selected === position.id && 'selected-key', tested?.has(position.id) && 'tested-key', flagged?.has(position.id) && 'flagged-key',
              heat && heat[position.id] > 0 && 'heat-key', behavior === 'Capa' && 'layer-key', behavior === 'Transparente' && 'inherited-key',
              label.length > 4 && 'long-key'].filter(Boolean).join(' ');
            const style = {
              '--x': position.x, '--y': position.y, '--heat': (heat?.[position.id] ?? 0) / max,
            } as CSSProperties;
            const fullLabel = (position.dial ? 'Pulsación EC11 · ' : '') + label + ' · ' + raw +
              (heat ? ' · ' + (heat[position.id] ?? 0) + ' pulsaciones' : '');
            const content = position.dial ? <RotateCw size={17} /> : <>{label}{behavior === 'Mod-Tap' && <small>MT</small>}{behavior === 'Layer-Tap' && <small>LT</small>}</>;
            return onSelect
              ? <button type="button" key={position.id} className={className} style={style} title={fullLabel} aria-label={fullLabel}
                  aria-pressed={selected === position.id} onClick={() => onSelect(position)}>{content}</button>
              : <span key={position.id} className={className} style={style} title={fullLabel}>{content}</span>;
          })}
          {dials && profile.geometry === 'studio' && <button type="button" className="keycap physical-dial studio-dial"
            style={{ '--x': hand === 0 ? .36 : 5.65, '--y': 4.48 } as CSSProperties}
            aria-label={'Dial EC11 ' + (hand === 0 ? 'izquierdo' : 'derecho')} aria-expanded={dialInfo === hand}
            onClick={() => setDialInfo(dialInfo === hand ? undefined : hand)}><RotateCw size={17} /></button>}
        </div>
      </div>)}
    </div>
    {dialInfo !== undefined && <div className="dial-detail">
      <strong>EC11 {dialInfo === 0 ? 'izquierdo' : 'derecho'}</strong>
      {[0, 1].map(direction => {
        const code = profile.encoders?.[layer]?.[dialInfo]?.[direction];
        const text = code ? labelFor(code, profile.locale) : 'Sin asignar';
        const Icon = direction ? RotateCw : RotateCcw;
        return onDial ? <button type="button" key={direction} className="button button-quiet" onClick={() => onDial(dialInfo, direction as 0 | 1)}><Icon size={14} />{text}</button>
          : <span key={direction}><Icon size={14} />{text}</span>;
      })}
    </div>}
  </div>;
}

export function KeyboardPanel({ profile, layer, onLayer, children, title = 'Teclado en vivo', ...board }: BoardProps & {
  onLayer?: (layer: number) => void; children?: ReactNode; title?: string;
}) {
  return <section className="panel keyboard-panel">
    <SectionHead icon={Keyboard} title={title}
      description={profile.geometry === 'studio' ? 'bCorne 4×6 · 56 teclas y 2 diales EC11' : 'BCORNE M57 · matriz QMK 10 × 7'}>
      {onLayer && <LayerSelect profile={profile} layer={layer} onChange={onLayer} />}
    </SectionHead>
    <Board profile={profile} layer={layer} {...board} />
    {children && <div className="keyboard-legend">{children}</div>}
  </section>;
}

export function KeyDetails({ profile, layer, position }: { profile: Profile; layer: number; position: Position }) {
  const index = positionsFor(profile).indexOf(position);
  const raw = profile.layers[layer].keys[index];
  const binding = resolvedBinding(profile, layer, index);
  return <div className="key-details">
    <div className="key-detail-heading"><span className="sample-key">{labelFor(binding, profile.locale)}</span>
      <div><strong>{behaviorFor(raw)}</strong><div className="muted">{position.half === 'left' ? 'Izquierda' : 'Derecha'} · {fingerFor(position)}</div></div>
    </div>
    <dl className="details-list">
      <div><dt>Posición</dt><dd>{position.matrix ? position.matrix.join(' : ') : 'R' + position.row + ' · C' + position.col}</dd></div>
      <div><dt>Asignación</dt><dd><code>{raw}</code></dd></div>
      {raw !== binding && <div><dt>Acción heredada</dt><dd><code>{binding}</code></dd></div>}
    </dl>
  </div>;
}

export function Metric({ label, value, unit, icon: Icon }: { label: string; value: ReactNode; unit?: string; icon?: LucideIcon }) {
  return <div className="metric"><span className="metric-label">{Icon && <Icon size={15} aria-hidden="true" />}{label}</span>
    <strong>{value}{unit && <small>{unit}</small>}</strong></div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty"><CircleHelp size={19} aria-hidden="true" />{children}</div>;
}
