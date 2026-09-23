#!/usr/bin/env node
/**
 * Recorta as fotos da mão para quadrados centrados no anel e grava-as em
 * aneis/ como JPEG 800×800. Só corre no macOS (usa o sips).
 *
 *   node tools/crop-hands.js "../Aneis Round 2"
 *
 * O objectivo é ela ver o anel como se estivesse a olhar para a própria mão:
 * dedos, unhas, o anel no meio disso. A foto inteira é demasiado: o anel
 * ocupa ~6% da largura e num cartão de telemóvel fica com 20px. O recorte
 * de 820px apanha as quatro unhas e quase toda a mão, e a pedra ainda se lê.
 *
 * As fotos partem todas da mesma foto da mão, por isso a pedra está quase
 * sempre no mesmo sítio. CENTROS guarda o centro da pedra em cada foto, em px
 * da imagem original. Os centros da ronda 2 foram detectados por cor (a pedra
 * é a única mancha verde ou azul na mão) e conferidos nos anéis repescados,
 * cujo centro já tinha sido medido à mão. Uma foto nova que não esteja na
 * lista usa DEFAULT: confirmar o recorte e, se o anel ficar descentrado,
 * acrescentar a entrada e voltar a correr.
 *
 * MAPA renomeia os anéis repescados da ronda 1 para o espaço de nomes da
 * ronda 2. Sem isso, os ids repetidos apanhavam pelo caminho as linhas que
 * esses anéis já tinham na folha, de duelos contra anéis que já não existem.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'aneis');
const SRC_DIR = path.resolve(process.argv[2] || path.join(ROOT, '..', 'Aneis Round 2'));

const CROP = 820;          // lado do quadrado recortado, px originais
const OUT = 800;           // lado final
const RING_X = 0.36;       // posição da pedra no quadrado: à esquerda do centro,
const RING_Y = 0.56;       // e abaixo, para caberem as pontas dos dedos
const DEFAULT = [424, 630];

// ficheiro de origem → id na ronda 2
const MAPA = {
  A1: 'R01', D25: 'R02', D26: 'R03', D27: 'R04', F50: 'R05', G56: 'R06',
  // segunda repescagem: os básicos que faltavam e um controlo
  D18: 'R27', D21: 'R28', D20: 'R29', D22: 'R30',
  E42: 'R31', E40: 'R32', E41: 'R33', C17: 'R34',
  // terceira repescagem: os que nunca tinham enfrentado os favoritos
  D30: 'R35', D29: 'R36', G57: 'R37', D19: 'R38', D28: 'R39', F48: 'R40'
};

const CENTROS = {
  R01: [422, 616], R02: [423, 629], R03: [424, 624], R04: [426, 630],
  R05: [424, 618], R06: [420, 598],
  R07: [428, 672], R08: [428, 646], R09: [425, 621], R10: [417, 639],
  R12: [412, 631], R13: [430, 658], R14: [422, 649], R15: [418, 649],
  R16: [422, 606], R17: [432, 640], R18: [421, 623], R19: [429, 625],
  R20: [420, 631], R21: [440, 586], R22: [422, 639], R23: [434, 727],
  R24: [435, 705], R25: [423, 634], R26: [427, 623],
  R27: [422, 580], R28: [427, 582], R29: [425, 602], R30: [429, 608],
  R31: [424, 584], R32: [424, 584], R33: [424, 596], R34: [432, 604],
  R35: [422, 606], R36: [420, 575], R37: [426, 588], R38: [426, 616],
  R39: [425, 628], R40: [428, 588]
};

if (!fs.existsSync(SRC_DIR)) {
  console.error('Não existe a pasta ' + SRC_DIR);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs.readdirSync(SRC_DIR).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
const semCentro = [];

files.forEach(f => {
  const bruto = path.basename(f, path.extname(f));
  const id = MAPA[bruto] || bruto;
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
  const origem = bruto === id ? '' : `  (era ${bruto})`;
  console.log(`${id.padEnd(4)} → aneis/${id}.jpg  ${kb}KB${origem}`);
});

console.log(`\n${files.length} fotos recortadas.`);
if (semCentro.length) {
  console.log(`  ${semCentro.length} sem centro medido (usaram o DEFAULT): ${semCentro.join(', ')}`);
  console.log('  Ver se o anel ficou centrado; se não, acrescentar a CENTROS.');
}
