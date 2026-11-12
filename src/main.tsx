import { lazy, StrictMode, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity as Pulse, ChartNoAxesCombined, FileUp, Gamepad2, Keyboard, Layers3, Plug, Settings2, Unplug } from 'lucide-react';
import { activityKey, loadActivity, profileKey, readLocal, writeLocal, type Usage } from './activity';
import { Diagnostics, emptyTest, recordTest } from './diagnostics';
import { Games } from './games';
import { useHardware, type MatrixEvent } from './hid';
import { parseKeymap, studioSource } from './keymap-files';
import { behaviorFor, labelFor, m57Profile, positionForEvent, positionsFor, resolvedBinding, studioProfile, type Profile } from './keyboard';
import { KeymapStudio, LayerExplorer } from './layers';
import { Metrics } from './metrics';
import { Practice } from './practice';
import { Mark } from './ui';
import './styles.css';

const Importer = lazy(() => import('./importer').then(module => ({ default: module.Importer })));

const pages = [
  { id: 'practica', label: 'Práctica', icon: Keyboard },
  { id: 'minijuegos', label: 'Minijuegos', icon: Gamepad2 },
  { id: 'capas', label: 'Capas', icon: Layers3 },
  { id: 'configurador', label: 'Configurador', icon: Settings2 },
  { id: 'cargar-keymap', label: 'Cargar keymap', icon: FileUp },
  { id: 'metricas', label: 'Métricas', icon: ChartNoAxesCombined },
  { id: 'diagnostico', label: 'Diagnóstico', icon: Pulse },
] as const;

const noKeys = new Set<string>();
const readPage = () => pages.find(page => page.id === window.location.hash.slice(1))?.id ?? 'practica';
const highestLayer = (mask: number, profile: Profile) => {
  for (let layer = profile.layers.length - 1; layer > 0; layer--) if (mask & (1 << layer)) return layer;
  return 0;
};

function loadProfile() {
  const source = readLocal(profileKey);
  try { return source ? parseKeymap(source, 'cornetype.json') : studioProfile; }
  catch { return studioProfile; }
}

