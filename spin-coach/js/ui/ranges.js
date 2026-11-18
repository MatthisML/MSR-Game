/* Range-Ansicht: Nash-Charts (Push/Fold, Call vs. All-in) und Modell-Ranges als 13x13-Raster. */
(function (SC) {
  'use strict';
  const { esc, fmt } = SC.ui;
  const C = SC.cards, E = SC.equity, PF = SC.preflop;

  const CHARTS = [
    { id: 'btnPush', group: 'Nash (Push/Fold, Chip-EV)', label: 'Button: All-in first in', action: 'All-in' },
    { id: 'sbPush', group: 'Nash (Push/Fold, Chip-EV)', label: 'Small Blind: All-in nach Button-Fold', action: 'All-in' },
    { id: 'huPush', group: 'Nash (Push/Fold, Chip-EV)', label: 'Heads-up: Small Blind All-in', action: 'All-in' },
    { id: 'bbCallSb', group: 'Nash (Push/Fold, Chip-EV)', label: 'Big Blind: Call vs. SB-All-in', action: 'Call' },
    { id: 'bbCall', group: 'Nash (Push/Fold, Chip-EV)', label: 'Big Blind: Call vs. Button-All-in', action: 'Call' },
    { id: 'sbCall', group: 'Nash (Push/Fold, Chip-EV)', label: 'Small Blind: Call vs. Button-All-in', action: 'Call' },
    { id: 'bbOver', group: 'Nash (Push/Fold, Chip-EV)', label: 'Big Blind: Overcall (BTN All-in + SB Call)', action: 'Call' },
    { id: 'huCall', group: 'Nash (Push/Fold, Chip-EV)', label: 'Heads-up: Big Blind Call vs. All-in', action: 'Call' },
    { id: 'm:btnOpen', group: 'Modell für tiefere Stacks (Näherung)', label: 'Button: Open-Raise 2 BB', action: 'Raise' },
    { id: 'm:huOpen', group: 'Modell für tiefere Stacks (Näherung)', label: 'Heads-up Button: Open-Raise', action: 'Raise' },
    { id: 'm:sb', group: 'Modell für tiefere Stacks (Näherung)', label: 'Small Blind vs. BB: Raise / Limp', action: 'Raise', second: 'Limp' },
    { id: 'm:bbIso', group: 'Modell für tiefere Stacks (Näherung)', label: 'Big Blind vs. Limp: Iso-Raise', action: 'Raise' },
    { id: 'm:bbDef', group: 'Modell für tiefere Stacks (Näherung)', label: 'Big Blind vs. Button-Raise: Verteidigen', action: 'Call' },
  ];

  let root, chart = 'btnPush', stack = 10, sel = -1;

  function render() {
    root = document.getElementById('view-ranges');
    const groups = [...new Set(CHARTS.map((c) => c.group))];
    root.innerHTML = `
      <h1>Ranges</h1>
      <p class="lead">Push/Fold- und Call-Ranges aus dem 3-Max-Gleichgewicht, dazu die Modell-Ranges für tiefere Stacks. Rote Punkte: Hände, bei denen du im Trainer hier Fehler gemacht hast.</p>
      <div class="panel">
        <div class="row" style="align-items:flex-end">
          <div class="field" style="flex:1 1 260px">
            <label for="chart-sel">Situation</label>
            <select id="chart-sel">${groups.map((g) => `<optgroup label="${esc(g)}">${CHARTS.filter((c) => c.group === g).map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</optgroup>`).join('')}</select>
          </div>
          <div class="field" style="flex:1 1 220px">
            <label for="stack-sel">Effektiver Stack: <b id="stack-val" class="num"></b></label>
            <input type="range" id="stack-sel" min="1" max="25" step="1">
          </div>
        </div>
      </div>
      <div class="range-layout">
        <div class="panel"><div class="grid13" id="grid" role="grid" aria-label="Range-Raster"></div><div class="legend" id="legend"></div></div>
        <div class="panel" id="detail"></div>
      </div>`;
    const cs = root.querySelector('#chart-sel'), ss = root.querySelector('#stack-sel');
    cs.value = chart; ss.value = stack;
    cs.addEventListener('change', () => { chart = cs.value; draw(); });
    ss.addEventListener('input', () => { stack = +ss.value; draw(); });
    root.querySelector('#grid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cls]'); if (!b) return;
      sel = +b.dataset.cls; draw();
    });
  }

  function onShow() { draw(); }

  // Häufigkeiten (0..1) je Klasse; bei zwei Aktionen zusätzlich second
  function chartData() {
    const ch = CHARTS.find((c) => c.id === chart);
    const main = new Float32Array(C.N_CLASSES), second = new Float32Array(C.N_CLASSES);
    let ev = null;
    if (!chart.startsWith('m:')) {
      ev = new Float32Array(C.N_CLASSES);
      for (let a = 0; a < C.N_CLASSES; a++) { const n = PF.nash(chart, stack, a); main[a] = n.freq / 100; ev[a] = n.ev; }
    } else if (chart === 'm:btnOpen') main.set(E.percentRange(PF.model.btnOpenPct(stack)));
    else if (chart === 'm:huOpen') main.set(E.percentRange(PF.model.huOpenPct(stack)));
    else if (chart === 'm:sb') { main.set(E.percentRange(PF.model.sbRaisePct)); second.set(E.percentRange(PF.model.sbLimpTo, PF.model.sbRaisePct)); }
    else if (chart === 'm:bbIso') main.set(E.percentRange(PF.model.bbIsoPct));
    else if (chart === 'm:bbDef') main.set(PF.actionRange('BB', { type: 'call' }, stack, 3));
    return { ch, main, second, ev };
  }

  function mistakes() {
    const name = (a) => C.CLASS_NAMES[a];
    const out = new Map();
    for (const d of SC.store.load().drills) {
      if (d.node !== chart || d.grade !== 'fehler' || Math.abs((d.stack || 0) - stack) > 1) continue;
      out.set(d.cls, (out.get(d.cls) || 0) + 1);
    }
    return { has: (a) => out.get(name(a)) || 0 };
  }

  function draw() {
    if (!root) return;
    root.querySelector('#stack-val').textContent = stack + ' BB';
    const { ch, main, second, ev } = chartData();
    const mist = mistakes();
    let html = '';
    for (let a = 0; a < C.N_CLASSES; a++) {
      const f = main[a], s2 = second[a];
      const tot = Math.min(1, f + s2);
      const m = mist.has(a);
      html += `<button class="cell ${f >= 0.5 ? 'hi' : ''} ${a === sel ? 'sel' : ''}" data-cls="${a}" role="gridcell" aria-label="${C.CLASS_NAMES[a]}: ${ch.action} ${Math.round(f * 100)} %${s2 ? `, ${ch.second} ${Math.round(s2 * 100)} %` : ''}">
        ${s2 ? `<span class="fill" style="height:${tot * 100}%;background:var(--series-1)"></span>` : ''}
        <span class="fill" style="height:${f * 100}%"></span>
        <span class="lbl" ${s2 >= 0.5 && f < 0.5 ? 'style="color:#fff"' : ''}>${C.CLASS_NAMES[a].replace(/[so]$/, (x) => x)}</span>${m ? '<span class="dot" aria-hidden="true"></span>' : ''}</button>`;
    }
    root.querySelector('#grid').innerHTML = html;
    let pctMain = 0, pctSecond = 0;
    for (let a = 0; a < C.N_CLASSES; a++) { pctMain += main[a] * C.CLASS_NCOMBOS[a]; pctSecond += second[a] * C.CLASS_NCOMBOS[a]; }
    root.querySelector('#legend').innerHTML = `<span><span class="sw" style="background:var(--accent)"></span>${esc(ch.action)} ${fmt(pctMain / 13.26, 1)} %</span>` +
      (ch.second ? `<span><span class="sw" style="background:var(--series-1)"></span>${esc(ch.second)} ${fmt(pctSecond / 13.26, 1)} %</span>` : '') +
      `<span><span class="sw" style="background:var(--surface-2);border:1px solid var(--line)"></span>Fold</span>` +
      '<span>Teilfüllung = gemischte Strategie</span>';
    detail(ch, main, second, ev);
  }

  function detail(ch, main, second, ev) {
    const el = root.querySelector('#detail');
    const isNash = !chart.startsWith('m:');
    let html = `<h2>${esc(ch.label)}</h2><p class="small muted">${isNash
      ? `Gleichgewicht für ${stack} BB effektiv, Blinds 0,5/1, keine Antes. Chip-EV entspricht bei Winner-takes-all dem Turnier-EV.`
      : 'Modell-Range (Näherung) für Stacks über 10 BB. Diese Ranges nutzt der Coach auch als Gegner-Annahmen.'}</p>`;
    if (sel >= 0) {
      const name = C.CLASS_NAMES[sel];
      const eqRand = E.classVsRange(sel, E.fullRange());
      html += `<div class="decision"><div class="rec-big">${esc(name)}</div><dl class="vs">
        <dt>${esc(ch.action)}</dt><dd>${Math.round(main[sel] * 100)} %</dd>
        ${ch.second ? `<dt>${esc(ch.second)}</dt><dd>${Math.round(second[sel] * 100)} %</dd>` : ''}
        ${ev ? `<dt>EV-Vorteil</dt><dd>${ev[sel] >= 0 ? '+' : ''}${fmt(ev[sel], 2)} BB gegenüber Fold</dd>` : ''}
        <dt>Equity vs. zufällig</dt><dd>${Math.round(eqRand * 100)} %</dd>
        <dt>Kombos</dt><dd>${C.CLASS_NCOMBOS[sel]}</dd></dl>
        ${mistakes().has(sel) ? `<div class="small" style="color:var(--bad-text)">Im Trainer hier ${mistakes().has(sel)}× falsch entschieden.</div>` : ''}</div>`;
    } else html += '<p class="small muted">Tippe auf eine Hand für Details.</p>';
    if (isNash) {
      // Schwellen: wie viele Hände bei Nachbar-Stacks
      const rows = [];
      for (const s of [Math.max(1, stack - 2), stack, Math.min(25, stack + 2)]) {
        let x = 0; for (let a = 0; a < C.N_CLASSES; a++) x += PF.nash(chart, s, a).freq / 100 * C.CLASS_NCOMBOS[a];
        rows.push(`<tr><td>${s} BB</td><td class="r">${fmt(x / 13.26, 1)} %</td></tr>`);
      }
      html += `<h3 style="margin-top:14px">Rangegröße nach Stack</h3><table class="data"><thead><tr><th>Stack</th><th class="r">${esc(ch.action)}</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
    }
    el.innerHTML = html;
  }

  function show(node, s, cls) {
    chart = node; stack = Math.round(Math.max(1, Math.min(25, s || stack))); sel = cls ?? -1;
    location.hash = '#ranges';
    if (root) { root.querySelector('#chart-sel').value = chart; root.querySelector('#stack-sel').value = stack; draw(); }
  }

  SC.ranges = { render, onShow, show };
})(window.SC = window.SC || {});
