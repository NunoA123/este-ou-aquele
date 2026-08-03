/* ══════════════════════════════════════════════════════════════
   Anel da Karolina ♡  —  duelo de anéis com ranking Elo
   ══════════════════════════════════════════════════════════════ */

/* ── Configuração ──────────────────────────────────────────────
   SYNC_URL: colar aqui o URL /exec do Google Apps Script.
   Enquanto estiver vazio a app funciona só com localStorage.
   ADMIN_PASS: ofuscação, não segurança. Mudar antes de publicar.
   ────────────────────────────────────────────────────────────── */
const SYNC_URL   = 'https://script.google.com/macros/s/AKfycbzIB3uKDWEd6TtZjd5gWCNHCMYnIdMu8JRF8i1gsy9I9zbBXpo9lJ46b2B2onJ6GCUzgg/exec';
const ADMIN_PASS = 'mirtilo-quarenta-e-sete';

const STORAGE_KEY    = 'ringduel:state:v1';
const SESSION_LIMIT  = 35;   // escolhas antes do ecrã de pausa
const ELO_WINDOW     = 120;  // janela de emparelhamento na fase 2
const PHASE1_GAMES   = 3;    // abaixo disto ainda estamos a cobrir
const K_HIGH         = 32;   // < 5 jogos
const K_LOW          = 16;   // >= 5 jogos
const K_SWITCH       = 5;
const PLAYOFF_TOP    = 6;
const SYNC_BATCH     = 5;

/* ── Valores permitidos em rings.json ─────────────────────────── */
const SCHEMA = {
  cut:     ['round', 'oval', 'princess', 'emerald', 'pear', 'marquise', 'cushion', 'radiant'],
  setting: ['solitaire', 'halo', 'three-stone', 'pave', 'bezel', 'cluster'],
  metal:   ['white-gold', 'yellow-gold', 'rose-gold', 'platinum', 'mixed'],
  band:    ['thin', 'medium', 'thick'],
  profile: ['low', 'medium', 'high'],
  accent:  ['none', 'side-stones', 'engraved', 'twisted', 'split-shank']
};
const FIELDS = Object.keys(SCHEMA);

/* ── Estado ────────────────────────────────────────────────── */
let RINGS = [];              // [{id, img, cut, ...}]
let RING_BY_ID = {};
let state = null;
let current = null;          // { a, b, leftIsA }
let lastMove = null;         // uma escolha para trás
let seenPairs = new Set();   // pares já mostrados no ciclo actual da fase
let seenPhase = null;        // fase a que o ciclo pertence

const $ = (id) => document.getElementById(id);

/* ══════════════════════════════════════════════════════════════
   Persistência
   ══════════════════════════════════════════════════════════════ */

function blankState() {
  const s = {
    version: 1,
    player: 'k',
    ratings: {}, games: {}, wins: {},
    history: [],
    skipped: [],
    phase: 'pairing',
    playoffIds: null,
    sessionCount: 0
  };
  RINGS.forEach(r => { s.ratings[r.id] = 1500; s.games[r.id] = 0; s.wins[r.id] = 0; });
  return s;
}

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { s = null; }
  if (!s || s.version !== 1) return blankState();
  // anéis novos adicionados depois de a sessão começar
  RINGS.forEach(r => {
    if (typeof s.ratings[r.id] !== 'number') { s.ratings[r.id] = 1500; s.games[r.id] = 0; s.wins[r.id] = 0; }
  });
  s.history = s.history || [];
  s.skipped = s.skipped || [];
  s.sessionCount = s.sessionCount || 0;
  s.phase = s.phase || 'pairing';
  s.playoffIds = s.playoffIds || null;
  return s;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* silêncio */ }
}

/* ══════════════════════════════════════════════════════════════
   Elo
   ══════════════════════════════════════════════════════════════ */

const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
const kFor = (n) => (n < K_SWITCH ? K_HIGH : K_LOW);

