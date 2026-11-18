/* Statistik: Lernverlauf, Leaks, Hand-Verlauf, Datenexport. */
(function (SC) {
  'use strict';
  const { esc, fmt, badge, when, toast } = SC.ui;

  let root, filter = 'all';

  function render() {
    root = document.getElementById('view-stats');
  }

  function onShow() {
    const db = SC.store.load();
    const hands = db.hands, drills = db.drills;
    const decs = hands.flatMap((h) => (h.decisions || []).filter((d) => !d.inferred).map((d) => Object.assign({ ts: h.ts }, d)));
    const handErr = decs.filter((d) => d.grade === 'fehler').length;
    const handLoss = decs.reduce((s, d) => s + (d.grade !== 'gut' && d.evLoss ? d.evLoss : 0), 0);
    const score = (arr) => (arr.length ? (arr.filter((d) => d.grade === 'gut').length + 0.5 * arr.filter((d) => d.grade === 'ok').length) / arr.length : null);
    const weekAgo = Date.now() - 7 * 864e5;
    const dRecent = drills.filter((d) => d.ts >= weekAgo), dOld = drills.filter((d) => d.ts < weekAgo);
    const sRecent = score(dRecent), sOld = score(dOld);

    root.innerHTML = `
      <h1>Statistik</h1>
      <p class="lead">Alles bleibt lokal auf diesem Gerät gespeichert. Mit Export/Import kannst du die Daten zwischen Handy und PC übertragen.</p>
      <div class="kpis">
        <div class="kpi"><div class="l">Hände im Review</div><div class="v">${hands.length}</div><div class="d">${decs.length} bewertete Entscheidungen</div></div>
        <div class="kpi"><div class="l">Fehlerquote Review</div><div class="v">${decs.length ? Math.round(handErr / decs.length * 100) + ' %' : '–'}</div><div class="d">${handErr} Fehler</div></div>
        <div class="kpi"><div class="l">EV-Verlust je Hand</div><div class="v">${hands.length ? fmt(handLoss / hands.length, 2) : '–'}</div><div class="d">BB, wo berechenbar</div></div>
        <div class="kpi"><div class="l">Trainer-Score (7 Tage)</div><div class="v">${sRecent !== null ? Math.round(sRecent * 100) + ' %' : '–'}</div><div class="d">${dRecent.length} Spots${sRecent !== null && sOld !== null ? ` · davor ${Math.round(sOld * 100)} %` : ''}</div></div>
      </div>
      <div class="panel">
        <h2>Trainer-Score pro Tag</h2>
        <p class="small muted" style="margin-top:-4px">Richtig = 1, vertretbar = ½. Letzte 30 Tage mit Training.</p>
        ${trendHTML(drills)}
      </div>
      <div class="panel">
        <h2>Deine Leaks</h2>
        <p class="small muted" style="margin-top:-4px">Spot-Arten aus Review und Trainer, sortiert nach Fehlern. Hier lohnt sich gezieltes Training.</p>
        ${leaksHTML(decs, drills)}
      </div>
      <div class="panel">
        <div class="row spread"><h2 style="margin:0">Hand-Verlauf</h2>
          <div class="chips" id="hfilter">
            <button class="chip ${filter === 'all' ? 'on' : ''}" data-f="all">Alle</button>
            <button class="chip ${filter === 'err' ? 'on' : ''}" data-f="err">Mit Fehlern</button>
          </div></div>
        <div id="hlist" style="margin-top:8px">${historyHTML(hands)}</div>
      </div>
      <div class="panel">
        <h2>Daten</h2>
        <div class="row">
          <button class="btn" id="exp" type="button">Exportieren (JSON)</button>
          <label class="btn" for="imp" style="cursor:pointer">Importieren</label>
          <input type="file" id="imp" accept="application/json,.json" hidden>
          <button class="btn ghost danger" id="wipe" type="button">Alles löschen</button>
        </div>
        <p class="small muted">Import fügt Hände und Trainer-Ergebnisse hinzu, die noch fehlen. Nichts wird überschrieben.</p>
      </div>`;

    root.querySelector('#hfilter').addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      filter = b.dataset.f; onShow();
    });
    root.querySelector('#hlist').addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        if (confirm('Diese Hand löschen?')) { SC.store.deleteHand(del.dataset.del); onShow(); }
        return;
      }
      const it = e.target.closest('[data-id]'); if (!it) return;
      const h = SC.store.load().hands.find((x) => x.id === it.dataset.id);
      if (h) SC.review.open(h);
    });
    root.querySelector('#exp').addEventListener('click', exportData);
    root.querySelector('#imp').addEventListener('change', importData);
    root.querySelector('#wipe').addEventListener('click', () => {
      if (confirm('Wirklich alle Hände und Trainer-Ergebnisse löschen? Exportiere vorher, wenn du sie behalten willst.')) { SC.store.reset(); onShow(); toast('Alle Daten gelöscht.'); }
    });
    wireTrend();
  }

  /* ---------- Verlauf (Balken je Tag) ---------- */
  let trendDays = [];
  function trendHTML(drills) {
    const byDay = new Map();
    for (const d of drills) {
      const k = new Date(d.ts).toISOString().slice(0, 10);
      const x = byDay.get(k) || { n: 0, s: 0 };
      x.n++; x.s += d.grade === 'gut' ? 1 : d.grade === 'ok' ? 0.5 : 0;
      byDay.set(k, x);
    }
    trendDays = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-30).map(([k, v]) => ({ day: k, n: v.n, score: v.s / v.n }));
    if (!trendDays.length) return '<p class="muted small">Noch kein Training. Starte im Trainer, dann siehst du hier deinen Verlauf.</p>';
    const W = 640, H = 180, pl = 34, pr = 8, pt = 10, pb = 26;
    const n = trendDays.length;
    const bw = Math.min(28, (W - pl - pr) / n - 2);
    const x = (i) => pl + (i + 0.5) * ((W - pl - pr) / n);
    const y = (v) => pt + (1 - v) * (H - pt - pb);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trainer-Score pro Tag">`;
    for (const g of [0, 0.5, 1]) svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 6}" y="${y(g) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${g * 100} %</text>`;
    trendDays.forEach((d, i) => {
      const top = y(d.score), h = Math.max(2, y(0) - top);
      svg += `<path d="M${x(i) - bw / 2},${y(0)} V${top + 4} q0,-4 4,-4 H${x(i) + bw / 2 - 4} q4,0 4,4 V${y(0)} Z" fill="var(--series-1)"/>`;
      svg += `<rect x="${x(i) - Math.max(bw, 14) / 2 - 2}" y="${pt}" width="${Math.max(bw, 14) + 4}" height="${H - pt - pb}" fill="transparent" data-i="${i}" style="cursor:default"/>`;
      void h;
    });
    const lbl = (i) => { const [, m, dd] = trendDays[i].day.split('-'); return `${+dd}.${+m}.`; };
    const idx = n <= 6 ? [...Array(n).keys()] : [0, Math.floor(n / 2), n - 1];
    for (const i of idx) svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${lbl(i)}</text>`;
    svg += '</svg>';
    return `<div class="chart" id="trend">${svg}<div class="tip" hidden></div></div>`;
  }
  function wireTrend() {
    const el = root.querySelector('#trend'); if (!el) return;
    const tip = el.querySelector('.tip');
    el.addEventListener('pointermove', (e) => {
      const r = e.target.closest('[data-i]');
      if (!r) { tip.hidden = true; return; }
      const d = trendDays[+r.dataset.i];
      const box = el.getBoundingClientRect(), rb = r.getBoundingClientRect();
      tip.hidden = false;
      tip.textContent = `${new Date(d.day).toLocaleDateString('de-DE')}: ${Math.round(d.score * 100)} % · ${d.n} Spots`;
      tip.style.left = (rb.left + rb.width / 2 - box.left) + 'px';
      tip.style.top = (e.clientY - box.top) + 'px';
    });
    el.addEventListener('pointerleave', () => { tip.hidden = true; });
  }

  /* ---------- Leaks ---------- */
  function leaksHTML(decs, drills) {
    const m = new Map();
    const add = (kind, d, src) => {
      const x = m.get(kind) || { n: 0, err: 0, ok: 0, loss: 0, src: new Set(), hands: new Map() };
      x.n++; if (d.grade === 'fehler') x.err++; if (d.grade === 'ok') x.ok++;
      if (d.grade !== 'gut' && d.evLoss) x.loss += d.evLoss;
      x.src.add(src);
      if (d.grade === 'fehler' && d.cls) x.hands.set(d.cls, (x.hands.get(d.cls) || 0) + 1);
      m.set(kind, x);
    };
    for (const d of decs) add(d.kind, d, 'Review');
    for (const d of drills) add(d.spotKind || d.kind, d, 'Trainer');
    const rows = [...m.entries()].filter(([, x]) => x.n >= 1).sort((a, b) => b[1].err - a[1].err || b[1].loss - a[1].loss).slice(0, 12);
    if (!rows.length) return '<p class="muted small">Noch keine Daten.</p>';
    return `<div class="table-scroll"><table class="data"><thead><tr><th>Spot</th><th class="r">Anzahl</th><th class="r">Fehler</th><th style="width:22%">Fehlerquote</th><th class="r">EV-Verlust</th></tr></thead><tbody>
      ${rows.map(([k, x]) => {
        const rate = x.err / x.n;
        const top = [...x.hands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h]) => h).join(', ');
        return `<tr><td><b>${esc(k)}</b><div class="small muted">${[...x.src].join(' + ')}${top ? ' · oft falsch: ' + esc(top) : ''}</div></td>
          <td class="r">${x.n}</td><td class="r">${x.err}</td>
          <td><div class="row" style="gap:6px;flex-wrap:nowrap"><div class="bar-inline" style="flex:1"><span style="width:${Math.round(rate * 100)}%"></span></div><span class="small num">${Math.round(rate * 100)} %</span></div></td>
          <td class="r">${x.loss > 0.005 ? fmt(x.loss, 1) + ' BB' : '–'}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  /* ---------- Hand-Verlauf ---------- */
  function historyHTML(hands) {
    const list = filter === 'err' ? hands.filter((h) => (h.decisions || []).some((d) => d.grade === 'fehler')) : hands;
    if (!list.length) return '<p class="muted small">Noch keine Hände gespeichert. Werte im Review eine Hand aus, sie wird automatisch gespeichert.</p>';
    return list.slice(0, 200).map((h) => {
      const errs = (h.decisions || []).filter((d) => d.grade === 'fehler').length;
      const oks = (h.decisions || []).filter((d) => d.grade === 'ok').length;
      const g = errs ? 'fehler' : oks ? 'ok' : 'gut';
      const cards = h.heroCards ? SC.ui.cardsHTML(h.heroCards.map(SC.cards.cardFromCode), 'sm') : '';
      const board = h.board && h.board.length ? ' ' + SC.ui.cardsHTML(h.board.map(SC.cards.cardFromCode), 'sm') : '';
      const sum = (h.decisions || []).map((d) => `${d.hero}${d.grade === 'fehler' ? ' ✗' : ''}`).join(' → ') || (h.open ? 'Offen: ' + h.open.rec : '');
      return `<div class="hist-item" data-id="${h.id}" role="button" tabindex="0">
        ${cards}
        <div class="grow"><div><b>${esc(h.heroClass || '')}</b> · ${esc(SC.ui.POS_DE[h.hero] || '')} · ${fmt(h.stack || 0)} BB${board}</div>
          <div class="sum">${esc(sum)}</div><div class="when">${when(h.ts)}</div></div>
        ${(h.decisions || []).length ? badge(g) : ''}
        <button class="btn ghost small" data-del="${h.id}" aria-label="Hand löschen" type="button">✕</button>
      </div>`;
    }).join('');
  }

  /* ---------- Export/Import ---------- */
  function exportData() {
    const blob = new Blob([SC.store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spin-coach-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importData(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { SC.store.importJSON(r.result, true); toast('Import erfolgreich.'); onShow(); }
      catch (err) { toast('Import fehlgeschlagen: ' + err.message); }
    };
    r.readAsText(f);
  }

  SC.stats = { render, onShow };
})(window.SC = window.SC || {});
