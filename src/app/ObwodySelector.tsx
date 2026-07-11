import { GminaModel } from '../engine/derive';
import { fmt, plAktywny, plZestaw } from '../engine/format';
import type { GminaConfig } from './App';

interface Props {
  model: GminaModel;
  config: GminaConfig | null;
  selSet: Set<string>;
  onToggle: (nr: string) => void;
  onToggleGroup: (nrs: string[], allOn: boolean) => void;
  onPreset: (nrs: string[], active: boolean) => void;
  onClear: () => void;
}

export function ObwodySelector({ model, config, selSet, onToggle, onToggleGroup, onPreset, onClear }: Props) {
  const grupy = (config?.grupy ?? [])
    .map(g => ({
      nazwa: g.nazwa,
      opis: g.opis,
      presety: (g.presety ?? [])
        .map(p => {
          const obw = (p.obwody ?? []).map(String).filter(nr => model.obwodByNr[nr]);
          return { nazwa: p.nazwa, opis: p.opis, obw, active: obw.length > 0 && obw.every(nr => selSet.has(nr)) };
        })
        .filter(p => p.obw.length > 0),
    }))
    .filter(g => g.presety.length > 0);

  return (
    <section class="card">
      <div class="sec-head">
        <div class="sec-title">1. Wybór obwodów</div>
        <div class="sec-sub">obwody pogrupowane wg rzeczywistych okręgów</div>
        <span class="link-btn" onClick={onClear}>wyczyść zaznaczenie</span>
      </div>
      {grupy.map(g => {
        const act = g.presety.filter(p => p.active).length;
        return (
          <details key={g.nazwa} class="preset-group" open={g.presety.length <= 10}>
            <summary title={g.opis}>
              <span class="presets-lbl">{g.nazwa}</span>
              <span class="preset-count">· {g.presety.length} {plZestaw(g.presety.length)}</span>
              {act > 0 && <span class="preset-active">· {act} {plAktywny(act)}</span>}
            </summary>
            <div class="presets">
              {g.presety.map(p => (
                <span
                  key={p.nazwa}
                  class={p.active ? 'preset on' : 'preset'}
                  title={`${p.opis ? p.opis + ' · ' : ''}obwody: ${p.obw.join(', ')} · kliknij, aby ${p.active ? 'usunąć z' : 'dodać do'} zaznaczenia`}
                  onClick={() => onPreset(p.obw, p.active)}
                >
                  {p.active ? '✓ ' : '+ '}{p.nazwa}
                </span>
              ))}
            </div>
          </details>
        );
      })}
      <div class="obwody-grid">
        {model.okregNrs.map(nr => {
          const ok = model.okregi[nr];
          const allOn = ok.obwodNrs.length > 0 && ok.obwodNrs.every(o => selSet.has(o));
          return (
            <div key={nr}>
              <label class="obwody-head">
                <input type="checkbox" checked={allOn} onChange={() => onToggleGroup(ok.obwodNrs, allOn)} />
                <span class="obwody-okreg">Okręg nr {nr}</span>
                <span class="obwody-count">{ok.obwodNrs.length} obw.</span>
              </label>
              {ok.obwodNrs.map(onr => {
                const ob = model.obwodByNr[onr];
                const on = selSet.has(onr);
                return (
                  <label key={onr} class={on ? 'obwod-row on' : 'obwod-row'}>
                    <input type="checkbox" checked={on} onChange={() => onToggle(onr)} />
                    <span class="obwod-nr">nr {onr}</span>
                    <span class="obwod-meta">{fmt(ob.wyborcy)} wyb. · {fmt(ob.glosy)} gł.</span>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
