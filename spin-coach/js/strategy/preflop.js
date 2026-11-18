/* Preflop-Empfehlungen.
   - Push/Fold bis 10 BB und Call vs. All-in: Nash-Gleichgewicht (tools/gen-pushfold.js) bzw. exakte EV-Rechnung
     gegen die Gleichgewichts-Range des Gegners mit den echten Pot-Odds.
   - Tiefere Stacks (Raise/Limp/Call): Modell-Ranges + EV-Rechnung, klar als Näherung gekennzeichnet. */
(function (SC) {
  'use strict';
  const C = SC.cards;
  const E = SC.equity;
  const N = C.N_CLASSES;
  const POS_DE = { BTN: 'Button', SB: 'Small Blind', BB: 'Big Blind' };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (S, s0, v0, s1, v1) => v0 + (v1 - v0) * clamp((S - s0) / (s1 - s0), 0, 1);
  const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('de-DE');
  const pct = (x) => fmt(x * 100, 0) + ' %';
  const PUSHFOLD_MAX = 10;

  /* ---------- Nash-Tabellen ---------- */
  const NODE_DE = {
    btnPush: 'Button All-in (first in)', sbCall: 'Small Blind callt Button-All-in', bbCall: 'Big Blind callt Button-All-in',
    bbOver: 'Big Blind overcallt (Button All-in + SB Call)', sbPush: 'Small Blind All-in (Button gefoldet)',
    bbCallSb: 'Big Blind callt SB-All-in', huPush: 'Heads-up: Small Blind All-in', huCall: 'Heads-up: Big Blind callt',
  };

  function nash(node, stack, cls) {
    const d = SC.data.PUSHFOLD;
    const s = clamp(stack, 1, 25);
    const lo = Math.floor(s), hi = Math.ceil(s), t = s - lo;
    const f = d.nodes[node].freq, e = d.nodes[node].ev;
    return {
      freq: f[lo - 1][cls] * (1 - t) + f[hi - 1][cls] * t,
      ev: e[lo - 1][cls] * (1 - t) + e[hi - 1][cls] * t,
    };
  }
  function nashRange(node, stack) {
    const r = E.emptyRange();
    for (let a = 0; a < N; a++) r[a] = nash(node, stack, a).freq / 100;
    return r;
  }

  /* ---------- Modell für tiefere Stacks (Näherung) ---------- */
  const model = {
    btnOpenPct: (S) => lerp(S, 11, 44, 25, 50),
    sbRaisePct: 12, sbLimpTo: 72,
    huOpenPct: (S) => lerp(S, 11, 70, 25, 80),
    bbIsoPct: 32,
    reshovePct: (S, villainPos, heroPos) => {
      let p = lerp(S, 10, 30, 25, 12);
      if (villainPos === 'SB') p *= 0.85;
      if (villainPos === 'BB' && heroPos === 'SB') p *= 1.25;
      return clamp(p, 6, 45);
    },
  };

  /* Wahrscheinliche Range eines Spielers nach seiner Preflop-Aktion (für Gegner und Range-Vorteil). */
  function actionRange(pos, line, S, players) {
    // line: { type: 'open'|'limp'|'call'|'check'|'allin'|'reraise', vs: Position des Aggressors, multi }
    const P = (hi, lo) => E.percentRange(hi, lo);
    const t = line.type;
    if (t === 'allin') {
      if (line.firstIn) {
        const node = players === 2 ? 'huPush' : pos === 'BTN' ? 'btnPush' : 'sbPush';
        if (S <= 25) return nashRange(node, S);
      }
      return P(model.reshovePct(S, pos, line.vs));
    }
    if (t === 'open') {
      if (players === 2) return P(model.huOpenPct(S));
      if (pos === 'BTN') return P(model.btnOpenPct(S));
      if (pos === 'SB') return P(model.sbRaisePct);
      return P(model.bbIsoPct);
    }
    if (t === 'limp') {
      if (players === 2) return P(85, model.huOpenPct(S) * 0.5);
      if (pos === 'SB') return P(model.sbLimpTo, model.sbRaisePct);
      return P(55, 10);
    }
    if (t === 'iso') return P(model.bbIsoPct);
    if (t === 'check') {
      // BB checkt nach Limp: alles außer seiner Iso-Range
      return P(100, model.bbIsoPct * 0.8);
    }
    if (t === 'call') {
      if (pos === 'BB') return P(line.multi ? 60 : 68, 6);
      if (pos === 'SB') return P(32, 6);
      return P(35, 6);
    }
    if (t === 'reraise') return P(model.reshovePct(S, pos, line.vs));
    return E.fullRange();
  }

  /* ---------- EV-Bausteine ---------- */

  // Equity der Heldenhand gegen eine oder mehrere Ranges (preflop)
  function heroEquity(spot, ranges) {
    if (ranges.length === 1) return E.classVsRange(spot.heroClass, ranges[0]);
    const cards = spot.heroCards || C.CLASS_COMBOS[spot.heroClass][0];
    return E.handVsRanges(cards, [], ranges, 5000).equity;
  }

  // Pot, den der Held bei einem All-in-Showdown gegen Gegner mit gegebenem Endeinsatz gewinnen kann
  function showdownPot(spot, finalInv) {
    const heroCap = finalInv[spot.hero];
    let pot = 0;
    for (const p of spot.positions) pot += Math.min(finalInv[p] !== undefined ? finalInv[p] : spot.inv[p], heroCap);
    return pot;
  }

  // EV(Call) gegen bereits gesetzte All-ins (relativ zu Fold, investierte Chips sind verloren)
  function callAllinEV(spot, villainRanges) {
    const eq = heroEquity(spot, villainRanges);
    const finalInv = Object.assign({}, spot.inv);
    finalInv[spot.hero] = spot.inv[spot.hero] + spot.toCall;
    const pot = showdownPot(spot, finalInv);
    const need = spot.toCall / pot;
    return { eq, pot, need, ev: eq * pot - spot.toCall };
  }

  /* EV(All-in) des Helden. callers: [{pos, range}] Gegner, die noch reagieren.
     Jeder Gegner callt mit den Händen, die gegen die angenommene Shove-Range des Helden profitabel callen. */
  function shoveEV(spot, callers, heroShoveRange) {
    const heroTotal = spot.inv[spot.hero] + spot.behind[spot.hero];
    const res = { callers: [], pFoldAll: 1 };
    let evCalled = 0;
    for (const v of callers) {
      const vTotal = spot.inv[v.pos] + spot.behind[v.pos];
      const vFinal = Math.min(vTotal, heroTotal);
      const callAmt = vFinal - spot.inv[v.pos];
      const finalInv = Object.assign({}, spot.inv);
      finalInv[spot.hero] = Math.min(heroTotal, vTotal);
      finalInv[v.pos] = vFinal;
      let pot = 0;
      for (const p of spot.positions) pot += Math.min(finalInv[p], finalInv[spot.hero]);
      const need = callAmt / pot;
      const callRange = E.emptyRange();
      let callW = 0, allW = 0;
      for (let a = 0; a < N; a++) {
        if (!v.range[a]) continue;
        const w = v.range[a] * C.COMPAT[a * N + spot.heroClass]; // Kombos mit Card Removal
        allW += w;
        if (E.classVsRange(a, heroShoveRange) >= need) { callRange[a] = v.range[a]; callW += w; }
      }
      const pCall = allW > 0 ? callW / allW : 0;
      const eq = callW > 0 ? E.classVsRange(spot.heroClass, callRange) : 0.5;
      const heroRisk = finalInv[spot.hero] - spot.inv[spot.hero];
      res.callers.push({ pos: v.pos, pCall, eq, pot, callPct: E.rangePercent(callRange), need });
      evCalled += res.pFoldAll * pCall * (eq * pot - heroRisk);
      res.pFoldAll *= 1 - pCall;
    }
    res.foldPot = spot.pot;
    res.ev = res.pFoldAll * spot.pot + evCalled;
    return res;
  }

  // Grobe Realisierungsfaktoren für Calls ohne All-in
  function realization(spot, multiway) {
    const t = C.CLASS_TYPE[spot.heroClass];
    let r = spot.inPosition ? 0.92 : 0.78;
    if (t === 'pair' || t === 'suited') r += 0.05;
    if (t === 'offsuit' && C.CLASS_HI[spot.heroClass] - C.CLASS_LO[spot.heroClass] > 4 && C.CLASS_HI[spot.heroClass] < 10) r -= 0.08;
    if (multiway) r -= 0.08;
    return r;
  }

  /* ---------- Entscheidungsbaum ---------- */

  function advise(spot) {
    const hero = spot.hero, n = spot.players;
    const hist = spot.history.filter((a) => a.street === 'preflop');
    const others = hist.filter((a) => a.pos !== hero && a.type !== 'fold');
    const heroPrev = hist.filter((a) => a.pos === hero);
    const lastAggr = [...hist].reverse().find((a) => a.type === 'raise' || a.type === 'allin');
    const facingAllin = spot.toCall > 0 && others.some((a) => a.type === 'allin' || a.allin);

    if (heroPrev.length === 0 && others.length === 0) return firstIn(spot);
    if (facingAllin) return facingShove(spot, hist, others, heroPrev);
    if (others.length && lastAggr && lastAggr.pos !== hero) return facingRaise(spot, hist, others, heroPrev, lastAggr);
    if (others.every((a) => a.type === 'call') && hero === 'BB' && spot.toCall === 0) return facingLimp(spot, others);
    if (others.every((a) => a.type === 'call')) return overLimp(spot, others);
    return generic(spot);
  }

  function result(spot, o) {
    return Object.assign({ street: 'preflop', lines: [], evs: null, freq: null }, o);
  }

  function firstIn(spot) {
    const n = spot.players, hero = spot.hero, cls = spot.heroClass;
    const S = spot.effStackStart;
    const name = C.CLASS_NAMES[cls];
    const node = n === 2 ? 'huPush' : hero === 'BTN' ? 'btnPush' : hero === 'SB' ? 'sbPush' : null;
    if (!node) return generic(spot);
    const ns = nash(node, S, cls);
    if (S <= PUSHFOLD_MAX) {
      const action = ns.freq >= 50 ? 'allin' : 'fold';
      const lines = [
        `Effektiver Stack ${fmt(S)} BB → Push/Fold-Bereich.`,
        `Nash-Gleichgewicht (${NODE_DE[node]}): ${name} wird zu ${fmt(ns.freq, 0)} % gepusht.`,
        `EV All-in gegenüber Fold: ${ns.ev >= 0 ? '+' : ''}${fmt(ns.ev, 2)} BB.`,
        `Gesamte Push-Range: ${fmt(E.rangePercent(nashRange(node, S)), 0)} % aller Hände.`,
      ];
      if (hero === 'SB' && n === 3 && S >= 7) lines.push('Hinweis: Solver mischen im SB auch Limps. Push/Fold ist hier eine sehr gute, einfache Näherung.');
      return result(spot, {
        action, source: 'nash', confidence: 'Gleichgewicht', freq: { allin: ns.freq, fold: 100 - ns.freq },
        evs: { fold: 0, allin: ns.ev }, lines, node, stack: S,
      });
    }
    // tiefer: Raise/Limp-Modell
    const rank = handRankPct(cls);
    const lines = [`Effektiver Stack ${fmt(S)} BB → kein reines Push/Fold mehr (Näherungsmodell).`, `${name} gehört zu den besten ${fmt(rank, 0)} % der Starthände.`];
    let action = 'fold', size = null;
    const shoveOk = S <= 15 && ns.freq >= 50 && rank > 10 && (C.CLASS_TYPE[cls] === 'pair' || C.CLASS_HI[cls] === 12);
    if (n === 2 && hero === 'SB') {
      const open = model.huOpenPct(S);
      lines.push(`Heads-up-Button öffnet etwa ${fmt(open, 0)} % mit Min-Raise (2 BB).`);
      if (shoveOk && S <= 13) { action = 'allin'; lines.push(`Bei ${fmt(S)} BB ist All-in mit ${name} besser als Raise/Fold (EV All-in ${fmt(ns.ev, 2)} BB, Nash-Push).`); }
      else if (rank <= open) { action = 'raise'; size = 2; }
    } else if (hero === 'BTN') {
      const open = model.btnOpenPct(S);
      lines.push(`Button öffnet 3-handed etwa ${fmt(open, 0)} % mit Min-Raise (2 BB).`);
      if (shoveOk) { action = 'allin'; lines.push(`Kleine Paare und schwache Asse spielen bei ${fmt(S)} BB lieber All-in (Nash-EV ${fmt(ns.ev, 2)} BB), weil sie einen Re-Shove schlecht callen können.`); }
      else if (rank <= open) { action = 'raise'; size = 2; }
    } else {
      lines.push(`Small Blind gegen Big Blind: Raise ~${model.sbRaisePct} % (stärkste Hände), Limp bis ~${model.sbLimpTo} %, Rest Fold.`);
      if (shoveOk) { action = 'allin'; lines.push(`Bei ${fmt(S)} BB lieber All-in als Limp (Nash-EV ${fmt(ns.ev, 2)} BB).`); }
      else if (rank <= model.sbRaisePct) { action = 'raise'; size = 3; }
      else if (rank <= model.sbLimpTo) action = 'limp';
    }
    return result(spot, { action, size, source: 'model', confidence: 'Näherung', lines, stack: S });
  }

  function handRankPct(cls) {
    const order = E.handOrder();
    let acc = 0;
    for (const a of order) {
      acc += C.CLASS_NCOMBOS[a] / 1326 * 100;
      if (a === cls) return acc;
    }
    return 100;
  }

  function facingShove(spot, hist, others, heroPrev) {
    const hero = spot.hero, n = spot.players, cls = spot.heroClass, name = C.CLASS_NAMES[cls];
    const shover = [...others].reverse().find((a) => a.type === 'allin' || a.allin);
    const shoverTotal = spot.stacks[shover.pos];
    const S = Math.min(spot.stacks[hero], shoverTotal);
    const firstInShove = hist.findIndex((a) => a === shover) === hist.findIndex((a) => a.type !== 'fold');
    const callers = others.filter((a) => a.type === 'call' && a.pos !== shover.pos);
    let node = null;
    if (heroPrev.length === 0 && firstInShove) {
      if (n === 2) node = 'huCall';
      else if (shover.pos === 'BTN' && hero === 'SB') node = 'sbCall';
      else if (shover.pos === 'BTN' && hero === 'BB') node = callers.length ? 'bbOver' : 'bbCall';
      else if (shover.pos === 'SB' && hero === 'BB') node = 'bbCallSb';
    }
    // Gegner-Ranges
    const ranges = [];
    let shoverRange;
    if (firstInShove && S <= 25) {
      const pushNode = n === 2 ? 'huPush' : shover.pos === 'BTN' ? 'btnPush' : 'sbPush';
      shoverRange = nashRange(pushNode, S);
    } else {
      shoverRange = actionRange(shover.pos, { type: 'reraise', vs: hero }, S, n);
    }
    ranges.push(shoverRange);
    for (const c of callers) ranges.push(node === 'bbOver' ? nashRange('sbCall', S) : actionRange(c.pos, { type: 'call' }, S, n));
    const m = callAllinEV(spot, ranges);
    const lines = [
      `${POS_DE[shover.pos]} ist All-in (${fmt(shoverTotal)} BB). Du musst ${fmt(spot.toCall)} BB in einen Pot von ${fmt(m.pot - spot.toCall)} BB zahlen.`,
      `Benötigte Equity (Pot-Odds): ${pct(m.need)}.`,
      `Deine Equity mit ${name} gegen die ${firstInShove && S <= 25 ? 'Gleichgewichts-' : 'angenommene '}Range (${fmt(E.rangePercent(shoverRange), 0)} %)${callers.length ? ' und den Caller' : ''}: ${pct(m.eq)}.`,
      `EV Call: ${m.ev >= 0 ? '+' : ''}${fmt(m.ev, 2)} BB gegenüber Fold.`,
    ];
    let action = m.ev > 0 ? 'call' : 'fold';
    let source = firstInShove && S <= 25 ? 'math' : 'model';
    let freq = null;
    const behind = spot.behindToAct.length > 0;
    if (node && S <= 25) {
      const ns = nash(node, S, cls);
      freq = { call: ns.freq, fold: 100 - ns.freq };
      lines.push(`Nash-Gleichgewicht (${NODE_DE[node]}): Call zu ${fmt(ns.freq, 0)} %.`);
      if (behind) {
        // Spieler dahinter kann noch overcallen: Nash-Lösung berücksichtigt das, die einfache Rechnung nicht
        action = ns.freq >= 50 ? 'call' : 'fold';
        source = 'nash';
        lines.push('Der Big Blind ist noch dahinter – maßgeblich ist hier die Nash-Lösung, die einen Overcall berücksichtigt.');
      }
    }
    if (!firstInShove) lines.push('Gegner-Range ist ein Re-Shove gegen deine Aktion – Größe der Range ist eine Modellannahme.');
    return result(spot, {
      action, source, confidence: source === 'model' ? 'Näherung' : source === 'nash' ? 'Gleichgewicht' : 'exakt (gegen GTO-Range)',
      evs: { fold: 0, call: m.ev }, freq, lines, node, stack: S, equity: m.eq, need: m.need,
    });
  }

  function facingRaise(spot, hist, others, heroPrev, raise) {
    const hero = spot.hero, n = spot.players, cls = spot.heroClass, name = C.CLASS_NAMES[cls];
    const S = spot.effStack;
    const opener = raise.pos;
    const raiserLine = heroPrev.length ? { type: 'iso' } : { type: 'open' };
    const villainRange = actionRange(opener, raiserLine, spot.effStackStart, n);
    const callersBefore = others.filter((a) => a.type === 'call' && hist.indexOf(a) > hist.indexOf(raise));
    const otherRanges = callersBefore.map((c) => actionRange(c.pos, { type: 'call', multi: true }, S, n));
    const lines = [`${POS_DE[opener]} erhöht auf ${fmt(raise.to)} BB. Modell-Range: ca. ${fmt(E.rangePercent(villainRange), 0)} %.`];
    // Call
    const multi = otherRanges.length > 0 || spot.behindToAct.length > 0;
    const eq = heroEquity(spot, [villainRange].concat(otherRanges));
    const R = realization(spot, multi);
    const callEV = eq * R * (spot.pot + spot.toCall) - spot.toCall;
    lines.push(`Equity gegen diese Range: ${pct(eq)}; realisiert etwa ${pct(eq * R)} (${spot.inPosition ? 'in Position' : 'out of Position'}).`);
    // All-in
    const callers = [{ pos: opener, range: villainRange }]
      .concat(callersBefore.map((c, k) => ({ pos: c.pos, range: otherRanges[k] })))
      .concat(spot.behindToAct.map((p) => ({ pos: p, range: E.fullRange() })));
    const heroShoveRange = E.percentRange(model.reshovePct(S, hero, opener));
    const sh = shoveEV(spot, callers, heroShoveRange);
    const evs = { fold: 0, call: callEV, allin: sh.ev };
    lines.push(`EV Call ≈ ${fmt(callEV, 2)} BB, EV All-in ≈ ${fmt(sh.ev, 2)} BB (Gegner folden ${pct(sh.pFoldAll)}).`);
    let action = 'fold';
    let best = 0;
    if (callEV > best) { action = 'call'; best = callEV; }
    if (sh.ev > best + 0.05 && S <= 30) { action = 'allin'; best = sh.ev; }
    if (S > 30 && sh.ev > best) lines.push('Bei so tiefen Stacks wäre statt All-in ein normaler 3-Bet sinnvoller.');
    return result(spot, { action, source: 'model', confidence: 'Näherung', evs, lines, equity: eq, stack: S });
  }

  function facingLimp(spot, limpers) {
    const n = spot.players, cls = spot.heroClass;
    const S = spot.effStack;
    const ranges = limpers.map((l) => actionRange(l.pos, { type: 'limp' }, spot.effStackStart, n));
    const eq = heroEquity(spot, ranges);
    const R = realization(spot, ranges.length > 1);
    const checkEV = eq * R * spot.pot;
    const callers = limpers.map((l, k) => ({ pos: l.pos, range: ranges[k] }));
    const sh = shoveEV(spot, callers, E.percentRange(35));
    const evs = { check: checkEV, allin: sh.ev };
    const lines = [
      `${limpers.map((l) => POS_DE[l.pos]).join(' und ')} ${limpers.length > 1 ? 'limpen' : 'limpt'}. Range ca. ${fmt(E.rangePercent(ranges[0]), 0)} % (ohne die stärksten Hände, die raisen).`,
      `Equity ${pct(eq)}. EV Check ≈ ${fmt(checkEV, 2)} BB (Anteil am Pot), EV All-in ≈ ${fmt(sh.ev, 2)} BB (Fold-Equity ${pct(sh.pFoldAll)}).`,
    ];
    let action = 'check', size = null;
    if (S <= 15 && sh.ev > checkEV + 0.1) action = 'allin';
    else if (handRankPct(cls) <= model.bbIsoPct && S > 10) {
      action = 'raise'; size = n === 2 ? 3 : 3.5;
      lines.push(`Mit Händen aus den besten ~${model.bbIsoPct} % raist du (Iso-Raise auf ${size} BB) für Value und Initiative.`);
    }
    return result(spot, { action, size, source: 'model', confidence: 'Näherung', evs, lines, equity: eq, stack: S });
  }

  function overLimp(spot, limpers) {
    // z. B. SB nach Button-Limp
    const cls = spot.heroClass;
    const rank = handRankPct(cls);
    const S = spot.effStack;
    const lines = ['Vor dir wurde gelimpt (selten in Spins). Näherung: starke Hände raisen/All-in, spielbare Hände completen, Rest fold.'];
    let action = 'fold';
    if (rank <= 12) action = S <= 15 ? 'allin' : 'raise';
    else if (rank <= 45) action = 'call';
    return result(spot, { action, size: action === 'raise' ? 4 : null, source: 'model', confidence: 'Näherung', lines, stack: S });
  }

  function generic(spot) {
    const eq = E.classVsRange(spot.heroClass, E.percentRange(15));
    const need = spot.toCall > 0 ? spot.toCall / (spot.pot + spot.toCall) : 0;
    const action = spot.toCall === 0 ? 'check' : eq >= need ? 'call' : 'fold';
    return result(spot, {
      action, source: 'model', confidence: 'grobe Näherung', equity: eq, need,
      lines: [`Seltener Spot. Grobe Rechnung: Equity gegen starke Range (Top 15 %) ${pct(eq)}, benötigt ${pct(need)}.`],
    });
  }

  SC.preflop = { advise, nash, nashRange, actionRange, model, handRankPct, NODE_DE, PUSHFOLD_MAX, callAllinEV, shoveEV };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
