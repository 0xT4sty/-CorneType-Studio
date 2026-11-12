import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CloudRain, Fingerprint, Gamepad2, Keyboard, Play, RotateCw, Shuffle, Timer, Trophy } from 'lucide-react';
import { formatTime, type Activity } from './activity';
import { type Profile } from './keyboard';
import { KeyboardPanel, Metric, PageIntro, SectionHead } from './ui';

const games = [
  { id: 'rain', title: 'Symbol Rain', description: 'Teclea números y símbolos antes de que lleguen al borde inferior.', skill: 'Símbolos y capas', icon: CloudRain },
  { id: 'vim', title: 'Vim Sprint', description: 'Navega hasta cada objetivo con H, J, K y L desde la fila base.', skill: 'Navegación HJKL', icon: Keyboard },
  { id: 'thumb', title: 'Thumb Cluster Duel', description: 'Alterna Espacio, Enter y Retroceso en el orden indicado.', skill: 'Coordinación de pulgares', icon: Fingerprint },
  { id: 'dial', title: 'Encoder Rhythm', description: 'Alterna los sentidos con flechas o con un dial que emita esas teclas.', skill: 'Salida de los diales', icon: RotateCw },
  { id: 'hold', title: 'Home Row Mod Ninja', description: 'Practica toques y retenciones alrededor de tu tapping term.', skill: 'Calibración Tap / Hold', icon: Timer },
] as const;
type Game = typeof games[number];
const glyphs = Array.from('0123456789{}[]()<>#@!?%&+-=');
const navigation = { h: [-1, 0], j: [0, 1], k: [0, -1], l: [1, 0] };
const thumbs = [' ', 'Enter', 'Backspace'];
const thumbLabels: Record<string, string> = { ' ': 'Espacio', Enter: 'Enter', Backspace: 'Retroceso' };
const dialLabels: Record<string, string> = { ArrowLeft: 'Antihorario', ArrowRight: 'Horario' };
const paths = [8, 20, 5, 16, 2, 23, 9, 14, 18, 1];
const duration = 30_000;
const dropTime = 2650;

type Round = { score: number; misses: number; turn: number; started: number; itemAt: number; cell: number; time: number; phase: 'idle' | 'ready' | 'playing' | 'ended' };
const waiting: Round = { score: 0, misses: 0, turn: 0, started: 0, itemAt: 0, cell: 12, time: 0, phase: 'idle' };

