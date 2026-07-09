import { Allocation, Method, VotesMap } from '../engine/allocate';
import { Analytics } from '../engine/analytics';
import { GminaModel, nameOf } from '../engine/derive';
import { fmt, fmtPct, plGlos } from '../engine/format';
import { DivisorTable } from './DivisorTable';
import { KomitetChip, listaColor } from './KomitetChip';

interface Props {
  model: GminaModel;
  votes: VotesMap;
  selVotes: number;
  mandaty: number;
  method: Method;
  compare: boolean;
  allocDh: Allocation;
  allocSl: Allocation;
  infoDh: Analytics;
  infoSl: Analytics;
}

const genitive = (m: Method) => (m === 'dh' ? "d'Hondta" : 'Sainte-Laguë');

export function ResultsPanel(props: Props) {
  const { model, votes, selVotes, mandaty, method, compare } = props;
  const alloc = method === 'dh' ? props.allocDh : props.allocSl;
  const info = method === 'dh' ? props.infoDh : props.infoSl;
  const sorted = [...alloc.listy].sort((a, b) => votes[b] - votes[a]);
  const cls = compare ? 'results cmp' : `results ${method}`;

  if (selVotes === 0) {
    return (
      <section class={cls}>
        <div class="results-banner"><div class="banner-t">3. Wynik</div></div>
        <div class="no-votes">Brak głosów ważnych w zaznaczonych obwodach — nie ma czego przeliczać.</div>
      </section>
    );
  }

  return (
    <section class={cls}>
      <div class="results-banner">
        <div class="banner-t">
          3. Wynik: {compare
            ? 'porównanie metod — d’Hondt i Sainte-Laguë'
            : `metoda ${genitive(method)} ${method === 'dh' ? '(ustawowa)' : '(wariant hipotetyczny)'}`}
        </div>
        <div class="banner-s">{mandaty} mandatów · {fmt(selVotes)} głosów ważnych · bez progu wyborczego</div>
      </div>
      {compare
        ? <CompareTable model={model} votes={votes} selVotes={selVotes} allocDh={props.allocDh} allocSl={props.allocSl} sorted={sorted} />
        : <SingleTable model={model} votes={votes} selVotes={selVotes} alloc={alloc} info={info} sorted={sorted} />}
      <Summaries {...props} activeInfo={info} />
      <DivisorTable model={model} votes={votes} alloc={alloc} mandaty={mandaty} method={method} compare={compare} sorted={sorted} />
    </section>
  );
}

