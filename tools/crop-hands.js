#!/usr/bin/env node
/**
 * Recorta as fotos da mão para quadrados centrados no anel e grava-as em
 * aneis/ como JPEG 800×800. Só corre no macOS (usa o sips).
 *
 *   node tools/crop-hands.js "../Ring Sample"
 *
 * O objectivo é ela ver o anel como se estivesse a olhar para a própria mão:
 * dedos, unhas, o anel no meio disso. A foto inteira é demasiado: o anel
 * ocupa ~6% da largura e num cartão de telemóvel fica com 20px. O recorte
 * de 820px apanha as quatro unhas e quase toda a mão, e a pedra ainda se lê.
 *
 * As fotos partem todas da mesma foto da mão, por isso a pedra está quase
 * sempre no mesmo sítio. CENTROS guarda o centro da pedra em cada foto, em px
 * da imagem original, medido a olho. Uma foto nova que não esteja na lista
 * usa DEFAULT: confirmar o recorte e, se o anel ficar descentrado, acrescentar
 * a entrada e voltar a correr.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'aneis');
const SRC_DIR = path.resolve(process.argv[2] || path.join(ROOT, '..', 'Ring Sample'));

const CROP = 820;          // lado do quadrado recortado, px originais
const OUT = 800;           // lado final
const RING_X = 0.36;       // posição da pedra no quadrado: à esquerda do centro,
const RING_Y = 0.56;       // e abaixo, para caberem as pontas dos dedos
const DEFAULT = [424, 610];

const CENTROS = {
  A1: [422, 616], A2: [420, 620], A3: [419, 629], A4: [418, 629], A5: [417, 630],
  A6: [426, 606], A7: [426, 614], A8: [428, 614], A9: [424, 616], A10: [419, 602],
  B11: [424, 600], B12: [424, 596], B13: [426, 610], B14: [426, 614], B15: [426, 622],
  C16: [434, 606], C17: [432, 604],
  D18: [422, 580], D19: [426, 616], D20: [425, 602], D21: [427, 582], D22: [429, 608],
  D23: [426, 590], D24: [428, 612], D25: [423, 629], D26: [424, 624], D27: [426, 630],
  D28: [425, 628], D29: [420, 575], D30: [422, 606], D31: [424, 608], D32: [426, 632],
  D33: [418, 624], D34: [424, 612], D35: [420, 622], D36: [425, 614], D37: [422, 638],
  D38: [430, 614], D39: [420, 600],
  E40: [424, 584], E41: [424, 596], E42: [424, 584], E43: [424, 604], E44: [420, 590],
  E45: [418, 606],
  F46: [426, 592], F47: [420, 618], F48: [428, 588], F49: [420, 606], F50: [424, 618],
  F51: [428, 596], F52: [416, 614], F53: [426, 628],
  G54: [424, 612], G55: [430, 606], G56: [420, 598], G57: [426, 588]
};

if (!fs.existsSync(SRC_DIR)) {
  console.error('Não existe a pasta ' + SRC_DIR);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs.readdirSync(SRC_DIR).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
const semCentro = [];

files.forEach(f => {
  const id = path.basename(f, path.extname(f));
  const [cx, cy] = CENTROS[id] || DEFAULT;
  if (!CENTROS[id]) semCentro.push(id);

  const x = Math.max(0, Math.round(cx - CROP * RING_X));
  const y = Math.max(0, Math.round(cy - CROP * RING_Y));
  const dest = path.join(OUT_DIR, id + '.jpg');

  // --cropOffset leva y antes de x
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80',
    path.join(SRC_DIR, f), '--cropOffset', String(y), String(x),
    '-c', String(CROP), String(CROP), '--out', dest], { stdio: 'ignore' });
  execFileSync('sips', ['-z', String(OUT), String(OUT), dest], { stdio: 'ignore' });

  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log(`${id.padEnd(4)} → aneis/${id}.jpg  ${kb}KB`);
});

console.log(`\n${files.length} fotos recortadas.`);
if (semCentro.length) {
  console.log(`  ${semCentro.length} sem centro medido (usaram o DEFAULT): ${semCentro.join(', ')}`);
  console.log('  Ver se o anel ficou centrado; se não, acrescentar a CENTROS.');
}