function Arena({ game, profile, record, onResult }: { game: Game; profile: Profile; record: number; onResult: (id: string, score: number) => void }) {
  const [round, setRound] = useState(waiting);
  const current = useRef(round);
  const field = useRef<HTMLDivElement>(null);
  const downAt = useRef<number | undefined>(undefined);
  const [measured, setMeasured] = useState<number>();
  const [seed, setSeed] = useState(0);
  const result = useRef(onResult);
  result.current = onResult;
  const goal = paths[(round.turn + seed) % paths.length];
  const symbol = glyphs[(round.turn * 7 + seed) % glyphs.length];
  const thumb = thumbs[(round.turn + seed) % thumbs.length];
  const dial = (round.turn + seed) % 2 ? 'ArrowRight' : 'ArrowLeft';
  const hold = (round.turn + seed) % 2 === 1;
  const drillKey = ['f', 'j', 'd', 'k'][(round.turn + seed) % 4];
  const acceptsInput = round.phase === 'ready' || round.phase === 'playing';

  function update(next: Round) {
    current.current = next;
    setRound(next);
  }

  function startOnInput(now: number) {
    const active = current.current;
    if (active.phase === 'playing') return active;
    if (active.phase !== 'ready') return;
    const started: Round = { ...active, started: now, itemAt: now, time: now, phase: 'playing' };
    update(started);
    return started;
  }

  function advance(correct: boolean) {
    const now = performance.now();
    const active = startOnInput(now);
    if (!active) return;
    update({ ...active, score: active.score + Number(correct), misses: active.misses + Number(!correct),
      turn: active.turn + 1, itemAt: now });
  }

  useEffect(() => {
    if (round.phase !== 'playing') return;
    const timer = window.setInterval(() => {
      const active = current.current;
      if (active.phase !== 'playing') return;
      const now = performance.now();
      if (now - active.started >= duration) {
        update({ ...active, phase: 'ended', time: active.started + duration });
        result.current(game.id, active.score);
        return;
      }
      if (game.id === 'rain' && now - active.itemAt >= dropTime) {
        update({ ...active, time: now, itemAt: now, turn: active.turn + 1, misses: active.misses + 1 });
        return;
      }
      update({ ...active, time: now });
    }, 55);
    return () => window.clearInterval(timer);
  }, [round.phase, game.id]);

  function prepare() {
    setSeed(Math.floor(Math.random() * 100));
    setMeasured(undefined);
    downAt.current = undefined;
    update({ ...waiting, phase: 'ready' });
    field.current?.focus();
  }

  function move(key: keyof typeof navigation) {
    const active = startOnInput(performance.now());
    if (!active) return;
    const [dx, dy] = navigation[key];
    const x = active.cell % 5 + dx;
    const y = Math.floor(active.cell / 5) + dy;
    if (x < 0 || x > 4 || y < 0 || y > 4) { update({ ...active, misses: active.misses + 1 }); return; }
    const cell = y * 5 + x;
    update({ ...active, cell });
    if (cell === goal) advance(true);
  }

  function beginGesture() {
    const now = performance.now();
    if (downAt.current === undefined && startOnInput(now)) downAt.current = now;
  }

  function endGesture() {
    if (current.current.phase !== 'playing' || downAt.current === undefined) return;
    const elapsed = Math.round(performance.now() - downAt.current);
    downAt.current = undefined;
    setMeasured(elapsed);
    advance(hold === (elapsed >= profile.tappingTerm));
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!acceptsInput || event.repeat || event.metaKey || event.ctrlKey) return;
    const key = event.key;
    if (game.id === 'vim' && Object.hasOwn(navigation, key.toLowerCase())) {
      event.preventDefault(); move(key.toLowerCase() as keyof typeof navigation);
    } else if (game.id === 'rain' && key.length === 1 && (key !== ' ' || event.target === event.currentTarget)) {
      event.preventDefault(); advance(key === symbol);
    } else if (game.id === 'thumb' && thumbs.includes(key) && event.target === event.currentTarget) {
      event.preventDefault(); advance(key === thumb);
    } else if (game.id === 'dial' && key in dialLabels) {
      event.preventDefault(); advance(key === dial);
    } else if (game.id === 'hold' && key.toLowerCase() === drillKey) {
      event.preventDefault(); beginGesture();
    }
  }

  function keyUp(event: KeyboardEvent<HTMLDivElement>) {
    if (game.id === 'hold' && event.key.toLowerCase() === drillKey) endGesture();
  }

  const timeLeft = Math.max(0, Math.ceil((duration - (round.time - round.started)) / 1000));
  let stage: ReactNode;
  if (game.id === 'vim') {
    stage = <><div className="vim-grid" role="img" aria-label={'Cursor en ' + round.cell + ', objetivo en ' + goal}>
      {Array.from({ length: 25 }, (_, cell) => <i key={cell} className={cell === round.cell ? 'vim-cursor' : cell === goal ? 'vim-goal' : ''}>{cell === goal ? '◎' : cell === round.cell ? '▣' : '·'}</i>)}
    </div><div className="game-keys">{Object.entries({ h: ArrowLeft, j: ArrowDown, k: ArrowUp, l: ArrowRight }).map(([key, Icon]) =>
      <button className="button button-secondary" key={key} type="button" disabled={!acceptsInput}
        onClick={() => { move(key as keyof typeof navigation); field.current?.focus(); }}><Icon size={15} />{key.toUpperCase()}</button>)}</div></>;
  } else if (game.id === 'rain') {
    const offset = round.phase === 'playing' ? Math.max(0, Math.min(1, (round.time - round.itemAt) / dropTime)) : 0;
    stage = <><div className="rain-stage" aria-label="Símbolo actual"><span className="rain-line" />
      <strong className="rain-glyph" style={{ top: 12 + offset * 62 + '%', left: 25 + (round.turn % 4) * 17 + '%' }}>{symbol}</strong>
    </div><div className="game-keys">{[...new Set([glyphs[(round.turn + seed + 3) % glyphs.length], symbol, glyphs[(round.turn + seed + 9) % glyphs.length]])].sort()
      .map(key => <button key={key} className="button button-secondary" disabled={!acceptsInput} type="button"
        onClick={() => { advance(key === symbol); field.current?.focus(); }}>{key}</button>)}</div></>;
  } else if (game.id === 'hold') {
    stage = <div className="prompt-stage"><span>{hold ? 'Mantén la tecla' : 'Toca y suelta'}</span><kbd>{drillKey.toUpperCase()}</kbd>
      <small>Umbral {profile.tappingTerm} ms{measured === undefined ? '' : ' · Último gesto ' + measured + ' ms'}</small>
      <button className="button button-secondary" type="button" disabled={!acceptsInput}
        onPointerDown={event => {
          if (event.button !== 0 || !event.isPrimary) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          beginGesture();
        }}
        onPointerCancel={() => { downAt.current = undefined; }}
        onPointerUp={event => { if (event.isPrimary) endGesture(); }}>Practicar con el dedo</button>
    </div>;
  } else {
    const isDial = game.id === 'dial';
    const labels = isDial ? dialLabels : thumbLabels;
    const target = isDial ? dial : thumb;
    stage = <div className="prompt-stage"><span>{isDial ? 'Sentido solicitado' : 'Tecla solicitada'}</span><kbd>{labels[target]}</kbd>
      <div className="game-keys">{Object.entries(labels).map(([key, label]) =>
        <button className="button button-secondary" key={key} type="button" disabled={!acceptsInput}
          onClick={() => { advance(key === target); field.current?.focus(); }}>{label}</button>)}</div></div>;
  }

  return <div className="sidebar-grid game-play">
    <section className="panel inset-panel">
      <SectionHead icon={game.icon} title={game.title} description={game.description}>
        <button type="button" className="button button-primary" disabled={acceptsInput} onClick={prepare}><Play size={16} />{round.phase === 'ended' ? 'Volver a jugar' : 'Jugar'}</button>
      </SectionHead>
      <div className="game-field" ref={field} tabIndex={0} aria-label={'Zona de juego de ' + game.title} onKeyDown={keyDown} onKeyUp={keyUp}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) downAt.current = undefined; }}>{stage}</div>
      {round.phase === 'ready' && <p className="notice" role="status">Haz la primera jugada para iniciar el reloj.</p>}
      {round.phase === 'ended' && <p className="notice success" role="status">Partida terminada · {round.score} aciertos y {round.misses} fallos.</p>}
    </section>
    <section className="panel inset-panel game-stats">
      <SectionHead icon={Gamepad2} title="Partida de 30 segundos" />
      <div className="session-metrics">
        <Metric label="Tiempo restante" value={formatTime(timeLeft)} />
        <Metric label="Aciertos" value={round.score} />
        <Metric label="Fallos" value={round.misses} />
        <Metric label="Récord" value={Math.max(record, round.score)} icon={Trophy} />
      </div>
    </section>
  </div>;
}

