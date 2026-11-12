import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { cpp } from '@codemirror/lang-cpp';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Braces, Check, CircleAlert, Download, FileCode2, FileUp, ShieldCheck, Upload } from 'lucide-react';
import spanishProfile from '../BCORNE/config/bcorne-es-espana.vil?raw';
import { download, parseKeymap, studioSource } from './keymap-files';
import { studioProfile, type Profile } from './keyboard';
import { KeyboardPanel, PageIntro, SectionHead } from './ui';

const editorTheme = EditorView.theme({
  '&': { backgroundColor: '#fcfaf6', color: '#2e3230', fontSize: '13px' },
  '.cm-content': { fontFamily: 'var(--mono)', minHeight: '300px', padding: '12px 0' },
  '.cm-scroller': { maxHeight: '398px' },
  '.cm-gutters': { backgroundColor: '#f1ede4', color: '#6f7168', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#e8eee4' },
  '&.cm-focused': { outline: '2px solid #4a7c59', outlineOffset: '-2px' },
});

function SourceEditor({ source, zmk, onEdit }: { source: string; zmk: boolean; onEdit: (value: string) => void }) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const state = useRef({ source, onEdit });
  state.current = { source, onEdit };
  useEffect(() => {
    if (!parent.current) return;
    const editor = new EditorView({
      doc: state.current.source, parent: parent.current,
      extensions: [
        editorTheme, lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), EditorView.lineWrapping,
        history(), keymap.of([...defaultKeymap, ...historyKeymap]),
        zmk ? cpp() : json(), syntaxHighlighting(defaultHighlightStyle),
        EditorView.contentAttributes.of({ 'aria-label': 'Código fuente del keymap', spellcheck: 'false' }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const next = update.state.doc.toString();
            if (next !== state.current.source) state.current.onEdit(next);
          }
        }),
      ],
    });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
  }, [zmk]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== source) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: source } });
  }, [source]);
  return <div className="source-editor" ref={parent} />;
}

export function Importer({ profile, onApply }: { profile: Profile; onApply: (profile: Profile) => void }) {
  const [source, setSource] = useState(() => studioSource(profile));
  const [filename, setFilename] = useState('cornetype-keymap.json');
  const [validated, setValidated] = useState<Profile>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [layer, setLayer] = useState(0);
  const chooser = useRef<HTMLInputElement>(null);
  const fileRead = useRef(0);
  const preview = validated ?? profile;

  function validate(text = source, name = filename) {
    try {
      const next = parseKeymap(text, name);
      setValidated(next);
      setLayer(0);
      setError(false);
      setStatus('Keymap válido · ' + next.layers.length + ' capas');
      return next;
    } catch (error) {
      setValidated(undefined);
      setLayer(0);
      setError(true);
      setStatus(error instanceof Error ? error.message : 'No se pudo leer el keymap.');
    }
  }

  async function load(file?: File) {
    if (!file) return;
    const version = ++fileRead.current;
    if (file.size > 1_000_000 || !/\.(json|vil|keymap)$/i.test(file.name)) {
      setError(true);
      setStatus('Selecciona un archivo .json, .vil o .keymap de hasta 1 MB.');
      return;
    }
    try {
      const text = await file.text();
      if (version !== fileRead.current) return;
      setFilename(file.name);
      setSource(text);
      validate(text, file.name);
    } catch {
      if (version !== fileRead.current) return;
      setError(true);
      setStatus('El navegador no pudo abrir el archivo.');
    }
  }

  function edited(text: string) {
    fileRead.current++;
    setSource(text);
    setStatus('');
    setLayer(0);
    setValidated(undefined);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void load(event.dataTransfer.files[0]);
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    void load(event.currentTarget.files?.[0]);
    event.currentTarget.value = '';
  }

  return <>
    <PageIntro category="Teclado" title="Cargar keymap" description="Importa tu distribución, revisa el código y comprueba el resultado en la matriz." />
    <div className="sidebar-grid import-top">
      <section className={'panel dropzone ' + (dragging ? 'dragging' : '')} onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)} onDrop={drop}>
        <span className="icon-tile large"><FileUp size={23} /></span>
        <h2>Arrastra tu archivo aquí</h2>
        <p>Vial (.vil), QMK/VIA (.json) o ZMK (.keymap)</p>
        <input ref={chooser} type="file" accept=".json,.vil,.keymap" className="sr-only" tabIndex={-1} aria-label="Archivo de keymap" onChange={choose} />
        <button type="button" className="button button-primary" onClick={() => chooser.current?.click()}><Upload size={16} />Seleccionar archivo</button>
      </section>
      <section className="panel inset-panel">
        <SectionHead icon={ShieldCheck} title="Formatos compatibles" />
        <ul className="format-list">
          <li><Check size={16} /><div><strong>Vial para BCORNE M57</strong><span>Matriz de 10 × 7 y asignaciones de diales.</span></div></li>
          <li><Check size={16} /><div><strong>QMK / VIA y CorneType JSON</strong><span>Capas y asignaciones compatibles con la matriz.</span></div></li>
          <li><Check size={16} /><div><strong>ZMK Devicetree</strong><span>Capas con bindings explícitos para esta geometría.</span></div></li>
        </ul>
        <div className="sample-links"><button type="button" className="text-link" onClick={() => {
          fileRead.current++;
          setFilename('bcorne-es-espana.vil'); setSource(spanishProfile); validate(spanishProfile, 'bcorne-es-espana.vil');
        }}>Abrir perfil M57 del repositorio</button>
        <button type="button" className="text-link" onClick={() => {
          fileRead.current++;
          const sample = studioSource(studioProfile);
          setFilename('studio-4x6.json'); setSource(sample); validate(sample, 'studio-4x6.json');
        }}>Abrir perfil Studio 4×6</button></div>
      </section>
    </div>
    <div className="two-columns editor-grid">
      <section className="panel inset-panel">
        <SectionHead icon={Braces} title="Editor de keymap" description={filename}>
          <select aria-label="Formato del editor" value={filename.split('.').at(-1)?.toLowerCase()} onChange={event => {
            edited(source); setFilename(filename.replace(/\.[^.]+$/, '.' + event.target.value));
          }}>
            <option value="json">JSON</option><option value="vil">Vial</option><option value="keymap">ZMK</option>
          </select>
        </SectionHead>
        <SourceEditor source={source} zmk={filename.toLowerCase().endsWith('.keymap')} onEdit={edited} />
        <div className="button-row editor-actions">
          <button type="button" className="button button-secondary" onClick={() => validate()}><ShieldCheck size={16} />Validar código</button>
          <button type="button" className="button button-quiet" onClick={() => {
            if (validate()) download(filename, source, 'text/plain');
          }}><Download size={16} />Descargar fuente</button>
        </div>
        {status && <p className={'notice ' + (error ? 'error' : 'success')} role="status">{error ? <CircleAlert size={16} /> : <Check size={16} />}{status}</p>}
      </section>
      <div className="import-preview">
        <KeyboardPanel title="Vista previa" profile={preview} layer={layer} onLayer={setLayer} />
        <div className="panel preview-footer">
          <span><FileCode2 size={16} />{validated ? validated.name : 'Perfil activo'}</span>
          <button type="button" className="button button-primary" disabled={!validated} onClick={() => {
            if (validated) { onApply(validated); setStatus('Perfil aplicado. Ya puedes usarlo en todo el estudio.'); }
          }}><Check size={16} />Usar este perfil</button>
        </div>
      </div>
    </div>
  </>;
}
