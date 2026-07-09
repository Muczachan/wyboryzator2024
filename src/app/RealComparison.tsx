import { Allocation, Method, VotesMap } from '../engine/allocate';
import { GminaModel, nameOf } from '../engine/derive';
import { KomitetChip } from './KomitetChip';

interface Props {
  model: GminaModel;
  sel: string[];
  votes: VotesMap;
  alloc: Allocation;
  method: Method;
}

export function RealComparison({ model, sel, votes, alloc, method }: Props) {
  const touched = [...new Set(sel.map(nr => model.obwodByNr[nr]?.okreg).filter((x): x is string => !!x))]
    .sort((a, b) => Number(a) - Number(b));
  const realSum: Record<string, number> = {};
  for (const nr of touched) {
    for (const [l, s] of Object.entries(model.okregi[nr].realSeats)) realSum[l] = (realSum[l] ?? 0) + s;
  }
  const listy = [...new Set([...alloc.listy, ...Object.keys(realSum)])]
    .sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0));

  return (
    <section class="card">
      <div class="sec-head">
        <div class="sec-title">4. Porównanie z wynikiem rzeczywistym</div>
        <div class="sec-sub">
          mandaty realnie zdobyte w okręgach nr {touched.join(', ')} (zawsze d’Hondt — tak liczono naprawdę) vs okręg wirtualny
        </div>
      </div>
      <div class="tbl-wrap pad">
        <table class="tbl">
          <thead>
            <tr>
              <th class="l">Komitet</th>
              <th>Mandaty realne (d'Hondt)</th>
              <th>Okręg wirtualny ({method === 'dh' ? "d'Hondt" : 'Sainte-Laguë'})</th>
              <th class="c">Różnica</th>
            </tr>
          </thead>
          <tbody>
            {listy.map(l => {
              const r = realSum[l] ?? 0;
              const v = alloc.seatsBy[l] ?? 0;
              const d = v - r;
              return (
                <tr key={l}>
                  <td><span class="kom"><KomitetChip lista={l} /><span class="kom-name">{nameOf(model, l)}</span></span></td>
                  <td class="r mono b">{r}</td>
                  <td class="r mono b">{v}</td>
                  <td class={`c mono b ${d === 0 ? 'dim' : d > 0 ? 'pos' : 'neg'}`}>
                    {d === 0 ? '=' : d > 0 ? `+${d}` : String(d)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div class="div-legend">
          Kolumna „realne" sumuje mandaty zdobyte przez komitety we wszystkich okręgach, z których pochodzą
          zaznaczone obwody. Porównanie ma charakter poglądowy — liczba mandatów okręgu wirtualnego może różnić
          się od sumy mandatów tych okręgów.
        </div>
      </div>
    </section>
  );
}
