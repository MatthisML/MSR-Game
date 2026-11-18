/* Trainer: zufällige Spots aus 3-Max-Spins. Die Spots werden im festen Eingabeformat erzeugt
   und laufen durch dieselbe Analyse wie das Hand-Review. */
(function (SC) {
  'use strict';
  const { esc, fmt, cardHTML, cardsHTML, badge, POS_DE, recLabel } = SC.ui;
  const C = SC.cards, E = SC.equity, PF = SC.preflop;

  const MODES = [
    { id: 'mix', label: 'Gemischt' },
    { id: 'pushfold', label: 'Push/Fold' },
    { id: 'callshove', label: 'Call vs. All-in' },
    { id: 'deep', label: 'Preflop tief' },
    { id: 'postcall', label: 'Postflop gegen Bet' },
    { id: 'postbet', label: 'Postflop erste Aktion' },
  ];
  const MODE_INFO = {
    pushfold: 'Push oder Fold mit 2–10 BB. Bewertet gegen das Nash-Gleichgewicht.',
    callshove: 'Ein Gegner geht All-in. Bewertet mit Nash-Lösung und exakter EV-Rechnung.',
    deep: '12–25 BB: Raise, Limp, Call oder All-in. Bewertet mit dem Näherungsmodell.',
    postcall: 'Gegner setzt, du entscheidest Fold, Call oder All-in. Equity gegen seine Range.',
    postbet: 'Du handelst zuerst: Check oder Bet. GTO-nahe Heuristik.',
  };

  let root, mode = 'mix', cur = null, answered = false;
  const session = { n: 0, gut: 0, ok: 0, fehler: 0, loss: 0 };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const code = (c) => C.cardCode(c);

  function randomCombo(cls, dead) {
    const combos = C.CLASS_COMBOS[cls].filter(([a, b]) => !dead.has(a) && !dead.has(b));
    return combos.length ? pick(combos) : null;
  }
  function sampleClass(weightFn) {
    let tot = 0; const w = [];
    for (let a = 0; a < C.N_CLASSES; a++) { const x = Math.max(0, weightFn(a)) * C.CLASS_NCOMBOS[a]; w.push(x); tot += x; }
    let r = Math.random() * tot;
    for (let a = 0; a < C.N_CLASSES; a++) { r -= w[a]; if (r <= 0) return a; }
    return C.N_CLASSES - 1;
  }
  // Lernwirksam: meist Hände nahe an der Grenze der Range
  function boundaryClass(node, S) {
    if (Math.random() < 0.3) return sampleClass(() => 1);
    return sampleClass((a) => { const n = PF.nash(node, S, a); return Math.abs(n.ev) < 1.2 || (n.freq > 5 && n.freq < 95) ? 1 : 0.05; });
  }
  function deckDraw(dead, k) {
    const out = [];
    while (out.length < k) { const c = rnd(0, 51); if (!dead.has(c)) { dead.add(c); out.push(c); } }
    return out;
  }

  /* ---------- Spot-Generatoren: liefern { text, answers, kind } ---------- */

  function genPushFold() {
    const S = pick([2, 3, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]);
    const v = pick(['BTN', 'BTN', 'SB', 'SB', 'HU']);
    const node = v === 'BTN' ? 'btnPush' : v === 'SB' ? 'sbPush' : 'huPush';
    const cls = boundaryClass(node, S);
    const [a, b] = randomCombo(cls, new Set());
    let text;
    if (v === 'HU') text = `Heads up. Stack ${S}. Position Small Blind. Hand ${code(a)} ${code(b)}.`;
    else if (v === 'BTN') text = `Stack ${S}. Position Button. Hand ${code(a)} ${code(b)}.`;
    else text = `Stack ${S}. Position Small Blind. Hand ${code(a)} ${code(b)}. Button fold.`;
    return { text, answers: [['fold', 'Fold'], ['allin', 'All-in']] };
  }

  function genCallShove() {
    const S = pick([3, 4, 5, 6, 7, 8, 9, 10, 10, 12, 12, 14, 15, 16, 18, 20]);
    const v = pick(['bbVsBtn', 'sbVsBtn', 'bbVsSb', 'bbVsSb', 'hu', 'hu', 'over']);
    const node = { bbVsBtn: 'bbCall', sbVsBtn: 'sbCall', bbVsSb: 'bbCallSb', hu: 'huCall', over: 'bbOver' }[v];
    const cls = boundaryClass(node, S);
    const [a, b] = randomCombo(cls, new Set());
    const h = `Hand ${code(a)} ${code(b)}.`;
    const text = {
      bbVsBtn: `Stack ${S}. Position Big Blind. ${h} Button all in. Small Blind fold.`,
      sbVsBtn: `Stack ${S}. Position Small Blind. ${h} Button all in.`,
      bbVsSb: `Stack ${S}. Position Big Blind. ${h} Button fold. Small Blind all in.`,
      hu: `Heads up. Stack ${S}. Position Big Blind. ${h} Small Blind all in.`,
      over: `Stack ${S}. Position Big Blind. ${h} Button all in. Small Blind call.`,
    }[v];
    return { text, answers: [['fold', 'Fold'], ['call', 'Call']] };
  }

  function genDeep() {
    const S = rnd(12, 25);
    const v = pick(['btn', 'btn', 'sb', 'bbVsBtn', 'bbVsBtn', 'huBb']);
    const cls = sampleClass(() => 1);
    const [a, b] = randomCombo(cls, new Set());
    const h = `Hand ${code(a)} ${code(b)}.`;
    if (v === 'btn') return { text: `Stack ${S}. Position Button. ${h}`, answers: [['fold', 'Fold'], ['raise:2', 'Raise 2 BB'], ['allin', 'All-in']] };
    if (v === 'sb') return { text: `Stack ${S}. Position Small Blind. ${h} Button fold.`, answers: [['fold', 'Fold'], ['call', 'Limp'], ['raise:3', 'Raise 3 BB'], ['allin', 'All-in']] };
    if (v === 'huBb') return { text: `Heads up. Stack ${S}. Position Big Blind. ${h} Small Blind raise 2.`, answers: [['fold', 'Fold'], ['call', 'Call'], ['allin', 'All-in']] };
    return { text: `Stack ${S}. Position Big Blind. ${h} Button raise 2. Small Blind fold.`, answers: [['fold', 'Fold'], ['call', 'Call'], ['allin', 'All-in']] };
  }

  // Preflop-Linie für Postflop-Spots: Raiser (IP) gegen Big Blind (OOP)
  function postSetup() {
    const hu = Math.random() < 0.35;
    const S = rnd(14, 25);
    const raiser = hu ? 'SB' : 'BTN';
    const pre = hu ? `Heads up. Stack ${S}.` : `Stack ${S}.`;
    const line = hu ? 'Small Blind raise 2. Big Blind call.' : 'Button raise 2. Small Blind fold. Big Blind call.';
    const raiserName = hu ? 'Small Blind' : 'Button';
    return { hu, S, raiser, raiserName, pre, line, players: hu ? 2 : 3 };
  }
  function heroHandFromRange(pos, lineType, S, players) {
    const range = PF.actionRange(pos, { type: lineType }, S, players);
    const cls = sampleClass((a) => range[a]);
    return randomCombo(cls, new Set());
  }
  const sizeWord = (p) => (p === 'allin' ? 'all in' : `bet ${p} Prozent`);

  function genPostCall() {
    const st = postSetup();
    const heroIsBB = Math.random() < 0.7;
    const street = pick(['flop', 'flop', 'turn', 'turn', 'river']);
    const hero = heroIsBB ? 'BB' : st.raiser;
    const [a, b] = heroHandFromRange(hero, heroIsBB ? 'call' : 'open', st.S, st.players);
    const dead = new Set([a, b]);
    const board = deckDraw(dead, street === 'flop' ? 3 : street === 'turn' ? 4 : 5);
    const bf = `Flop ${board.slice(0, 3).map(code).join(' ')}.`;
    const size = pick([33, 50, 50, 66, 75, 100]);
    let text = `${st.pre} Position ${heroIsBB ? 'Big Blind' : st.raiserName}. Hand ${code(a)} ${code(b)}. ${st.line} ${bf} `;
    if (heroIsBB) {
      if (street === 'flop') text += `Big Blind check. ${st.raiserName} ${sizeWord(size)}.`;
      else if (street === 'turn') text += `Big Blind check. ${st.raiserName} bet 33 Prozent. Big Blind call. Turn ${code(board[3])}. Big Blind check. ${st.raiserName} ${sizeWord(size)}.`;
      else text += `Big Blind check. ${st.raiserName} bet 33 Prozent. Big Blind call. Turn ${code(board[3])}. Big Blind check. ${st.raiserName} check. River ${code(board[4])}. Big Blind check. ${st.raiserName} ${sizeWord(size)}.`;
    } else {
      // Held ist Raiser in Position, Big Blind spielt Check-Raise bzw. Lead
      if (street === 'flop') text += `Big Blind check. ${st.raiserName} bet 33 Prozent. Big Blind raise ${pick([3, 3.5, 4])}.`;
      else if (street === 'turn') text += `Big Blind check. ${st.raiserName} check. Turn ${code(board[3])}. Big Blind ${sizeWord(size)}.`;
      else text += `Big Blind check. ${st.raiserName} bet 33 Prozent. Big Blind call. Turn ${code(board[3])}. Big Blind check. ${st.raiserName} check. River ${code(board[4])}. Big Blind ${sizeWord(size)}.`;
    }
    return { text, answers: [['fold', 'Fold'], ['call', 'Call'], ['allin', 'All-in']] };
  }

  function genPostBet() {
    const st = postSetup();
    const v = pick(['cbet', 'cbet', 'turnBarrel', 'bbTurn', 'river']);
    const raiserHand = heroHandFromRange(st.raiser, 'open', st.S, st.players);
    const bbHand = heroHandFromRange('BB', 'call', st.S, st.players);
    const heroIsBB = v === 'bbTurn';
    const [a, b] = heroIsBB ? bbHand : raiserHand;
    const dead = new Set([a, b]);
    const board = deckDraw(dead, v === 'cbet' ? 3 : v === 'river' ? 5 : 4);
    const bf = `Flop ${board.slice(0, 3).map(code).join(' ')}.`;
    let text = `${st.pre} Position ${heroIsBB ? 'Big Blind' : st.raiserName}. Hand ${code(a)} ${code(b)}. ${st.line} ${bf} `;
    if (v === 'cbet') text += 'Big Blind check.';
    else if (v === 'turnBarrel') text += `Big Blind check. ${st.raiserName} bet 33 Prozent. Big Blind call. Turn ${code(board[3])}. Big Blind check.`;
    else if (v === 'bbTurn') text += `Big Blind check. ${st.raiserName} check. Turn ${code(board[3])}.`;
    else text += `Big Blind check. ${st.raiserName} bet 33 Prozent. Big Blind call. Turn ${code(board[3])}. Big Blind check. ${st.raiserName} bet 50 Prozent. Big Blind call. River ${code(board[4])}. Big Blind check.`;
    return { text, answers: [['check', 'Check'], ['bet:33', 'Bet 33 %'], ['bet:66', 'Bet 66 %'], ['allin', 'All-in']] };
  }

  const GEN = { pushfold: genPushFold, callshove: genCallShove, deep: genDeep, postcall: genPostCall, postbet: genPostBet };

  function nextSpot() {
    for (let tries = 0; tries < 20; tries++) {
      const m = mode === 'mix' ? pick(['pushfold', 'pushfold', 'callshove', 'callshove', 'deep', 'postcall', 'postcall', 'postbet']) : mode;
      const g = GEN[m]();
      const parsed = SC.parser.parse(g.text);
      if (parsed.errors.length) continue;
      const game = SC.game.replay(parsed);
      if (!game.open || !game.open.heroCards) continue;
      const spot = game.open;
      // trivial: All-in-Antwort ohne Sinn, wenn Held schon (fast) All-in ist
      const answers = g.answers.filter(([k]) => !(k === 'allin' && spot.toCall >= spot.behind[spot.hero] - 0.01));
      if (spot.toCall >= spot.behind[spot.hero] - 0.01 && !answers.some(([k]) => k === 'call')) answers.splice(1, 0, ['call', 'Call']);
      return { mode: m, text: g.text, parsed, game, spot, answers };
    }
    return null;
  }

  /* ---------- Darstellung ---------- */

  function render() {
    root = document.getElementById('view-trainer');
    root.innerHTML = `
      <h1>Trainer</h1>
      <p class="lead">Entscheide den Spot, der Coach bewertet sofort. Tasten am PC: <span class="kbd">1</span>–<span class="kbd">4</span> für Antworten, <span class="kbd">Enter</span> für den nächsten Spot.</p>
      <div class="chips" id="modes" role="tablist">${MODES.map((m) => `<button class="chip ${m.id === mode ? 'on' : ''}" data-mode="${m.id}" role="tab" aria-selected="${m.id === mode}">${m.label}</button>`).join('')}</div>
      <p class="small muted" id="mode-info" style="margin:8px 0 12px"></p>
      <div class="score panel" id="score" style="padding:10px 14px"></div>
      <div id="spot"></div>`;
    root.querySelector('#modes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]'); if (!b) return;
      mode = b.dataset.mode;
      root.querySelectorAll('#modes .chip').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      deal();
    });
    document.addEventListener('keydown', onKey);
    updateScore();
  }

  function onShow() { if (!cur) deal(); }

  function onKey(e) {
    if (!root || root.hidden || e.target.closest('input, textarea, select')) return;
    if (answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); deal(); return; }
    const k = parseInt(e.key, 10);
    if (!answered && cur && k >= 1 && k <= cur.answers.length) { e.preventDefault(); answer(cur.answers[k - 1][0]); }
  }

  function deal() {
    root.querySelector('#mode-info').textContent = mode === 'mix' ? 'Alle Spot-Arten gemischt.' : MODE_INFO[mode];
    cur = nextSpot();
    answered = false;
    const el = root.querySelector('#spot');
    if (!cur) { el.innerHTML = '<div class="msg err">Konnte keinen Spot erzeugen.</div>'; return; }
    el.innerHTML = tableHTML(cur) + `<div class="answers" id="answers">${cur.answers.map(([k, l], i) => `<button class="btn ${i === cur.answers.length - 1 ? '' : ''}" data-ans="${k}"><span class="kbd" aria-hidden="true">${i + 1}</span> ${esc(l)}</button>`).join('')}</div><div id="feedback"></div>`;
    el.querySelector('#answers').addEventListener('click', (e) => { const b = e.target.closest('[data-ans]'); if (b && !answered) answer(b.dataset.ans); });
  }

  function tableHTML(c) {
    const s = c.spot;
    const lastAct = {};
    for (const a of s.history) {
      if (a.type === 'fold') lastAct[a.pos] = 'Fold';
      else if (a.street === s.street) lastAct[a.pos] = SC.ui.heroLabel(a);
    }
    const seat = (p) => {
      const folded = s.folded[p];
      const posName = p === s.hero ? 'Du · ' + p : POS_DE[p];
      return `<div class="seat ${folded ? 'out' : ''} ${p === s.hero ? 'hero' : ''}">
        <span class="nm">${esc(posName)}</span>
        <span class="stk num">${fmt(s.behind[p])} BB${s.allin[p] ? ' · All-in' : ''}</span>
        <span class="act">${esc(lastAct[p] || (s.street === 'preflop' && p === 'SB' && !lastAct[p] ? 'SB 0,5' : s.street === 'preflop' && p === 'BB' && !lastAct[p] ? 'BB 1' : ''))}</span>
      </div>`;
    };
    const opps = s.positions.filter((p) => p !== s.hero);
    const prompt = s.toCall > 0
      ? `Du bist am Zug: ${fmt(s.toCall)} BB zu callen`
      : s.street === 'preflop' ? 'Du bist am Zug' : 'Du bist am Zug (kein Einsatz offen)';
    const boardSlots = s.street === 'preflop' ? '' : cardsHTML(s.board);
    return `<div class="table-wrap">
      <div class="seats" style="grid-template-columns:repeat(${opps.length},1fr)">${opps.map(seat).join('')}</div>
      <div class="board">${boardSlots}</div>
      <div class="potline num">Pot ${fmt(s.pot)} BB · effektiv ${fmt(s.effStack)} BB${s.players === 2 ? ' · Heads-up' : ''}</div>
      <div class="hero-cards">${cardsHTML(s.heroCards, 'lg')}</div>
      <div class="seats" style="grid-template-columns:1fr;max-width:220px;margin:10px auto 0">${seat(s.hero)}</div>
      <div class="prompt">${esc(prompt)}</div>
    </div>`;
  }

  function answer(key) {
    answered = true;
    const s = cur.spot;
    const [type, arg] = key.split(':');
    const heroAction = { type };
    if (type === 'raise') heroAction.to = parseFloat(arg);
    if (type === 'bet') heroAction.to = Math.round(s.pot * parseFloat(arg) / 10) / 10;
    if (type === 'allin') heroAction.to = s.behind[s.hero] + s.streetInv[s.hero];
    const rec = SC.coach.recommend(s);
    const g = SC.coach.grade(rec, heroAction, s);
    // Bet-Größe: richtige Richtung, andere Größe
    if (type === 'bet' && rec.action === 'bet' && rec.sizePct) {
      const diff = Math.abs(parseFloat(arg) / 100 - rec.sizePct);
      if (diff > 0.2) { g.grade = 'ok'; g.note = `Bet ist richtig, die Größe eher ~${Math.round(rec.sizePct * 100)} % Pot.`; }
    }
    const kind = SC.coach.spotKind(s, rec);
    session.n++; session[g.grade]++;
    if (g.evLoss && g.grade !== 'gut') session.loss += g.evLoss;
    SC.store.addDrill({ kind: cur.mode, spotKind: kind, cls: C.CLASS_NAMES[s.heroClass], stack: s.effStackStart, street: s.street, grade: g.grade, evLoss: g.evLoss, node: rec.node || null, hero: key, rec: rec.action });
    updateScore();
    root.querySelectorAll('#answers .btn').forEach((b) => {
      b.disabled = true;
      const t = b.dataset.ans.split(':')[0];
      if (t === rec.action || (rec.action === 'limp' && t === 'call')) b.classList.add('primary');
      if (b.dataset.ans === key) b.classList.add('mine');
    });
    const node = rec.node ? `<button class="btn ghost" id="to-range" type="button">Range ansehen</button>` : '';
    root.querySelector('#feedback').innerHTML = `<p class="small muted" style="margin:8px 0 0">Umrandet: deine Wahl · gefüllt: Empfehlung des Coaches</p><div class="decision" style="margin-top:10px">
      <div class="dhead">${badge(g.grade)}<span class="kind">${esc(kind)}</span><span class="conf">${esc(rec.confidence || '')}</span></div>
      <dl class="vs"><dt>Coach</dt><dd class="rec-big">${esc(recLabel(rec))}</dd>
        ${rec.freq ? `<dt>Gleichgewicht</dt><dd>${esc(Object.entries(rec.freq).filter(([, v]) => v > 0.5).map(([k, v]) => `${SC.ui.REC_DE[k]} ${Math.round(v)} %`).join(' · '))}</dd>` : ''}
        ${g.evLoss && g.grade !== 'gut' && g.evLoss > 0.005 ? `<dt>EV-Verlust</dt><dd>${fmt(g.evLoss, 2)} BB</dd>` : ''}</dl>
      ${g.note ? `<div class="small muted">${esc(g.note)}</div>` : ''}
      <ul class="why">${rec.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <details class="small" style="margin-top:8px"><summary>Spot im Eingabeformat</summary><div class="example">${esc(cur.text)}</div></details>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn primary" id="next" type="button">Nächster Spot</button>${node}</div>`;
    root.querySelector('#next').addEventListener('click', deal);
    const tr = root.querySelector('#to-range');
    if (tr) tr.addEventListener('click', () => SC.ranges.show(rec.node, rec.stack, s.heroClass));
    root.querySelector('#next').focus({ preventScroll: true });
  }

  function updateScore() {
    const el = root.querySelector('#score');
    const acc = session.n ? Math.round((session.gut + session.ok * 0.5) / session.n * 100) : 0;
    el.innerHTML = session.n
      ? `<span>Diese Sitzung: <b>${session.n}</b> Spots</span><span>Richtig <b>${session.gut}</b></span><span>Vertretbar <b>${session.ok}</b></span><span>Fehler <b>${session.fehler}</b></span><span>Score <b>${acc} %</b></span><span>EV-Verlust <b>${fmt(session.loss, 2)} BB</b></span>`
      : '<span>Noch keine Spots in dieser Sitzung. Alle Ergebnisse landen in deiner Statistik.</span>';
  }

  SC.trainer = { render, onShow, nextSpot, GEN };
})(window.SC = window.SC || {});
