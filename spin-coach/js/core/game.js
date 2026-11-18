/* Spielt eine geparste Hand nach: Blinds, Pot, Reihenfolge, fehlende Folds/Checks ergänzen.
   Liefert die Zeitleiste und für jede Entscheidung des Helden einen "Spot" (Zustand vor der Aktion). */
(function (SC) {
  'use strict';
  const C = SC.cards;

  const ORDER = {
    3: { preflop: ['BTN', 'SB', 'BB'], post: ['SB', 'BB', 'BTN'] },
    2: { preflop: ['SB', 'BB'], post: ['BB', 'SB'] },
  };
  const STREETS = ['preflop', 'flop', 'turn', 'river'];
  const POS_DE = { BTN: 'Button', SB: 'Small Blind', BB: 'Big Blind' };
  const round2 = (x) => Math.round(x * 100) / 100;

  /* Fehlende Farben bei Klassen-Eingabe ("AKs") konfliktfrei mit dem Board ergänzen. */
  function concreteHeroCards(parsed) {
    if (parsed.heroCards) return parsed.heroCards;
    if (parsed.heroClass < 0) return null;
    const dead = new Set(parsed.board);
    for (const k of Object.keys(parsed.showdown)) for (const c of parsed.showdown[k]) dead.add(c);
    const combos = C.CLASS_COMBOS[parsed.heroClass];
    // Farben bevorzugen, die keinen Flush-Draw erzeugen, damit nichts erfunden wird
    const boardSuits = parsed.board.map(C.suitOf);
    let best = null, bestScore = 1e9;
    for (const [a, b] of combos) {
      if (dead.has(a) || dead.has(b)) continue;
      const score = boardSuits.filter((s) => s === C.suitOf(a)).length + boardSuits.filter((s) => s === C.suitOf(b)).length;
      if (score < bestScore) { best = [a, b]; bestScore = score; }
    }
    return best;
  }

  function replay(parsed) {
    const n = parsed.players;
    const positions = ORDER[n].preflop.slice();
    const warnings = [];
    const stacks = {};
    for (const p of positions) {
      let s = parsed.stacks[p];
      if (s === undefined) s = parsed.stackAll;
      if (s === undefined || s === null) { s = 25; }
      stacks[p] = s;
    }
    if (parsed.stackAll === null && Object.keys(parsed.stacks).length === 0) warnings.push('Kein Stack angegeben – nehme 25 BB für alle an.');

    const st = {
      behind: {}, inv: {}, streetInv: {}, folded: {}, allin: {},
      street: 'preflop', currentBet: 0, lastRaise: 1, needAct: new Set(),
    };
    for (const p of positions) { st.behind[p] = stacks[p]; st.inv[p] = 0; st.streetInv[p] = 0; st.folded[p] = false; st.allin[p] = false; }
    const put = (p, amt) => {
      amt = Math.min(amt, st.behind[p]);
      st.behind[p] = round2(st.behind[p] - amt); st.inv[p] = round2(st.inv[p] + amt); st.streetInv[p] = round2(st.streetInv[p] + amt);
      if (st.behind[p] <= 0.001) { st.behind[p] = 0; st.allin[p] = true; }
      return amt;
    };
    const sbPos = 'SB';
    put(sbPos, 0.5); put('BB', 1);
    st.currentBet = Math.max(st.streetInv.SB, st.streetInv.BB);
    st.lastRaise = 1;
    const pot = () => round2(positions.reduce((s, p) => s + st.inv[p], 0));
    const active = () => positions.filter((p) => !st.folded[p]);
    const canAct = (p) => !st.folded[p] && !st.allin[p];
    const order = () => (st.street === 'preflop' ? ORDER[n].preflop : ORDER[n].post);
    function resetNeed() {
      st.needAct = new Set(order().filter(canAct));
    }
    resetNeed();
    let pointer = 0; // Index in order() für nächsten Spieler
    function nextToAct() {
      const o = order();
      for (let k = 0; k < o.length; k++) {
        const p = o[(pointer + k) % o.length];
        if (st.needAct.has(p) && canAct(p)) return p;
      }
      return null;
    }
    const roundClosed = () => {
      const live = active().filter((p) => !st.allin[p]);
      if (active().length <= 1) return true;
      if (live.length === 0) return true;
      if (live.length === 1 && st.streetInv[live[0]] >= st.currentBet && !st.needAct.has(live[0])) return true;
      return st.needAct.size === 0 || [...st.needAct].every((p) => !canAct(p));
    };

    const timeline = [];
    const spots = [];
    const heroCards = concreteHeroCards(parsed);
    const actionsDone = [];
    const boardAt = (street) => {
      const b = parsed.boardByStreet;
      if (street === 'preflop') return [];
      if (street === 'flop') return b.flop.slice();
      if (street === 'turn') return b.flop.concat(b.turn);
      return b.flop.concat(b.turn, b.river);
    };

    function advanceStreet(to) {
      // Einsätze der Straße einsammeln
      for (const p of positions) st.streetInv[p] = 0;
      st.street = to; st.currentBet = 0; st.lastRaise = 1;
      pointer = 0;
      resetNeed();
      timeline.push({ kind: 'street', street: to, board: boardAt(to), pot: pot() });
    }

    function snapshot(p) {
      const opp = active().filter((q) => q !== p);
      const heroTotal = st.behind[p] + st.streetInv[p];
      const oppMax = Math.max(0, ...opp.map((q) => st.behind[q] + st.streetInv[q]));
      const o = order();
      const live = active();
      return {
        street: st.street, players: n, positions: positions.slice(), hero: p,
        heroCards, heroClass: parsed.heroClass, board: boardAt(st.street),
        stacks: Object.assign({}, stacks), behind: Object.assign({}, st.behind), inv: Object.assign({}, st.inv),
        streetInv: Object.assign({}, st.streetInv), folded: Object.assign({}, st.folded), allin: Object.assign({}, st.allin),
        pot: pot(), toCall: round2(Math.min(st.currentBet - st.streetInv[p], st.behind[p])), currentBet: st.currentBet,
        minRaiseTo: round2(st.currentBet + st.lastRaise),
        effStack: round2(Math.min(heroTotal, oppMax)),
        effStackStart: Math.min(stacks[p], Math.max(...opp.map((q) => stacks[q]))),
        opponents: opp, history: actionsDone.slice(),
        // in Position: Held handelt postflop als Letzter der aktiven Spieler
        inPosition: ORDER[n].post.filter((q) => live.includes(q)).slice(-1)[0] === p,
        behindToAct: o.slice(o.indexOf(p) + 1).filter((q) => canAct(q) && st.needAct.has(q) && q !== p),
      };
    }

    function apply(p, a) {
      const before = { toCall: round2(st.currentBet - st.streetInv[p]) };
      let type = a.type;
      let to = null;
      const cur = st.currentBet;
      if (type === 'check' && before.toCall > 0.001) { warnings.push(`${POS_DE[p]} kann nicht checken (offener Einsatz) – gewertet als Call.`); type = 'call'; }
      if (type === 'call' && before.toCall <= 0.001) type = 'check';
      if (type === 'bet' && (cur > 0.001 || st.street === 'preflop')) type = 'raise';
      if (type === 'raise' && cur <= 0.001 && st.street !== 'preflop') type = 'bet';
      if (type === 'bet') {
        let amt = a.amount;
        if (a.pct !== undefined) amt = pot() * a.pct / 100;
        if (a.mult !== undefined) amt = a.mult; // "bet 3x" ergibt postflop wenig Sinn: als BB lesen
        to = round2(amt);
      } else if (type === 'raise') {
        if (a.min) to = st.currentBet + st.lastRaise;
        else if (a.mult !== undefined) to = st.currentBet * a.mult;
        else if (a.pct !== undefined) to = st.currentBet + (pot() + before.toCall) * a.pct / 100;
        else to = a.amount;
        if (to !== null && a.amount !== undefined && st.street !== 'preflop' && to <= st.currentBet) to = st.currentBet + a.amount; // "raise 3" als Erhöhung um 3
        to = round2(to);
        if (to < st.currentBet + st.lastRaise - 0.001 && to < st.streetInv[p] + st.behind[p]) {
          warnings.push(`${POS_DE[p]}: Raise auf ${to} BB ist kleiner als ein Min-Raise – auf ${round2(st.currentBet + st.lastRaise)} BB korrigiert.`);
          to = round2(st.currentBet + st.lastRaise);
        }
      } else if (type === 'allin') {
        to = st.streetInv[p] + st.behind[p];
      }
      let rec;
      if (type === 'fold') { st.folded[p] = true; rec = { pos: p, type }; }
      else if (type === 'check') rec = { pos: p, type };
      else if (type === 'call') { const amt = put(p, before.toCall); rec = { pos: p, type, amount: amt, allin: st.allin[p] }; }
      else {
        to = Math.min(to, round2(st.streetInv[p] + st.behind[p]));
        const add = round2(to - st.streetInv[p]);
        put(p, add);
        const newBet = st.streetInv[p];
        if (newBet > st.currentBet) {
          const raiseSize = newBet - st.currentBet;
          if (raiseSize >= st.lastRaise) st.lastRaise = raiseSize;
          st.currentBet = newBet;
          // alle anderen müssen wieder handeln
          st.needAct = new Set(positions.filter((q) => q !== p && canAct(q)));
        }
        const realType = st.allin[p] ? 'allin' : (cur > 0.001 || st.street === 'preflop' ? 'raise' : 'bet');
        rec = { pos: p, type: realType, to: st.streetInv[p], amount: add, allin: st.allin[p] };
      }
      st.needAct.delete(p);
      const o = order();
      pointer = (o.indexOf(p) + 1) % o.length;
      rec.street = st.street; rec.pot = pot();
      actionsDone.push(rec);
      timeline.push(Object.assign({ kind: 'action', hero: p === parsed.hero }, rec));
      return rec;
    }

    let k = 0;
    const acts = parsed.actions;
    while (k < acts.length) {
      const a = acts[k];
      // Straßenwechsel laut Eingabe
      if (STREETS.indexOf(a.street) > STREETS.indexOf(st.street)) {
        // offene Spieler der laufenden Straße: Check, wenn möglich, sonst Fold
        let guard = 0;
        while (!roundClosed() && guard++ < 6) {
          const p = nextToAct();
          if (!p) break;
          const toCall = st.currentBet - st.streetInv[p];
          warnings.push(`${POS_DE[p]} (${st.street}): keine Aktion genannt – angenommen: ${toCall > 0.001 ? 'Fold' : 'Check'}.`);
          if (p === parsed.hero) spots.push({ spot: snapshot(p), heroAction: { type: toCall > 0.001 ? 'fold' : 'check' }, inferred: true });
          apply(p, { type: toCall > 0.001 ? 'fold' : 'check' });
        }
        if (active().length <= 1) break;
        while (STREETS.indexOf(st.street) < STREETS.indexOf(a.street)) advanceStreet(STREETS[STREETS.indexOf(st.street) + 1]);
      }
      let p = a.pos || nextToAct();
      if (!p) { warnings.push('Aktion ohne Spieler und niemand ist am Zug – ignoriert.'); k++; continue; }
      if (st.folded[p]) { warnings.push(`${POS_DE[p]} hat schon gefoldet – Aktion ignoriert.`); k++; continue; }
      if (st.allin[p]) { warnings.push(`${POS_DE[p]} ist schon All-in – Aktion ignoriert.`); k++; continue; }
      // übersprungene Spieler vor p: Fold (bei Einsatz) bzw. Check
      let guard = 0;
      while (nextToAct() && nextToAct() !== p && guard++ < 4) {
        const q = nextToAct();
        const toCall = st.currentBet - st.streetInv[q];
        warnings.push(`${POS_DE[q]} (${st.street}): keine Aktion genannt – angenommen: ${toCall > 0.001 ? 'Fold' : 'Check'}.`);
        if (q === parsed.hero) spots.push({ spot: snapshot(q), heroAction: { type: toCall > 0.001 ? 'fold' : 'check' }, inferred: true });
        apply(q, { type: toCall > 0.001 ? 'fold' : 'check' });
      }
      if (p === parsed.hero) {
        const snap = snapshot(p);
        const rec = apply(p, a);
        spots.push({ spot: snap, heroAction: rec });
      } else apply(p, a);
      if (roundClosed() && active().length > 1 && st.street !== 'river') {
        const liveCount = active().filter((q) => !st.allin[q]).length;
        if (liveCount <= 1) {
          // alle (bis auf einen) All-in: restliche Straßen ohne Aktionen
          while (st.street !== 'river') advanceStreet(STREETS[STREETS.indexOf(st.street) + 1]);
        } else {
          const nextAct = acts[k + 1];
          if (nextAct && nextAct.street === st.street) {
            // Eingabe bleibt auf derselben Straße: Spieler hat Straße wohl vergessen
            advanceStreet(STREETS[STREETS.indexOf(st.street) + 1]);
            warnings.push(`Setzrunde war beendet – folgende Aktionen werden dem ${st.street === 'flop' ? 'Flop' : st.street === 'turn' ? 'Turn' : 'River'} zugeordnet.`);
            for (let j = k + 1; j < acts.length && acts[j].street === nextAct.street; j++) acts[j].street = st.street;
          }
        }
      }
      k++;
    }

    // Offene Entscheidung des Helden am Ende (Eingabe endet, Held ist dran) -> "Was soll ich tun?"
    let open = null;
    if (active().length > 1 && !st.folded[parsed.hero] && !st.allin[parsed.hero]) {
      let guard = 0;
      while (guard++ < 4) {
        const q = nextToAct();
        if (!q) break;
        if (q === parsed.hero) { open = snapshot(q); break; }
        break;
      }
      if (!open && roundClosed() && st.street !== 'river' && active().filter((q) => !st.allin[q]).length > 1) {
        const nextStreet = STREETS[STREETS.indexOf(st.street) + 1];
        const b = parsed.boardByStreet[nextStreet];
        if (b && b.length) {
          advanceStreet(nextStreet);
          if (nextToAct() === parsed.hero) open = snapshot(parsed.hero);
        }
      }
    }

    // Ergebnis bei Showdown (falls Gegnerkarten bekannt)
    let result = null;
    const finalActive = active();
    if (finalActive.length === 1) result = { winner: finalActive[0], pot: pot() };

    return { positions, stacks, timeline, spots, open, warnings, heroCards, pot: pot(), result, finalStreet: st.street };
  }

  SC.game = { replay, POS_DE, ORDER, concreteHeroCards };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
