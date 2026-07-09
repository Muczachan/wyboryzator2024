import { useState } from 'preact/hooks';
import type { IndexEntry } from './App';

interface Props {
  index: IndexEntry[];
  notice: string | null;
  onPick: (teryt: string) => void;
}

export function PickerView({ index, notice, onPick }: Props) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const hits = index.filter(g => !needle || `${g.name} ${g.wojewodztwo}`.toLowerCase().includes(needle));
  return (
    <main class="pick">
      <h1>Wybierz gminę</h1>
      <p class="pick-lead">
        Oficjalne wyniki wyborów do rad gmin w gminach powyżej 20&nbsp;tys. mieszkańców. Po wybraniu
        gminy możesz przeglądać wyniki okręgów i budować własne, wirtualne okręgi z dowolnych obwodów
        głosowania.
      </p>
      {notice && <p class="notice">{notice}</p>}
      <input
        class="pick-search"
        type="text"
        value={q}
        onInput={e => setQ((e.target as HTMLInputElement).value)}
        placeholder="Szukaj gminy lub województwa…"
      />
      <div class="pick-list">
        {hits.map(g => (
          <div key={g.teryt} class="pick-row" onClick={() => onPick(g.teryt)}>
            <div class="pick-name">{g.name}</div>
            <div class="pick-detail">woj. {g.wojewodztwo}</div>
            <div class="pick-teryt">TERYT {g.teryt}</div>
          </div>
        ))}
        {hits.length === 0 && <div class="pick-empty">Brak gmin pasujących do zapytania.</div>}
      </div>
    </main>
  );
}