function App() {
  const [page, setPage] = useState(readPage);
  const [savedProfile, setSavedProfile] = useState(loadProfile);
  const [previewLayer, setPreviewLayer] = useState(0);
  const [activity, setActivity] = useState(loadActivity);
  const [test, setTest] = useState(emptyTest);
  const [browserPressed, setBrowserPressed] = useState(noKeys);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const keyboardDown = useRef(new Map<string, string>());
  const pressStart = useRef(new Map<string, number>());
  const lastMask = useRef<number | undefined>(undefined);
  const navCurrent = useRef<HTMLAnchorElement>(null);
  const activityRef = useRef(activity);
  activityRef.current = activity;

  const hardware = useHardware((event, mask) => {
    const profile = savedProfile.geometry === 'm57' ? savedProfile : m57Profile;
    register(event, profile, highestLayer(mask, profile), mask);
  });
  const live = hardware.status.phase === 'live';
  const profile = live && savedProfile.geometry !== 'm57' ? m57Profile : savedProfile;
  const mask = live ? hardware.telemetry?.mask : undefined;
  const layer = mask === undefined ? Math.min(previewLayer, profile.layers.length - 1) : highestLayer(mask, profile);
  const pressed = live ? hardware.telemetry?.pressed ?? noKeys : browserPressed;
  const tracking = page === 'practica' || page === 'minijuegos';

  function updateUsage(geometry: Profile['geometry'], update: (usage: Usage) => Usage) {
    setActivity(previous => ({ ...previous, usage: { ...previous.usage, [geometry]: update(previous.usage[geometry]) } }));
  }

  function register(event: MatrixEvent, map: Profile, level: number, layerMask?: number, virtual = false) {
    const index = positionsFor(map).findIndex(position => position.id === event.id);
    if (index === -1) return;
    const binding = resolvedBinding(map, level, index, layerMask);
    if (page === 'diagnostico') setTest(previous => recordTest(previous, { ...event, layer: level, label: labelFor(binding, map.locale), virtual }));
    if (!tracking || virtual) return;
    if (event.down) {
      if (behaviorFor(binding) === 'Mod-Tap') pressStart.current.set(event.id, event.at);
      updateUsage(map.geometry, usage => ({ ...usage, keys: { ...usage.keys, [event.id]: (usage.keys[event.id] ?? 0) + 1 },
        layers: { ...usage.layers, [level]: (usage.layers[level] ?? 0) + 1 } }));
    } else {
      const start = pressStart.current.get(event.id);
      pressStart.current.delete(event.id);
      if (start !== undefined) updateUsage(map.geometry, usage => event.at - start >= map.tappingTerm ?
        { ...usage, holds: usage.holds + 1 } : { ...usage, taps: usage.taps + 1 });
    }
  }

  const browserEvent = useRef<(event: KeyboardEvent, down: boolean) => void>(() => {});
  browserEvent.current = (event, down) => {
    if (live || event.repeat || event.metaKey) return;
    if (down) {
      if (!tracking && page !== 'diagnostico') return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, select, textarea, [contenteditable]') && target.id !== 'typing-input') return;
      if (target instanceof HTMLElement && target.closest('button, a') && (event.key === 'Enter' || event.key === ' ')) return;
      const position = positionForEvent(profile, layer, event);
      if (!position || keyboardDown.current.has(event.code)) return;
      keyboardDown.current.set(event.code, position.id);
      if (page === 'diagnostico' && event.key === ' ') event.preventDefault();
    }
    const id = keyboardDown.current.get(event.code);
    if (!id) return;
    if (!down) keyboardDown.current.delete(event.code);
    setBrowserPressed(new Set(keyboardDown.current.values()));
    register({ id, down, at: event.timeStamp }, profile, layer);
  };

  useEffect(() => {
    const navigate = () => {
      setPage(readPage());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    document.title = (pages.find(item => item.id === page)?.label ?? 'Práctica') + ' · CorneType Studio';
    const current = navCurrent.current;
    const nav = current?.parentElement;
    if (current && nav && nav.scrollWidth > nav.clientWidth) {
      const offset = current.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
      if (offset < nav.scrollLeft || offset + current.offsetWidth > nav.scrollLeft + nav.clientWidth) {
        nav.scrollLeft = offset - Math.max(0, (nav.clientWidth - current.offsetWidth) / 2);
      }
    }
  }, [page]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => browserEvent.current(event, true);
    const up = (event: KeyboardEvent) => browserEvent.current(event, false);
    const clear = () => {
      keyboardDown.current.clear();
      pressStart.current.clear();
      setBrowserPressed(noKeys);
      setTest(previous => previous.pressed.size ? { ...previous, pressed: noKeys } : previous);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);
  useEffect(() => {
    keyboardDown.current.clear();
    pressStart.current.clear();
    setBrowserPressed(noKeys);
    setTest(emptyTest);
  }, [live, profile.geometry]);
  useEffect(() => {
    if (mask !== undefined && lastMask.current !== undefined && lastMask.current !== mask && tracking) {
      setActivity(previous => ({ ...previous, usage: { ...previous.usage, m57: { ...previous.usage.m57, changes: previous.usage.m57.changes + 1 } } }));
    }
    lastMask.current = mask;
  }, [mask, tracking]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!writeLocal(activityKey, JSON.stringify(activity))) setStorageUnavailable(true);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [activity]);
  useEffect(() => {
    const save = () => { writeLocal(activityKey, JSON.stringify(activityRef.current)); };
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, []);

  function changeProfile(next: Profile) {
    setPreviewLayer(0);
    setSavedProfile(next);
    if (!writeLocal(profileKey, studioSource(next))) setStorageUnavailable(true);
  }

  const { status, connection } = hardware;
  const sourceText = live ? 'M57 conectado' : status.phase === 'connecting' ? 'Conectando…' : 'Sin conexión USB';

  return <>
    <a className="skip-link" href="#contenido" onClick={event => { event.preventDefault(); document.getElementById('contenido')?.focus(); }}>Ir al contenido</a>
    <div className="site-header">
      <div className="header-inner">
        <a className="brand" href="#practica" aria-label="CorneType Studio, práctica"><Mark /><span><strong>CorneType</strong><small>Studio</small></span></a>
        <nav className="nav" aria-label="Navegación principal">
          {pages.map(({ id, label, icon: Icon }) => <a key={id} href={'#' + id} ref={page === id ? navCurrent : undefined}
            className={page === id ? 'current' : undefined} aria-current={page === id ? 'page' : undefined}><Icon size={16} />{label}</a>)}
        </nav>
        <div className="connection">
          <button type="button" className={'button usb-button ' + (live ? 'button-secondary' : 'button-primary')}
            onClick={() => void (live || status.phase === 'connecting' ? connection.close() : connection.connect())}>
            {live ? <Unplug size={16} /> : <Plug size={16} />}
            {live ? 'Desconectar' : status.phase === 'connecting' ? 'Cancelar USB' : 'Conectar USB'}
          </button>
        </div>
      </div>
    </div>
    <div className="context-bar">
      <div className="container context-inner">
        <span><i className={'state-dot ' + (live ? 'live' : '')} />{sourceText}</span>
        <span><Keyboard size={14} />{profile.geometry === 'studio' ? 'bCorne 4×6 + 4' : 'BCORNE M57'}</span>
      </div>
    </div>
    <main className="container main-content" id="contenido" tabIndex={-1}>
      {(status.phase === 'connecting' || status.phase === 'error') && <p className={'notice usb-notice ' + (status.phase === 'error' ? 'error' : '')} role="status"><Plug size={17} />{status.message}</p>}
      {storageUnavailable && <p className="notice error" role="status">El almacenamiento local no está disponible. Exporta tus datos antes de cerrar la pestaña.</p>}
      {page === 'practica' && <Practice profile={profile} layer={layer} mask={mask} pressed={pressed} usage={activity.usage[profile.geometry]}
        onLayer={live ? undefined : setPreviewLayer} onFinish={session => setActivity(previous => ({ ...previous, sessions: [...previous.sessions.slice(-499), session] }))}
        onErrors={count => updateUsage(profile.geometry, usage => ({ ...usage, errors: { ...usage.errors, [layer]: (usage.errors?.[layer] ?? 0) + count } }))} />}
      {page === 'minijuegos' && <Games profile={profile} records={activity.records} pressed={pressed} layer={layer} mask={mask}
        onResult={(id, score) => setActivity(previous => ({ ...previous, records: { ...previous.records, [id]: Math.max(score, previous.records[id] ?? 0) } }))} />}
      {page === 'capas' && <LayerExplorer key={profile.geometry + profile.name} profile={profile} />}
      {page === 'configurador' && <KeymapStudio key={profile.geometry + profile.name} profile={profile} onChange={changeProfile} />}
      {page === 'cargar-keymap' && <Suspense fallback={<p role="status">Cargando el editor de keymaps…</p>}><Importer profile={savedProfile} onApply={next => {
        changeProfile(next);
        if (live && next.geometry !== 'm57') void connection.close();
      }} /></Suspense>}
      {page === 'metricas' && <Metrics profile={profile} activity={activity} />}
      {page === 'diagnostico' && <Diagnostics profile={profile} layer={layer} mask={mask} pressed={pressed} run={test}
        source={live ? 'usb' : 'browser'} onReset={() => setTest(emptyTest)} onVirtual={id => {
          const at = performance.now();
          register({ id, down: true, at }, profile, layer, undefined, true);
          register({ id, down: false, at: at + 30 }, profile, layer, undefined, true);
        }} />}
    </main>
    <footer className="site-footer"><div className="container">
      <a className="footer-brand" href="#practica"><Mark />CorneType Studio</a>
      <span>Entrenamiento y diagnóstico para teclados divididos</span>
    </div></footer>
  </>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<StrictMode><App /></StrictMode>);
import.meta.hot?.dispose(() => root.unmount());
