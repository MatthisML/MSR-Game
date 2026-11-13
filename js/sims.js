/* Interaktive Simulatoren. Definition: {title, ctl, sel, btn, upd(st), tick(st,dt), draw(st)} */
(function (M) {
  const S = M.sims, K = M.svgkit, f = M.fmt;
  const ro = pairs => `<div class="readout">${pairs.map(([l, v]) => `<span>${l} <b>${v}</b></span>`).join('')}</div>`;
  const led = (on, t) => `<span><i class="led ${on ? 'on' : ''}"></i>${t}</span>`;

  M.mountSim = function (host, name, preset) {
    const def = S[name]; preset = preset || {}; const st = {}; const lock = preset.lock || [];
    const ctl = (def.ctl || []).map(c => Object.assign({}, c, (preset.ctl || {})[c.k]));
    ctl.forEach(c => st[c.k] = c.v); (def.sel || []).forEach(c => st[c.k] = c.v); (def.btn || []).forEach(b => st[b.k] = !!b.v);
    Object.assign(st, preset.st || {}); st._p = preset;
    const uid = 'sim-' + name + '-' + (preset.uid || 'x');
    host.innerHTML = `<div class="figwrap"><div class="sim"><div class="sim-out"></div><div class="sim-ctl">` +
      ctl.filter(c => !lock.includes(c.k)).map(c => `<label><span>${c.l}<b data-v="${c.k}"></b></span><input type="range" id="${uid}-${c.k}" data-k="${c.k}" min="${c.min}" max="${c.max}" step="${c.step}" value="${st[c.k]}"></label>`).join('') +
      (def.sel || []).filter(c => !lock.includes(c.k)).map(c => `<label><span>${c.l}</span><select id="${uid}-${c.k}" data-k="${c.k}">${c.o.map(([v, l]) => `<option value="${v}" ${String(v) === String(st[c.k]) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`).join('') +
      `<div class="row">${(def.btn || []).map(b => `<button class="btn ghost sm" data-b="${b.k}" data-toggle="${b.toggle ? 1 : ''}">${b.l}</button>`).join('')}</div>` +
      (def.note ? `<p class="mute">${M.T(def.note)}</p>` : '') + `</div></div></div>`;
    const out = host.querySelector('.sim-out');
    const draw = () => {
      if (def.upd) def.upd(st);
      out.innerHTML = def.draw(st);
      ctl.forEach(c => { const b = host.querySelector(`[data-v="${c.k}"]`); if (b) b.textContent = (c.fmt ? c.fmt(st[c.k]) : f(st[c.k], 4)) + (c.u ? ' ' + c.u : ''); });
      host.querySelectorAll('[data-b]').forEach(b => b.classList.toggle('sig', !!st[b.dataset.b]));
    };
    host.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; st[k] = e.target.tagName === 'SELECT' ? (isNaN(+e.target.value) ? e.target.value : +e.target.value) : +e.target.value; draw(); });
    host.querySelectorAll('[data-b]').forEach(b => {
      const k = b.dataset.b;
      if (b.dataset.toggle) b.addEventListener('click', () => { st[k] = !st[k]; draw(); });
      else { const dn = () => { st[k] = true; draw(); }, up = () => { if (st[k]) { st[k] = false; draw(); } }; b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') dn(); }); b.addEventListener('keyup', up); }
    });
    if (def.init) def.init(st);
    if (def.tick) { let last = performance.now(); const iv = setInterval(() => { if (!host.isConnected) return clearInterval(iv); const now = performance.now(); def.tick(st, Math.min(0.2, (now - last) / 1000)); last = now; draw(); }, 60); }
    draw();
    return { st, draw };
  };

  // 1 Zielscheibe
  S.ziel = { title: 'Richtigkeit und Präzision', ctl: [{ k: 'sys', l: 'Systematische Abweichung', min: 0, max: 3, step: .1, v: 0 }, { k: 'str', l: 'Streuung (zufällig)', min: .1, max: 2, step: .1, v: .4 }],
    note: 'Jeder Punkt ist eine Messung, die Mitte ist der wahre Wert.',
    draw(st) { const r = M.rng(7); let s = ''; let mx = 0, my = 0; const pts = []; for (let i = 0; i < 12; i++) { const a = r() * 6.283, d = Math.sqrt(-2 * Math.log(r() + 1e-9)) * st.str; pts.push([st.sys * .8 + d * Math.cos(a), -st.sys * .6 + d * Math.sin(a)]); }
      pts.forEach(p => { mx += p[0] / 12; my += p[1] / 12; s += `<circle cx="${160 + p[0] * 30}" cy="${150 + p[1] * 30}" r="4.5" class="fi"/>`; });
      const rings = [120, 90, 60, 30].map(q => `<circle cx="160" cy="150" r="${q}" fill="none" class="ln thin"/>`).join('');
      const richtig = st.sys <= .5, praezise = st.str <= .6; st._r = { richtig, praezise };
      return `<svg viewBox="0 0 320 300" class="fig">${rings}<circle cx="160" cy="150" r="5" class="fo"/><line class="ln thin" x1="20" y1="150" x2="300" y2="150"/><line class="ln thin" x1="160" y1="10" x2="160" y2="290"/>${s}<circle cx="${160 + mx * 30}" cy="${150 + my * 30}" r="7" fill="none" class="ln hi"/></svg>` + ro([['Urteil:', (praezise ? 'präzise' : 'unpräzise') + ' und ' + (richtig ? 'richtig' : 'falsch')]]) + `<p class="mute">Der orange Ring ist der Mittelwert aller Schüsse.</p>`; } };

  // 2 Vertrauensbereich
  const TT = { 3: [2.920, 4.303, 9.925], 5: [2.132, 2.776, 4.604], 7: [1.943, 2.447, 3.707], 10: [1.833, 2.262, 3.25], 15: [1.761, 2.145, 2.977], 20: [1.729, 2.093, 2.861], 25: [1.711, 2.064, 2.797], 30: [1.699, 2.045, 2.756], 40: [1.695, 2.021, 2.704], 60: [1.672, 2.000, 2.660], 120: [1.658, 1.980, 2.617] };
  M.tTable = TT;
  S.vertrauen = { title: 'Vertrauensbereich', ctl: [{ k: 's', l: 'Standardabweichung s', min: .02, max: .3, step: .01, v: .08, u: 'mm' }], sel: [{ k: 'n', l: 'Anzahl Messungen n', v: 10, o: Object.keys(TT).map(n => [n, 'n = ' + n]) }, { k: 'P', l: 'Statistische Sicherheit P', v: 1, o: [[0, '90 %'], [1, '95 %'], [2, '99 %']] }],
    note: 'Mehr Messungen machen den Bereich schmaler, mehr Sicherheit macht ihn breiter.',
    draw(st) { const t = TT[st.n][st.P], hw = t * st.s / Math.sqrt(st.n), u = st.s / Math.sqrt(st.n); st._r = { hw };
      const d = M.range(49.6, 50.2, 150).map(x => [x, Math.exp(-.5 * Math.pow((x - 49.9) / u, 2))]);
      return M.plot({ x: [49.6, 50.2], y: [0, 1.1], xl: 'Kantenlänge in mm', yl: 'Dichte des Mittelwerts', series: [{ d, c: 'pe' }], bands: [{ x0: 49.9 - hw, x1: 49.9 + hw }], vl: [{ x: 49.9, t: 'x̄' }] }) + ro([['t =', f(t)], ['u(x̄) = s/√n =', f(u, 3) + ' mm'], ['x_M = 49,9 ±', f(hw, 3) + ' mm']]); } };

  // 3 Fehlerfortpflanzung Dichte
  S.fortpfl = { title: 'Fehlerfortpflanzung am Metallstab', ctl: [{ k: 'um', l: 'u(m)/m', min: 0, max: 3, step: .1, v: .2, u: '%' }, { k: 'ud', l: 'u(d)/d', min: 0, max: 3, step: .1, v: 1, u: '%' }, { k: 'ul', l: 'u(l)/l', min: 0, max: 3, step: .1, v: 1, u: '%' }],
    note: 'Dichte $ρ = {4·m}/{π·d^2·l}$. Der Durchmesser geht quadratisch ein und zählt deshalb doppelt.',
    draw(st) { const parts = [['m', st.um], ['d (×2)', 2 * st.ud], ['l', st.ul]]; const tot = Math.sqrt(parts.reduce((a, p) => a + p[1] * p[1], 0)); st._r = { tot };
      let s = ''; parts.concat([['gesamt', tot]]).forEach((p, i) => { s += `<text x="70" y="${40 + i * 44}" text-anchor="end">${p[0]}</text><rect x="80" y="${24 + i * 44}" width="${Math.min(360, p[1] * 55)}" height="24" class="${i === 3 ? 'fs' : 'fp'}"/><text x="${90 + Math.min(360, p[1] * 55)}" y="${40 + i * 44}" class="mono s">${f(p[1], 3)} %</text>`; });
      return `<svg viewBox="0 0 520 200" class="fig">${s}</svg>` + ro([['u(ρ)/ρ = √(Σ Quadrate) =', f(tot, 3) + ' %']]); } };

  // 4 Messpotentiometer
  S.poti = { title: 'Messpotentiometer', ctl: [{ k: 's', l: 'Schleiferstellung s/s_max', min: 0, max: 1, step: .01, v: .5 }, { k: 'q', l: 'Belastung R₀/R_B', min: 0, max: 5, step: .1, v: 1 }],
    note: 'Unbelastet ($R_B → ∞$) ist die Kennlinie eine Gerade. Je kleiner der Lastwiderstand $R_B$, desto stärker hängt sie durch.',
    draw(st) { const g = (s, q) => s / (1 + q * s * (1 - s)); const xs = M.range(0, 1, 60); st._r = { um: g(st.s, st.q) };
      return M.plot({ x: [0, 1], y: [0, 1], xl: 's / s_max', yl: 'U_M / U₀', series: [{ d: xs.map(x => [x, x]), c: 'thin', dash: 1 }, { d: xs.map(x => [x, g(x, st.q)]), c: 'pe' }], pts: [{ x: st.s, y: g(st.s, st.q) }], legend: [['thin', 'unbelastet'], ['pe', 'belastet']] }) + ro([['U_M/U₀ =', f(g(st.s, st.q), 3)], ['Abweichung zur Geraden:', f((st.s - g(st.s, st.q)) * 100, 3) + ' % von U₀']]); } };

  // 5 Kondensator
  S.kond = { title: 'Kapazitiver Wegaufnehmer', ctl: [{ k: 's', l: 'Plattenabstand s', min: .2, max: 3, step: .05, v: 1, u: 'mm' }, { k: 'A', l: 'Plattenfläche A', min: 1, max: 10, step: .5, v: 4, u: 'cm²' }],
    note: '$C = ε·ε_0·{A}/{s}$ mit Luft ($ε ≈ 1$).',
    draw(st) { const C = 8.854e-12 * st.A * 1e-4 / (st.s * 1e-3); st._r = { C }; const gap = st.s * 28, w = 60 + st.A * 22;
      return `<svg viewBox="0 0 400 180" class="fig"><rect x="${200 - w / 2}" y="${85 - gap / 2 - 8}" width="${w}" height="8" class="fp"/><rect x="${200 - w / 2}" y="${85 + gap / 2}" width="${w}" height="8" class="fs"/><line class="ln thin dash" x1="${210 + w / 2}" y1="${85 - gap / 2}" x2="${210 + w / 2}" y2="${85 + gap / 2}"/><text x="${218 + w / 2}" y="89" class="s">s</text></svg>` + M.plot({ h: 170, x: [.2, 3], y: [0, 50], xl: 's in mm', yl: 'C in pF', series: [{ d: M.range(.2, 3, 60).map(x => [x, 8.854e-12 * st.A * 1e-4 / (x * 1e-3) * 1e12]) }], pts: [{ x: st.s, y: C * 1e12 }] }) + ro([['C =', f(C * 1e12, 3) + ' pF']]); } };

  // 6 Messbrücke mit DMS
  S.bruecke = { title: 'Wheatstone-Brücke mit DMS', ctl: [{ k: 'eps', l: 'Dehnung ε', min: -1000, max: 1000, step: 10, v: 0, u: 'µm/m' }, { k: 'k', l: 'k-Faktor', min: 1.8, max: 2.2, step: .05, v: 2 }, { k: 'U0', l: 'Speisespannung U₀', min: 1, max: 10, step: .5, v: 5, u: 'V' }], sel: [{ k: 'n', l: 'Aktive DMS', v: 1, o: [[1, 'Viertelbrücke (1 DMS)'], [2, 'Halbbrücke (2 DMS)'], [4, 'Vollbrücke (4 DMS)']] }],
    note: 'Bei kleinen Änderungen gilt $U ≈ U_0·{n}/{4}·k·ε$ mit n aktiven, gegensinnig verschalteten DMS.',
    draw(st) { const dR = st.k * st.eps * 1e-6, U = st.U0 * st.n / 4 * dR; st._r = { U };
      return M.figs.wheatstone() + ro([['ΔR/R = k·ε =', f(dR * 100, 3) + ' %'], ['Brückenspannung U =', f(U * 1000, 3) + ' mV'], ['Abgeglichen?', Math.abs(U) < 1e-9 ? 'ja' : 'nein']]); } };

  // 7 PT100
  S.pt100 = { title: 'Widerstandsthermometer PT100', ctl: [{ k: 'T', l: 'Temperatur ϑ', min: -50, max: 300, step: 1, v: 20, u: '°C' }],
    note: 'Im Skript: Anstieg $0,4 Ω/K$, bei 0 °C genau 100 Ω. (Die Norm rechnet mit 0,385 Ω/K.)',
    draw(st) { const R = 100 + .4 * st.T; st._r = { R }; return M.plot({ x: [-50, 300], y: [60, 240], xl: 'ϑ in °C', yl: 'R in Ω', series: [{ d: [[-50, 80], [300, 220]] }], pts: [{ x: st.T, y: R }], hl: [{ y: 100, t: '100 Ω bei 0 °C' }] }) + ro([['R =', f(R, 4) + ' Ω']]); } };

  // 8 Näherungsschalter mit Hysterese
  S.naeherung = { title: 'Näherungsschalter', ctl: [{ k: 'd', l: 'Abstand Objekt – Sensor', min: 0, max: 12, step: .1, v: 10, u: 'mm' }], sel: [{ k: 'mat', l: 'Material (induktiver Sensor)', v: 1, o: [[1, 'Stahl (Faktor 1,0)'], [.5, 'Messing (0,5)'], [.4, 'Aluminium (0,4)'], [.3, 'Kupfer (0,3)'], [0, 'Kunststoff (wird nicht erkannt)']] }],
    note: 'Fahre das Objekt heran und wieder weg: Ein- und Ausschaltpunkt liegen auseinander. Diese **Hysterese** verhindert Flattern am Schaltpunkt.',
    upd(st) { const on = 6 * st.mat, off = on * 1.15; if (st.d <= on && st.mat > 0) st.on = true; else if (st.d >= off) st.on = false; st._r = { on: st.on, son: on, soff: off }; },
    draw(st) { const x = 150 + st.d * 22, r = st._r; return `<svg viewBox="0 0 460 150" class="fig"><rect x="20" y="50" width="130" height="50" rx="4" class="fp"/><text x="85" y="80" text-anchor="middle" fill="var(--panel)" style="fill:var(--panel)">Sensor</text>${st.mat > 0 ? `<line class="ln thin dash" x1="${150 + r.son * 22}" y1="20" x2="${150 + r.son * 22}" y2="130"/><text class="s" x="${150 + r.son * 22}" y="14" text-anchor="middle">ein</text><line class="ln thin dash" x1="${150 + r.soff * 22}" y1="30" x2="${150 + r.soff * 22}" y2="130"/><text class="s" x="${150 + r.soff * 22 + 14}" y="28">aus</text>` : ''}<rect x="${x}" y="40" width="34" height="70" class="${st.mat > 0 ? 'fi' : 'fy'}"/></svg>` + ro([['Ausgang:', '']]) + led(st.on, st.on ? 'geschaltet (1)' : 'nicht geschaltet (0)'); } };

  // 9 Lichtschranke
  S.licht = { title: 'Lichtschranken', ctl: [{ k: 'x', l: 'Position des Pakets', min: 0, max: 10, step: .1, v: 1 }], sel: [{ k: 'typ', l: 'Bauart', v: 'ein', o: [['ein', 'Einweglichtschranke'], ['reflex', 'Reflexlichtschranke'], ['taster', 'Reflexlichttaster']] }],
    note: 'Einweg: Sender und Empfänger getrennt. Reflex: beide in einem Gehäuse, ein Reflektor wirft den Strahl zurück. Taster: das Objekt selbst reflektiert.',
    draw(st) { const blocked = st.x > 4 && st.x < 6; const px = 60 + st.x * 36; const t = st.typ; const sig = t === 'taster' ? blocked : !blocked; st._r = { blocked };
      let s = `<rect x="${px}" y="60" width="50" height="60" class="fy"/>`;
      if (t === 'ein') s += `<rect x="250" y="10" width="40" height="24" class="fp"/><text x="300" y="27" class="s">Sender</text><rect x="250" y="150" width="40" height="24" class="fp"/><text x="300" y="167" class="s">Empfänger</text><line class="ln hi ${blocked ? '' : ''}" x1="270" y1="34" x2="270" y2="${blocked ? 60 : 150}"/>`;
      else s += `<rect x="240" y="10" width="60" height="24" class="fp"/><text x="310" y="27" class="s">Sender + Empfänger</text>` + (t === 'reflex' ? `<rect x="240" y="160" width="60" height="8" class="fi"/><text x="310" y="170" class="s">Reflektor</text><line class="ln hi" x1="262" y1="34" x2="262" y2="${blocked ? 60 : 160}"/>${blocked ? '' : '<line class="ln hi dash" x1="278" y1="160" x2="278" y2="34"/>'}` : `<line class="ln hi" x1="262" y1="34" x2="262" y2="${blocked ? 60 : 180}"/>${blocked ? '<line class="ln hi dash" x1="278" y1="60" x2="278" y2="34"/>' : ''}`);
      return `<svg viewBox="0 0 520 185" class="fig"><line class="ln" x1="20" y1="122" x2="500" y2="122"/>${s}</svg>` + led(sig, 'Empfänger sieht Licht: ' + (sig ? 'ja' : 'nein')) + ro([['Objekt erkannt:', blocked ? 'ja' : 'nein']]); } };

  // 10 A/D-Wandler
  S.adc = { title: 'A/D-Wandler', ctl: [{ k: 'bits', l: 'Auflösung', min: 1, max: 8, step: 1, v: 3, u: 'Bit' }, { k: 'spp', l: 'Abtastungen pro Signalperiode', min: 1, max: 24, step: .5, v: 12 }],
    note: 'Der Sinus ist das analoge Signal. Die Treppe ist, was der Rechner daraus macht.',
    draw(st) { const N = Math.pow(2, st.bits), per = 2; const an = M.range(0, 6, 300).map(t => [t, 5 + 4.5 * Math.sin(6.283 * t / per)]); const Ts = per / st.spp; const dg = []; const pts = [];
      for (let t = 0; t <= 6 + 1e-9; t += Ts) { const v = 5 + 4.5 * Math.sin(6.283 * t / per); const q = Math.min(N - 1, Math.floor(v / 10 * N)) * 10 / N + 5 / N; dg.push([t, q], [Math.min(6, t + Ts), q]); pts.push({ x: t, y: q, r: 3 }); }
      const alias = st.spp < 2; st._r = { alias, frq: 1 / N };
      return M.plot({ x: [0, 6], y: [0, 10], xl: 'Zeit in ms', yl: 'Spannung in V', series: [{ d: an, c: 'thin' }, { d: dg, c: 'hi' }], pts, legend: [['thin', 'analog'], ['hi', 'digital']] }) + ro([['Stufen 2ⁿ =', N], ['F_rq = 1/2ⁿ =', f(100 / N, 3) + ' %'], ['1 LSB =', f(10 / N * 1000, 4) + ' mV']]) + `<p class="${alias ? '' : 'mute'}">${alias ? '<b>Abtasttheorem verletzt:</b> weniger als 2 Abtastungen pro Periode. Das digitale Signal zeigt eine falsche, zu niedrige Frequenz (Aliasing).' : 'Abtasttheorem erfüllt (mindestens 2 Abtastungen pro Periode).'}</p>`; } };

  // 11 Logikgatter
  const GF = { and: (a, b) => a & b, or: (a, b) => a | b, nand: (a, b) => 1 - (a & b), nor: (a, b) => 1 - (a | b), xor: (a, b) => a ^ b, not: a => 1 - a };
  S.gatter = { title: 'Logikgatter', sel: [{ k: 'g', l: 'Gatter', v: 'and', o: [['and', 'UND  (a ∧ b)'], ['or', 'ODER  (a ∨ b)'], ['not', 'NICHT  (¬a)'], ['nand', 'NAND  ¬(a ∧ b)'], ['nor', 'NOR  ¬(a ∨ b)'], ['xor', 'XOR  (entweder – oder)']] }], btn: [{ k: 'a', l: 'a', toggle: 1 }, { k: 'b', l: 'b', toggle: 1 }],
    note: 'Schalte a und b um und beobachte den Ausgang. Die aktuelle Zeile der Wahrheitstabelle ist markiert.',
    draw(st) { const a = +st.a, b = +st.b, g = st.g, y = GF[g](a, b); st._r = { y }; const one = g === 'not'; const rows = one ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
      return `<div class="row" style="gap:24px;align-items:flex-start"><div>${led(a, 'a = ' + a)}<br>${one ? '' : led(b, 'b = ' + b) + '<br>'}<br>${led(y, 'y = ' + y)}</div><table class="tt"><tr><th>a</th>${one ? '' : '<th>b</th>'}<th>y</th></tr>${rows.map(r => `<tr style="${r[0] === a && (one || r[1] === b) ? 'background:var(--signal-soft)' : ''}"><td>${r[0]}</td>${one ? '' : `<td>${r[1]}</td>`}<td><b>${GF[g](r[0], r[1])}</b></td></tr>`).join('')}</table></div>`; } };

  // 12 Speicher
  S.flipflop = { title: 'Speicher (Flipflop)', sel: [{ k: 'dom', l: 'Dominanz', v: 'r', o: [['r', 'Rücksetzen dominiert: A = ¬R ∧ (S ∨ Q)'], ['s', 'Setzen dominiert: A = S ∨ (Q ∧ ¬R)']] }], btn: [{ k: 'S', l: 'S (Setzen) halten' }, { k: 'R', l: 'R (Rücksetzen) halten' }, { k: 'both', l: 'S und R gleichzeitig' }],
    note: 'Drücke S kurz und lass los: Q bleibt 1. Das ist der Speicher. Teste dann, was passiert, wenn S und R gleichzeitig anliegen.',
    upd(st) { const s = st.S || st.both, r = st.R || st.both; st.Q = st.dom === 'r' ? (!r && (s || st.Q)) : (s || (st.Q && !r)); st._r = { Q: st.Q }; },
    draw(st) { const s = st.S || st.both, r = st.R || st.both; return `<div class="col">${led(s, 'S = ' + (s ? 1 : 0))}${led(r, 'R = ' + (r ? 1 : 0))}<div style="font-size:1.3rem">${led(st.Q, '<b>Q = ' + (st.Q ? 1 : 0) + '</b>')}</div></div>` + M.figs.flipflop().replace(/data-f="\d"/g, ''); } };

  // 14 Grafcet Treppenlicht
  S.grafcet = { title: 'Treppenlicht als Ablaufsteuerung', btn: [{ k: 'S1', l: 'Taster S1' }, { k: 'S2', l: 'Taster S2' }],
    note: 'Die 30 Sekunden laufen hier zehnfach beschleunigt ab.',
    init(st) { st.step = 1; st.t = 0; },
    tick(st, dt) { if (st.step === 1 && (st.S1 || st.S2)) { st.step = 2; st.t = 0; } else if (st.step === 2) { st.t += dt * 10; if (st.t >= 30) { st.step = 1; st.t = 0; } } st._r = { step: st.step }; },
    draw(st) { const g = M.figs.grafcetStep, tr = M.figs.grafcetTrans; const a = st.step;
      return K.svg(520, 250, g(80, 10, '1', 0, true, a === 1) + K.ln('105,54 105,110') + tr(105, 82, 'S1 ∨ S2', 0) + g(80, 110, '2', 0, false, a === 2) + K.ln('130,132 160,132') + K.box(160, 112, 140, 40, 'Lampe H1 := 1', 0, a === 2 ? 'hi' : '') + K.ln('105,154 105,215') + tr(105, 186, '30 s / X2', 0) + K.ln('105,215 105,238 30,238 30,2 105,2 105,10', 0, 'dash') + `<circle cx="420" cy="90" r="34" class="${a === 2 ? 'fy' : 'fl'}" stroke="currentColor" stroke-width="2"/><text x="420" y="150" text-anchor="middle">${a === 2 ? 'Licht an' : 'Licht aus'}</text><text x="420" y="172" text-anchor="middle" class="mono s">${a === 2 ? 't = ' + st.t.toFixed(0) + ' s' : ''}</text>`) + ro([['Aktiver Schritt:', a]]); } };

  // 15 SPS-Zyklus
  S.sps = { title: 'Zyklische Bearbeitung in der SPS', ctl: [{ k: 'tz', l: 'Zykluszeit (Zeitlupe)', min: 1, max: 6, step: .5, v: 3, u: 's' }], btn: [{ k: 'in', l: 'Taster am Eingang E0.0', toggle: 1 }],
    note: 'Programm: A0.0 := E0.0. Schalte den Taster mitten im Zyklus um. Der Ausgang reagiert erst, wenn der nächste Zyklus den Eingang eingelesen und am Ende ausgegeben hat.',
    init(st) { st.ph = 0; st.img = 0; st.mem = 0; st.out = 0; },
    tick(st, dt) { const prev = Math.floor(st.ph * 3); st.ph = (st.ph + dt / st.tz) % 1; const now = Math.floor(st.ph * 3); if (now !== prev) { if (now === 0) st.out = st.mem; if (now === 1) st.img = st.in ? 1 : 0; if (now === 2) st.mem = st.img; } },
    draw(st) { const p = Math.floor(st.ph * 3); const b = (i, t) => `<div class="fcard" style="${p === i ? 'border-color:var(--signal);background:var(--signal-soft)' : ''}"><b>${t}</b></div>`;
      return `<div class="col">${b(0, '1  Eingänge einlesen → Prozessabbild E0.0 = ' + st.img)}${b(1, '2  Programm: A0.0 := E0.0 → berechnet ' + st.mem)}${b(2, '3  Ausgänge ausgeben')}</div>` + `<div class="row" style="gap:24px">${led(st.in, 'Taster real: ' + (st.in ? 1 : 0))}${led(st.out, 'Lampe an A0.0: ' + st.out)}</div>`; } };

  // 16 Zeitfunktionen
  S.timer = { title: 'Zeitfunktionen TON, TOF, TP', sel: [{ k: 'typ', l: 'Baustein', v: 'TON', o: [['TON', 'TON – Einschaltverzögerung'], ['TOF', 'TOF – Ausschaltverzögerung'], ['TP', 'TP – Impuls']] }], ctl: [{ k: 'PT', l: 'Zeit PT', min: .5, max: 5, step: .5, v: 2, u: 's' }, { k: 'len', l: 'Dauer des Eingangssignals IN', min: .5, max: 6, step: .5, v: 4, u: 's' }],
    draw(st) { const t0 = 1, t1 = 1 + st.len; let q0, q1; if (st.typ === 'TON') { q0 = t0 + st.PT; q1 = t1; if (q0 >= q1) q0 = q1 = -1; } else if (st.typ === 'TOF') { q0 = t0; q1 = t1 + st.PT; } else { q0 = t0; q1 = t0 + st.PT; }
      const sq = (a, b, base) => [[0, base], [a, base], [a, base + 1], [b, base + 1], [b, base], [12, base]]; st._r = { q0, q1 };
      return M.plot({ x: [0, 12], y: [-.3, 3.6], xl: 'Zeit in s', yl: '', series: [{ d: sq(t0, t1, 2), c: 'pe' }, { d: q0 < 0 ? [[0, 0], [12, 0]] : sq(q0, q1, 0), c: 'hi' }], legend: [['pe', 'IN (oben)'], ['hi', 'Q (unten)']] }) + `<p>${{ TON: 'Q wird erst 1, wenn IN ununterbrochen PT lang 1 war. Fällt IN vorher ab, bleibt Q auf 0.', TOF: 'Q wird sofort mit IN 1 und bleibt nach dem Abfallen von IN noch PT lang 1.', TP: 'Eine steigende Flanke an IN erzeugt einen Impuls der Länge PT, egal wie lang IN anliegt.' }[st.typ]}</p>`; } };

  // 17 Tank von Hand / mit P-Regler
  S.tank = { title: 'Füllstand im Tank T-101', ctl: [{ k: 'u', l: 'Zulaufventil (Stellgröße)', min: 0, max: 100, step: 1, v: 40, u: '%' }, { k: 'Kp', l: 'Reglerverstärkung K_P (nur Automatik)', min: .5, max: 10, step: .5, v: 3 }], btn: [{ k: 'auto', l: 'Automatik (P-Regler)', toggle: 1 }],
    note: 'Sollwert: 50 %. Der Verbraucher (Störgröße) ändert den Ablauf alle paar Sekunden. Halte den Füllstand im grünen Band – erst von Hand, dann mit Automatik.',
    init(st) { st.h = 50; st.z = 40; st.tt = 0; st.inBand = 0; st.T = 0; st.hist = []; st.r = M.rng(3); },
    tick(st, dt) { st.tt += dt; if (st.tt > 5) { st.tt = 0; st.z = 15 + st.r() * 60; } const u = st.auto ? Math.max(0, Math.min(100, st.Kp * (50 - st.h) + 40)) : st.u; st.uEff = u; st.h = Math.max(0, Math.min(100, st.h + (u - st.z) * dt * .35)); st.T += dt; if (Math.abs(st.h - 50) <= 5) st.inBand += dt; st.hist.push([st.T, st.h]); if (st.hist.length > 400) st.hist.shift(); st._r = { quote: st.inBand / st.T, T: st.T, auto: st.auto }; },
    draw(st) { const t1 = st.T, t0 = Math.max(0, t1 - 24); const y = 150 - st.h * 1.3;
      return `<div class="row" style="align-items:flex-start;gap:8px"><svg viewBox="0 0 150 180" class="fig" style="max-width:150px"><rect x="35" y="20" width="80" height="130" class="fl" stroke="currentColor" stroke-width="2"/><rect x="36" y="${y}" width="78" height="${150 - y}" class="fp" opacity=".7"/><rect x="36" y="${150 - 55 * 1.3}" width="78" height="13" class="fo" opacity=".35"/><text x="75" y="14" text-anchor="middle" class="s">Zulauf ${f(st.uEff || 0, 3)} %</text><text x="75" y="172" text-anchor="middle" class="s">Ablauf ${f(st.z, 3)} %</text></svg><div class="grow">${M.plot({ w: 420, h: 200, x: [t0, t0 + 24], y: [0, 100], xl: 'Zeit in s', yl: 'Füllstand in %', series: [{ d: st.hist.filter(p => p[0] >= t0) }], hl: [{ y: 55, c: 'ok' }, { y: 45, c: 'ok' }] })}</div></div>` + ro([['Füllstand y =', f(st.h, 3) + ' %'], ['Regeldifferenz e =', f(50 - st.h, 2) + ' %'], ['Zeit im Band:', f(100 * st.inBand / Math.max(.1, st.T), 3) + ' %']]); } };

  // 18 Grundglieder
  S.glieder = { title: 'Sprungantworten der Grundglieder', sel: [{ k: 'typ', l: 'Übertragungsglied', v: 'pt1', o: [['p', 'P-Glied'], ['i', 'I-Glied'], ['d', 'D-Glied'], ['tt', 'Totzeitglied T_t'], ['pt1', 'PT1-Glied'], ['pt2', 'PT2-Glied']] }], ctl: [{ k: 'K', l: 'Verstärkung K', min: .2, max: 3, step: .1, v: 1 }, { k: 'T', l: 'Zeitkonstante T bzw. T_t', min: .2, max: 3, step: .1, v: 1, u: 's' }, { k: 'D', l: 'Dämpfung ϑ (nur PT2)', min: 0, max: 2, step: .05, v: .3 }],
    draw(st) { const ts = M.range(0, 10, 400); let d; const K = st.K, T = st.T, D = st.D; const G = { p: 'K_P', i: '{K_I}/{s}', d: 'K_D·s', tt: 'e^{−s·T_t}', pt1: '{K}/{1 + s·T}', pt2: '{K}/{1 + {2ϑ}/{ω_0}·s + {1}/{ω_0^2}·s^2}' }[st.typ];
      if (st.typ === 'p') d = ts.map(t => [t, K]); else if (st.typ === 'i') d = ts.map(t => [t, K * t]); else if (st.typ === 'd') d = [[0, 0], [0, 3.4], [.03, 3.4], [.03, 0], [10, 0]]; else if (st.typ === 'tt') d = [[0, 0], [T, 0], [T, 1], [10, 1]]; else if (st.typ === 'pt1') d = ts.map(t => [t, K * (1 - Math.exp(-t / T))]); else d = M.simLoop({ type: 'pt2', K, w0: 1 / T, D }, { open: true }, { tEnd: 10 }).y;
      return M.plot({ x: [0, 10], y: [0, 3.5], xl: 'Zeit t in s', yl: 'h(t)', series: [{ d: [[0, 1], [10, 1]], c: 'thin', dash: 1 }, { d, c: 'hi' }], vl: st.typ === 'pt1' ? [{ x: T, t: 'T' }] : [], pts: st.typ === 'pt1' ? [{ x: T, y: .632 * K, t: '63 %' }] : [], legend: [['thin', 'Sprung am Eingang'], ['hi', 'Antwort']] }) + `<div class="fbox">${M.T('$G(s) = ' + G + '$')}</div>`; } };

  // 19 RC-Glied
  S.rc = { title: 'RC-Schaltung laden', ctl: [{ k: 'R', l: 'Widerstand R', min: 1, max: 50, step: 1, v: 20, u: 'kΩ' }, { k: 'C', l: 'Kapazität C', min: 1, max: 20, step: 1, v: 5, u: 'µF' }, { k: 'U0', l: 'Spannung U₀', min: 10, max: 100, step: 10, v: 100, u: 'V' }],
    draw(st) { const T = st.R * 1e3 * st.C * 1e-6; st._r = { T };
      return M.plot({ x: [0, 1], y: [0, 105], xl: 'Zeit t in s', yl: 'u_C in V', series: [{ d: M.range(0, 1, 200).map(t => [t, st.U0 * (1 - Math.exp(-t / T))]), c: 'hi' }], hl: [{ y: st.U0, t: 'U₀' }], vl: [{ x: T, t: 'T' }], pts: T <= 1 ? [{ x: T, y: .632 * st.U0, t: '63,2 %' }] : [] }) + ro([['T = R·C =', f(T, 3) + ' s'], ['u_C(T) =', f(.632 * st.U0, 3) + ' V'], ['fertig (99 %) nach ≈ 5·T =', f(5 * T, 3) + ' s']]); } };

  // 20 Frequenzgang PT1
  S.bode = { title: 'Frequenzgang eines PT1-Glieds', ctl: [{ k: 'lw', l: 'Kreisfrequenz ω', min: -1, max: 2, step: .02, v: 0, u: 'rad/s', fmt: v => f(Math.pow(10, v), 3) }, { k: 'T', l: 'Zeitkonstante T', min: .2, max: 3, step: .1, v: 1, u: 's' }],
    note: 'Oben: Eingang und Ausgang über der Zeit. Unten: derselbe Punkt im Bode-Diagramm.',
    draw(st) { const w = Math.pow(10, st.lw), T = st.T, A = 1 / Math.sqrt(1 + w * w * T * T), ph = -Math.atan(w * T); st._r = { A, ph }; const per = 6.283 / w; const ts = M.range(0, 3 * per, 240);
      const lws = M.range(-1, 2, 90);
      return M.plot({ h: 180, x: [0, 3 * per], y: [-1.1, 1.1], xl: 'Zeit t in s', yl: '', series: [{ d: ts.map(t => [t, Math.sin(w * t)]), c: 'thin' }, { d: ts.map(t => [t, A * Math.sin(w * t + ph)]), c: 'hi' }], legend: [['thin', 'Eingang'], ['hi', 'Ausgang']] }) +
        M.plot({ h: 180, x: [-1, 2], xlog: 1, y: [-45, 5], xl: 'ω in rad/s (logarithmisch)', yl: '|G| in dB', series: [{ d: lws.map(l => [l, -10 * Math.log10(1 + Math.pow(Math.pow(10, l) * T, 2))]) }], pts: [{ x: st.lw, y: 20 * Math.log10(A) }], vl: [{ x: Math.log10(1 / T), t: 'ω_E = 1/T' }] }) +
        ro([['|G| =', f(A, 3)], ['=', f(20 * Math.log10(A), 3) + ' dB'], ['φ =', f(ph * 180 / Math.PI, 3) + '°']]); } };

  // 21 RLC-Resonanz
  S.rlc = { title: 'Schwingkreis aus dem Skript', ctl: [{ k: 'w', l: 'Anregungsfrequenz ω', min: .03, max: 2, step: .01, v: .63, u: 'rad/s' }, { k: 'R', l: 'Widerstand R', min: 1, max: 20, step: 1, v: 10, u: 'Ω' }],
    note: '$L = 5 H$, $C = 0,5 F$, $U_0 = 10 V$. Amplitude: $i_0 = {U_0}/{√{R^2 + (L·ω − {1}/{C·ω})^2}}$',
    draw(st) { const a = w => 10 / Math.sqrt(st.R * st.R + Math.pow(5 * w - 1 / (.5 * w), 2)); const ph = Math.atan((5 * st.w - 1 / (.5 * st.w)) / st.R); st._r = { i0: a(st.w) };
      return M.plot({ x: [0, 2], y: [0, Math.max(1.2, 11 / st.R)], xl: 'ω in rad/s', yl: 'i₀ in A', series: [{ d: M.range(.03, 2, 200).map(w => [w, a(w)]) }], pts: [{ x: st.w, y: a(st.w) }], vl: [{ x: .632, t: 'ω₀ = 1/√(LC)' }] }) + ro([['i₀ =', f(a(st.w), 3) + ' A'], ['Phasenwinkel φ =', f(ph * 180 / Math.PI, 3) + '°']]); } };

  // 22 Regelkreis (P/I/PI/PD/PID)
  const PL = { pt1: { type: 'pt1', K: 1, T: .2 }, pt2: { type: 'pt2t', K: 1, T: 1, T2: .4 }, i: { type: 'i', K: 1 }, pt3: { type: 'pt3', K: 1, T: .5 }, pt2s: { type: 'pt2', K: 1, w0: 2, D: .25 } };
  S.pid = { title: 'Regelkreis einstellen', sel: [{ k: 'plant', l: 'Regelstrecke', v: 'pt1', o: [['pt1', 'PT1 (K_S = 1, T = 0,2 s)'], ['pt2', 'PT2 (T₁ = 1 s, T₂ = 0,4 s)'], ['pt2s', 'PT2 schwingfähig (ϑ = 0,25)'], ['i', 'I-Strecke (K_S = 1)'], ['pt3', 'PT3 (drei Verzögerungen, T = 0,5 s)']] }],
    ctl: [{ k: 'Kp', l: 'K_P (P-Anteil)', min: 0, max: 12, step: .1, v: 1 }, { k: 'Ti', l: 'T_I Nachstellzeit (0 = kein I)', min: 0, max: 5, step: .05, v: 0, u: 's' }, { k: 'Td', l: 'T_D Vorhaltzeit (0 = kein D)', min: 0, max: 1, step: .01, v: 0, u: 's' }, { k: 'd', l: 'Störsprung d bei halber Zeit', min: 0, max: 1, step: .1, v: 0 }],
    draw(st) { const p = st._p || {}; const plant = p.plantDef || PL[st.plant]; const tEnd = p.tEnd || 10; const w = p.w || 1;
      const ctrl = p.pureI ? { Ki: st.Kp } : { Kp: st.Kp, Ti: st.Ti, Td: st.Td, umax: p.umax }; const r = M.simLoop(plant, ctrl, { tEnd, w, d: st.d * w, dt: p.dt || .004 }); st._r = r;
      const ymax = Math.max(1.6 * w, Math.min(4 * w, r.peak * 1.1));
      return M.plot({ x: [0, tEnd], y: [Math.min(0, -0.2 * w), ymax], xl: 'Zeit t in s', yl: p.yl || 'Regelgröße y', series: [{ d: r.y, c: 'hi' }], hl: [{ y: w, t: 'Sollwert w' }], legend: [['hi', 'y(t)']] }) + (p.showU ? M.plot({ h: 150, x: [0, tEnd], y: [Math.min(0, ...r.u.map(q => q[1])), Math.max(1, ...r.u.map(q => q[1])) * 1.05], xl: 'Zeit t in s', yl: 'Stellgröße u', series: [{ d: r.u }] }) : '') +
        ro([['Überschwingen:', f(r.over, 3) + ' %'], ['bleibende Regeldifferenz:', r.settled ? f(r.err, 2) : '–'], ['Zustand:', r.unstable ? 'instabil' : r.settled ? 'eingeschwungen' : 'schwingt noch']]); } };

  // 23 Pollage
  S.pole = { title: 'Pollage und Zeitverhalten', ctl: [{ k: 're', l: 'Realteil δ', min: -2, max: .6, step: .05, v: -.5 }, { k: 'im', l: 'Imaginärteil ω', min: 0, max: 6, step: .1, v: 3 }],
    note: 'Ein Polpaar $s_{1,2} = δ ± jω$ erzeugt im Zeitbereich $e^{δt}·cos(ωt)$. Nur der Realteil entscheidet über die Stabilität.',
    draw(st) { st._r = { stable: st.re < 0 }; const X = x => 130 + x * 50, Y = y => 110 - y * 15;
      return `<div class="row" style="align-items:flex-start;gap:8px"><svg viewBox="0 0 220 220" class="fig" style="max-width:220px"><rect x="${X(0)}" y="5" width="${220 - X(0)}" height="210" class="fs" opacity=".15"/><line class="ln" x1="10" y1="110" x2="212" y2="110" marker-end="url(#ah)"/><line class="ln" x1="${X(0)}" y1="215" x2="${X(0)}" y2="8" marker-end="url(#ah)"/><text x="200" y="126" class="s">Re</text><text x="${X(0) + 6}" y="16" class="s">Im</text><text x="${X(0) + 8}" y="205" class="s ts">instabil</text><text x="14" y="205" class="s">stabil</text><text x="${X(st.re) - 6}" y="${Y(st.im) + 6}" class="ts" style="font-size:20px">×</text>${st.im ? `<text x="${X(st.re) - 6}" y="${Y(-st.im) + 6}" class="ts" style="font-size:20px">×</text>` : ''}</svg><div class="grow">${M.plot({ w: 400, h: 220, x: [0, 8], y: [-3, 3], xl: 'Zeit t in s', yl: '', series: [{ d: M.range(0, 8, 300).map(t => [t, Math.exp(st.re * t) * Math.cos(st.im * t)]), c: 'hi' }] })}</div></div>` + ro([['Re{s} =', f(st.re, 2)], ['Verhalten:', st.re < 0 ? 'klingt ab → stabil' : st.re > 0 ? 'klingt auf → instabil' : 'Dauerschwingung → grenzstabil']]); } };

  // 24 Skriptbeispiel: PT2 mit negativer Dämpfung + PD-Regler, k variieren
  S.wok = { title: 'Skriptbeispiel: Verstärkung k verschiebt die Pole', ctl: [{ k: 'k', l: 'Reglerverstärkung k', min: 0, max: 4, step: .05, v: 1 }],
    note: 'Charakteristische Gleichung $s^2 + (k − 1)·s + (1 + k) = 0$. Für $k = 0$ liegen die Pole bei $0,5 ± j·0,866$ (offene Strecke).',
    draw(st) { const k = st.k, p = (k - 1), q = 1 + k, disc = p * p / 4 - q; const re = -p / 2, im = disc < 0 ? Math.sqrt(-disc) : 0; st._r = { re };
      // G = k(s+1)/(s²+(k-1)s+(1+k)) als Zustandsmodell
      let x1 = 0, x2 = 0; const d = []; const dt = .002; for (let i = 0; i <= 5000; i++) { const a = 1 - p * x2 - q * x1; const y = k * (x1 + x2); if (i % 12 === 0) d.push([i * dt, Math.max(-50, Math.min(50, y))]); x1 += dt * x2; x2 += dt * a; }
      const X = x => 150 + x * 40, Y = y => 100 - y * 40; let loc = ''; for (let kk = 0; kk <= 4.001; kk += .05) { const pp = kk - 1, dd = pp * pp / 4 - (1 + kk); if (dd < 0) loc += `<circle cx="${X(-pp / 2)}" cy="${Y(Math.sqrt(-dd))}" r="1.3" class="fp"/><circle cx="${X(-pp / 2)}" cy="${Y(-Math.sqrt(-dd))}" r="1.3" class="fp"/>`; }
      return `<div class="row" style="align-items:flex-start;gap:8px"><svg viewBox="0 0 240 200" class="fig" style="max-width:240px"><rect x="${X(0)}" y="4" width="${240 - X(0)}" height="192" class="fs" opacity=".15"/><line class="ln" x1="6" y1="100" x2="232" y2="100"/><line class="ln" x1="${X(0)}" y1="196" x2="${X(0)}" y2="4"/>${loc}<circle cx="${X(-1)}" cy="100" r="5" fill="none" class="ln"/><text x="${X(re) - 6}" y="${Y(im) + 6}" class="ts" style="font-size:20px">×</text><text x="${X(re) - 6}" y="${Y(-im) + 6}" class="ts" style="font-size:20px">×</text><text x="8" y="16" class="s">Wurzelortskurve</text></svg><div class="grow">${M.plot({ w: 400, h: 200, x: [0, 10], y: [-2, 4], xl: 'Zeit t in s', yl: 'y(t)', series: [{ d, c: 'hi' }], hl: [{ y: 1, t: 'w' }] })}</div></div>` + ro([['Pole:', f(re, 3) + ' ± j·' + f(im, 3)], ['Urteil:', re < -1e-9 ? 'stabil' : re > 1e-9 ? 'instabil' : 'Stabilitätsgrenze (Dauerschwingung)'], ['Endwert k/(1+k) =', f(k / (1 + k), 3)]]); } };
})(window.MSR);