/** Aplica um resultado a um mapa de ratings/jogos. Muta os objectos. */
function applyResult(ratings, games, wins, a, b, winner) {
  const ra = ratings[a], rb = ratings[b];
  if (typeof ra !== 'number' || typeof rb !== 'number') return;
  const sa = winner === a ? 1 : 0;
  const ka = kFor(games[a] || 0), kb = kFor(games[b] || 0);
  const ea = expected(ra, rb);
  ratings[a] = ra + ka * (sa - ea);
  ratings[b] = rb + kb * ((1 - sa) - (1 - ea));
  games[a] = (games[a] || 0) + 1;
  games[b] = (games[b] || 0) + 1;
  wins[winner] = (wins[winner] || 0) + 1;
}

/* ══════════════════════════════════════════════════════════════
   Emparelhamento
   ══════════════════════════════════════════════════════════════ */

const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

function skippedSet() {
  const s = new Set();
  state.skipped.forEach(p => s.add(pairKey(p[0], p[1])));
  return s;
}

/** Fase corrente: 'playoff' é manual; senão depende do mínimo de jogos. */
function currentPhase() {
  if (state.phase === 'playoff' || state.phase === 'finished') return state.phase;
  const min = Math.min(...RINGS.map(r => state.games[r.id] || 0));
  return min < PHASE1_GAMES ? 'phase1' : 'phase2';
}

function topIds(n) {
  return RINGS.slice()
    .sort((x, y) => state.ratings[y.id] - state.ratings[x.id])
    .slice(0, n)
    .map(r => r.id);
}

/**
 * Os 6 do playoff, congelados no momento em que o playoff arranca.
 * Sem isto o round-robin nunca fecha: os Elos mexem-se durante o playoff,
 * a composição do top 6 muda a meio e aparecem combinações a mais.
 */
function playoffIds() {
  if (!Array.isArray(state.playoffIds) || state.playoffIds.length < 2) {
    state.playoffIds = topIds(PLAYOFF_TOP);
    save();
  }
  return state.playoffIds;
}

/** Todos os pares possíveis da fase, já sem os saltados. */
function candidatePairs(phase) {
  const skip = skippedSet();
  const out = [];

  if (phase === 'playoff') {
    const top = playoffIds();
    for (let i = 0; i < top.length; i++)
      for (let j = i + 1; j < top.length; j++) {
        const k = pairKey(top[i], top[j]);
        if (!skip.has(k)) out.push([top[i], top[j], k]);
      }
    return out;
  }

  const ids = RINGS.map(r => r.id);
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      if (!skip.has(k)) out.push([ids[i], ids[j], k]);
    }
  return out;
}

/**
 * Escolhe o próximo par.
 * Nunca repete um par enquanto a fase não esgotar todas as combinações.
 * Devolve null quando o playoff termina.
 */
function nextPair() {
  const phase = currentPhase();
  if (phase === 'finished') return null;

  if (seenPhase !== phase) { seenPairs = new Set(); seenPhase = phase; }

  let pool = candidatePairs(phase);
  if (!pool.length) return null;

  let fresh = pool.filter(p => !seenPairs.has(p[2]));
  if (!fresh.length) {
    // esgotou-se o ciclo
    if (phase === 'playoff') { state.phase = 'finished'; save(); return null; }
    seenPairs = new Set();
    fresh = pool;
  }

  let chosen;

  if (phase === 'phase1') {
    // prioridade a quem tem menos jogos disputados
    const g = (id) => state.games[id] || 0;
    let best = Infinity;
    fresh.forEach(p => { const v = g(p[0]) + g(p[1]); if (v < best) best = v; });
    const tier = fresh.filter(p => g(p[0]) + g(p[1]) === best);
    chosen = tier[(Math.random() * tier.length) | 0];

  } else if (phase === 'phase2') {
    // janela de ±120 pontos; alarga se não houver nada
    const near = (w) => fresh.filter(p => Math.abs(state.ratings[p[0]] - state.ratings[p[1]]) <= w);
    let tier = near(ELO_WINDOW);
    for (let w = ELO_WINDOW * 2; !tier.length && w <= 2000; w *= 2) tier = near(w);
    if (!tier.length) tier = fresh;
    chosen = tier[(Math.random() * tier.length) | 0];

  } else { // playoff — ordem aleatória entre as combinações que faltam
    chosen = fresh[(Math.random() * fresh.length) | 0];
  }

  seenPairs.add(chosen[2]);
  return { a: chosen[0], b: chosen[1], leftIsA: Math.random() < 0.5 };
}