function SingleTable({ model, votes, selVotes, alloc, info, sorted }: {
  model: GminaModel; votes: VotesMap; selVotes: number; alloc: Allocation; info: Analytics; sorted: string[];
}) {
  return (
    <div class="tbl-wrap">
      <table class="tbl results-tbl">
        <thead>
          <tr>
            <th class="l">Komitet</th>
            <th>Głosy</th>
            <th>% ważnych</th>
            <th>Mandaty</th>
            <th class="gap-col">Brakujące głosy / przewaga</th>
            <th>Głosy nadwyżkowe</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(l => {
            const v = votes[l];
            const sc = alloc.seatsBy[l] ?? 0;
            const rec = info.perLista[l] ?? {};
            const closest = l === info.minMissingLista;
            return (
              <tr key={l} class={closest ? 'closest' : sc === 0 ? 'seatless' : ''}>
                <td>
                  <span class="kom">
                    <KomitetChip lista={l} />
                    <span class="kom-name b">{nameOf(model, l)}</span>
                    {closest && <span class="badge">najbliżej mandatu</span>}
                  </span>
                </td>
                <td class="r mono">{fmt(v)}</td>
                <td class="r mono dim">{fmtPct((100 * v) / selVotes)}</td>
                <td class="r mono">
                  <span class="seats">{sc}</span>{' '}
                  <span class="dots" style={{ color: listaColor(l) }}>{'●'.repeat(Math.min(sc, 12))}</span>
                </td>
                <td class="gap-col">
                  {rec.margin != null && rec.marginOver != null && (
                    <span class="gap-margin">przewaga {fmt(rec.margin)} {plGlos(rec.margin)} nad: {nameOf(model, rec.marginOver)}</span>
                  )}
                  {rec.missing != null && (
                    <span class={closest ? 'gap-missing hot' : 'gap-missing'}>
                      brakło {fmt(rec.missing)} {plGlos(rec.missing)} do ostatniego mandatu
                    </span>
                  )}
                  {rec.margin == null && rec.missing == null && <span class="dim">—</span>}
                </td>
                <td class="r mono dim">{rec.surplus != null ? fmt(rec.surplus) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompareTable({ model, votes, selVotes, allocDh, allocSl, sorted }: {
  model: GminaModel; votes: VotesMap; selVotes: number; allocDh: Allocation; allocSl: Allocation; sorted: string[];
}) {
  const rows = sorted.map(l => ({ l, a: allocDh.seatsBy[l] ?? 0, b: allocSl.seatsBy[l] ?? 0 }));
  const anyDiff = rows.some(r => r.a !== r.b);
  return (
    <div class="tbl-wrap">
      <table class="tbl results-tbl">
        <thead>
          <tr>
            <th class="l">Komitet</th>
            <th>Głosy</th>
            <th>% ważnych</th>
            <th class="th-dh">Mandaty · d'Hondt (ustawowa)</th>
            <th class="th-sl">Mandaty · Sainte-Laguë (hipot.)</th>
            <th class="c">Różnica</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ l, a, b }) => (
            <tr key={l} class={a !== b ? 'differs' : ''}>
              <td><span class="kom"><KomitetChip lista={l} /><span class="kom-name b">{nameOf(model, l)}</span></span></td>
              <td class="r mono">{fmt(votes[l])}</td>
              <td class="r mono dim">{fmtPct((100 * votes[l]) / selVotes)}</td>
              <td class="r mono seats bl">{a}</td>
              <td class="r mono seats">{b}</td>
              <td class="c mono">
                {a === b ? <span class="dim">=</span> : <span class="diff-pill">{b > a ? `+${b - a} S-L` : `+${a - b} d'H`}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!anyDiff && <div class="identical">Przy tym zaznaczeniu obie metody dają identyczny podział mandatów.</div>}
    </div>
  );
}

function Summaries({ model, votes, selVotes, method, compare, infoDh, infoSl, activeInfo }: Props & { activeInfo: Analytics }) {
  const cards = (info: Analytics, suffix: string) => {
    const names = info.wastedListy.map(l => `${nameOf(model, l)} (${fmt(votes[l])})`).join(', ');
    return [
      {
        title: `Głosy zmarnowane${suffix}`,
        value: `${fmt(info.wastedSum)} (${fmtPct((100 * info.wastedSum) / selVotes)})`,
        note: info.wastedListy.length ? `oddane na komitety bez mandatu: ${names}` : 'każdy komitet z głosami zdobył mandat',
      },
      {
        title: `Głosy nadwyżkowe${suffix}`,
        value: `${fmt(info.surplusSum)} (${fmtPct((100 * info.surplusSum) / selVotes)})`,
        note: 'głosy, które komitety z mandatami mogłyby stracić bez utraty żadnego mandatu',
      },
    ];
  };
  const noEffect = (i: Analytics) => i.wastedSum + i.surplusSum;
  const list = compare
    ? (() => {
        const a = cards(infoDh, " — d'Hondt");
        const b = cards(infoSl, ' — Sainte-Laguë');
        return [a[0], b[0], a[1], b[1]];
      })()
    : cards(activeInfo, '');
  return (
    <>
      <div class="summary-grid">
        {list.map(c => (
          <div key={c.title} class="summary-card">
            <div class="sum-t">{c.title}</div>
            <div class="sum-v">{c.value}</div>
            <div class="sum-n">{c.note}</div>
          </div>
        ))}
      </div>
      <div class="no-effect">
        <span class="b">Głosy bez wpływu na wynik:</span>
        {compare ? (
          <>
            <span class="ne-v mono">{fmt(noEffect(infoDh))} (d'H) · {fmt(noEffect(infoSl))} (S-L)</span>
            <span class="ne-n">
              głosy bez wpływu (zmarnowane + nadwyżkowe): {fmtPct((100 * noEffect(infoDh)) / selVotes)} wg d'Hondta,{' '}
              {fmtPct((100 * noEffect(infoSl)) / selVotes)} wg Sainte-Laguë
            </span>
          </>
        ) : (
          <>
            <span class="ne-v mono">{fmt(noEffect(activeInfo))} z {fmt(selVotes)}</span>
            <span class="ne-n">
              ({fmtPct((100 * noEffect(activeInfo)) / selVotes)} głosów ważnych) — zmarnowane + nadwyżkowe,
              metoda {genitive(method)}
            </span>
          </>
        )}
      </div>
    </>
  );
}
