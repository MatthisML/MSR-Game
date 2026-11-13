/* MSR Werkjahr – Hilfsfunktionen: Formelsatz, Zufall, Zahlen, Diagramme */
window.MSR = { days: [], gens: {}, topics: {}, sims: {}, figs: {}, formulas: [] };
(function (M) {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  M.esc = esc;

  // Formel-Kurzschrift: {a}/{b} Bruch, √{x} Wurzel, _x / _{xy} tief, ^x / ^{xy} hoch
  M.fm = function (s) {
    let i = 0;
    const grp = () => { i++; const o = seq('}'); i++; return o; };
    function seq(end) {
      let out = '';
      while (i < s.length && s[i] !== end) {
        const c = s[i];
        if (c === '{') { const a = grp(); if (s[i] === '/' && s[i + 1] === '{') { i++; const b = grp(); out += `<span class="fr"><span>${a}</span><span>${b}</span></span>`; } else out += a; }
        else if (c === '√' && s[i + 1] === '{') { i++; out += `<span class="sq">√<span>${grp()}</span></span>`; }
        else if (c === '_' || c === '^') { const tag = c === '_' ? 'sub' : 'sup'; i++; let a; if (s[i] === '{') a = grp(); else { a = esc(s[i]); i++; } out += `<${tag}>${a}</${tag}>`; }
        else { out += esc(c); i++; }
      }
      return out;
    }
    return `<span class="fm">${seq(null)}</span>`;
  };
  // Text: $...$ = Formel, **fett**
  M.T = s => String(s == null ? '' : s).replace(/\$([^$]+)\$/g, (_, f) => M.fm(f)).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  M.rng = function (seed) { let a = seed >>> 0; const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; f.pick = arr => arr[Math.floor(f() * arr.length)]; f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)); return f; };
  M.shuffle = function (arr, r) { const a = arr.slice(); r = r || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // P(r, kanonisch, auswahl): ohne Zufall (r=null) Skriptwert, sonst Variante
  M.P = (r, canon, choices) => r ? r.pick(choices) : canon;

  M.parseNum = function (s) {
    s = String(s).trim().replace(/\s/g, '').replace(/,/g, '.').replace(/[·*x]10\^?\(?(-?\d+)\)?/i, 'e$1').replace(/−/g, '-');
    if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return parseFloat(s);
  };
  M.fmt = function (x, sig) {
    if (!isFinite(x)) return '–'; if (x === 0) return '0';
    sig = sig || 4; const ax = Math.abs(x);
    if (ax >= 1e6 || ax < 1e-3) { const e = Math.floor(Math.log10(ax)); const m = x / Math.pow(10, e); return String(+m.toPrecision(sig)).replace('.', ',') + '·10^' + e; }
    return String(+x.toPrecision(sig)).replace('.', ',');
  };
  M.fmtF = (x, sig) => M.fmt(x, sig).replace(/·10\^(-?\d+)/, '·10^{$1}'); // für $...$
  M.numOk = (v, a, tol, abs) => isFinite(v) && (abs != null ? Math.abs(v - a) <= abs : Math.abs(v - a) <= (tol == null ? 0.02 : tol) * Math.abs(a) + 1e-12);

  // ---- Diagramm (SVG) ----
  function ticks(a, b, n) { const span = b - a, step0 = Math.pow(10, Math.floor(Math.log10(span / n))); const err = span / n / step0; const step = step0 * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1); const out = []; for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(+v.toPrecision(10)); return out; }
  M.plot = function (o) {
    const w = o.w || 640, h = o.h || 250, ml = 52, mr = 14, mt = 12, mb = 36;
    const [x0, x1] = o.x, [y0, y1] = o.y;
    const X = x => ml + (x - x0) / (x1 - x0) * (w - ml - mr), Y = y => mt + (1 - (Math.max(y0, Math.min(y1, y)) - y0) / (y1 - y0)) * (h - mt - mb);
    let s = `<svg viewBox="0 0 ${w} ${h}" class="fig" role="img" aria-label="${esc(o.title || 'Diagramm')}">`;
    const tl = o.xlog ? v => M.fmt(Math.pow(10, v), 2) : v => M.fmt(v, 3);
    ticks(x0, x1, 6).forEach(v => { s += `<line class="grid" x1="${X(v)}" y1="${mt}" x2="${X(v)}" y2="${h - mb}"/><text class="s mono" x="${X(v)}" y="${h - mb + 14}" text-anchor="middle">${tl(v)}</text>`; });
    ticks(y0, y1, 5).forEach(v => { s += `<line class="grid" x1="${ml}" y1="${Y(v)}" x2="${w - mr}" y2="${Y(v)}"/><text class="s mono" x="${ml - 6}" y="${Y(v) + 4}" text-anchor="end">${M.fmt(v, 3)}</text>`; });
    s += `<rect x="${ml}" y="${mt}" width="${w - ml - mr}" height="${h - mt - mb}" fill="none" class="ln thin"/>`;
    if (o.xl) s += `<text class="s" x="${(ml + w - mr) / 2}" y="${h - 4}" text-anchor="middle">${esc(o.xl)}</text>`;
    if (o.yl) s += `<text class="s" x="12" y="${(mt + h - mb) / 2}" text-anchor="middle" transform="rotate(-90 12 ${(mt + h - mb) / 2})">${esc(o.yl)}</text>`;
    (o.bands || []).forEach(b => { s += `<rect x="${X(b.x0)}" y="${mt}" width="${Math.max(0, X(b.x1) - X(b.x0))}" height="${h - mt - mb}" class="${b.c || 'fq'}" opacity=".6"/>`; });
    (o.hl || []).forEach(l => { s += `<line class="ln dash ${l.c || 'thin'}" x1="${ml}" y1="${Y(l.y)}" x2="${w - mr}" y2="${Y(l.y)}"/>` + (l.t ? `<text class="s" x="${w - mr - 4}" y="${Y(l.y) - 4}" text-anchor="end">${esc(l.t)}</text>` : ''); });
    (o.vl || []).forEach(l => { s += `<line class="ln dash ${l.c || 'thin'}" x1="${X(l.x)}" y1="${mt}" x2="${X(l.x)}" y2="${h - mb}"/>` + (l.t ? `<text class="s" x="${X(l.x) + 4}" y="${mt + 12}">${esc(l.t)}</text>` : ''); });
    (o.series || []).forEach(se => { let d = ''; se.d.forEach((p, k) => { if (isFinite(p[1])) d += (d ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }); s += `<path class="ln ${se.c || 'pe'} ${se.dash ? 'dash' : ''}" d="${d}"/>`; });
    (o.pts || []).forEach(p => { s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r || 4.5}" class="${p.c || 'fs'}"/>` + (p.t ? `<text class="s" x="${X(p.x) + 8}" y="${Y(p.y) - 6}">${esc(p.t)}</text>` : ''); });
    if (o.legend) { let lx = ml + 8; o.legend.forEach(([c, t]) => { s += `<line class="ln ${c}" x1="${lx}" y1="${mt + 10}" x2="${lx + 18}" y2="${mt + 10}"/><text class="s" x="${lx + 22}" y="${mt + 14}">${esc(t)}</text>`; lx += 30 + t.length * 6.2; }); }
    return s + '</svg>';
  };
  M.range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);

  // ---- Regelkreis-Simulation (Euler) ----
  // plant: {type:'pt1'|'pt2'|'i'|'i2'|'pt1tt'|'pt3', K,T,T2,D,w0,Tt}; ctrl: {Kp,Ti(0=aus),Td, Ki(optional, reiner I-Regler), open(true=nur Strecke), umax}
  M.simLoop = function (plant, ctrl, o) {
    o = o || {}; const dt = o.dt || 0.004, tEnd = o.tEnd || 10, w = o.w == null ? 1 : o.w, dStep = o.d || 0, dAt = o.dAt == null ? tEnd / 2 : o.dAt;
    let x1 = 0, x2 = 0, x3 = 0, integ = 0, ePrev = null, dF = 0, y = 0; const out = [], us = []; const buf = []; const nDelay = Math.round((plant.Tt || 0) / dt);
    const N = Math.round(tEnd / dt), every = Math.max(1, Math.round(N / 500));
    for (let k = 0; k <= N; k++) {
      const t = k * dt, e = w - y; let u;
      if (ctrl.open) u = w; else {
        integ += e * dt; const de = ePrev == null ? 0 : (e - ePrev) / dt; ePrev = e; dF += (de - dF) * Math.min(1, dt / 0.02);
        u = (ctrl.Kp || 0) * e + (ctrl.Ti ? (ctrl.Kp || 0) / ctrl.Ti * integ : 0) + (ctrl.Ki ? ctrl.Ki * integ : 0) + (ctrl.Kp || 0) * (ctrl.Td || 0) * dF + (ctrl.Kd || 0) * dF;
        if (ctrl.umax != null) { const c = Math.max(-ctrl.umax, Math.min(ctrl.umax, u)); if (c !== u) integ -= e * dt; u = c; }
      }
      let v = u + (t >= dAt ? dStep : 0);
      if (nDelay) { buf.push(v); v = buf.length > nDelay ? buf.shift() : 0; }
      const K = plant.K == null ? 1 : plant.K;
      switch (plant.type) {
        case 'p': y = K * v; break;
        case 'pt1': x1 += dt * (K * v - x1) / plant.T; y = x1; break;
        case 'pt1tt': x1 += dt * (K * v - x1) / plant.T; y = x1; break;
        case 'i': x1 += dt * K * v; y = x1; break;
        case 'i2': x2 += dt * K * v; x1 += dt * x2; y = x1; break;
        case 'pt2': { const w0 = plant.w0, D = plant.D; const a = w0 * w0 * (K * v - x1) - 2 * D * w0 * x2; x2 += dt * a; x1 += dt * x2; y = x1; break; }
        case 'pt2t': x1 += dt * (K * v - x1) / plant.T; x2 += dt * (x1 - x2) / plant.T2; y = x2; break;
        case 'pt3': x1 += dt * (K * v - x1) / plant.T; x2 += dt * (x1 - x2) / plant.T; x3 += dt * (x2 - x3) / plant.T; y = x3; break;
      }
      if (!isFinite(y) || Math.abs(y) > 1e6) { y = Math.sign(y) * 1e6; }
      if (k % every === 0) { out.push([t, y]); us.push([t, u]); }
    }
    const ys = out.map(p => p[1]); const last = ys.slice(-Math.round(ys.length / 8)); const fin = last.reduce((a, b) => a + b, 0) / last.length; const sw = Math.max(...last) - Math.min(...last);
    const peak = Math.max(...ys); const amp = Math.max(...ys.map(Math.abs));
    const diverge = amp > 20 * Math.max(1, Math.abs(w)) || sw > Math.abs(w) * 0.5 && Math.max(...ys.slice(-40).map(Math.abs)) > Math.max(...ys.slice(ys.length / 2 | 0, ys.length / 2 + 40 | 0).map(Math.abs)) * 1.15;
    return { y: out, u: us, fin, peak, over: w ? Math.max(0, (peak - w) / Math.abs(w)) * 100 : 0, err: w - fin, settled: sw < 0.04 * Math.max(Math.abs(w), 0.1), unstable: diverge, swing: sw };
  };
})(window.MSR);
