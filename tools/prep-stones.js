#!/usr/bin/env node
/**
 * Normaliza as fotos das pedras para pedras/PNN.jpg, 800×800. Só corre no
 * macOS (usa o sips).
 *
 *   node tools/prep-stones.js "../Pedras"
 *
 * Ao contrário das rondas dos anéis, aqui não há recorte a inventar: as fotos
 * do vendedor já são a pedra ao centro sobre fundo liso. O que é preciso é
 * que fiquem todas **exactamente do mesmo tamanho**, senão a arena deixa de
 * ser simétrica e ela passa a escolher a foto em vez da pedra.
 *
 * Corta ao quadrado pelo lado mais curto, a partir do centro, e reduz a
 * 800×800. Uma pedra pequena numa foto grande continua pequena no cartão — e
 * isso é informação verdadeira, porque o tamanho é um dos atributos que
 * estamos a medir. O que não pode é variar o enquadramento.
 *
 * O nome do ficheiro manda: pedra-07.jpg → P07.jpg, que é o id no rings.json.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'pedras');
const SRC_DIR = path.resolve(process.argv[2] || path.join(ROOT, '..', 'Pedras'));
const LADO = 800;

if (!fs.existsSync(SRC_DIR)) {
  console.error('Não existe a pasta ' + SRC_DIR);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const dim = (f) => {
  const txt = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', f]).toString();
  const w = +(txt.match(/pixelWidth:\s*(\d+)/) || [])[1];
  const h = +(txt.match(/pixelHeight:\s*(\d+)/) || [])[1];
  return { w, h };
};

const files = fs.readdirSync(SRC_DIR)
  .filter(f => /^pedra-\d+\.jpe?g$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!files.length) {
  console.error('Nenhuma foto pedra-NN.jpg em ' + SRC_DIR);
  process.exit(1);
}

files.forEach(f => {
  const id = 'P' + path.basename(f, path.extname(f)).split('-')[1];
  const dest = path.join(OUT_DIR, id + '.jpg');
  const src = path.join(SRC_DIR, f);
  const { w, h } = dim(src);
  const lado = Math.min(w, h);

  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', src,
    '-c', String(lado), String(lado), '--out', dest], { stdio: 'ignore' });   // -c corta do centro
  execFileSync('sips', ['-z', String(LADO), String(LADO), dest], { stdio: 'ignore' });

  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(`${id}  ${w}×${h} → pedras/${id}.jpg  ${LADO}×${LADO}  ${kb}KB`);
});

console.log(`\n${files.length} pedras preparadas.`);

/* Confere contra o rings.json, que vem da ficha do vendedor. */
const fichaPath = path.join(ROOT, 'rings.json');
if (fs.existsSync(fichaPath)) {
  const ficha = JSON.parse(fs.readFileSync(fichaPath, 'utf8'));
  const temFoto = new Set(fs.readdirSync(OUT_DIR).map(f => path.basename(f, '.jpg')));
  const semFoto = ficha.filter(r => !temFoto.has(r.id)).map(r => r.id);
  const semFicha = [...temFoto].filter(id => !ficha.some(r => r.id === id));
  if (semFoto.length) console.log(`  aviso: na ficha mas sem foto: ${semFoto.join(', ')}`);
  if (semFicha.length) console.log(`  aviso: com foto mas fora da ficha: ${semFicha.join(', ')}`);
  if (!semFoto.length && !semFicha.length) console.log(`  as ${ficha.length} pedras da ficha têm todas foto.`);
}
