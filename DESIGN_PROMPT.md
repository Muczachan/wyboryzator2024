# Design brief: PKW 2024 — przelicznik wyników dla wirtualnych okręgów

## What this app is

A web UI for exploring official 2024 Polish local election results (rady gmin
w gminach powyżej 20 tys. mieszkańców) with one killer feature: the user can
compose a **virtual okręg** out of arbitrary obwody głosowania (polling
stations) within a single gmina and see the seats recounted for it — "what if
these stations formed one district?" — under a choice of two seat-allocation
methods: **d'Hondt** (the real method used in these elections) and
**Sainte-Laguë** (for comparison).

UI language: **Polish**. Use real domain vocabulary throughout: gmina, okręg,
obwód, komitet, lista, mandat, wyborcy. No translations of these terms.

## Data (already exists, static, no backend)

One JSON file per gmina, named by TERYT code (e.g. `020101.json`), plus an
index file `teryt_mappings.yml` mapping TERYT → "gmina, województwo" for the
gmina picker. Shape:

```json
{
  "020101": {
    "wojewodztwo": "dolnośląskie",
    "powiat": "bolesławiecki",
    "gmina": "m. Bolesławiec",
    "organ": "Rada Miasta Bolesławiec",
    "siedziba": "Bolesławiec",
    "okregi": {
      "1": {
        "mandaty": 5,
        "listy": 6,
        "mieszkancy": 8666,
        "wyborcy": 7115,
        "granice": "Bolesławiec ulice: Agatowa, Akacjowa, ...",
        "kandydaci": {
          "1": {
            "komitet": "KW PRAWO I SPRAWIEDLIWOŚĆ",
            "pozycje": {
              "1": { "name": "WIĘCEWICZ Rafał Paweł",
                     "uzyskane_glosy": { "1": 349, "2": 210 } }
            }
          }
        },
        "obwody": {
          "1": {
            "okreg": 1,
            "wyborcy": 1673,
            "wyborcy_glosujacy": 767,
            "kandydaci": {
              "1": { "1": { "name": "WIĘCEWICZ Rafał Paweł", "glosy": 349 } }
            }
          }
        }
      }
    }
  }
}
```

Key facts about the data:

- Lista numbers identify committees consistently across all okręgi of a gmina
  (same komitet = same lista number gmina-wide).
- Candidates are okręg-specific — a candidate's votes exist only in the
  obwody of their own okręg. Therefore the virtual-okręg recount is
  **committee-level only**: sum votes per lista across selected obwody.
- Obwód numbers are unique within a gmina; each obwód belongs to exactly one
  real okręg.
- Committee votes per obwód = sum of that lista's candidate `glosy` in that
  obwód.

## Core flows to design

1. **Gmina picker** — search/select from ~320 gminas (name + województwo).
2. **Gmina overview** — real okręgi with their mandaty, wyborcy, committee
   results and seat allocation; obwody listed per okręg with frekwencja
   (wyborcy_glosujacy / wyborcy).
3. **Virtual okręg builder** (the centerpiece):
   - Select obwody via checkboxes, grouped by their real okręg; support
     select-all-per-okręg. Selection persists while browsing.
   - Live summary of selection: number of obwody, total wyborcy, total votes.
   - **Mandaty input**: editable number, pre-filled with a smart default —
     total council seats × (selected wyborcy / gmina wyborcy), rounded,
     minimum 1. Show the formula so the default is explainable.
   - **Method switch**: a prominent toggle **d'Hondt / Sainte-Laguë**.
     d'Hondt is the default and labeled as the statutory method
     ("metoda ustawowa"); Sainte-Laguë labeled as hypothetical
     ("wariant hipotetyczny"). Divisors: d'Hondt 1, 2, 3, 4…;
     Sainte-Laguë 1, 3, 5, 7… Switching recounts instantly and the whole
     results panel must make the active method unmistakable — a subtle
     toggle that leaves users unsure which method they're looking at is a
     design failure here.
   - **Live recount**: seats allocated by the active method over summed
     committee votes for the chosen mandate count. No electoral threshold.
     Show per komitet: votes, % of valid votes in selection, mandates won,
     and the divisor table on demand (transparency of the method matters to
     this audience). Consider a side-by-side mode showing both methods'
     seat counts at once, highlighting rows where they differ — the
     difference between methods is exactly what this switch exists to
     reveal.
   - **"Brakujące głosy" (missing votes)**: for every komitet that did not
     win the last-assigned mandate, show how many additional votes it would
     have needed to take that seat from its actual winner. Semantics: the
     last mandate goes to the lowest winning quotient; a committee needs
     the smallest Δ such that (its votes + Δ) / its next divisor exceeds
     that quotient. Show it per komitet next to the seat count (e.g.
     "brakło 37 głosów"), and for the committee holding the last seat show
     the inverse — its margin ("przewaga 37 głosów nad …"). Values are
     method-dependent: recompute on method switch. This is the emotional
     core of the tool — "so close" must be instantly visible, consider
     emphasizing the smallest gap in the whole panel.
   - **"Głosy zmarnowane" (wasted votes)**: total votes cast for committees
     that won zero seats in the virtual okręg, shown as a count and as % of
     all valid votes in the selection (e.g. "1 254 głosów (8,3%) oddano na
     komitety bez mandatu"). List the affected committees with their vote
     counts. Method-dependent — a committee seatless under d'Hondt may win
     a seat under Sainte-Laguë, so recompute on switch; in side-by-side
     mode the difference in wasted votes between methods is worth
     surfacing.
   - **"Głosy nadwyżkowe" (surplus votes)**: for each committee that won
     seats, the votes it could have lost without losing any of them —
     actual votes minus the minimum needed to keep its last seat ahead of
     the best losing quotient. Show per komitet and as a total. Together
     with "głosy zmarnowane" this yields a combined "głosy bez wpływu na
     wynik" (votes with no effect on the outcome) summary line: zmarnowane
     + nadwyżkowe, as count and % of valid votes. Method-dependent —
     recompute on switch.
   - **Comparison**: virtual result vs. the aggregate real-world seats those
     committees won in the okręgi the selected obwody came from (real-world
     baseline is always d'Hondt — that is what actually happened).
4. **Shareable state** — selection, mandate count and chosen method encoded
   in URL, so a virtual okręg can be sent as a link.

## Constraints

- Fully static: client-side only, fetches the JSON per selected gmina.
  Files are up to ~300 KB each; load one gmina at a time.
- Desktop-first (analysts, journalists, local-politics nerds), but readable
  on mobile.
- Data density is a feature: this audience wants tables and numbers, not
  hero sections. Sober, government-data aesthetic; committee results may use
  color coding but must not imply party endorsement.
- Polish number formatting (space as thousands separator, comma decimal).

## Deliverable

Screen designs + component inventory for the three main views (picker,
gmina overview, virtual okręg builder with recount panel), including empty
states (nothing selected), the mandaty-default explainer, the method
switch with both its states, the methods-differ highlight, the
"brakujące głosy" / "przewaga" presentation, the "głosy zmarnowane" and
"głosy nadwyżkowe" summaries with the combined no-effect line, and the
divisor table for both methods.