/* ══════════════════════════════════════════════════════════════
   Sincronização (silenciosa — nunca aparece nada à jogadora)
   ══════════════════════════════════════════════════════════════ */

function syncRows(force) {
  if (!SYNC_URL) return;
  const pending = state.history.filter(h => !h.synced);
  if (!pending.length) return;
  if (!force && pending.length < SYNC_BATCH) return;

  const rows = pending.map(h => ({
    t: h.t, a: h.a, b: h.b, winner: h.winner, elo_a: h.ea, elo_b: h.eb
  }));

  // Content-Type text/plain evita o preflight, que o Apps Script rejeita.
  fetch(SYNC_URL, {
    method: 'POST',
    mode: 'no-cors',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ rows })
  }).then(() => {
    // resposta opaca: assume êxito se o fetch não rejeitou
    pending.forEach(h => { h.synced = true; });
    save();
  }).catch(() => { /* fica synced:false e vai no lote seguinte */ });
}

/* ══════════════════════════════════════════════════════════════
   Jogo
   ══════════════════════════════════════════════════════════════ */

let busy = false;

function showScreen(which) {
  ['scr-game', 'scr-pause', 'scr-done', 'scr-load'].forEach(id => {
    $(id).hidden = (id !== which);
  });
}

function renderPair() {
  if (!current) { showScreen('scr-done'); return; }
  const left  = current.leftIsA ? current.a : current.b;
  const right = current.leftIsA ? current.b : current.a;
  $('img0').src = RING_BY_ID[left].img;
  $('img1').src = RING_BY_ID[right].img;
  $('card0').dataset.ring = left;
  $('card1').dataset.ring = right;
  $('btn-back').disabled = !lastMove;
  showScreen('scr-game');
}

function advance() {
  const arena = $('arena');
  arena.classList.add('fading');
  setTimeout(() => {
    $('card0').classList.remove('chosen');
    $('card1').classList.remove('chosen');
    current = nextPair();
    if (!current) { arena.classList.remove('fading'); showScreen('scr-done'); busy = false; return; }
    renderPair();
    arena.classList.remove('fading');
    busy = false;
  }, 190);
}

function choose(winnerId) {
  if (busy || !current) return;
  busy = true;

  const a = current.a, b = current.b;
  const loserId = winnerId === a ? b : a;

  // snapshot para o "Anterior"
  lastMove = {
    a, b, winner: winnerId,
    ra: state.ratings[a], rb: state.ratings[b],
    ga: state.games[a], gb: state.games[b],
    wa: state.wins[a], wb: state.wins[b],
    session: state.sessionCount,
    pairKey: pairKey(a, b)
  };

  applyResult(state.ratings, state.games, state.wins, a, b, winnerId);
  state.history.push({
    t: Date.now(), a, b, winner: winnerId,
    ea: round2(state.ratings[a]), eb: round2(state.ratings[b]),
    synced: false
  });
  state.sessionCount++;
  save();
  syncRows(false);

  // feedback visual, idêntico dos dois lados
  const card = $('card0').dataset.ring === winnerId ? $('card0') : $('card1');
  card.classList.add('chosen');

  setTimeout(() => {
    if (state.sessionCount >= SESSION_LIMIT) {
      $('card0').classList.remove('chosen');
      $('card1').classList.remove('chosen');
      syncRows(true);
      showScreen('scr-pause');
      busy = false;
      return;
    }
    advance();
  }, 260);
  void loserId;
}

function skipPair() {
  if (busy || !current) return;
  busy = true;
  state.skipped.push([current.a, current.b]);
  save();
  advance();
}

