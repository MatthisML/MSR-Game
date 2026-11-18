/* Push/Fold-Gleichgewicht (Chip-EV) für 3-Max und Heads-up per Fictitious Play.
   Spin & Gold ist Winner-takes-all: Unter ICM entspricht die Gewinnchance dann dem Chipanteil,
   Chip-EV ist hier also auch Turnier-EV.
   Modell: Blinds 0,5 / 1 BB, keine Antes, alle Stacks gleich (= effektiver Stack).
   Knoten 3-Max: BTN push | SB call vs BTN | BB call vs BTN (SB fold) | BB overcall (BTN push + SB call)
                 SB push (BTN fold) | BB call vs SB.  Heads-up: SB push | BB call.
   Benötigt tools/out/eq2.bin und eq3.bin (node tools/gen-equity.js).
   Aufruf: node tools/gen-pushfold.js [iterationen] */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const fs = require('fs');
const path = require('path');
const load = require('./load');

const SC = load('core/cards.js');
const { N_CLASSES: N, CLASS_NCOMBOS, COMPAT } = SC.cards;
const STACKS = [];
for (let s = 1; s <= 25; s++) STACKS.push(s);

const outDir = path.join(__dirname, 'out');

function solve(S, iters, eq2, eq3) {
  // w[a][b]: P(Gegner hat Klasse b | ich habe a), mit Card Removal
  const w = new Float64Array(N * N);
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) w[a * N + b] = COMPAT[a * N + b] / (CLASS_NCOMBOS[a] * 1225);
  // f[b][c]: Verträglichkeit der beiden Gegnerhände untereinander
  const f = new Float64Array(N * N);
  for (let b = 0; b < N; b++) for (let c = 0; c < N; c++) f[b * N + c] = COMPAT[b * N + c] / (CLASS_NCOMBOS[b] * CLASS_NCOMBOS[c]);
  const E2 = (a, b) => eq2[a * N + b];
  const E3 = (a, b, c) => eq3[(a * N + b) * N + c];
  const prior = new Float64Array(N);
  for (let a = 0; a < N; a++) prior[a] = CLASS_NCOMBOS[a] / 1326;

  // Strategien (Wahrscheinlichkeit für push/call) je Klasse, Start: alles 0,5
  const st = {};
  for (const k of ['btnPush', 'sbCall', 'bbCall', 'bbOver', 'sbPush', 'bbCallSb', 'huPush', 'huCall']) st[k] = new Float64Array(N).fill(0.5);

  // Erwartungswert über zwei Gegnerhände (b, c) mit Gewicht g(b, c)
  function pairSum(a, gb, gc, val) {
    let num = 0, den = 0;
    const wa = a * N;
    for (let b = 0; b < N; b++) {
      const xb = w[wa + b] * gb[b];
      if (xb === 0) continue;
      for (let c = 0; c < N; c++) {
        const x = xb * w[wa + c] * gc[c] * f[b * N + c];
        if (x === 0) continue;
        num += x * val(b, c); den += x;
      }
    }
    return [num, den];
  }
  const ones = new Float64Array(N).fill(1);
  const inv = (arr) => arr.map((v) => 1 - v);

  // Differenz EV(push/call) - EV(fold) je Knoten bei gegebenen Strategien
  function evDiffs() {
    const d = {};
    const sbFold = inv(st.sbCall), btnFold = inv(st.btnPush);
    d.btnPush = new Float64Array(N); d.sbCall = new Float64Array(N); d.bbCall = new Float64Array(N);
    d.bbOver = new Float64Array(N); d.sbPush = new Float64Array(N); d.bbCallSb = new Float64Array(N);
    for (let a = 0; a < N; a++) {
      // BTN push (fold = 0)
      let [num, den] = pairSum(a, ones, ones, (s, r) => {
        const cs = st.sbCall[s], cb = st.bbCall[r], oc = st.bbOver[r];
        return (1 - cs) * (1 - cb) * 1.5
          + (1 - cs) * cb * (E2(a, r) * (2 * S + 0.5) - S)
          + cs * (1 - oc) * (E2(a, s) * (2 * S + 1) - S)
          + cs * oc * (E3(a, s, r) * 3 * S - S);
      });
      d.btnPush[a] = num / den;
      // SB call vs BTN push (fold = -0,5)
      [num, den] = pairSum(a, st.btnPush, ones, (b, r) => {
        const oc = st.bbOver[r];
        return (1 - oc) * (E2(a, b) * (2 * S + 1) - S) + oc * (E3(a, b, r) * 3 * S - S);
      });
      d.sbCall[a] = den > 0 ? num / den + 0.5 : 0;
      // BB call vs BTN push, SB fold (fold = -1)
      [num, den] = pairSum(a, st.btnPush, sbFold, (b) => E2(a, b) * (2 * S + 0.5) - S);
      d.bbCall[a] = den > 0 ? num / den + 1 : 0;
      // BB overcall (fold = -1)
      [num, den] = pairSum(a, st.btnPush, st.sbCall, (b, s) => E3(a, b, s) * 3 * S - S);
      d.bbOver[a] = den > 0 ? num / den + 1 : 0;
      // SB push nach BTN fold (fold = -0,5)
      [num, den] = pairSum(a, ones, btnFold, (r) => {
        const cb = st.bbCallSb[r];
        return (1 - cb) * 1 + cb * (E2(a, r) * 2 * S - S);
      });
      d.sbPush[a] = den > 0 ? num / den + 0.5 : 0;
      // BB call vs SB push (fold = -1)
      [num, den] = pairSum(a, st.sbPush, btnFold, (s) => E2(a, s) * 2 * S - S);
      d.bbCallSb[a] = den > 0 ? num / den + 1 : 0;
    }
    // Heads-up
    d.huPush = new Float64Array(N); d.huCall = new Float64Array(N);
    for (let a = 0; a < N; a++) {
      let num = 0, den = 0, num2 = 0, den2 = 0;
      for (let r = 0; r < N; r++) {
        const x = w[a * N + r];
        if (!x) continue;
        const cb = st.huCall[r];
        num += x * ((1 - cb) * 1 + cb * (E2(a, r) * 2 * S - S)); den += x;
        const y = x * st.huPush[r];
        num2 += y * (E2(a, r) * 2 * S - S); den2 += y;
      }
      d.huPush[a] = num / den + 0.5;
      d.huCall[a] = den2 > 0 ? num2 / den2 + 1 : 0;
    }
    return d;
  }

  for (let t = 1; t <= iters; t++) {
    const d = evDiffs();
    const step = 1 / (t + 1);
    for (const k of Object.keys(st)) {
      const s = st[k], dk = d[k];
      for (let a = 0; a < N; a++) s[a] += step * ((dk[a] > 0 ? 1 : 0) - s[a]);
    }
  }
  const d = evDiffs();
  // Häufigkeit des Spots je Klasse für Rangegrößen
  const pct = {};
  for (const k of Object.keys(st)) {
    let x = 0; for (let a = 0; a < N; a++) x += prior[a] * st[k][a];
    pct[k] = x;
  }
  return { st, d, pct };
}

