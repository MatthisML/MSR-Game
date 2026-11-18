/* Ranges (Gewichte je Hand-Klasse) und Equity-Berechnung.
   Preflop: Tabelle eq2 (Klasse gegen Klasse). Mit Board: Monte Carlo. */
(function (SC) {
  'use strict';
  const C = SC.cards;
  const N = C.N_CLASSES;
  const evaluate = SC.evaluator.evaluate;

  /* ---------- Preflop-Equity-Tabelle ---------- */
  let EQ2 = null;
  function eq2Table() {
    if (EQ2) return EQ2;
    const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const s = SC.data.EQ2;
    EQ2 = new Float32Array(N * N);
    let k = 0;
    for (let a = 0; a < N; a++) {
      EQ2[a * N + a] = 0.5;
      for (let b = a + 1; b < N; b++) {
        const v = (B64.indexOf(s[k]) << 6 | B64.indexOf(s[k + 1])) / 4095;
        k += 2;
        EQ2[a * N + b] = v; EQ2[b * N + a] = 1 - v;
      }
    }
    return EQ2;
  }
  const eq2 = (a, b) => eq2Table()[a * N + b];

  /* Equity einer Klasse gegen eine Range (Card Removal über Kombi-Zählung). */
  function classVsRange(a, range) {
    const t = eq2Table();
    let num = 0, den = 0;
    for (let b = 0; b < N; b++) {
      if (!range[b]) continue;
      const x = range[b] * C.COMPAT[a * N + b];
      num += x * t[a * N + b]; den += x;
    }
    return den > 0 ? num / den : 0.5;
  }

  /* ---------- Ranges ---------- */
  const emptyRange = () => new Float32Array(N);
  const fullRange = () => new Float32Array(N).fill(1);

  /* Rangfolge der Hände nach Equity gegen eine zufällige Hand (für Prozent-Ranges). */
  let ORDER = null;
  function handOrder() {
    if (ORDER) return ORDER;
    const all = fullRange();
    const score = [];
    for (let a = 0; a < N; a++) {
      // leichter Bonus für Spielbarkeit: suited und verbundene Hände
      const gap = C.CLASS_HI[a] - C.CLASS_LO[a];
      let bonus = 0;
      if (C.CLASS_TYPE[a] === 'suited') bonus += 0.012;
      if (C.CLASS_TYPE[a] !== 'pair' && gap <= 2) bonus += 0.006 * (3 - gap);
      score.push([a, classVsRange(a, all) + bonus]);
    }
    score.sort((x, y) => y[1] - x[1]);
    ORDER = score.map((x) => x[0]);
    return ORDER;
  }

  /* Range der Hände zwischen Perzentil lo und hi (in Prozent aller 1326 Kombos). */
  function percentRange(hi, lo) {
    lo = lo || 0;
    const r = emptyRange();
    const order = handOrder();
    let acc = 0;
    for (const a of order) {
      const share = C.CLASS_NCOMBOS[a] / 1326 * 100;
      const start = acc, end = acc + share;
      acc = end;
      const overlap = Math.max(0, Math.min(end, hi) - Math.max(start, lo));
      if (overlap > 0) r[a] = Math.min(1, overlap / share);
    }
    return r;
  }

  function rangePercent(range) {
    let x = 0;
    for (let a = 0; a < N; a++) x += range[a] * C.CLASS_NCOMBOS[a];
    return x / 1326 * 100;
  }

  /* Text wie "22+, A2s+, KTo+" in eine Range umwandeln. */
  function parseRange(text) {
    const r = emptyRange();
    const R = C.RANKS;
    for (const raw of text.split(/[\s,]+/)) {
      if (!raw) continue;
      const m = raw.match(/^([2-9TJQKA])([2-9TJQKA])([so]?)(\+?)(?:-([2-9TJQKA])([2-9TJQKA])[so]?)?$/i);
      if (!m) continue;
      const r1 = R.indexOf(m[1].toUpperCase()), r2 = R.indexOf(m[2].toUpperCase());
      const t = m[3].toLowerCase();
      const plus = !!m[4];
      const set = (h, l, type) => {
        const name = R[h] + R[l] + (h === l ? '' : type);
        const id = C.classFromName(name);
        if (id >= 0) r[id] = 1;
      };
      const types = t ? [t] : ['s', 'o'];
      if (r1 === r2) {
        const end = m[5] ? R.indexOf(m[5].toUpperCase()) : (plus ? 12 : r1);
        for (let x = Math.min(r1, end); x <= Math.max(r1, end); x++) set(x, x);
      } else {
        const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
        let from = lo, to = lo;
        if (plus) to = hi - 1;
        if (m[6]) { const l2 = R.indexOf(m[6].toUpperCase()); from = Math.min(lo, l2); to = Math.max(lo, l2); }
        for (let l = from; l <= to; l++) for (const ty of types) set(hi, l, ty);
      }
    }
    return r;
  }

  /* ---------- Monte Carlo mit Board ---------- */
  const rng = C.makeRng(Date.now() & 0xffffffff);

  /* Konkrete Kombos einer Range ohne tote Karten, mit Gewicht. */
  function rangeCombos(range, dead) {
    const out = [];
    for (let a = 0; a < N; a++) {
      if (!range[a]) continue;
      for (const [x, y] of C.CLASS_COMBOS[a]) {
        if (dead[x] || dead[y]) continue;
        out.push([x, y, range[a], a]);
      }
    }
    return out;
  }

  function weightedPicker(combos) {
    const cum = new Float64Array(combos.length);
    let t = 0;
    for (let i = 0; i < combos.length; i++) { t += combos[i][2]; cum[i] = t; }
    return function pick() {
      const x = rng() * t;
      let lo = 0, hi = combos.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
      return combos[lo];
    };
  }

  /* Equity der Hand hero ([c1, c2]) gegen eine oder mehrere Ranges auf dem Board.
     Gibt { equity, win, tie, samples } zurück. */
  function handVsRanges(hero, board, ranges, samples) {
    samples = samples || 6000;
    const dead = new Uint8Array(52);
    dead[hero[0]] = dead[hero[1]] = 1;
    for (const c of board) dead[c] = 1;
    const pickers = ranges.map((r) => {
      const combos = rangeCombos(r, dead);
      return combos.length ? weightedPicker(combos) : null;
    });
    if (pickers.some((p) => !p)) return { equity: 1, win: 1, tie: 0, samples: 0, empty: true };
    const used = new Uint8Array(52);
    const hh = new Int32Array(7), vh = new Int32Array(7);
    let eqSum = 0, wins = 0, ties = 0, done = 0, guard = 0;
    const need = 5 - board.length;
    const full = new Int32Array(5);
    while (done < samples && guard < samples * 20) {
      guard++;
      used.set(dead);
      const villains = [];
      let ok = true;
      for (const p of pickers) {
        const v = p();
        if (used[v[0]] || used[v[1]]) { ok = false; break; }
        used[v[0]] = used[v[1]] = 1;
        villains.push(v);
      }
      if (!ok) continue;
      for (let i = 0; i < board.length; i++) full[i] = board[i];
      for (let i = board.length; i < 5; i++) {
        let c; do { c = (rng() * 52) | 0; } while (used[c]);
        used[c] = 1; full[i] = c;
      }
      hh[0] = hero[0]; hh[1] = hero[1];
      for (let i = 0; i < 5; i++) hh[2 + i] = full[i];
      const hs = evaluate(hh, 7);
      let best = 0, nBest = 0;
      for (const v of villains) {
        vh[0] = v[0]; vh[1] = v[1];
        for (let i = 0; i < 5; i++) vh[2 + i] = full[i];
        const s = evaluate(vh, 7);
        if (s > best) { best = s; nBest = 1; } else if (s === best) nBest++;
      }
      if (hs > best) { eqSum += 1; wins++; }
      else if (hs === best) { eqSum += 1 / (nBest + 1); ties++; }
      done++;
      if (need === 0 && ranges.length === 1 && done >= 2500) break;
    }
    return { equity: done ? eqSum / done : 0, win: done ? wins / done : 0, tie: done ? ties / done : 0, samples: done };
  }

  /* Equity von Range A gegen Range B auf dem Board (Range-Vorteil). */
  function rangeVsRange(rangeA, rangeB, board, samples) {
    samples = samples || 4000;
    const dead = new Uint8Array(52);
    for (const c of board) dead[c] = 1;
    const ca = rangeCombos(rangeA, dead), cb = rangeCombos(rangeB, dead);
    if (!ca.length || !cb.length) return { equity: 0.5, nutsA: 0, nutsB: 0 };
    const pa = weightedPicker(ca), pb = weightedPicker(cb);
    const used = new Uint8Array(52);
    const ha = new Int32Array(7), hb = new Int32Array(7), full = new Int32Array(5);
    let eq = 0, done = 0, guard = 0, nutsA = 0, nutsB = 0;
    while (done < samples && guard < samples * 20) {
      guard++;
      const a = pa(), b = pb();
      if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue;
      used.set(dead);
      used[a[0]] = used[a[1]] = used[b[0]] = used[b[1]] = 1;
      for (let i = 0; i < board.length; i++) full[i] = board[i];
      for (let i = board.length; i < 5; i++) {
        let c; do { c = (rng() * 52) | 0; } while (used[c]);
        used[c] = 1; full[i] = c;
      }
      ha[0] = a[0]; ha[1] = a[1]; hb[0] = b[0]; hb[1] = b[1];
      for (let i = 0; i < 5; i++) { ha[2 + i] = full[i]; hb[2 + i] = full[i]; }
      const sa = evaluate(ha, 7), sb = evaluate(hb, 7);
      eq += sa > sb ? 1 : sa === sb ? 0.5 : 0;
      // "starke Hände" auf dem aktuellen Board: Zwei Paare oder besser
      if (board.length >= 3) {
        const cur = board.length + 2;
        const ah = [a[0], a[1], ...board], bh = [b[0], b[1], ...board];
        if (evaluate(ah, cur) >> 20 >= 2 && usesHole(ah, board)) nutsA++;
        if (evaluate(bh, cur) >> 20 >= 2 && usesHole(bh, board)) nutsB++;
      }
      done++;
    }
    return { equity: done ? eq / done : 0.5, nutsA: done ? nutsA / done : 0, nutsB: done ? nutsB / done : 0 };
  }

  // Trägt mindestens eine Hole Card zur Kategorie bei (sonst spielt nur das Board)?
  function usesHole(cards, board) {
    return (evaluate(cards, cards.length) >> 20) > (evaluate(board, board.length) >> 20);
  }

  SC.equity = {
    eq2, eq2Table, classVsRange, handOrder, percentRange, rangePercent, parseRange,
    emptyRange, fullRange, rangeCombos, handVsRanges, rangeVsRange,
  };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
