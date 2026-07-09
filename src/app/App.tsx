import { useEffect, useRef, useState } from 'preact/hooks';
import { deriveGmina, GminaModel } from '../engine/derive';
import { AppState, parseHash, toHash } from '../state/url';
import { PickerView } from './PickerView';
import { GminaView } from './GminaView';
import { BuilderView } from './BuilderView';

export interface IndexEntry { teryt: string; name: string; wojewodztwo: string }
export interface Preset { nazwa: string; opis?: string; obwody: string[] }
export interface GminaConfig { presety?: Preset[] }
interface GminaBundle { model: GminaModel; config: GminaConfig | null }

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

export function App() {
  const [state, setState] = useState<AppState>(() => parseHash(location.hash));
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [indexTry, setIndexTry] = useState(0);
  const [bundle, setBundle] = useState<GminaBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, GminaBundle>());

  const patch = (p: Partial<AppState>) => {
    setLoadError(null);
    setState(s => ({ ...s, ...p }));
  };

  useEffect(() => {
    history.replaceState(null, '', '#' + toHash(state));
  }, [state]);

  useEffect(() => {
    setIndexError(false);
    fetch(dataUrl('index.json'))
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((j: IndexEntry[]) => setIndex(j))
      .catch(() => setIndexError(true));
  }, [indexTry]);

  useEffect(() => {
    const teryt = state.teryt;
    if (!teryt) { setBundle(null); return; }
    const hit = cache.current.get(teryt);
    if (hit) { setBundle(hit); return; }
    let cancelled = false;
    setLoading(true);
    setBundle(null);
    Promise.all([
      fetch(dataUrl(`${teryt}.json`)).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(dataUrl(`${teryt}.config.json`)).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([raw, config]) => {
        const b: GminaBundle = { model: deriveGmina(teryt, raw[teryt]), config };
        cache.current.set(teryt, b);
        if (!cancelled) setBundle(b);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('Nie udało się wczytać danych gminy.');
        setState(s => ({ ...s, view: 'picker', teryt: null, sel: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [state.teryt]);

  // Drop selected obwód numbers that don't exist in the loaded gmina (stale links).
  useEffect(() => {
    if (!bundle) return;
    const valid = state.sel.filter(nr => bundle.model.obwodByNr[nr]);
    if (valid.length !== state.sel.length) setState(s => ({ ...s, sel: valid }));
  }, [bundle, state.sel]);

  const model = bundle?.model ?? null;
  const view = model ? state.view : state.teryt && (loading || !index) ? 'loading' : 'picker';

  return (
    <div class="page">
      <header class="hdr">
        <div class="hdr-in">
          <div class="hdr-title" onClick={() => patch({ view: 'picker', teryt: null, sel: [], mandatyOverride: null })}>
            Wybory samorządowe 2024
          </div>
          <div class="hdr-sub">rady gmin powyżej 20 tys. mieszkańców · przelicznik wirtualnych okręgów</div>
          <nav class="crumbs">
            <span class="crumb" onClick={() => patch({ view: 'picker', teryt: null, sel: [], mandatyOverride: null })}>Gminy</span>
            {model && view !== 'picker' && (
              <>
                <span class="crumb-sep">/</span>
                <span class="crumb" onClick={() => patch({ view: 'gmina' })}>{model.nazwa}</span>
              </>
            )}
            {model && view === 'builder' && (
              <>
                <span class="crumb-sep">/</span>
                <span class="crumb-cur">Okręg wirtualny</span>
              </>
            )}
          </nav>
        </div>
      </header>

      {view === 'picker' && (
        indexError ? (
          <main class="pick">
            <div class="load-error">
              <p>Nie udało się wczytać indeksu gmin.</p>
              <button class="btn-primary" onClick={() => setIndexTry(n => n + 1)}>Spróbuj ponownie</button>
            </div>
          </main>
        ) : index ? (
          <PickerView
            index={index}
            notice={loadError}
            onPick={teryt => patch({ teryt, view: 'gmina', sel: [], mandatyOverride: null })}
          />
        ) : (
          <main class="pick"><p class="loading">Wczytywanie…</p></main>
        )
      )}
      {view === 'loading' && <main class="wide"><p class="loading">Wczytywanie…</p></main>}
      {view === 'gmina' && model && (
        <GminaView model={model} onBuilder={() => patch({ view: 'builder' })} />
      )}
      {view === 'builder' && model && (
        <BuilderView model={model} config={bundle!.config} state={state} patch={patch} />
      )}

      <footer class="ftr">
        <div class="ftr-in">
          <span>Dane: Państwowa Komisja Wyborcza — wybory do rad gmin, 7 kwietnia 2024</span>
          <span class="ftr-right">Narzędzie poglądowe. Nie stanowi oficjalnej interpretacji wyników.</span>
        </div>
      </footer>
    </div>
  );
}
