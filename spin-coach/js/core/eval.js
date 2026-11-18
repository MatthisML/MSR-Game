/* Handbewertung für 5 bis 7 Karten. Ergebnis: Zahl, größer = besser.
   Kategorie (0 High Card ... 8 Straight Flush) in Bits 20+, darunter Kicker in 4-Bit-Schritten. */
(function (SC) {
  'use strict';

  const CATEGORY_DE = ['High Card', 'Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush'];

  // Höchste Straße in einer 13-Bit-Rangmaske (Rang der höchsten Karte) oder -1.
  const STRAIGHT_HIGH = new Int8Array(8192).fill(-1);
  const POPCOUNT = new Uint8Array(8192);
  for (let m = 0; m < 8192; m++) {
    let n = 0; for (let b = 0; b < 13; b++) if (m & (1 << b)) n++;
    POPCOUNT[m] = n;
    for (let hi = 12; hi >= 4; hi--) {
      const run = 0x1f << (hi - 4);
      if ((m & run) === run) { STRAIGHT_HIGH[m] = hi; break; }
    }
    if (STRAIGHT_HIGH[m] < 0 && (m & 0x100f) === 0x100f) STRAIGHT_HIGH[m] = 3; // A-2-3-4-5
  }

  // Die n höchsten gesetzten Bits als Kicker-Nibbles kodieren.
  function topKickers(mask, n) {
    let v = 0, k = 0;
    for (let r = 12; r >= 0 && k < n; r--) {
      if (mask & (1 << r)) { v = (v << 4) | r; k++; }
    }
    while (k < n) { v <<= 4; k++; }
    return v;
  }

  const cnt = new Uint8Array(13);
  const suitMask = new Int32Array(4);

  function evaluate(cards, n) {
    const len = n === undefined ? cards.length : n;
    cnt.fill(0); suitMask[0] = suitMask[1] = suitMask[2] = suitMask[3] = 0;
    let rankMask = 0;
    for (let i = 0; i < len; i++) {
      const c = cards[i], r = c >> 2;
      cnt[r]++; suitMask[c & 3] |= 1 << r; rankMask |= 1 << r;
    }
    let flushMask = 0;
    for (let s = 0; s < 4; s++) if (POPCOUNT[suitMask[s]] >= 5) flushMask = suitMask[s];
    if (flushMask) {
      const sf = STRAIGHT_HIGH[flushMask];
      if (sf >= 0) return (8 << 20) | (sf << 16);
    }
    let q = -1, t1 = -1, t2 = -1, p1 = -1, p2 = -1;
    for (let r = 12; r >= 0; r--) {
      const c = cnt[r];
      if (c === 4) q = r;
      else if (c === 3) { if (t1 < 0) t1 = r; else if (t2 < 0) t2 = r; }
      else if (c === 2) { if (p1 < 0) p1 = r; else if (p2 < 0) p2 = r; }
    }
    if (q >= 0) return (7 << 20) | (q << 16) | (topKickers(rankMask & ~(1 << q), 1) << 12);
    if (t1 >= 0 && (t2 >= 0 || p1 >= 0)) return (6 << 20) | (t1 << 16) | (Math.max(t2, p1) << 12);
    if (flushMask) return (5 << 20) | topKickers(flushMask, 5);
    const st = STRAIGHT_HIGH[rankMask];
    if (st >= 0) return (4 << 20) | (st << 16);
    if (t1 >= 0) return (3 << 20) | (t1 << 16) | (topKickers(rankMask & ~(1 << t1), 2) << 8);
    if (p1 >= 0 && p2 >= 0) return (2 << 20) | (p1 << 16) | (p2 << 12) | (topKickers(rankMask & ~(1 << p1) & ~(1 << p2), 1) << 8);
    if (p1 >= 0) return (1 << 20) | (p1 << 16) | (topKickers(rankMask & ~(1 << p1), 3) << 4);
    return topKickers(rankMask, 5);
  }

  const category = (score) => score >> 20;

  SC.evaluator = { evaluate, category, CATEGORY_DE, STRAIGHT_HIGH, POPCOUNT };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
