import { useEffect, useRef, useState } from 'react';
import { Activity as Pulse, ArrowRight, AudioLines, ChevronDown, Code2, Crosshair, Fingerprint, Gamepad2, Hourglass, Keyboard, Leaf, Play, RotateCcw, Timer, Volume2, VolumeX } from 'lucide-react';
import { formatTime, number, typingStats, type Session, type Usage } from './activity';
import { positionsFor, positionForTarget, type Profile } from './keyboard';
import { KeyboardPanel, Metric, PageIntro, SectionHead } from './ui';

const exercises = [
  { label: 'Prosa en español', short: 'Prosa', texts: [
    'La práctica constante mejora la coordinación. Coloca los dedos en la fila base y encuentra un ritmo cómodo. Escribe con calma.',
    'La luz de la mañana entra por la ventana. Antes de empezar, respira y acomoda las manos. Cada pulsación precisa ayuda a encontrar un ritmo natural.',
  ] },
  { label: 'Código JavaScript', short: 'Código', texts: [
    'const keys = layout.map(key => key.label);\nif (keys.length > 0) {\n  console.log({ keys });\n}',
    'const total = scores.reduce((sum, score) => sum + score, 0);\nconst average = total / scores.length;',
  ] },
  { label: 'Fila base y coordinación', short: 'Fila base', texts: [
    'asdf jklñ asdf jklñ fdsa ñlkj fafa jaja dfjk asñl fjfj dkd ksl alfalfa sal sala falda hada gas jas',
    'fj dk sl añ fj dk sl añ asdf jklñ asdf jklñ gasas faldas dalas salas jaldas lados',
  ] },
  { label: 'Números y símbolos', short: 'Símbolos', texts: [
    '12345 67890 {} [] () <> => :: && || != == 12 + 34 = 46 / 2 * 7 # @ $ % ¡ ! ¿ ?',
    '98765 43210 <= >= + - = / * [{()}] 3.14 50% 60€ #1 #2 #3',
  ] },
];
type Run = {
  value: string; correct: number; attempts: number; intervals: number[];
  start: number; last: number; elapsed: number; phase: 'idle' | 'running' | 'finished';
};
const blank: Run = { value: '', correct: 0, attempts: 0, intervals: [], start: 0, last: 0, elapsed: 0, phase: 'idle' };

