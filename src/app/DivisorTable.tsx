import { Allocation, Method, VotesMap, divisor } from '../engine/allocate';
import { GminaModel, nameOf } from '../engine/derive';
import { fmt, fmtDec } from '../engine/format';

interface Props {
  model: GminaModel;
  votes: VotesMap;
  alloc: Allocation;
  mandaty: number;
  method: Method;
  compare: boolean;
  sorted: string[];
}

export function DivisorTable({ model, votes, alloc, mandaty, method, compare, sorted }: Props) {
  const winKeys = new Set(alloc.winners.map(w => `${w.lista}/${w.divisor}`));
  const lastKey = alloc.last ? `${alloc.last.lista}/${alloc.last.divisor}` : '';
  const divisors = Array.from({ length: mandaty }, (_, k) => divisor(k, method));
  return (
    <details class="div-details">
      <summary>
        Tabela dzielników — jak przydzielono mandaty ({compare ? 'metoda z przełącznika: ' : ''}
        metoda {method === 'dh' ? "d'Hondta" : 'Sainte-Laguë'}, dzielniki {method === 'dh' ? '1, 2, 3, 4…' : '1, 3, 5, 7…'})
      </summary>
      <div class="tbl-wrap">
        <table class="tbl div-tbl">
          <thead>
            <tr>
              <th class="l">Komitet</th>
              <th>Głosy</th>
              {divisors.map(d => <th key={d} class="mono">÷{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.map(l => (
              <tr key={l}>
                <td class="div-name">{nameOf(model, l)}</td>
                <td class="r mono">{fmt(votes[l])}</td>
                {divisors.map(d => {
                  const key = `${l}/${d}`;
                  const cls = key === lastKey ? `cell-last ${method}` : winKeys.has(key) ? 'cell-win' : 'cell-lose';
                  return <td key={d} class={`r mono ${cls}`}>{fmtDec(votes[l] / d, 1)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div class="div-legend">
          Pogrubione komórki to {mandaty} najwyższych ilorazów — każdy oznacza mandat. Wyróżniona komórka to
          ostatni (najniższy) zwycięski iloraz: o ten mandat toczy się gra w kolumnie „brakujące głosy / przewaga".
          Remisy ilorazów rozstrzyga wyższa łączna liczba głosów komitetu, następnie niższy numer listy
          (ustawowo: losowanie).
        </div>
      </div>
    </details>
  );
}