function undo() {
  if (busy || !lastMove) return;
  const m = lastMove;
  state.ratings[m.a] = m.ra; state.ratings[m.b] = m.rb;
  state.games[m.a]   = m.ga; state.games[m.b]   = m.gb;
  state.wins[m.a]    = m.wa; state.wins[m.b]    = m.wb;
  state.sessionCount = m.session;

  // remove do histórico apenas se ainda não foi enviado
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (h.a === m.a && h.b === m.b && h.winner === m.winner) {
      if (!h.synced) state.history.splice(i, 1);
      break;
    }
  }
  seenPairs.delete(m.pairKey);
  lastMove = null;
  save();

  current = { a: m.a, b: m.b, leftIsA: Math.random() < 0.5 };
  seenPairs.add(m.pairKey);
  $('card0').classList.remove('chosen');
  $('card1').classList.remove('chosen');
  renderPair();
}

const round2 = (n) => Math.round(n * 100) / 100;

/* ── Pré-carregamento: nunca um flash branco ─────────────────── */
function preloadAll() {
  let i = 0;
  const step = () => {
    if (i >= RINGS.length) return;
    const im = new Image();
    im.onload = im.onerror = () => setTimeout(step, 60);
    im.src = RINGS[i++].img;
  };
  step();
}

/* ══════════════════════════════════════════════════════════════
   Arranque
   ══════════════════════════════════════════════════════════════ */

function validateRings(list) {
  const seen = new Set();
  list.forEach((r, i) => {
    if (!r.id) { console.warn(`rings.json[${i}]: falta "id"`); return; }
    if (seen.has(r.id)) console.warn(`rings.json: id duplicado "${r.id}"`);
    seen.add(r.id);
    if (!r.img) console.warn(`rings.json[${r.id}]: falta "img"`);
    FIELDS.forEach(f => {
      if (r[f] === undefined || r[f] === null || r[f] === '') {
        console.warn(`rings.json[${r.id}]: campo obrigatório "${f}" vazio`);
      } else if (!SCHEMA[f].includes(r[f])) {
        console.warn(`rings.json[${r.id}]: "${f}" = "${r[f]}" não está na lista permitida (${SCHEMA[f].join(', ')})`);
      }
    });
  });
}

async function loadRings() {
  const res = await fetch('rings.json', { cache: 'no-store' });
  const list = await res.json();
  validateRings(list);
  RINGS = list;
  RING_BY_ID = {};
  RINGS.forEach(r => { RING_BY_ID[r.id] = r; });
}

function wireGame() {
  $('card0').addEventListener('click', () => choose($('card0').dataset.ring));
  $('card1').addEventListener('click', () => choose($('card1').dataset.ring));
  $('btn-none').addEventListener('click', skipPair);
  $('btn-back').addEventListener('click', undo);

  $('btn-more').addEventListener('click', () => {
    state.sessionCount = 0; save();
    advance();
  });
  $('btn-stop').addEventListener('click', () => {
    state.sessionCount = 0; save();
    syncRows(true);
    showScreen('scr-done');
  });

  document.addEventListener('keydown', (e) => {
    if (!$('scr-game').hidden) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); choose($('card0').dataset.ring); }
      if (e.key === 'ArrowRight') { e.preventDefault(); choose($('card1').dataset.ring); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); skipPair(); }
      if (e.key === 'Backspace')  { e.preventDefault(); undo(); }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') syncRows(true);
  });
  window.addEventListener('online', () => syncRows(true));
}

async function boot() {
  if (location.hash.startsWith('#/admin')) { await bootAdmin(); return; }

  showScreen('scr-load');
  try {
    await loadRings();
  } catch (e) {
    console.error('Não foi possível carregar rings.json', e);
    return; // fica no ecrã "Um momento…", sem falar de rede
  }
  if (!RINGS.length) { console.error('rings.json está vazio'); return; }

  state = load();
  wireGame();
  syncRows(true);           // envia o que tiver ficado pendente da última vez
  current = nextPair();
  renderPair();
  preloadAll();
}

