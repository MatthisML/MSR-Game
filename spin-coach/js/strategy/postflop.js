/* Postflop-Empfehlungen (GTO-nahe Heuristik, kein Solver):
   Gegner-Range aus der Preflop-Linie, eingeengt durch jede Aktion auf Flop/Turn/River.
   Entscheidung über Equity gegen diese Range, Pot-Odds, MDF, Draws, SPR, Board-Textur und Range-Vorteil. */
(function (SC) {
  'use strict';
  const C = SC.cards;
  const E = SC.equity;
  const PF = SC.preflop;
  const ev7 = SC.evaluator.evaluate;
  const { STRAIGHT_HIGH } = SC.evaluator;
  const POS_DE = { BTN: 'Button', SB: 'Small Blind', BB: 'Big Blind' };
  const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('de-DE');
  const pct = (x) => fmt(x * 100, 0) + ' %';
  const STREET_DE = { flop: 'Flop', turn: 'Turn', river: 'River' };

  /* ---------- Hand- und Board-Analyse ---------- */

  function texture(board) {
    const suits = [0, 0, 0, 0];
    const ranks = board.map(C.rankOf);
    for (const c of board) suits[C.suitOf(c)]++;
    const maxSuit = Math.max(...suits);
    const uniq = [...new Set(ranks)].sort((a, b) => b - a);
    const paired = uniq.length < ranks.length;
    let mask = 0; for (const r of ranks) mask |= 1 << r;
    // Anzahl Rang-Paare (x, y), mit denen eine Straße möglich ist
    let straightCombos = 0;
    for (let x = 0; x < 13; x++) for (let y = x; y < 13; y++) {
      const m = mask | (1 << x) | (1 << y);
      if (STRAIGHT_HIGH[m] >= 0) straightCombos++;
    }
    let straightNow = false;
    for (let x = 0; x < 13 && !straightNow; x++) for (let y = x; y < 13; y++) {
      if (STRAIGHT_HIGH[mask | (1 << x) | (1 << y)] >= 0) { straightNow = true; break; }
    }
    const flushPossible = maxSuit >= 3;
    const flushDraw = board.length < 5 && maxSuit === 2;
    let wet = 0;
    if (maxSuit >= 3) wet += 0.45; else if (flushDraw) wet += 0.25;
    wet += Math.min(0.45, straightCombos * 0.04);
    if (paired) wet -= 0.1;
    wet = Math.max(0, Math.min(1, wet));
    const parts = [];
    parts.push(maxSuit >= 3 ? (board.length === 3 ? 'monoton' : 'Flush möglich') : maxSuit === 2 && board.length < 5 ? 'zweifarbig' : 'rainbow');
    if (paired) parts.push('gepaart');
    if (straightCombos >= 6) parts.push('verbunden');
    parts.push(uniq[0] >= 8 ? 'hoch' : 'niedrig');
    return { wet, dry: wet < 0.35, maxSuit, paired, straightCombos, flushPossible, straightNow, high: uniq[0], desc: parts.join(', ') };
  }

  function handFeatures(hole, board) {
    const all = hole.concat(board);
    const score = ev7(all, all.length);
    const cat = score >> 20;
    const boardScore = ev7(board, board.length);
    const boardCat = boardScore >> 20;
    const br = board.map(C.rankOf).sort((a, b) => b - a);
    const h = hole.map(C.rankOf).sort((a, b) => b - a);
    const pocket = h[0] === h[1];
    let desc = SC.evaluator.CATEGORY_DE[cat];
    let made = cat; // grobe Stärke
    if (cat === 1) {
      const pr = (score >> 16) & 15;
      if (boardCat === 1 && !h.includes(pr)) { desc = 'Nur Board-Paar'; made = 0; }
      else if (pocket && pr > br[0]) desc = 'Overpair';
      else if (pocket) desc = pr > br[br.length - 1] ? 'Pocket Pair unter Top-Karte' : 'Underpair';
      else if (pr === br[0]) { const k = h[0] === pr ? h[1] : h[0]; desc = 'Top Pair' + (k >= 10 ? ', guter Kicker' : k >= 7 ? ', mittlerer Kicker' : ', schwacher Kicker'); }
      else if (pr === br[1]) desc = 'Middle Pair';
      else desc = 'Bottom Pair';
    } else if (cat === 2) {
      const p1 = (score >> 16) & 15, p2 = (score >> 12) & 15;
      const usesBoth = h.includes(p1) && h.includes(p2);
      if (boardCat >= 1 && !(usesBoth)) { desc = h.includes(p1) || h.includes(p2) ? 'Paar + Board-Paar' : 'Nur Board-Paare'; made = h.includes(p1) || h.includes(p2) ? 1 : 0; }
      else desc = pocket ? 'Zwei Paare (Pocket Pair)' : 'Zwei Paare';
    } else if (cat === 3) {
      desc = pocket ? 'Set' : boardCat >= 3 ? 'Drilling auf dem Board' : 'Trips';
      if (boardCat >= 3) made = 0;
    } else if (cat > 3 && boardScore >= score) { desc += ' (spielt das Board)'; made = 0; }

    // Draws
    const draws = [];
    let outs = 0;
    if (board.length < 5 && cat < 5) {
      for (let s = 0; s < 4; s++) {
        const n = all.filter((c) => C.suitOf(c) === s).length;
        const heroIn = hole.filter((c) => C.suitOf(c) === s);
        if (n === 4 && heroIn.length) {
          const topHero = Math.max(...heroIn.map(C.rankOf));
          const higherMissing = [];
          for (let r = 12; r > topHero; r--) if (!board.some((c) => C.suitOf(c) === s && C.rankOf(c) === r)) higherMissing.push(r);
          draws.push(higherMissing.length === 0 ? 'Nut-Flush-Draw' : 'Flush-Draw');
          outs += 9;
        } else if (n === 3 && heroIn.length && board.length === 3) draws.push('Backdoor-Flush-Draw');
      }
      if (cat < 4) {
        let mask = 0; for (const c of all) mask |= 1 << C.rankOf(c);
        let bmask = 0; for (const c of board) bmask |= 1 << C.rankOf(c);
        let sRanks = 0;
        for (let r = 0; r < 13; r++) {
          if (mask & (1 << r)) continue;
          if (STRAIGHT_HIGH[mask | (1 << r)] >= 0 && STRAIGHT_HIGH[bmask | (1 << r)] < 0) sRanks++;
        }
        if (sRanks >= 2) { draws.push('Open-Ender'); outs += draws.some((d) => d.includes('Flush-Draw') && !d.includes('Backdoor')) ? 6 : 8; }
        else if (sRanks === 1) { draws.push('Gutshot'); outs += draws.some((d) => d.includes('Flush-Draw') && !d.includes('Backdoor')) ? 3 : 4; }
      }
      if (made === 0 && h[1] > br[0]) { draws.push('Zwei Overcards'); outs += 6; }
      else if (made === 0 && h[0] > br[0]) { draws.push('Overcard'); outs += 3; }
    }
    return { score, cat, made, desc, draws, outs, strongDraw: outs >= 12 };
  }

  /* ---------- Ranges als Kombos ---------- */

  function preflopLine(history, pos, players) {
    const pre = history.filter((a) => a.street === 'preflop');
    let raises = 0, limps = 0, line = null;
    let lastAggressor = null;
    for (const a of pre) {
      if (a.type === 'raise' || a.type === 'allin') {
        if (a.pos === pos) line = { type: raises === 0 ? (limps ? 'iso' : 'open') : 'reraise' };
        raises++; lastAggressor = a.pos;
      } else if (a.type === 'call') {
        if (a.pos === pos) line = raises === 0 ? { type: 'limp' } : { type: 'call', multi: pre.filter((x) => x.type === 'call').length > 1 };
        if (raises === 0) limps++;
      } else if (a.type === 'check' && a.pos === pos) line = { type: 'check' };
    }
    return { line: line || { type: 'check' }, aggressor: lastAggressor };
  }

  function comboRange(classRange, dead) {
    const out = [];
    for (let a = 0; a < C.N_CLASSES; a++) {
      if (!classRange[a]) continue;
      for (const [x, y] of C.CLASS_COMBOS[a]) {
        if (dead.has(x) || dead.has(y)) continue;
        out.push({ c: [x, y], w: classRange[a] });
      }
    }
    return out;
  }

  /* Range nach einer Aktion auf dem Board einengen. */
  function narrow(combos, board, action, potBefore, betSize, street) {
    const live = combos.filter((x) => !board.includes(x.c[0]) && !board.includes(x.c[1]) && x.w > 0);
    if (!live.length) return live;
    const feats = live.map((x) => handFeatures(x.c, board));
    const order = live.map((x, i) => i).sort((i, j) => feats[i].score - feats[j].score);
    const pctl = new Float64Array(live.length);
    order.forEach((idx, k) => { pctl[idx] = (k + 0.5) / live.length; });
    const isDraw = (f) => f.outs >= 8;
    const out = live.map((x, i) => ({ c: x.c, w: x.w, p: pctl[i], f: feats[i] }));
    const river = street === 'river';
    if (action === 'bet' || action === 'raise' || action === 'allin') {
      const b = potBefore > 0 ? betSize / potBefore : 1;
      const valueCut = action === 'bet' ? 0.55 : 0.72;
      let valueMass = 0, airMass = 0;
      for (const x of out) {
        if (x.p >= valueCut && x.f.made >= 1) { valueMass += x.w; x.k = 'v'; }
        else if (!river && isDraw(x.f)) { x.w *= action === 'bet' ? 0.85 : 0.55; valueMass += x.w; x.k = 'd'; }
        else { airMass += x.w; x.k = 'a'; }
      }
      // Bluff-Anteil nach Einsatzgröße: Bluffs : Value = b / (1 + b), auf früheren Straßen mehr
      const mult = river ? 1 : street === 'turn' ? 1.3 : 1.7;
      const wantBluff = valueMass * (b / (1 + b)) * mult * (action === 'bet' ? 1 : 0.6);
      const alpha = airMass > 0 ? Math.min(1, wantBluff / airMass) : 0;
      for (const x of out) if (x.k === 'a') x.w *= alpha;
    } else if (action === 'check') {
      for (const x of out) if (x.p >= 0.8 && x.f.made >= 2) x.w *= 0.45; // nur ein Teil slowplayt
    } else if (action === 'call') {
      for (const x of out) {
        if (x.p >= 0.92 && x.f.made >= 2) x.w *= 0.6; // hätte oft geraist
        else if (x.f.made === 0 && !isDraw(x.f)) x.w *= river ? 0.05 : 0.2; // Luft foldet meistens
      }
    }
    return out.filter((x) => x.w > 0.001).map((x) => ({ c: x.c, w: x.w }));
  }

  /* Range eines Spielers zum aktuellen Zeitpunkt der Hand. */
  function currentRange(spot, pos, dead) {
    const { line } = preflopLine(spot.history, pos, spot.players);
    const classRange = PF.actionRange(pos, line, spot.effStackStart, spot.players);
    let combos = comboRange(classRange, dead);
    const boardFull = spot.board;
    const boardAt = { flop: boardFull.slice(0, 3), turn: boardFull.slice(0, 4), river: boardFull.slice(0, 5) };
    for (const a of spot.history) {
      if (a.street === 'preflop' || a.pos !== pos) continue;
      if (a.type === 'fold') continue;
      const potBefore = a.pot - (a.amount || 0);
      combos = narrow(combos, boardAt[a.street], a.type, potBefore, a.amount || 0, a.street);
    }
    return { combos, line };
  }

  /* ---------- Equity gegen Kombo-Ranges ---------- */

  function equityVsCombos(hero, board, ranges, samples) {
    const rng = Math.random;
    const dead = new Set(hero.concat(board));
    const lists = ranges.map((r) => r.filter((x) => !dead.has(x.c[0]) && !dead.has(x.c[1])));
    if (lists.some((l) => !l.length)) return { equity: 1, samples: 0 };
    const hh = new Int32Array(7), vh = new Int32Array(7);
    // exakt: ein Gegner, Turn oder River
    if (lists.length === 1 && board.length >= 4) {
      let num = 0, den = 0;
      const rivers = board.length === 5 ? [null] : [...Array(52).keys()].filter((c) => !dead.has(c));
      for (const x of lists[0]) {
        for (const r of rivers) {
          if (r !== null && (r === x.c[0] || r === x.c[1])) continue;
          const b = r === null ? board : board.concat([r]);
          hh[0] = hero[0]; hh[1] = hero[1]; vh[0] = x.c[0]; vh[1] = x.c[1];
          for (let i = 0; i < 5; i++) { hh[2 + i] = b[i]; vh[2 + i] = b[i]; }
          const a = ev7(hh, 7), v = ev7(vh, 7);
          num += x.w * (a > v ? 1 : a === v ? 0.5 : 0); den += x.w;
        }
      }
      return { equity: den ? num / den : 0.5, exact: true };
    }
    const cum = lists.map((l) => { let t = 0; return { l, c: l.map((x) => (t += x.w)), t }; });
    const pick = (o) => { const x = rng() * o.t; let lo = 0, hi = o.c.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (o.c[m] < x) lo = m + 1; else hi = m; } return o.l[lo].c; };
    samples = samples || 5000;
    const used = new Uint8Array(52);
    let eq = 0, done = 0, guard = 0;
    const full = new Int32Array(5);
    while (done < samples && guard++ < samples * 20) {
      used.fill(0);
      for (const c of dead) used[c] = 1;
      const vs = [];
      let ok = true;
      for (const o of cum) { const v = pick(o); if (used[v[0]] || used[v[1]]) { ok = false; break; } used[v[0]] = used[v[1]] = 1; vs.push(v); }
      if (!ok) continue;
      for (let i = 0; i < board.length; i++) full[i] = board[i];
      for (let i = board.length; i < 5; i++) { let c; do { c = (rng() * 52) | 0; } while (used[c]); used[c] = 1; full[i] = c; }
      hh[0] = hero[0]; hh[1] = hero[1];
      for (let i = 0; i < 5; i++) hh[2 + i] = full[i];
      const hs = ev7(hh, 7);
      let best = 0, nb = 0;
      for (const v of vs) { vh[0] = v[0]; vh[1] = v[1]; for (let i = 0; i < 5; i++) vh[2 + i] = full[i]; const s = ev7(vh, 7); if (s > best) { best = s; nb = 1; } else if (s === best) nb++; }
      eq += hs > best ? 1 : hs === best ? 1 / (nb + 1) : 0;
      done++;
    }
    return { equity: done ? eq / done : 0.5, samples: done };
  }

  function rangeVsRangeCombos(a, b, board, samples) {
    const rng = Math.random;
    const mk = (l) => { let t = 0; return { l, c: l.map((x) => (t += x.w)), t }; };
    const A = mk(a), B = mk(b);
    if (!A.l.length || !B.l.length) return 0.5;
    const pick = (o) => { const x = rng() * o.t; let lo = 0, hi = o.c.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (o.c[m] < x) lo = m + 1; else hi = m; } return o.l[lo].c; };
    const used = new Uint8Array(52);
    const ha = new Int32Array(7), hb = new Int32Array(7), full = new Int32Array(5);
    let eq = 0, done = 0, guard = 0;
    samples = samples || 2500;
    while (done < samples && guard++ < samples * 20) {
      const x = pick(A), y = pick(B);
      if (x[0] === y[0] || x[0] === y[1] || x[1] === y[0] || x[1] === y[1]) continue;
      used.fill(0); for (const c of board) used[c] = 1; used[x[0]] = used[x[1]] = used[y[0]] = used[y[1]] = 1;
      for (let i = 0; i < board.length; i++) full[i] = board[i];
      for (let i = board.length; i < 5; i++) { let c; do { c = (rng() * 52) | 0; } while (used[c]); used[c] = 1; full[i] = c; }
      ha[0] = x[0]; ha[1] = x[1]; hb[0] = y[0]; hb[1] = y[1];
      for (let i = 0; i < 5; i++) { ha[2 + i] = full[i]; hb[2 + i] = full[i]; }
      const sa = ev7(ha, 7), sb = ev7(hb, 7);
      eq += sa > sb ? 1 : sa === sb ? 0.5 : 0; done++;
    }
    return done ? eq / done : 0.5;
  }

  /* Perzentil der Heldenhand innerhalb der eigenen Range (nach aktueller Handstärke inkl. Draws). */
  function rangePercentile(heroCards, heroCombos, board) {
    const strength = (c) => { const f = handFeatures(c, board); return f.score + (board.length < 5 ? f.outs * 25000 : 0); };
    const hs = strength(heroCards);
    let below = 0, tot = 0;
    for (const x of heroCombos) {
      if (board.includes(x.c[0]) || board.includes(x.c[1])) continue;
      const s = strength(x.c);
      tot += x.w; if (s < hs) below += x.w; else if (s === hs) below += x.w / 2;
    }
    return tot ? below / tot : 0.5;
  }

  /* ---------- Empfehlung ---------- */

  function advise(spot) {
    const hero = spot.hero;
    const heroCards = spot.heroCards;
    const board = spot.board;
    const street = spot.street;
    const dead = new Set(heroCards.concat(board));
    const opp = spot.opponents;
    const lines = [];
    const tex = texture(board);
    const feat = handFeatures(heroCards, board);

    const villains = opp.map((p) => Object.assign({ pos: p }, currentRange(spot, p, dead)));
    const heroR = currentRange(spot, hero, new Set(board));
    const eqRes = equityVsCombos(heroCards, board, villains.map((v) => v.combos), opp.length > 1 ? 4000 : 6000);
    const eq = eqRes.equity;
    const { aggressor } = preflopLine(spot.history, hero, spot.players);
    const heroAggressor = lastAggressor(spot) === hero;
    const potNow = spot.pot;
    const behind = spot.behind[hero];
    const spr = behind / Math.max(potNow, 0.01);
    let raVal = 0.5;
    if (opp.length === 1) raVal = rangeVsRangeCombos(heroR.combos, villains[0].combos, board, 2000);
    const multi = opp.length > 1;

    lines.push(`${STREET_DE[street]} ${board.map(C.cardLabel).join(' ')} (${tex.desc}). Pot ${fmt(potNow)} BB, dein Stack ${fmt(behind)} BB, SPR ${fmt(spr, 1)}.`);
    lines.push(`Deine Hand: ${feat.desc}${feat.draws.length ? ' + ' + feat.draws.join(', ') : ''}${feat.outs && street !== 'river' ? ` (~${feat.outs} Outs)` : ''}.`);
    for (const v of villains) {
      lines.push(`Range ${POS_DE[v.pos]} (${lineDE(v.line)}): ~${countCombos(v.combos)} Kombos nach seinen Aktionen.`);
    }
    lines.push(`Equity gegen ${multi ? 'beide Ranges' : 'diese Range'}: ${pct(eq)}${eqRes.exact ? ' (exakt)' : ''}.`);
    if (!multi) lines.push(`Range-Vorteil: deine Range hat ${pct(raVal)} Equity gegen seine${raVal >= 0.55 ? ' → du hast den Range-Vorteil' : raVal <= 0.45 ? ' → er hat den Range-Vorteil' : ''}.`);

    const rec = { street, source: 'heuristic', confidence: 'Näherung (kein Solver)', lines, equity: eq, texture: tex, features: feat, spr };

    if (spot.toCall > 0) {
      const toCall = spot.toCall;
      const need = toCall / (potNow + toCall);
      const lastBet = [...spot.history].reverse().find((a) => a.street === street && (a.type === 'bet' || a.type === 'raise' || a.type === 'allin'));
      const potBeforeBet = potNow - (lastBet ? lastBet.amount : toCall);
      const betFrac = potBeforeBet > 0 ? (lastBet ? lastBet.amount : toCall) / potBeforeBet : 1;
      const mdf = potBeforeBet / (potBeforeBet + (lastBet ? lastBet.amount : toCall));
      const perc = rangePercentile(heroCards, heroR.combos, board);
      const villainAllin = opp.some((p) => spot.allin[p]);
      const allinCall = villainAllin || toCall >= behind - 0.01;
      lines.push(`Du musst ${fmt(toCall)} BB in ${fmt(potNow + toCall)} BB zahlen → benötigte Equity ${pct(need)}.`);
      lines.push(`MDF (Minimum Defense Frequency) gegen ${pct(betFrac)}-Pot-Bet: ${pct(mdf)}. Deine Hand liegt bei ${pct(perc)} deiner Range (höher = stärker).`);
      const realize = allinCall || street === 'river' ? 1 : spot.inPosition ? 0.95 : 0.88;
      const implied = !allinCall && street !== 'river' && feat.outs >= 8 && spr > 1.5 ? Math.min(0.06, feat.outs * 0.004) : 0;
      const eqR = eq * realize + implied;
      const evCall = eq * (potNow + toCall) - toCall;
      rec.need = need; rec.mdf = mdf; rec.percentile = perc;
      rec.evs = { fold: 0, call: evCall };
      const gtoDefend = perc >= 1 - mdf;
      if (allinCall) {
        rec.action = eq >= need ? 'call' : 'fold';
        rec.source = 'math'; rec.confidence = 'exakt gegen Modell-Range';
        lines.push(`All-in-Entscheidung: Equity ${pct(eq)} ${eq >= need ? '≥' : '<'} ${pct(need)} → ${eq >= need ? 'Call' : 'Fold'} (EV Call ${fmt(evCall, 2)} BB).`);
      } else if (eq >= 0.72 - (multi ? 0 : 0.04) && feat.made >= 1) {
        const raiseTo = spot.currentBet * 3;
        const allin = raiseTo >= (behind + spot.streetInv[hero]) * 0.5 || spr < 2.5;
        rec.action = allin ? 'allin' : 'raise'; rec.size = allin ? null : Math.round(raiseTo * 10) / 10;
        lines.push(`Du bist gegen seine Bet-Range klar vorne → Raise für Value${allin ? ' (bei diesem SPR direkt All-in)' : ` auf ca. ${fmt(raiseTo)} BB`}.`);
      } else if (feat.strongDraw && street !== 'river' && spr <= 4 && !multi) {
        rec.action = 'allin';
        lines.push(`Starker Draw (${feat.outs} Outs) bei niedrigem SPR → Semi-Bluff All-in: Fold-Equity + ${pct(eq)} Equity, wenn gecallt.`);
      } else if (eqR >= need) {
        rec.action = 'call';
        lines.push(`Equity (realisiert ${pct(eqR)}${implied ? ', inkl. Implied Odds' : ''}) reicht für einen Call.`);
        if (feat.outs >= 8 && street !== 'river' && !multi && spr <= 4) {
          rec.mixed = 'allin';
          lines.push(`Mit ${feat.draws.join(' + ')} ist auch ein Semi-Bluff-Raise (All-in) gut: GTO mischt hier Call und Raise.`);
        }
      } else {
        rec.action = 'fold';
        lines.push(`Equity (realisiert ${pct(eqR)}) reicht nicht → Fold.`);
      }
      if (!allinCall) {
        if (rec.action === 'fold' && gtoDefend) lines.push('GTO-Check: Nach MDF gehört die Hand eher zur Verteidigungs-Range. Gegen Spieler, die zu wenig bluffen, ist der Fold richtig, gegen aggressive Gegner eher Call.');
        if (rec.action === 'call' && !gtoDefend) lines.push('GTO-Check: Nach MDF wäre die Hand eher ein Fold, die Pot-Odds gegen die Modell-Range sprechen aber für den Call.');
      }
      rec.borderline = Math.abs(eqR - need) < 0.03;
      if (rec.borderline && (rec.action === 'call' || rec.action === 'fold')) lines.push('Knappe Entscheidung – beide Optionen sind vertretbar.');
    } else {
      const strong = eq >= (multi ? 0.6 : 0.66) && feat.made >= 1;
      const medium = eq >= 0.42;
      const sizeFor = (wet) => (street === 'river' ? (eq >= 0.85 ? 0.75 : 0.66) : wet ? 0.66 : 0.33);
      const betSize = (frac) => Math.round(potNow * frac * 10) / 10;
      const toAllin = (frac) => spr <= 1.5 || behind - betSize(frac) < (potNow + 2 * betSize(frac)) * 0.75;
      if (strong) {
        const f = sizeFor(!tex.dry);
        rec.action = toAllin(f) ? 'allin' : 'bet'; rec.size = rec.action === 'bet' ? betSize(f) : null; rec.sizePct = f;
        lines.push(`Value-Bet: Du bist vorne gegen seine Range. ${tex.dry ? 'Trockenes Board → kleine Größe' : 'Nasses Board → größere Größe, Draws zahlen lassen'}${rec.size ? ` (~${pct(f)} Pot = ${fmt(rec.size)} BB)` : ' – bei diesem SPR direkt All-in'}.`);
      } else if (street !== 'river' && feat.outs >= 8 && (heroAggressor || spot.inPosition) && !multi) {
        const f = tex.dry ? 0.5 : 0.66;
        rec.action = toAllin(f) ? 'allin' : 'bet'; rec.size = rec.action === 'bet' ? betSize(f) : null; rec.sizePct = f;
        lines.push(`Semi-Bluff mit ${feat.draws.join(' + ')}: Fold-Equity plus ${feat.outs} Outs, wenn gecallt.`);
      } else if (street === 'flop' && heroAggressor && !multi && raVal >= 0.53 && tex.dry) {
        rec.action = 'bet'; rec.size = betSize(0.33); rec.sizePct = 0.33;
        lines.push(`Range-Bet: Du hast als Preflop-Aggressor den Range-Vorteil auf einem trockenen Board → kleine C-Bet (33 %) mit fast der ganzen Range.`);
      } else if (medium) {
        rec.action = 'check';
        lines.push(`Mittlere Stärke (Showdown-Value): Check zur Pot-Kontrolle. Bets würden meist nur bessere Hände callen lassen.`);
      } else if (street === 'river' && heroAggressor && !multi && eq < 0.15 && raVal >= 0.5) {
        rec.action = 'check'; rec.mixed = 'bet';
        lines.push('Schwächste Hand deiner Range: GTO blufft hiermit teilweise (vor allem mit Blockern). Gegen Calling Stations einfach aufgeben.');
      } else {
        rec.action = 'check';
        lines.push(`Zu schwach zum Value-Betten und kein guter Bluff-Kandidat → Check${street === 'river' ? ' und meist aufgeben' : ''}.`);
      }
    }
    return rec;
  }

  function lastAggressor(spot) {
    const pre = spot.history.filter((a) => a.street !== spot.street);
    const ag = [...pre].reverse().find((a) => a.type === 'raise' || a.type === 'bet' || a.type === 'allin');
    return ag ? ag.pos : null;
  }
  const countCombos = (combos) => Math.round(combos.reduce((s, x) => s + x.w, 0));
  const lineDE = (l) => ({ open: 'Open-Raise', iso: 'Iso-Raise', reraise: '3-Bet', limp: 'Limp', call: 'Call', check: 'Check' }[l.type] || l.type);

  SC.postflop = { advise, texture, handFeatures, currentRange, equityVsCombos, narrow, preflopLine, rangePercentile };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