if (!isMainThread) {
  const eq2 = new Float32Array(fs.readFileSync(path.join(outDir, 'eq2.bin')).buffer.slice(0));
  const eq3 = new Float32Array(fs.readFileSync(path.join(outDir, 'eq3.bin')).buffer.slice(0));
  parentPort.on('message', (S) => {
    if (S === null) process.exit(0);
    const r = solve(S, workerData.iters, eq2, eq3);
    const out = { S, pct: r.pct, freq: {}, ev: {} };
    for (const k of Object.keys(r.st)) {
      out.freq[k] = Array.from(r.st[k], (v) => Math.round(v * 100));
      out.ev[k] = Array.from(r.d[k], (v) => Math.round(v * 100) / 100);
    }
    parentPort.postMessage(out);
  });
} else {
  const iters = +process.argv[2] || 300;
  const results = {};
  let next = 0, done = 0;
  const t0 = Date.now();
  const nWorkers = Math.min(os.cpus().length, STACKS.length);
  const order = STACKS.slice().reverse();
  for (let i = 0; i < nWorkers; i++) {
    const w = new Worker(__filename, { workerData: { iters } });
    w.on('message', (r) => {
      results[r.S] = r; done++;
      console.log(`  ${r.S} BB: BTN push ${(r.pct.btnPush * 100).toFixed(1)}%, SB push ${(r.pct.sbPush * 100).toFixed(1)}%, BB call vs SB ${(r.pct.bbCallSb * 100).toFixed(1)}%, HU push ${(r.pct.huPush * 100).toFixed(1)}%  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      w.postMessage(next < order.length ? order[next++] : null);
      if (done === STACKS.length) write();
    });
    w.postMessage(order[next++]);
  }
  function write() {
    const data = { stacks: STACKS, iterations: iters, nodes: {} };
    for (const k of Object.keys(results[STACKS[0]].freq)) {
      data.nodes[k] = { freq: STACKS.map((s) => results[s].freq[k]), ev: STACKS.map((s) => results[s].ev[k]) };
    }
    fs.writeFileSync(path.join(__dirname, '..', 'js', 'data', 'pushfold.js'),
      '/* Generiert von tools/gen-pushfold.js: Push/Fold-Gleichgewicht 3-Max und Heads-up, Chip-EV, Stacks 1-25 BB, ' + iters + ' Iterationen.\n' +
      '   freq = Push/Call-Häufigkeit in % je Hand-Klasse, ev = EV(push/call) - EV(fold) in BB. */\n' +
      '(function (SC) { SC.data = SC.data || {}; SC.data.PUSHFOLD = ' + JSON.stringify(data) + '; })' +
      "(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));\n");
    console.log('pushfold.js geschrieben');
    process.exit(0);
  }
}