window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#/admin')) bootAdmin();
  else location.reload();
});

/* ══════════════════════════════════════════════════════════════
   VISTA DO DONO
   ══════════════════════════════════════════════════════════════ */

let adminOpen = false;

async function bootAdmin() {
  if (adminOpen) return;
  const pass = window.prompt('Password');
  if (pass !== ADMIN_PASS) { location.hash = ''; return; }
  adminOpen = true;

  const el = $('admin');
  el.hidden = false;
  $('shell').style.display = 'none';
  el.innerHTML = '<p>a carregar…</p>';

  try { await loadRings(); } catch (e) { el.innerHTML = '<p class="warn">rings.json não carregou.</p>'; return; }

  let rows = null, source = '';
  if (SYNC_URL) {
    try {
      const r = await fetch(SYNC_URL, { cache: 'no-store' });
      const raw = await r.json();
      rows = normalizeRemote(raw);
      source = 'remoto';
    } catch (e) { rows = null; }
  }
  if (!rows) {
    const local = load();
    rows = local.history.map(h => ({ t: h.t, a: h.a, b: h.b, winner: h.winner }));
    source = 'local';
  }

  renderAdmin(rows, source);
}

function normalizeRemote(raw) {
  // A Sheet devolve arrays [timestamp, a, b, winner, elo_a, elo_b]
  const out = raw.map(v => ({
    t: new Date(v[0]).getTime() || 0,
    a: String(v[1] || ''), b: String(v[2] || ''), winner: String(v[3] || '')
  })).filter(r => r.a && r.b);
  // dedupe defensivo (um POST reenviado não pode contar duas vezes)
  const seen = new Set();
  return out.filter(r => {
    const k = r.t + '|' + r.a + '|' + r.b + '|' + r.winner;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).sort((x, y) => x.t - y.t);
}

/** Recalcula tudo do zero a partir das linhas. */
function recompute(rows) {
  const ratings = {}, games = {}, wins = {}, losses = {};
  RINGS.forEach(r => { ratings[r.id] = 1500; games[r.id] = 0; wins[r.id] = 0; losses[r.id] = 0; });

  const h2h = {};   // h2h[a][b] = vitórias de a sobre b
  let skips = 0, used = 0;

  rows.forEach(r => {
    if (!(r.a in ratings) || !(r.b in ratings)) return;       // anel desconhecido
    if (r.winner !== r.a && r.winner !== r.b) { skips++; return; }  // 'skip' e afins
    applyResult(ratings, games, wins, r.a, r.b, r.winner);
    const loser = r.winner === r.a ? r.b : r.a;
    losses[loser]++;
    (h2h[r.winner] = h2h[r.winner] || {})[loser] = ((h2h[r.winner] || {})[loser] || 0) + 1;
    used++;
  });

  return { ratings, games, wins, losses, h2h, skips, used };
}

function aggregate(calc) {
  const out = {};
  FIELDS.forEach(f => {
    const buckets = {};
    RINGS.forEach(r => {
      const v = r[f];
      if (v === undefined || v === null || v === '') return;
      const bk = buckets[v] || (buckets[v] = { value: v, rings: 0, games: 0, wsum: 0 });
      bk.rings++;
      bk.games += calc.games[r.id] || 0;
      bk.wsum  += (calc.ratings[r.id] || 1500) * (calc.games[r.id] || 0);
      bk.plain = (bk.plain || 0) + (calc.ratings[r.id] || 1500);
    });
    out[f] = Object.values(buckets).map(bk => ({
      value: bk.value,
      rings: bk.rings,
      games: bk.games,
      // Elo médio ponderado pelo número de jogos; sem jogos, média simples
      elo: bk.games > 0 ? bk.wsum / bk.games : bk.plain / bk.rings,
      weak: bk.rings < 3 || bk.games < 10
    })).sort((x, y) => y.elo - x.elo);
  });
  return out;
}

/** Ciclos A>B>C>A nos confrontos directos do top N. */
function findCycles(calc, ids) {
  const beats = (x, y) => {
    const w = (calc.h2h[x] && calc.h2h[x][y]) || 0;
    const l = (calc.h2h[y] && calc.h2h[y][x]) || 0;
    return w > l;
  };
  const found = [], seen = new Set();
  for (let i = 0; i < ids.length; i++)
    for (let j = 0; j < ids.length; j++)
      for (let k = 0; k < ids.length; k++) {
        if (i === j || j === k || i === k) continue;
        const A = ids[i], B = ids[j], C = ids[k];
        if (beats(A, B) && beats(B, C) && beats(C, A)) {
          const key = [A, B, C].slice().sort().join('|');
          if (!seen.has(key)) { seen.add(key); found.push([A, B, C]); }
        }
      }
  return found;
}

function renderAdmin(rows, source) {
  const calc = recompute(rows);
  const el = $('admin');
  const n = (x, d = 1) => (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);

  const ordered = RINGS.slice().sort((a, b) => calc.ratings[b.id] - calc.ratings[a.id]);
  const gamesArr = RINGS.map(r => calc.games[r.id] || 0);
  const minG = Math.min(...gamesArr), avgG = gamesArr.reduce((a, b) => a + b, 0) / (gamesArr.length || 1);

  const local = load();
  const phase = (() => {
    const saved = state ? state.phase : local.phase;
    if (saved === 'playoff') return 'playoff';
    if (saved === 'finished') return 'terminado';
    return minG < PHASE1_GAMES ? 'fase 1 (cobertura)' : 'fase 2 (janela ±' + ELO_WINDOW + ')';
  })();

  const agg = aggregate(calc);
  const cycles = findCycles(calc, ordered.slice(0, PLAYOFF_TOP).map(r => r.id));

  let html = '';

  html += source === 'remoto'
    ? '<div class="ok">Dados vindos da Google Sheet (' + rows.length + ' linhas). Elos recalculados do zero.</div>'
    : '<div class="warn">Sem ligação ao SYNC_URL' + (SYNC_URL ? '' : ' (não configurado)') +
      ' — a usar o localStorage <b>deste</b> dispositivo. Os dados podem estar incompletos.</div>';

  /* 4. Estado */
  html += '<h2>Estado</h2><table>' +
    row2('comparações contadas', calc.used) +
    row2('linhas ignoradas / saltadas', calc.skips + (source === 'local' ? ' (+' + (local.skipped || []).length + ' pares saltados localmente)' : '')) +
    row2('anéis', RINGS.length) +
    row2('jogos por anel — mínimo', minG) +
    row2('jogos por anel — média', n(avgG, 2)) +
    row2('fase actual', phase) +
    '</table>';

  /* 5. Botões */
  html += '<div class="bar">' +
    '<button id="ad-export">Exportar JSON</button>' +
    '<button id="ad-import">Importar JSON</button>' +
    '<button id="ad-playoff">Ativar playoff</button>' +
    '<button id="ad-reset">Reset total</button>' +
    '<button id="ad-reload">Recarregar</button>' +
    '</div>';

  /* 2. Agregação por atributo — a secção mais importante */
  html += '<h2>Agregação por atributo</h2>';
  html += '<p class="muted">Elo médio ponderado pelos jogos disputados. ' +
          '<span class="weak">A vermelho</span> = menos de 3 anéis ou menos de 10 jogos: pouco fiável.</p>';
  html += '<div class="grid">';
  FIELDS.forEach(f => {
    html += '<div><table><thead><tr><th>' + f + '</th><th class="num">elo</th><th class="num">anéis</th><th class="num">jogos</th></tr></thead><tbody>';
    agg[f].forEach(b => {
      html += '<tr class="' + (b.weak ? 'weak' : '') + '"><td>' + b.value + '</td>' +
              '<td class="num">' + n(b.elo) + '</td>' +
              '<td class="num">' + b.rings + '</td>' +
              '<td class="num">' + b.games + '</td></tr>';
    });
    html += '</tbody></table></div>';
  });
  html += '</div>';

  /* 3. Intransitividade */
  html += '<h2>Intransitividade no top ' + PLAYOFF_TOP + '</h2>';
  if (!cycles.length) {
    html += '<p class="muted">Nenhum ciclo encontrado nos confrontos directos.</p>';
  } else {
    html += '<p class="muted">Cada ciclo é um grupo sem preferência forte.</p><table><tbody>';
    cycles.forEach(c => { html += '<tr><td>' + c[0] + ' &gt; ' + c[1] + ' &gt; ' + c[2] + ' &gt; ' + c[0] + '</td></tr>'; });
    html += '</tbody></table>';
  }

  /* 1. Tabela de anéis */
  html += '<h2>Anéis por Elo</h2><div class="scroll"><table><thead><tr>' +
    '<th>#</th><th>foto</th><th>id</th><th class="num">elo</th><th class="num">jogos</th><th class="num">v-d</th>' +
    FIELDS.map(f => '<th>' + f + '</th>').join('') + '<th>note</th></tr></thead><tbody>';
  ordered.forEach((r, i) => {
    html += '<tr><td class="num">' + (i + 1) + '</td>' +
      '<td><img class="thumb" src="' + r.img + '" alt=""></td>' +
      '<td>' + r.id + '</td>' +
      '<td class="num">' + n(calc.ratings[r.id]) + '</td>' +
      '<td class="num">' + (calc.games[r.id] || 0) + '</td>' +
      '<td class="num">' + (calc.wins[r.id] || 0) + '-' + (calc.losses[r.id] || 0) + '</td>' +
      FIELDS.map(f => '<td>' + (r[f] || '<span class="weak">—</span>') + '</td>').join('') +
      '<td>' + (r.note || '') + '</td></tr>';
  });
  html += '</tbody></table></div>';

  el.innerHTML = html;
  wireAdminButtons(rows, calc);

  function row2(k, v) { return '<tr><td>' + k + '</td><td class="num">' + v + '</td></tr>'; }
}

function wireAdminButtons(rows, calc) {
  $('ad-reload').onclick = () => { adminOpen = false; bootAdmin(); };

  $('ad-export').onclick = () => {
    const blob = new Blob([JSON.stringify({
      exported: new Date().toISOString(),
      rings: RINGS,
      rows,
      ratings: calc.ratings, games: calc.games, wins: calc.wins,
      local: load()
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ringduel-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  $('ad-import').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const data = JSON.parse(fr.result);
          const st = data.local || data;
          if (!st.ratings) throw new Error('formato inesperado');
          st.version = 1;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
          alert('Importado. A recarregar.');
          adminOpen = false; bootAdmin();
        } catch (e) { alert('Ficheiro inválido: ' + e.message); }
      };
      fr.readAsText(f);
    };
    inp.click();
  };

  $('ad-playoff').onclick = () => {
    // congela os 6 já a partir dos Elos recalculados, para o round-robin fechar
    const top = RINGS.slice()
      .sort((a, b) => calc.ratings[b.id] - calc.ratings[a.id])
      .slice(0, PLAYOFF_TOP).map(r => r.id);
    if (!confirm('Activar playoff entre:\n\n' + top.join(', ') + '\n\nSão ' +
                 (PLAYOFF_TOP * (PLAYOFF_TOP - 1) / 2) + ' confrontos.')) return;
    const s = load();
    s.phase = 'playoff';
    s.playoffIds = top;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    alert('Playoff activado neste dispositivo.\n\nAtenção: a fase vive no localStorage do telemóvel onde ela joga — ' +
          'para valer no jogo dela, é preciso activar no telemóvel dela.');
  };

  $('ad-reset').onclick = () => {
    if (!confirm('Reset total: apaga TODOS os dados locais. Continuar?')) return;
    if (!confirm('A sério? Isto não se desfaz. A Google Sheet, se existir, mantém-se.')) return;
    localStorage.removeItem(STORAGE_KEY);
    alert('Estado local apagado.');
    adminOpen = false; bootAdmin();
  };
}

boot();
