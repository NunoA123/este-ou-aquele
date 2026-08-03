#!/usr/bin/env node
/**
 * Varre aneis/ e gera (ou completa) o rings.json.
 *
 *   node tools/init-rings.js            # não mexe em entradas já preenchidas
 *   node tools/init-rings.js --force    # recomeça do zero, apaga o que lá estiver
 *
 * Entradas novas ficam com os campos vazios para preencher à mão.
 * Entradas cujo ficheiro deixou de existir são reportadas, não removidas.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'aneis');
const OUT = path.join(ROOT, 'rings.json');
const FORCE = process.argv.includes('--force');

const SCHEMA = {
  cut:     ['round', 'oval', 'princess', 'emerald', 'pear', 'marquise', 'cushion', 'radiant'],
  setting: ['solitaire', 'halo', 'three-stone', 'pave', 'bezel', 'cluster'],
  metal:   ['white-gold', 'yellow-gold', 'rose-gold', 'platinum', 'mixed'],
  band:    ['thin', 'medium', 'thick'],
  profile: ['low', 'medium', 'high'],
  accent:  ['none', 'side-stones', 'engraved', 'twisted', 'split-shank']
};
const FIELDS = Object.keys(SCHEMA);

if (!fs.existsSync(IMG_DIR)) {
  console.error('Não existe a pasta aneis/');
  process.exit(1);
}

const files = fs.readdirSync(IMG_DIR)
  .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();

if (!files.length) {
  console.error('Nenhuma imagem em aneis/');
  process.exit(1);
}

let existing = [];
if (!FORCE && fs.existsSync(OUT)) {
  try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')); }
  catch (e) { console.error('rings.json existente está inválido:', e.message); process.exit(1); }
}
const byId = {};
existing.forEach(r => { if (r && r.id) byId[r.id] = r; });

const out = files.map(f => {
  const id = path.basename(f, path.extname(f));
  const prev = byId[id];
  const rec = { id, img: 'aneis/' + f };
  FIELDS.forEach(k => { rec[k] = prev && prev[k] ? prev[k] : ''; });
  rec.note = (prev && prev.note) || '';
  delete byId[id];
  return rec;
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

/* ── Relatório ───────────────────────────────────────────────── */
const missing = [];
const invalid = [];
out.forEach(r => {
  FIELDS.forEach(k => {
    if (!r[k]) missing.push(`${r.id}.${k}`);
    else if (!SCHEMA[k].includes(r[k])) invalid.push(`${r.id}.${k} = "${r[k]}"`);
  });
});

console.log(`rings.json escrito com ${out.length} anéis.`);
Object.keys(byId).forEach(id => console.log(`  aviso: "${id}" está no rings.json mas já não tem imagem em aneis/`));
if (invalid.length) {
  console.log(`\n  ${invalid.length} valor(es) fora das listas permitidas:`);
  invalid.forEach(s => console.log('    ' + s));
}
if (missing.length) {
  console.log(`\n  ${missing.length} campo(s) por preencher:`);
  const byRing = {};
  missing.forEach(s => { const [id, k] = s.split('.'); (byRing[id] = byRing[id] || []).push(k); });
  Object.entries(byRing).forEach(([id, ks]) => console.log(`    ${id}: ${ks.join(', ')}`));
  console.log('\n  Valores permitidos:');
  FIELDS.forEach(k => console.log(`    ${k.padEnd(8)} ${SCHEMA[k].join(', ')}`));
} else {
  console.log('  Todos os campos preenchidos e válidos.');
}
