import { GminaModel } from '../engine/derive';
import { fmt, fmtDec } from '../engine/format';
import { AppState } from '../state/url';

interface Props {
  model: GminaModel;
  state: AppState;
  patch: (p: Partial<AppState>) => void;
  selCount: number;
  selWyborcy: number;
  selVotes: number;
  defMandaty: number;
  mandaty: number;
}

export function ParamsPanel({ model, state, patch, selCount, selWyborcy, selVotes, defMandaty, mandaty }: Props) {
  const raw = (model.mandatyGmina * selWyborcy) / model.wyborcyGmina;
  const overridden = state.mandatyOverride != null && state.mandatyOverride !== defMandaty;
  return (
    <section class="card">
      <div class="sec-head"><div class="sec-title">2. Parametry przeliczenia</div></div>
      <div class="params">
        <div class="params-stats">
          <div><div class="stat-val">{selCount}</div><div class="stat-lbl">zaznaczone obwody</div></div>
          <div><div class="stat-val">{fmt(selWyborcy)}</div><div class="stat-lbl">wyborcy uprawnieni</div></div>
          <div><div class="stat-val">{fmt(selVotes)}</div><div class="stat-lbl">głosy ważne</div></div>
        </div>
        <div class="params-block">
          <div class="col-label">Mandaty do obsadzenia</div>
          <div class="mandaty-row">
            <input
              class="mandaty-input"
              type="number"
              min={1}
              max={60}
              value={mandaty}
              onInput={e => {
                const v = parseInt((e.target as HTMLInputElement).value, 10);
                patch({ mandatyOverride: Number.isInteger(v) && v >= 1 ? Math.min(60, v) : null });
              }}
            />
            {overridden && (
              <span class="link-btn" onClick={() => patch({ mandatyOverride: null })}>
                przywróć domyślne ({defMandaty})
              </span>
            )}
          </div>
          <div class="formula">
            domyślnie: {model.mandatyGmina} mandatów × ({fmt(selWyborcy)} ∕ {fmt(model.wyborcyGmina)} wyborców) = {fmtDec(raw, 2)} ≈ {defMandaty}
          </div>
        </div>
        <div class="params-block">
          <div class="col-label">Metoda podziału mandatów</div>
          <div class="method-toggle">
            <button class={state.method === 'dh' ? 'method-btn dh on' : 'method-btn dh'} onClick={() => patch({ method: 'dh' })}>
              <span class="method-name">d'Hondt</span>
              <span class="method-tag">metoda ustawowa</span>
            </button>
            <button class={state.method === 'sl' ? 'method-btn sl on' : 'method-btn sl'} onClick={() => patch({ method: 'sl' })}>
              <span class="method-name">Sainte-Laguë</span>
              <span class="method-tag">wariant hipotetyczny</span>
            </button>
          </div>
          <label class="compare-toggle">
            <input type="checkbox" checked={state.compare} onChange={() => patch({ compare: !state.compare })} />
            Porównaj obie metody obok siebie
          </label>
        </div>
        <div class="params-block">
          <div class="col-label">Próg wyborczy</div>
          <label class="compare-toggle">
            <input type="checkbox" checked={state.prog} onChange={() => patch({ prog: !state.prog })} />
            Próg 5% w skali gminy (ustawowy)
          </label>
          <div class="formula">
            wyłączenie progu to wariant hipotetyczny — w wyborach komitety poniżej 5% nie uczestniczą w podziale mandatów
          </div>
        </div>
      </div>
    </section>
  );
}