export function Games({ profile, records, onResult, layer, pressed, mask }: {
  profile: Profile; records: Activity['records']; onResult: (id: string, score: number) => void;
  layer: number; pressed: Set<string>; mask?: number;
}) {
  const [choice, setChoice] = useState(0);
  return <>
    <PageIntro category="Entrenamiento" title="Arena de minijuegos" description="Entrena reflejos, atajos y coordinación de ambas manos en partidas breves.">
      <button type="button" className="button button-secondary" onClick={() =>
        setChoice((choice + 1 + Math.floor(Math.random() * (games.length - 1))) % games.length)}><Shuffle size={17} />Elegir al azar</button>
    </PageIntro>
    <div className="game-tabs" aria-label="Minijuegos">{games.map((game, index) => <button key={game.id} type="button"
      className={'panel game-tab ' + (choice === index ? 'active' : '')} aria-pressed={choice === index} onClick={() => setChoice(index)}>
      <span className="icon-tile"><game.icon size={17} /></span><span><strong>{game.title}</strong><small>{game.skill}</small></span>
    </button>)}</div>
    <Arena key={games[choice].id} game={games[choice]} profile={profile} record={records[games[choice].id] ?? 0} onResult={onResult} />
    <KeyboardPanel title="Monitor físico" profile={profile} layer={layer} pressed={pressed} mask={mask} />
  </>;
}
