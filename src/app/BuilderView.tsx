import { useMemo, useState } from 'preact/hooks';
import { allocate } from '../engine/allocate';
import { analyze } from '../engine/analytics';
import { GminaModel, clampMandaty, defaultMandaty, overProg, sumVotes, votesOfSelection } from '../engine/derive';
import { AppState } from '../state/url';
import type { GminaConfig } from './App';
import { ObwodySelector } from './ObwodySelector';
import { ParamsPanel } from './ParamsPanel';
import { ResultsPanel } from './ResultsPanel';

interface Props {
  model: GminaModel;
  config: GminaConfig | null;
  state: AppState;
  patch: (p: Partial<AppState>) => void;
}

const numAsc = (a: string, b: string) => Number(a) - Number(b);

export function BuilderView({ model, config, state, patch }: Props) {
  const [copied, setCopied] = useState(false);
  const selSet = useMemo(() => new Set(state.sel), [state.sel]);
  const votes = useMemo(() => votesOfSelection(model, state.sel), [model, state.sel]);
  const selVotes = sumVotes(votes);
  const selWyborcy = state.sel.reduce((a, nr) => a + (model.obwodByNr[nr]?.wyborcy ?? 0), 0);
  const defMandaty = defaultMandaty(model, selWyborcy);
  const mandaty = clampMandaty(state.mandatyOverride ?? defMandaty);

  const qualified = useMemo(
    () => new Set(Object.keys(model.votesGmina).filter(l => overProg(model, l))),
    [model],
  );
  const votesForAlloc = useMemo(
    () => (state.prog
      ? Object.fromEntries(Object.entries(votes).filter(([l]) => qualified.has(l)))
      : votes),
    [votes, state.prog, qualified],
  );

  const allocDh = useMemo(() => allocate(votesForAlloc, mandaty, 'dh'), [votesForAlloc, mandaty]);
  const allocSl = useMemo(() => allocate(votesForAlloc, mandaty, 'sl'), [votesForAlloc, mandaty]);
  const infoDh = useMemo(() => analyze(votesForAlloc, allocDh, 'dh'), [votesForAlloc, allocDh]);
  const infoSl = useMemo(() => analyze(votesForAlloc, allocSl, 'sl'), [votesForAlloc, allocSl]);

  const setSel = (s: Set<string>) => patch({ sel: [...s].sort(numAsc) });
  const onToggle = (nr: string) => {
    const s = new Set(selSet);
    s.has(nr) ? s.delete(nr) : s.add(nr);
    setSel(s);
  };
  const onToggleGroup = (nrs: string[], allOn: boolean) => {
    const s = new Set(selSet);
    for (const nr of nrs) allOn ? s.delete(nr) : s.add(nr);
    setSel(s);
  };
  const onPreset = (nrs: string[], active: boolean) => {
    const s = new Set(selSet);
    for (const nr of nrs) active ? s.delete(nr) : s.add(nr);
    patch({ sel: [...s].sort(numAsc), mandatyOverride: null });
  };
  const onClear = () => patch({ sel: [], mandatyOverride: null });

  const copyLink = () => {
    navigator.clipboard?.writeText(location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <main class="wide">
      <div class="view-head">
        <div>
          <h1>Okręg wirtualny — {model.nazwa}</h1>
          <div class="view-sub">Zaznacz dowolne obwody głosowania, a mandaty zostaną przeliczone tak, jakby tworzyły jeden okręg.</div>
        </div>
        <button class="btn-ghost" onClick={copyLink}>{copied ? 'Skopiowano ✓' : 'Kopiuj link do tego okręgu'}</button>
      </div>

      <ObwodySelector
        model={model} config={config} selSet={selSet}
        onToggle={onToggle} onToggleGroup={onToggleGroup} onPreset={onPreset} onClear={onClear}
      />

      {state.sel.length === 0 ? (
        <section class="empty">
          <div class="empty-t">Nie zaznaczono żadnego obwodu</div>
          <div class="empty-s">Zaznacz obwody powyżej — liczba mandatów, podział głosów i wynik przeliczenia pojawią się tutaj automatycznie.</div>
        </section>
      ) : (
        <>
          <ParamsPanel
            model={model} state={state} patch={patch}
            selCount={state.sel.length} selWyborcy={selWyborcy} selVotes={selVotes}
            defMandaty={defMandaty} mandaty={mandaty}
          />
          <ResultsPanel
            model={model} votes={votes} selVotes={selVotes} mandaty={mandaty}
            method={state.method} compare={state.compare}
            prog={state.prog}
            allocDh={allocDh} allocSl={allocSl} infoDh={infoDh} infoSl={infoSl}
          />
        </>
      )}
    </main>
  );
}
