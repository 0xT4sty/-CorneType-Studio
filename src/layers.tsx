import { useState, type FormEvent } from 'react';
import { ArrowRight, BookOpen, Check, Download, Fingerprint, Layers3, Link2, RotateCcw, RotateCw, Settings2, SlidersHorizontal, X } from 'lucide-react';
import { defaultSelection, download, studioSource, vialSource } from './keymap-files';
import { behaviorFor, labelFor, positionsFor, type Combo, type Profile } from './keyboard';
import { KeyDetails, KeyboardPanel, LayerCards, PageIntro, SectionHead } from './ui';

const descriptions = [
  'La distribución de partida para escribir y coordinar ambas manos.',
  'Accesos a símbolos y atajos al alcance del pulgar.',
  'Fila de funciones y accesos numéricos.',
  'Atajos de navegación sin alejarte de la fila base.',
  'Controles de sistema, iluminación y multimedia.',
];

export function LayerExplorer({ profile }: { profile: Profile }) {
  const [layer, setLayer] = useState(0);
  const [selection, setSelection] = useState(() => defaultSelection(profile));
  const position = positionsFor(profile).find(item => item.id === selection) ?? positionsFor(profile)[0];
  return <>
    <PageIntro category="Teclado" title="Explorador de capas" description="Recorre las capas y localiza las teclas de acceso, los símbolos y los atajos de tu perfil.">
      <a className="button button-secondary" href="#configurador"><Settings2 size={17} />Editar asignaciones</a>
    </PageIntro>
    <LayerCards profile={profile} layer={layer} onChange={setLayer} />
    <div className="sidebar-grid">
      <KeyboardPanel title={'L' + layer + ' · ' + profile.layers[layer].name} profile={profile} layer={layer} selected={position.id}
        onSelect={item => setSelection(item.id)}>
        <span><i className="legend-swatch target" />Tecla seleccionada</span>
        <span><i className="legend-swatch layer" />Acceso a capa</span>
        <span><i className="legend-swatch home" />Fila base</span>
      </KeyboardPanel>
      <section className="panel inset-panel">
        <SectionHead icon={Fingerprint} title="Detalle de tecla" description="Selecciona una posición de la matriz." />
        <KeyDetails profile={profile} layer={layer} position={position} />
      </section>
    </div>
    <div className="two-columns">
      <section className="panel inset-panel">
        <SectionHead icon={Layers3} title="Sobre esta capa" />
        <p>{profile.geometry === 'studio' && layer < descriptions.length ? descriptions[layer] : 'Distribución del perfil ' + profile.name + '.'}</p>
        <p className="muted">Una asignación transparente hereda la función de la capa base en esta vista.</p>
      </section>
      <section className="panel inset-panel">
        <SectionHead icon={RotateCw} title="Diales rotatorios EC11" />
        <div className="encoder-list">{['Izquierdo', 'Derecho'].map((hand, index) =>
          <div key={hand}><strong>{hand}</strong>
            <span><RotateCcw size={15} />{profile.encoders?.[layer]?.[index]?.[0] ? labelFor(profile.encoders[layer][index][0], profile.locale) : 'Sin asignar'}</span>
            <span><RotateCw size={15} />{profile.encoders?.[layer]?.[index]?.[1] ? labelFor(profile.encoders[layer][index][1], profile.locale) : 'Sin asignar'}</span>
          </div>)}</div>
      </section>
    </div>
  </>;
}

const templates: Record<string, string> = {
  'Pulsación': 'KC_A', 'Mod-Tap': 'MT(MOD_LSFT, KC_F)', 'Layer-Tap': 'LT(1, KC_SPC)', 'Tap-Dance': 'TD(0)',
  'Capa': 'MO(1)', 'Transparente': 'KC_TRNS', 'Desactivada': 'KC_NO',
};
const zmkTemplates: Record<string, string> = {
  'Pulsación': '&kp A', 'Mod-Tap': '&mt LSHIFT F', 'Layer-Tap': '&lt 1 SPACE', 'Tap-Dance': '&td',
  'Capa': '&mo 1', 'Transparente': '&trans', 'Desactivada': '&none',
};
const commonKeys = 'ESC TAB ENT BSPC SPC A S D F H J K L LEFT DOWN UP RGHT LCTL LSFT LALT'.split(' ');

function validBinding(value: string) {
  return value.length <= 128 && (value === '_______' || /^(?:0x[0-9a-f]+|[A-Z][A-Z0-9_]*)(?:\([A-Z0-9_, ]+\))?$/i.test(value) ||
    /^&[\w-]+(?:\s+[\w+()-]+)*$/.test(value));
}

