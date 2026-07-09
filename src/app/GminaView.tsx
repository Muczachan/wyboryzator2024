import { GminaModel, nameOf } from '../engine/derive';
import { fmt, fmtPct } from '../engine/format';
import { KomitetChip } from './KomitetChip';

interface Props {
  model: GminaModel;
  onBuilder: () => void;
}

export function GminaView({ model, onBuilder }: Props) {
  const stats = [
    { value: String(model.okregNrs.length), label: 'okręgi wyborcze' },
    { value: String(model.mandatyGmina), label: 'mandaty w radzie' },
    { value: fmt(model.wyborcyGmina), label: 'wyborcy uprawnieni' },
    { value: String(model.obwodNrs.length), label: 'obwody głosowania' },
  ];
  return (
    <main class="wide">
      <div class="view-head">
        <div>
          <h1>{model.nazwa}</h1>
          <div class="view-sub">
            {model.organ} · {model.powiat}, woj. {model.wojewodztwo} · siedziba: {model.siedziba}
          </div>
        </div>
        <button class="btn-primary" onClick={onBuilder}>Zbuduj okręg wirtualny →</button>
      </div>
      <div class="stats-strip">
        {stats.map(s => (
          <div key={s.label}>
            <div class="stat-val">{s.value}</div>
            <div class="stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {model.okregNrs.map(nr => {
        const ok = model.okregi[nr];
        const rows = Object.keys(ok.votes).sort((a, b) => ok.votes[b] - ok.votes[a]);
        return (
          <section key={nr} class="card">
            <div class="card-head">
              <div class="card-title">Okręg nr {nr}</div>
              <div class="card-meta">
                {ok.mandaty} mandatów · {ok.listy} list · {fmt(ok.wyborcy)} wyborców · {fmt(ok.totalVotes)} głosów ważnych
              </div>
            </div>
            <div class="okreg-grid">
              <div class="okreg-col">
                <div class="col-label">Wyniki komitetów · podział mandatów (d'Hondt)</div>
                <div class="tbl-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th class="l">Komitet</th><th>Głosy</th><th>%</th><th>Mandaty</th></tr>
                    </thead>
                    <tbody>
                      {rows.map(l => (
                        <tr key={l}>
                          <td><span class="kom"><KomitetChip lista={l} /><span class="kom-name">{nameOf(model, l)}</span></span></td>
                          <td class="r mono">{fmt(ok.votes[l])}</td>
                          <td class="r mono dim">{ok.totalVotes ? fmtPct((100 * ok.votes[l]) / ok.totalVotes) : '—'}</td>
                          <td class="r mono b">{ok.realSeats[l] ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="okreg-col">
                <div class="col-label">Obwody głosowania</div>
                <div class="tbl-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th class="l">Obwód</th><th>Wyborcy</th><th>Głosy ważne</th><th>% wyborców</th></tr>
                    </thead>
                    <tbody>
                      {ok.obwodNrs.map(onr => {
                        const ob = model.obwodByNr[onr];
                        return (
                          <tr key={onr}>
                            <td class="mono">nr {onr}</td>
                            <td class="r mono">{fmt(ob.wyborcy)}</td>
                            <td class="r mono">{fmt(ob.glosy)}</td>
                            <td class="r mono dim">{ob.wyborcy ? fmtPct((100 * ob.glosy) / ob.wyborcy) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <details class="granice">
              <summary>Granice okręgu</summary>
              <div>{ok.granice}</div>
            </details>
          </section>
        );
      })}
    </main>
  );
}
