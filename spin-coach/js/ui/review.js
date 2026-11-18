/* Review-Ansicht: Hand per Sprache oder Text eingeben, auswerten, speichern. */
(function (SC) {
  'use strict';
  const { esc, fmt, cardHTML, cardsHTML, badge, toast, POS_DE, recLabel, heroLabel } = SC.ui;
  const C = SC.cards;

  let root, ta, micBtn, statusEl, interimEl, resultEl;
  let voice = null;
  let currentId = null; // gespeicherte Hand, die gerade angezeigt wird
  let pendingRank = null;

  const EXAMPLE = `Stack 18
Position Button
Hand Herz Ass Pik König
Button raise 2
Small Blind fold
Big Blind call
Flop Herz Dame, Pik Sieben, Karo Zwei
Big Blind check
Button bet 50 Prozent
Big Blind call
Turn Kreuz Neun
Big Blind bet 4
Ich call`;

  function render() {
    root = document.getElementById('view-review');
    const rankBtns = C.RANKS.split('').reverse().map((r) => `<button type="button" data-rank="${r}" aria-label="${C.RANK_NAME_DE[C.RANKS.indexOf(r)]}">${r === 'T' ? '10' : r}</button>`).join('');
    root.innerHTML = `
      <h1>Hand-Review</h1>
      <p class="lead">Sag oder tippe die Hand im festen Format. Danach bewertet der Coach jede deiner Entscheidungen und speichert die Hand.</p>
      <div class="panel">
        <div class="mic-row">
          <button class="mic" id="mic" type="button" aria-label="Spracheingabe starten">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
          </button>
          <div style="min-width:0">
            <div id="mic-status" class="small muted">${SC.voice.supported ? 'Tippe aufs Mikrofon und sprich Zeile für Zeile. Befehle: „auswerten“, „zurück“, „neue Hand“, „stopp“.' : 'Spracheingabe wird von diesem Browser nicht unterstützt (Chrome, Edge oder Safari nutzen). Tippen funktioniert immer.'}</div>
            <div id="interim" class="interim" aria-live="polite"></div>
          </div>
        </div>
        <div class="field" style="margin-top:12px">
          <label for="hand-text">Hand (eine Angabe pro Zeile oder alles am Stück)</label>
          <textarea id="hand-text" rows="8" spellcheck="false" autocapitalize="off" placeholder="${esc(EXAMPLE)}"></textarea>
        </div>
        <details class="insert" id="insert">
          <summary>Eingabehilfen zum Tippen</summary>
          <div class="chips" data-ins>
            ${['Stack ', 'Position ', 'Hand ', 'Button ', 'Small Blind ', 'Big Blind ', 'Ich ', 'fold', 'check', 'call', 'raise ', 'bet ', 'all in', 'Prozent', 'suited', 'offsuit', 'Flop ', 'Turn ', 'River ', 'Heads up'].map((t) => `<button type="button" class="chip" data-text="${esc(t)}">${esc(t.trim())}</button>`).join('')}
          </div>
          <div class="small muted">Karte: erst Rang, dann Farbe tippen.</div>
          <div class="picker" id="picker">${rankBtns}</div>
          <div class="suits" id="suits">
            <button type="button" class="c" data-suit="Kreuz" aria-label="Kreuz">♣</button>
            <button type="button" class="d" data-suit="Karo" aria-label="Karo">♦</button>
            <button type="button" class="h" data-suit="Herz" aria-label="Herz">♥</button>
            <button type="button" class="s" data-suit="Pik" aria-label="Pik">♠</button>
          </div>
        </details>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="analyze" type="button">Auswerten</button>
          <button class="btn" id="undo" type="button">Letzte Zeile löschen</button>
          <button class="btn ghost" id="clear" type="button">Neue Hand</button>
          <button class="btn ghost" id="example" type="button">Beispiel</button>
        </div>
      </div>
      <details class="panel format-help">
        <summary>Das feste Format</summary>
        <ul>
          <li><b>Stacks</b> in Big Blinds: <code>Stack 18</code> (alle gleich) oder <code>Stack Button 20 Small Blind 15 Big Blind 25</code>. Ohne Angabe: 25 BB.</li>
          <li><b>Deine Position</b>: <code>Position Button</code> (oder <code>Ich bin Big Blind</code>). Heads-up: <code>Heads up</code> sagen, dann gibt es nur Small Blind (= Button) und Big Blind.</li>
          <li><b>Deine Hand</b>: <code>Hand Herz Ass Pik König</code>, kurz <code>Hand Ah Ks</code> oder ohne Farben <code>Hand Ass König suited</code>. Für Postflop-Analyse bitte mit Farben.</li>
          <li><b>Aktionen</b>: <code>&lt;Spieler&gt; &lt;Aktion&gt; [Betrag]</code>. Spieler: Button, Small Blind, Big Blind oder <code>Ich</code>. Aktionen: fold, check, call, bet, raise, all in (auch limp, shove, min raise).</li>
          <li><b>Beträge</b> in BB: <code>raise 2</code> heißt <i>auf</i> 2 BB, <code>bet 3</code> setzt 3 BB. Oder relativ: <code>bet 50 Prozent</code>, <code>bet halber Pot</code>, <code>bet Pot</code>.</li>
          <li><b>Board</b>: <code>Flop Herz Dame, Pik Sieben, Karo Zwei</code>, dann <code>Turn Kreuz Neun</code>, <code>River Karo Ass</code>.</li>
          <li><b>Optional</b>: <code>Showdown Big Blind Herz Dame Kreuz Dame</code>.</li>
          <li>Vergessene Folds/Checks ergänzt der Coach selbst (mit Hinweis). Endet die Eingabe, während du am Zug bist, bekommst du eine Empfehlung für diesen Spot.</li>
        </ul>
        <div class="example">${esc(EXAMPLE)}</div>
      </details>
      <div id="review-result" aria-live="polite"></div>`;

    ta = root.querySelector('#hand-text');
    micBtn = root.querySelector('#mic');
    statusEl = root.querySelector('#mic-status');
    interimEl = root.querySelector('#interim');
    resultEl = root.querySelector('#review-result');
    if (!SC.voice.supported) micBtn.disabled = true;

    micBtn.addEventListener('click', toggleMic);
    root.querySelector('#analyze').addEventListener('click', () => analyze(true));
    root.querySelector('#undo').addEventListener('click', undoLine);
    root.querySelector('#clear').addEventListener('click', clearAll);
    root.querySelector('#example').addEventListener('click', () => { ta.value = EXAMPLE; currentId = null; analyze(false); });
    root.querySelector('[data-ins]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-text]'); if (!b) return;
      const t = b.dataset.text;
      const startsLine = /^(Stack|Position|Hand|Button|Small|Big|Ich|Flop|Turn|River|Heads)/.test(t);
      insert((startsLine ? '\n' : ' ') + t);
    });
    root.querySelector('#picker').addEventListener('click', (e) => {
      const b = e.target.closest('[data-rank]'); if (!b) return;
      pendingRank = b.dataset.rank;
      root.querySelectorAll('#picker button').forEach((x) => x.classList.toggle('sel', x === b));
    });
    root.querySelector('#suits').addEventListener('click', (e) => {
      const b = e.target.closest('[data-suit]'); if (!b || !pendingRank) return;
      insert(` ${b.dataset.suit} ${C.RANK_NAME_DE[C.RANKS.indexOf(pendingRank)]}`);
      pendingRank = null;
      root.querySelectorAll('#picker button').forEach((x) => x.classList.remove('sel'));
    });
    ta.addEventListener('input', () => { currentId = null; });
  }

  function insert(text) {
    const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? ta.value.length;
    let t = text;
    if (s === 0 && t.startsWith('\n')) t = t.slice(1);
    ta.value = ta.value.slice(0, s) + t + ta.value.slice(e);
    const pos = s + t.length;
    ta.setSelectionRange(pos, pos);
    ta.focus();
    currentId = null;
  }

  function toggleMic() {
    if (!voice) {
      voice = SC.voice.create({
        onLine: (line) => {
          ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + line;
          ta.scrollTop = ta.scrollHeight;
          currentId = null;
        },
        onInterim: (t) => { interimEl.textContent = t; },
        onCommand: (cmd) => {
          if (cmd === 'analyze') analyze(true);
          else if (cmd === 'undo') undoLine();
          else if (cmd === 'clear') clearAll();
          else if (cmd === 'stop') voice.stop();
        },
        onState: (on) => {
          micBtn.classList.toggle('live', on);
          micBtn.setAttribute('aria-label', on ? 'Spracheingabe stoppen' : 'Spracheingabe starten');
          statusEl.textContent = on ? 'Ich höre zu … sprich Zeile für Zeile. „auswerten“ beendet die Eingabe.' : 'Mikrofon aus. Tippen zum Starten.';
          if (!on) interimEl.textContent = '';
        },
        onError: (msg) => { statusEl.textContent = msg; },
      });
    }
    if (!voice) return;
    if (voice.active) voice.stop(); else voice.start();
  }

  function undoLine() {
    const lines = ta.value.replace(/\s+$/, '').split('\n');
    lines.pop();
    ta.value = lines.join('\n');
    currentId = null;
  }
  function clearAll() { ta.value = ''; resultEl.innerHTML = ''; currentId = null; }

  /* Hand auswerten; save = true speichert neue Hände automatisch. */
  function analyze(save) {
    const text = ta.value.trim();
    if (!text) { toast('Noch keine Hand eingegeben.'); return; }
    if (voice && voice.active) voice.stop();
    resultEl.innerHTML = '<div class="panel muted">Rechne …</div>';
    setTimeout(() => {
      let res;
      try { res = SC.coach.analyze(text); }
      catch (e) { console.error(e); resultEl.innerHTML = `<div class="msg err">Interner Fehler bei der Auswertung: ${esc(e.message)}</div>`; return; }
      showResult(res);
      if (save && res.ok && (res.decisions.length || res.open) && !currentId) {
        const entry = SC.store.addHand(summarize(text, res));
        currentId = entry.id;
        const s = resultEl.querySelector('#save-state');
        if (s) s.innerHTML = 'Gespeichert. <button class="btn ghost" id="unsave" type="button">Nicht speichern</button>';
        const u = resultEl.querySelector('#unsave');
        if (u) u.addEventListener('click', () => { SC.store.deleteHand(entry.id); currentId = null; s.textContent = 'Nicht gespeichert.'; });
      } else if (currentId) {
        const s = resultEl.querySelector('#save-state');
        if (s) s.textContent = 'Aus deinem Verlauf.';
      }
    }, 20);
  }

  function summarize(text, res) {
    const p = res.parsed;
    return {
      text,
      hero: p.hero, players: p.players,
      heroClass: C.CLASS_NAMES[p.heroClass],
      heroCards: res.game.heroCards ? res.game.heroCards.map(C.cardCode) : null,
      stack: res.game.stacks[p.hero],
      board: p.board.map(C.cardCode),
      decisions: res.decisions.map((d) => ({
        kind: d.kind, street: d.spot.street, hero: heroLabel(d.heroAction), rec: recLabel(d.rec),
        grade: d.grade.grade, evLoss: d.grade.evLoss, source: d.rec.source, inferred: d.inferred,
      })),
      open: res.open ? { kind: res.open.kind, rec: recLabel(res.open.rec) } : null,
    };
  }

  function showResult(res) {
    if (!res.ok) {
      resultEl.innerHTML = `<div class="msg err"><b>Bitte korrigieren:</b><ul>${res.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` +
        (res.warnings.length ? `<div class="msg warn"><ul>${res.warnings.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '');
      return;
    }
    const p = res.parsed, g = res.game;
    const heroCards = g.heroCards;
    const errors = res.decisions.filter((d) => d.grade.grade === 'fehler');
    const loss = res.decisions.reduce((s, d) => s + (d.grade.evLoss && d.grade.grade !== 'gut' ? d.grade.evLoss : 0), 0);
    let html = '';
    if (res.warnings.length) html += `<div class="msg warn"><b>Hinweise zur Eingabe</b><ul>${res.warnings.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    html += `<div class="panel">
      <div class="hand-head">
        ${heroCards ? cardsHTML(heroCards, 'lg') : ''}
        <div class="meta">
          <div class="rec-big">${esc(C.CLASS_NAMES[p.heroClass])} · ${esc(POS_DE[p.hero])}</div>
          <div class="muted small">${p.players === 2 ? 'Heads-up' : '3 Spieler'} · Stacks ${g.positions.map((q) => `${q} ${fmt(g.stacks[q])}`).join(' / ')} BB${p.heroSuitsKnown ? '' : ' · Farben ergänzt'}</div>
          <div class="small">${res.decisions.length} Entscheidung${res.decisions.length === 1 ? '' : 'en'} · ${errors.length ? `<b style="color:var(--bad-text)">${errors.length} Fehler</b>` : '<b style="color:var(--good-text)">keine Fehler</b>'}${loss > 0.005 ? ` · EV-Verlust ca. ${fmt(loss, 2)} BB` : ''}</div>
        </div>
      </div>
      <div class="small muted" id="save-state" style="margin-top:8px"></div>
    </div>`;
    if (res.open) html += decisionHTML({ spot: res.open.spot, rec: res.open.rec, kind: res.open.kind }, true);
    html += res.decisions.map((d) => decisionHTML(d, false)).join('');
    html += `<div class="panel"><h2>Handverlauf</h2>${timelineHTML(g, p)}</div>`;
    resultEl.innerHTML = html;
  }

  function decisionHTML(d, open) {
    const s = d.spot;
    const conf = d.rec.confidence ? `<span class="conf">${esc(d.rec.confidence)}</span>` : '';
    const street = s.street === 'preflop' ? 'Preflop' : s.street[0].toUpperCase() + s.street.slice(1);
    const boardHTML = s.board.length ? ' ' + cardsHTML(s.board, 'sm') : '';
    let head;
    if (open) head = `<span class="badge info">Offener Spot</span><span class="kind">${esc(d.kind)}</span>`;
    else head = `${badge(d.grade.grade)}<span class="kind">${esc(d.kind)}</span>`;
    const vs = open
      ? `<dl class="vs"><dt>Empfehlung</dt><dd class="rec-big">${esc(recLabel(d.rec))}</dd>${freqLine(d.rec)}</dl>`
      : `<dl class="vs"><dt>Du</dt><dd>${esc(heroLabel(d.heroAction))}${d.inferred ? ' <span class="muted small">(angenommen)</span>' : ''}</dd>
          <dt>Coach</dt><dd>${esc(recLabel(d.rec))}</dd>${freqLine(d.rec)}
          ${d.grade.evLoss !== null && d.grade.evLoss !== undefined && d.grade.grade !== 'gut' && d.grade.evLoss > 0.005 ? `<dt>EV-Verlust</dt><dd>${fmt(d.grade.evLoss, 2)} BB</dd>` : ''}</dl>
          ${d.grade.note ? `<div class="small muted">${esc(d.grade.note)}</div>` : ''}`;
    return `<div class="decision">
      <div class="dhead">${head}<span class="muted small">${street}${boardHTML} · Pot ${fmt(s.pot)} BB${s.toCall > 0 ? ` · zu callen ${fmt(s.toCall)} BB` : ''}</span>${conf}</div>
      ${vs}
      <details ${open || (d.grade && d.grade.grade !== 'gut') ? 'open' : ''}><summary class="small">Begründung</summary>
        <ul class="why">${d.rec.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      </details>
    </div>`;
  }

  function freqLine(rec) {
    if (!rec.freq) return '';
    const parts = Object.entries(rec.freq).filter(([, v]) => v > 0.5).map(([k, v]) => `${SC.ui.REC_DE[k] || k} ${Math.round(v)} %`);
    return `<dt>Gleichgewicht</dt><dd>${esc(parts.join(' · '))}</dd>`;
  }

  function timelineHTML(g, p) {
    let html = '<div class="timeline">';
    for (const e of g.timeline) {
      if (e.kind === 'street') {
        if (!e.board.length) continue;
        html += `<div class="tl-street"><span>${e.street[0].toUpperCase() + e.street.slice(1)}</span>${cardsHTML(e.board, 'sm')}<span class="muted small">Pot ${fmt(e.pot)} BB</span></div>`;
      } else {
        html += `<div class="tl-act ${e.hero ? 'hero' : ''}"><span class="pos">${esc(e.hero ? 'Du (' + e.pos + ')' : POS_DE[e.pos])}</span><span>${esc(heroLabel(e))}</span><span class="pot num">${fmt(e.pot)}</span></div>`;
      }
    }
    if (Object.keys(p.showdown).length) {
      html += `<div class="tl-street">Showdown</div>`;
      for (const [pos, cs] of Object.entries(p.showdown)) html += `<div class="tl-act"><span class="pos">${esc(POS_DE[pos])}</span>${cardsHTML(cs, 'sm')}</div>`;
    }
    return html + '</div>';
  }

  /* Gespeicherte Hand wieder öffnen. */
  function open(entry) {
    location.hash = '#review';
    ta.value = entry.text;
    currentId = entry.id;
    analyze(false);
  }

  SC.review = { render, open, analyze };
})(window.SC = window.SC || {});
