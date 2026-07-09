const HUES = [250, 45, 160, 310, 200, 25, 100, 340, 70, 130];

export const listaColor = (lista: string): string =>
  `oklch(0.55 0.09 ${HUES[(Number(lista) - 1) % HUES.length]})`;

export const KomitetChip = ({ lista }: { lista: string }) => (
  <span class="chip" style={{ background: listaColor(lista) }} />
);
