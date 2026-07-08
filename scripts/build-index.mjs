import { readFileSync, writeFileSync } from 'node:fs';

const src = new URL('../public/data/teryt_mappings.yml', import.meta.url);
const out = new URL('../public/data/index.json', import.meta.url);

const entries = [];
for (const line of readFileSync(src, 'utf8').split('\n')) {
  const m = line.match(/^"(\d{6})":\s*"(.*)"\s*$/);
  if (!m) continue;
  const cut = m[2].lastIndexOf(', ');
  if (cut === -1) throw new Error(`Unparseable entry: ${line}`);
  entries.push({ teryt: m[1], name: m[2].slice(0, cut), wojewodztwo: m[2].slice(cut + 2) });
}
if (entries.length < 300) throw new Error(`Only ${entries.length} entries parsed — expected ~320`);
entries.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
writeFileSync(out, JSON.stringify(entries));
console.log(`index.json: ${entries.length} gmin`);
