/* Berechnet Preflop-Equities per Monte Carlo:
   - eq2: Klasse gegen Klasse (169 x 169), wird als js/data/eq2.js ausgeliefert
   - eq3: Klasse gegen zwei Klassen (169^3), nur für die Push/Fold-Berechnung (tools/out/eq3.bin)
   Aufruf: node tools/gen-equity.js [samples2] [samples3] */
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const fs = require('fs');
const path = require('path');
const load = require('./load');

const SC = load('core/cards.js', 'core/eval.js');
const { N_CLASSES: N, CLASS_COMBOS, makeRng } = SC.cards;
const evaluate = SC.evaluator.evaluate;

function sampler(seed) {
  const rng = makeRng(seed);
  const used = new Uint8Array(52);
  const h = [new Int32Array(7), new Int32Array(7), new Int32Array(7)];
  const board = new Int32Array(5);

  // Equity der Spieler für die gegebenen Klassen; null, wenn die Klassen sich nicht vertragen.
  return function run(classes, samples) {
    const k = classes.length;
    const eq = new Float64Array(k);
    let done = 0, fails = 0;
    while (done < samples) {
      used.fill(0);
      let ok = true;
      for (let p = 0; p < k && ok; p++) {
        const combos = CLASS_COMBOS[classes[p]];
        let tries = 0, combo;
        do { combo = combos[(rng() * combos.length) | 0]; tries++; }
        while ((used[combo[0]] || used[combo[1]]) && tries < 30);
        if (used[combo[0]] || used[combo[1]]) { ok = false; break; }
        used[combo[0]] = used[combo[1]] = 1;
        h[p][0] = combo[0]; h[p][1] = combo[1];
      }
      if (!ok) { if (++fails > 200 && done === 0) return null; continue; }
      for (let b = 0; b < 5; b++) {
        let c; do { c = (rng() * 52) | 0; } while (used[c]);
        used[c] = 1; board[b] = c;
      }
      let best = -1, nBest = 0;
      const scores = [0, 0, 0];
      for (let p = 0; p < k; p++) {
        for (let b = 0; b < 5; b++) h[p][2 + b] = board[b];
        const s = evaluate(h[p], 7);
        scores[p] = s;
        if (s > best) { best = s; nBest = 1; } else if (s === best) nBest++;
      }
      for (let p = 0; p < k; p++) if (scores[p] === best) eq[p] += 1 / nBest;
      done++;
    }
    for (let p = 0; p < k; p++) eq[p] /= samples;
    return eq;
  };
}

if (!isMainThread) {
  const { mode, samples } = workerData;
  const run = sampler(1234567 + workerData.id * 7919);
  parentPort.on('message', (a) => {
    if (a === null) { process.exit(0); }
    if (mode === 2) {
      const out = new Float32Array(N);
      for (let b = a; b < N; b++) {
        const e = run([a, b], samples);
        out[b] = e ? e[0] : 0.5;
      }
      parentPort.postMessage({ a, out });
    } else {
      // alle Tripel a <= b <= c: je drei Equities
      const out = [];
      for (let b = a; b < N; b++) for (let c = b; c < N; c++) {
        const e = run([a, b, c], samples);
        out.push(b, c, e ? e[0] : 1 / 3, e ? e[1] : 1 / 3, e ? e[2] : 1 / 3);
      }
      parentPort.postMessage({ a, out: Float32Array.from(out) });
    }
  });
} else {
  const samples2 = +process.argv[2] || 12000;
  const samples3 = +process.argv[3] || 500;
  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  function runPool(mode, samples, onResult) {
    return new Promise((resolve) => {
      const order = [];
      for (let a = 0; a < N; a++) order.push(a);
      // aufwendige Aufgaben (kleines a bei Tripeln) zuerst verteilen
      let next = 0, finished = 0;
      const nWorkers = Math.max(1, os.cpus().length);
      for (let id = 0; id < nWorkers; id++) {
        const w = new Worker(__filename, { workerData: { mode, samples, id: id + mode * 100 } });
        w.on('message', (msg) => {
          onResult(msg);
          finished++;
          if (finished % 20 === 0) process.stdout.write(`  eq${mode}: ${finished}/${N}\n`);
          if (next < N) w.postMessage(order[next++]); else w.postMessage(null);
          if (finished === N) resolve();
        });
        w.postMessage(order[next++]);
      }
    });
  }

  (async () => {
    let t = Date.now();
    const eq2 = new Float32Array(N * N);
    await runPool(2, samples2, ({ a, out }) => {
      for (let b = a; b < N; b++) {
        if (a === b) { eq2[a * N + a] = 0.5; continue; }
        eq2[a * N + b] = out[b];
        eq2[b * N + a] = 1 - out[b];
      }
    });
    fs.writeFileSync(path.join(outDir, 'eq2.bin'), Buffer.from(eq2.buffer));
    // Auslieferung: obere Dreiecksmatrix, je Wert 0..4095 als zwei Base64-Zeichen
    const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let s = '';
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {
      const v = Math.max(0, Math.min(4095, Math.round(eq2[a * N + b] * 4095)));
      s += B64[v >> 6] + B64[v & 63];
    }
    fs.writeFileSync(path.join(__dirname, '..', 'js', 'data', 'eq2.js'),
      '/* Generiert von tools/gen-equity.js (' + samples2 + ' Samples je Paar). Preflop-Equity Klasse gegen Klasse. */\n' +
      '(function (SC) { SC.data = SC.data || {}; SC.data.EQ2 = "' + s + '"; })' +
      "(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));\n");
    console.log('eq2 fertig in', ((Date.now() - t) / 1000).toFixed(1), 's');

    t = Date.now();
    const eq3 = new Float32Array(N * N * N);
    const set = (x, y, z, v) => { eq3[(x * N + y) * N + z] = v; eq3[(x * N + z) * N + y] = v; };
    await runPool(3, samples3, ({ a, out }) => {
      for (let i = 0; i < out.length; i += 5) {
        const b = out[i], c = out[i + 1];
        set(a, b, c, out[i + 2]); set(b, a, c, out[i + 3]); set(c, a, b, out[i + 4]);
      }
    });
    fs.writeFileSync(path.join(outDir, 'eq3.bin'), Buffer.from(eq3.buffer));
    console.log('eq3 fertig in', ((Date.now() - t) / 1000).toFixed(1), 's');
    process.exit(0);
  })();
}