export function Practice({ profile, layer, onLayer, mask, pressed, usage, onFinish, onErrors }: {
  profile: Profile; layer: number; onLayer?: (layer: number) => void; mask?: number; pressed: Set<string>;
  usage: Usage; onFinish: (session: Session) => void; onErrors: (count: number) => void;
}) {
  const [mode, setMode] = useState(0);
  const [variant, setVariant] = useState(0);
  const [run, setRun] = useState(blank);
  const [sound, setSound] = useState(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const current = useRef(run);
  const composing = useRef(false);
  const audio = useRef<AudioContext>(null);
  const baseline = useRef({ geometry: profile.geometry, keys: usage.keys });
  if (baseline.current.geometry !== profile.geometry) baseline.current = { geometry: profile.geometry, keys: usage.keys };
  const exercise = exercises[mode];
  const text = exercise.texts[variant % exercise.texts.length];
  const chars = Array.from(text);
  const typed = Array.from(run.value);
  const target = run.phase !== 'finished' ? positionForTarget(profile, layer, chars[typed.length] ?? '') : undefined;
  const stats = typingStats(run.correct, run.attempts, run.elapsed, run.intervals);
  const matching = typed.filter((char, index) => char === chars[index]).length;
  const thumbHits = (half: 'left' | 'right') => positionsFor(profile).filter(position => position.half === half && position.thumb)
    .reduce((sum, { id }) => sum + Math.max(0, (usage.keys[id] ?? 0) - (baseline.current.keys[id] ?? 0)), 0);
  const left = thumbHits('left');
  const right = thumbHits('right');
  const balance = left + right > 0 ? Math.round(left * 100 / (left + right)) : null;

  useEffect(() => {
    if (run.phase !== 'running') return;
    const timer = window.setInterval(() => {
      const active = current.current;
      if (active.phase !== 'running') return;
      const next = { ...active, elapsed: (performance.now() - active.start) / 1000 };
      current.current = next;
      setRun(next);
    }, 250);
    return () => window.clearInterval(timer);
  }, [run.phase]);
  useEffect(() => () => { void audio.current?.close(); }, []);

  function reset(nextMode = mode, nextVariant = variant) {
    current.current = blank;
    baseline.current = { geometry: profile.geometry, keys: usage.keys };
    setRun(blank);
    setDraft('');
    setMode(nextMode);
    setVariant(nextVariant);
  }

  function finish(active: Run) {
    if (!active.attempts || active.phase === 'finished') return;
    const seconds = Math.max(1, (performance.now() - active.start) / 1000);
    const accepted = Array.from(active.value).filter((char, index) => char === chars[index]).length;
    const score = typingStats(active.correct, active.attempts, seconds, active.intervals);
    current.current = { ...active, elapsed: seconds, phase: 'finished' };
    setRun(current.current);
    onFinish({ at: new Date().toISOString(), mode: exercise.short, seconds: Math.round(seconds),
      wpm: typingStats(accepted, active.attempts, seconds, active.intervals).wpm, accuracy: score.accuracy, errors: active.attempts - active.correct });
    input.current?.blur();
  }

  function beep(correct: boolean) {
    if (!sound || !audio.current || audio.current.state !== 'running') return;
    const context = audio.current;
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.frequency.value = correct ? 420 : 175;
    volume.gain.setValueAtTime(.035, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(.001, context.currentTime + .065);
    tone.connect(volume).connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + .075);
  }

  function enter(raw: string) {
    const active = current.current;
    if (active.phase === 'finished') return;
    const next = Array.from(raw.normalize('NFC')).slice(0, chars.length);
    const previous = Array.from(active.value);
    const value = next.join('');
    setDraft(value);
    if (value === active.value) return;
    let start = 0;
    let end = 0;
    while (start < next.length && next[start] === previous[start]) start++;
    while (end < next.length - start && end < previous.length - start &&
      next[next.length - end - 1] === previous[previous.length - end - 1]) end++;
    const additions = next.slice(start, next.length - end);
    const correct = additions.filter((char, offset) => char === chars[start + offset]).length;
    const now = performance.now();
    const updated: Run = {
      ...active, value, attempts: active.attempts + additions.length, correct: active.correct + correct,
      start: active.start || now, last: additions.length ? now : active.last,
      intervals: additions.length && active.last ? [...active.intervals, now - active.last] : active.intervals,
      phase: 'running',
    };
    current.current = updated;
    setRun(updated);
    if (correct < additions.length) onErrors(additions.length - correct);
    if (additions.length) beep(correct === additions.length);
    if (value === text) finish(updated);
  }

  return <>
    <PageIntro category="Entrenamiento" title="Práctica de escritura" description="Entrena la memoria muscular y gana precisión con tu teclado dividido.">
      <span className="profile-chip"><Keyboard size={17} /><span><small>Perfil de práctica</small><strong>{profile.name}</strong></span></span>
    </PageIntro>
    <div className="practice-grid">
      <section className="panel practice-panel">
        <div className="practice-toolbar">
          <div className="exercise-label"><span className="icon-tile"><Code2 size={18} /></span><label>Ejercicio
            <span className="exercise-select"><select aria-label="Ejercicio de escritura" value={mode} onChange={event => reset(Number(event.target.value), 0)}>
              {exercises.map((item, index) => <option value={index} key={item.label}>{item.label}</option>)}
            </select><ChevronDown size={14} /></span>
          </label></div>
          <div className="button-row">
            <button type="button" className="icon-button" title={sound ? 'Silenciar' : 'Activar sonido'} aria-label={sound ? 'Silenciar' : 'Activar sonido'} aria-pressed={sound}
              onClick={() => {
                if (!sound && typeof AudioContext !== 'undefined') {
                  audio.current ??= new AudioContext();
                  void audio.current.resume().catch(() => {});
                }
                setSound(!sound);
              }}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
            <button type="button" className="icon-button" title="Reiniciar ejercicio" aria-label="Reiniciar ejercicio" onClick={() => reset()}><RotateCcw size={17} /></button>
          </div>
        </div>
        <div className={'typing-stage ' + (focused ? 'typing-focused ' : '') + (run.phase === 'finished' ? 'typing-complete' : '')}>
          <label className="typing-copy" htmlFor="typing-input" aria-hidden="true">
            {chars.map((char, index) => <span key={index} className={index === typed.length ? 'cursor-char' : index < typed.length ? typed[index] === char ? 'correct-char' : 'wrong-char' : ''}>{char}</span>)}
          </label>
          <label className="sr-only" htmlFor="typing-input">Escribe el texto del ejercicio</label>
          <span className="sr-only" id="practice-prompt">{text}</span>
          <textarea id="typing-input" aria-describedby="practice-prompt" ref={input} value={draft} readOnly={run.phase === 'finished'}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={event => { composing.current = false; enter(event.currentTarget.value); }}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onChange={event => composing.current ? setDraft(event.target.value) : enter(event.target.value)} />
        </div>
        <div className="practice-bottom">
          <span className="muted practice-hint" role="status"><span className="state-dot" />{run.phase === 'finished' ? 'Sesión guardada' : focused || run.phase === 'running' ? 'Escritura activa' : 'El tiempo empieza al escribir'}</span>
          {run.phase === 'finished' ? <button className="button button-primary" type="button" onClick={() => { reset(mode, variant + 1); input.current?.focus(); }}>Siguiente texto <ArrowRight size={16} /></button>
            : run.phase === 'running' ? <button className="button button-secondary" type="button" onClick={() => finish(current.current)}>Guardar sesión</button>
            : <button className="button button-primary" type="button" onClick={() => input.current?.focus()}><Play size={15} /> Empezar a escribir</button>}
        </div>
      </section>
      <aside className="panel session-panel">
        <SectionHead icon={Pulse} title="Sesión en vivo" />
        <div className="session-metrics">
          <Metric label="Tiempo" value={formatTime(run.elapsed)} icon={Timer} />
          <Metric label="Velocidad" value={typingStats(matching, run.attempts, run.elapsed, run.intervals).wpm} unit="PPM" icon={Hourglass} />
          <Metric label="Precisión" value={run.attempts ? number(stats.accuracy, 1) + '%' : '—'} icon={Crosshair} />
          <Metric label="Consistencia" value={stats.consistency === null ? '—' : stats.consistency + '%'} icon={AudioLines} />
        </div>
        <div className="session-balance"><Leaf size={17} /><div><strong>Equilibrio de pulgares</strong>
          <div>{balance === null ? 'Esperando pulsaciones' : balance + '% izq. / ' + (100 - balance) + '% der.'}</div>
        </div></div>
      </aside>
    </div>
    <KeyboardPanel profile={profile} layer={layer} onLayer={onLayer} pressed={pressed} target={target} mask={mask}>
      <span><i className="legend-swatch target" />Siguiente tecla</span>
      <span><i className="legend-swatch home" />Fila base</span>
      <span><i className="legend-swatch layer" />Acceso a capa</span>
      <span className="legend-note"><Fingerprint size={14} />{mask === undefined ? 'Posición estimada por el navegador' : 'Matriz USB en directo'}</span>
    </KeyboardPanel>
    <section className="panel practice-links">
      <SectionHead icon={Gamepad2} title="Entrena otras habilidades" description="Practica símbolos, navegación y coordinación con desafíos cortos." />
      <a className="button button-secondary" href="#minijuegos">Ver minijuegos <ArrowRight size={16} /></a>
    </section>
  </>;
}