export function KeymapStudio({ profile, onChange }: { profile: Profile; onChange: (profile: Profile) => void }) {
  const [layer, setLayer] = useState(0);
  const [selection, setSelection] = useState(() => defaultSelection(profile));
  const [draft, setDraft] = useState<string>();
  const [status, setStatus] = useState('');
  const [comboMode, setComboMode] = useState(false);
  const [comboKeys, setComboKeys] = useState<string[]>([]);
  const [comboAction, setComboAction] = useState('KC_ESC');
  const [comboStatus, setComboStatus] = useState('');
  const [dial, setDial] = useState(0);
  const [dialCodes, setDialCodes] = useState<string[]>();
  const [dialStatus, setDialStatus] = useState('');
  const positions = positionsFor(profile);
  const index = Math.max(0, positions.findIndex(item => item.id === selection));
  const position = positions[index];
  const binding = profile.layers[layer].keys[index];
  const value = draft ?? binding;
  const zmk = profile.layers[0].keys.some(key => key.startsWith('&'));
  const options = zmk ? zmkTemplates : templates;
  const kind = behaviorFor(value);
  const currentDial = dialCodes ?? profile.encoders?.[layer]?.[dial] ?? ['KC_NO', 'KC_NO'];

  function save(event: FormEvent) {
    event.preventDefault();
    const next = value.trim();
    if (!validBinding(next) || profile.vial && next.startsWith('&')) {
      setStatus(profile.vial ? 'Usa un código QMK para este perfil Vial.' : 'Usa un código QMK válido o una asignación ZMK, como &kp A.');
      return;
    }
    onChange({ ...profile, layers: profile.layers.map((item, level) => level !== layer ? item : {
      ...item, keys: item.keys.map((key, keyIndex) => keyIndex === index ? next : key),
    }) });
    setDraft(undefined);
    setStatus('Asignación guardada en el perfil local.');
  }

  function saveCombo(event: FormEvent) {
    event.preventDefault();
    if (comboKeys.length < 2 || !validBinding(comboAction.trim())) {
      setComboStatus('Elige dos o más posiciones y escribe una acción válida.');
      return;
    }
    const combo: Combo = { positions: comboKeys, action: comboAction.trim() };
    onChange({ ...profile, combos: [...profile.combos.filter(item =>
      item.positions.length !== comboKeys.length || !item.positions.every(id => comboKeys.includes(id))), combo] });
    setComboMode(false);
    setComboKeys([]);
    setComboStatus('Combo guardado en el perfil local.');
  }

  function saveDial(event: FormEvent) {
    event.preventDefault();
    if (!currentDial.every(code => validBinding(code.trim()) && (!profile.vial || !code.trim().startsWith('&')))) {
      setDialStatus('Escribe un código válido para cada sentido de giro.');
      return;
    }
    const encoders = profile.layers.map((_, level) => [0, 1].map(side => level === layer && side === dial
      ? currentDial.map(code => code.trim()) : profile.encoders?.[level]?.[side] ?? ['KC_NO', 'KC_NO']));
    onChange({ ...profile, encoders });
    setDialCodes(undefined);
    setDialStatus('Dial guardado en el perfil local.');
  }

  return <>
    <PageIntro category="Teclado" title="Configurador de teclas" description="Edita tu distribución, prueba comportamientos y guarda una copia del perfil.">
      <div className="button-row">
        {profile.vial && <button className="button button-secondary" type="button" title="Descarga las asignaciones y los diales para Vial"
          onClick={() => download('bcorne-cornetype.vil', vialSource(profile))}><Download size={17} />Exportar Vial</button>}
        <button className="button button-primary" type="button" onClick={() => download('cornetype-keymap.json', studioSource(profile))}><Download size={17} />Exportar perfil</button>
      </div>
    </PageIntro>
    <LayerCards profile={profile} layer={layer} onChange={value => {
      setLayer(value); setDraft(undefined); setDialCodes(undefined); setStatus(''); setDialStatus('');
    }} />
    <div className="sidebar-grid">
      <KeyboardPanel title="Matriz de asignaciones" profile={profile} layer={layer} selected={comboMode ? undefined : position.id}
        tested={comboMode ? new Set(comboKeys) : undefined} onSelect={item => {
          if (comboMode) setComboKeys(keys => keys.includes(item.id) ? keys.filter(key => key !== item.id) : [...keys, item.id]);
          else { setSelection(item.id); setDraft(undefined); setStatus(''); }
        }}>
        <span><i className="legend-swatch target" />{comboMode ? 'Posiciones del combo' : 'Tecla seleccionada'}</span>
        <span><i className="legend-swatch layer" />Acceso a capa</span>
        <span className="legend-note">{comboMode ? comboKeys.length + ' seleccionadas' : 'Haz clic en una tecla para editarla'}</span>
      </KeyboardPanel>
      <section className="panel inset-panel">
        <SectionHead icon={Settings2} title="Asignación" />
        <KeyDetails profile={profile} layer={layer} position={position} />
        <form className="field-stack" onSubmit={save}>
          <label>Comportamiento<select value={kind} onChange={event => setDraft(options[event.target.value])}>
            {Object.keys(options).map(option => <option key={option}>{option}</option>)}
          </select></label>
          <label>Código de tecla<input value={value} onChange={event => setDraft(event.target.value)} spellCheck={false} required /></label>
          {kind === 'Tap-Dance' && <small className="muted">Usa el identificador de una secuencia definida en tu firmware.</small>}
          <button className="button button-primary" type="submit"><Check size={16} />Guardar tecla</button>
          {status && <small role="status">{status}</small>}
        </form>
      </section>
    </div>
    <div className="two-columns">
      <section className="panel inset-panel">
        <SectionHead icon={SlidersHorizontal} title="Umbral Tap / Hold" description="Ajusta el umbral de la calibración local." />
        <div className="range-heading"><label htmlFor="tapping-term">Tapping term</label><strong>{profile.tappingTerm} ms</strong></div>
        <input type="range" id="tapping-term" min={100} max={300} step={5} value={profile.tappingTerm}
          onChange={event => onChange({ ...profile, tappingTerm: Number(event.target.value) })} />
        <div className="range-ends"><span>100 ms</span><span>300 ms</span></div>
        <label className="field-stack">Preferencia para el perfil
          <select value={profile.preference} onChange={event => onChange({ ...profile, preference: event.target.value as Profile['preference'] })}>
            <option value="balanced">Equilibrada</option><option value="tap">Priorizar toque</option><option value="hold">Priorizar mantener</option>
          </select>
        </label>
        <a className="text-link" href="#minijuegos">Probar en Home Row Mod Ninja <ArrowRight size={14} /></a>
      </section>
      <section className="panel inset-panel">
        <SectionHead icon={Link2} title="Combos" description="Asocia una acción a varias posiciones simultáneas." />
        <form className="field-stack" onSubmit={saveCombo}>
          <button type="button" className={'button ' + (comboMode ? 'button-primary' : 'button-secondary')} aria-pressed={comboMode}
            onClick={() => { setComboMode(!comboMode); setComboKeys([]); setComboStatus(''); }}>
            {comboMode ? 'Cancelar selección' : 'Seleccionar posiciones en la matriz'}
          </button>
          {comboMode && <><span>{comboKeys.length ? comboKeys.join(' + ') : 'Selecciona al menos dos teclas en la matriz.'}</span>
            <label>Acción del combo<input value={comboAction} onChange={event => setComboAction(event.target.value)} required /></label>
            <button className="button button-primary" type="submit">Guardar combo</button></>}
          {comboStatus && <small role="status">{comboStatus}</small>}
        </form>
        {profile.combos.length > 0 && <ul className="combo-list">{profile.combos.map((combo, index) =>
          <li key={index}><code>{combo.positions.join(' + ')} → {combo.action}</code>
            <button type="button" className="icon-button" aria-label={'Quitar combo ' + (index + 1)} onClick={() =>
              onChange({ ...profile, combos: profile.combos.filter((_, item) => item !== index) })}><X size={16} /></button></li>)}</ul>}
      </section>
      <section className="panel inset-panel">
        <SectionHead icon={RotateCw} title="Configuración EC11" description="Asigna los dos sentidos de giro para esta capa." />
        <form className="field-stack" onSubmit={saveDial}>
          <label>Dial<select value={dial} onChange={event => { setDial(Number(event.target.value)); setDialCodes(undefined); setDialStatus(''); }}>
            <option value={0}>Izquierdo</option><option value={1}>Derecho</option>
          </select></label>
          {[0, 1].map(direction => <label key={direction}>{direction === 0 ? 'Giro antihorario' : 'Giro horario'}
            <input value={currentDial[direction]} spellCheck={false} onChange={event =>
              setDialCodes(currentDial.map((code, index) => index === direction ? event.target.value : code))} required />
          </label>)}
          <button type="submit" className="button button-secondary">Guardar dial</button>
          {dialStatus && <small role="status">{dialStatus}</small>}
        </form>
      </section>
      <section className="panel inset-panel">
        <SectionHead icon={BookOpen} title="Biblioteca de teclas" description="Inserta un código en el campo de asignación." />
        <div className="key-library">{commonKeys.map(code => <button className="button button-quiet" key={code} type="button"
          onClick={() => { setDraft(zmk ? '&kp ' + code : 'KC_' + code); setStatus('Código insertado. Guarda la tecla para aplicarlo.'); }}>{code}</button>)}</div>
        <p className="notice">{profile.vial ? 'Exporta a Vial para cargar las asignaciones y los diales. Los combos de Studio y la calibración local se incluyen en el perfil JSON.' :
          'Las asignaciones, los combos y la calibración se guardan en el perfil local. Aplica los cambios del dispositivo en el código de tu firmware.'}</p>
      </section>
    </div>
  </>;
}
