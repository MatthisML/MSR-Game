/* Karten, Hand-Klassen (169) und Kombinationen.
   Karte = Zahl 0..51: rank * 4 + suit, rank 0..12 = 2..A, suit 0..3 = c d h s */
(function (SC) {
  'use strict';

  const RANKS = '23456789TJQKA';
  const SUITS = 'cdhs';
  const SUIT_SYMBOL = ['♣', '♦', '♥', '♠'];
  const SUIT_NAME_DE = ['Kreuz', 'Karo', 'Herz', 'Pik'];
  const RANK_NAME_DE = ['Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Bube', 'Dame', 'König', 'Ass'];

  const card = (rank, suit) => rank * 4 + suit;
  const rankOf = (c) => c >> 2;
  const suitOf = (c) => c & 3;

  function cardFromCode(code) {
    if (!code || code.length !== 2) return -1;
    const r = RANKS.indexOf(code[0].toUpperCase());
    const s = SUITS.indexOf(code[1].toLowerCase());
    return r < 0 || s < 0 ? -1 : card(r, s);
  }
  const cardCode = (c) => RANKS[rankOf(c)] + SUITS[suitOf(c)];
  const cardLabel = (c) => RANKS[rankOf(c)].replace('T', '10') + SUIT_SYMBOL[suitOf(c)];

  /* Hand-Klassen im 13x13-Raster: Zeile i, Spalte j (0 = Ass ... 12 = Zwei).
     i == j Paar, i < j suited (oben rechts), i > j offsuit. Klassen-Id = i * 13 + j. */
  const N_CLASSES = 169;
  const CLASS_NAMES = new Array(N_CLASSES);
  const CLASS_COMBOS = new Array(N_CLASSES); // Liste von [c1, c2]
  const CLASS_NCOMBOS = new Uint8Array(N_CLASSES);
  const CLASS_HI = new Uint8Array(N_CLASSES);
  const CLASS_LO = new Uint8Array(N_CLASSES);
  const CLASS_TYPE = new Array(N_CLASSES); // 'pair' | 'suited' | 'offsuit'

  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const id = i * 13 + j;
      const ri = 12 - i, rj = 12 - j;
      const hi = Math.max(ri, rj), lo = Math.min(ri, rj);
      CLASS_HI[id] = hi; CLASS_LO[id] = lo;
      const combos = [];
      if (i === j) {
        CLASS_TYPE[id] = 'pair';
        CLASS_NAMES[id] = RANKS[hi] + RANKS[hi];
        for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) combos.push([card(hi, a), card(hi, b)]);
      } else if (i < j) {
        CLASS_TYPE[id] = 'suited';
        CLASS_NAMES[id] = RANKS[hi] + RANKS[lo] + 's';
        for (let s = 0; s < 4; s++) combos.push([card(hi, s), card(lo, s)]);
      } else {
        CLASS_TYPE[id] = 'offsuit';
        CLASS_NAMES[id] = RANKS[hi] + RANKS[lo] + 'o';
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) combos.push([card(hi, a), card(lo, b)]);
      }
      CLASS_COMBOS[id] = combos;
      CLASS_NCOMBOS[id] = combos.length;
    }
  }

  function classOf(c1, c2) {
    const r1 = rankOf(c1), r2 = rankOf(c2);
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    const i = 12 - hi, j = 12 - lo;
    if (hi === lo) return i * 13 + i;
    return suitOf(c1) === suitOf(c2) ? i * 13 + j : j * 13 + i;
  }

  function classFromName(name) {
    if (!name) return -1;
    const n = name.trim();
    const r1 = RANKS.indexOf(n[0] && n[0].toUpperCase());
    const r2 = RANKS.indexOf(n[1] && n[1].toUpperCase());
    if (r1 < 0 || r2 < 0) return -1;
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    const i = 12 - hi, j = 12 - lo;
    if (hi === lo) return i * 13 + i;
    const t = (n[2] || 'o').toLowerCase();
    return t === 's' ? i * 13 + j : j * 13 + i;
  }

  /* Anzahl konfliktfreier Kombi-Paare zweier Klassen (für Card Removal). */
  const COMPAT = new Uint8Array(N_CLASSES * N_CLASSES);
  for (let a = 0; a < N_CLASSES; a++) {
    for (let b = 0; b < N_CLASSES; b++) {
      let n = 0;
      for (const x of CLASS_COMBOS[a]) for (const y of CLASS_COMBOS[b]) {
        if (x[0] !== y[0] && x[0] !== y[1] && x[1] !== y[0] && x[1] !== y[1]) n++;
      }
      COMPAT[a * N_CLASSES + b] = n;
    }
  }

  /* Schneller Zufallsgenerator (xorshift32), reproduzierbar per Seed. */
  function makeRng(seed) {
    let x = (seed >>> 0) || 0x9e3779b9;
    return function () {
      x ^= x << 13; x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5; x >>>= 0;
      return x / 4294967296;
    };
  }

  SC.cards = {
    RANKS, SUITS, SUIT_SYMBOL, SUIT_NAME_DE, RANK_NAME_DE,
    card, rankOf, suitOf, cardFromCode, cardCode, cardLabel,
    N_CLASSES, CLASS_NAMES, CLASS_COMBOS, CLASS_NCOMBOS, CLASS_HI, CLASS_LO, CLASS_TYPE,
    classOf, classFromName, COMPAT, makeRng,
  };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
