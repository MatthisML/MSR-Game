/* Verbindet Parser, Hand-Simulation und Strategie: bewertet jede Entscheidung einer Hand. */
(function (SC) {
  'use strict';
  const C = SC.cards;

  const ACTION_DE = { fold: 'Fold', check: 'Check', call: 'Call', limp: 'Limp', bet: 'Bet', raise: 'Raise', allin: 'All-in' };
  const GROUP = { fold: 'fold', check: 'passive', call: 'passive', limp: 'passive', bet: 'aggr', raise: 'aggr', allin: 'aggr' };

  function actionLabel(a) {
    if (!a) return '–';
    let s = ACTION_DE[a.type] || a.type;
    if ((a.type === 'raise' || a.type === 'bet') && (a.size || a.to)) s += ' ' + fmtBB(a.size || a.to);
    return s;
  }
  const fmtBB = (x) => (Math.round(x * 10) / 10).toLocaleString('de-DE') + ' BB';

  function recommend(spot) {
    if (spot.street === 'preflop') return SC.preflop.advise(spot);
    return SC.postflop.advise(spot);
  }

  /* Heldenaktion mit Empfehlung vergleichen → { grade: 'gut'|'ok'|'fehler', evLoss, note } */
  function grade(rec, heroAction, spot) {
    let h = heroAction.type;
    // Limp/Complete preflop ohne Raise: Call == Limp
    if (spot.street === 'preflop' && h === 'call' && spot.toCall <= 0.5 + 1e-9 && spot.currentBet <= 1) h = 'limp';
    if (spot.street === 'preflop' && h === 'check') h = 'check';
    // großer Raise mit kurzem Stack ≈ All-in
    if (h === 'raise' && heroAction.to && heroAction.to >= 0.6 * (spot.behind[spot.hero] + spot.streetInv[spot.hero])) h = 'allin';
    const r = rec.action;
    const out = { heroType: h, recType: r, evLoss: null, grade: 'fehler', note: '' };

    // EV-Verlust, wenn beide Optionen bewertet sind
    if (rec.evs) {
      const evOf = (t) => {
        if (t in rec.evs) return rec.evs[t];
        if (t === 'limp' && 'call' in rec.evs) return rec.evs.call;
        if (t === 'check' && 'call' in rec.evs) return null;
        return null;
      };
      const best = Math.max(...Object.values(rec.evs).filter((v) => v !== null && v !== undefined));
      const mine = evOf(h);
      if (mine !== null && mine !== undefined) out.evLoss = Math.max(0, best - mine);
    }

    // Nash-Häufigkeiten: gemischte Strategien zulassen
    if (rec.freq) {
      const key = h === 'call' || h === 'limp' ? 'call' : h;
      const f = rec.freq[key] !== undefined ? rec.freq[key] : (h === 'fold' ? rec.freq.fold : 0);
      if (f >= 50) out.grade = 'gut';
      else if (f >= 15) { out.grade = 'ok'; out.note = `Gemischter Spot: Das Gleichgewicht wählt deine Aktion in ${Math.round(f)} % der Fälle.`; }
      else out.grade = 'fehler';
      if (rec.source !== 'nash' && GROUP[h] === GROUP[r]) out.grade = 'gut';
      if (rec.source !== 'nash' && out.evLoss !== null && out.evLoss < 0.1 && out.grade === 'fehler') { out.grade = 'ok'; out.note = 'Praktisch gleicher EV.'; }
      return out;
    }

    if (h === r) {
      out.grade = 'gut';
      if (h === 'bet' && rec.size && heroAction.to && Math.abs(heroAction.to - rec.size) > Math.max(0.5, rec.size * 0.4)) {
        out.note = `Bet ist richtig. Der Coach würde eher ${rec.size.toLocaleString('de-DE')} BB setzen.`;
      }
    }
    else if (GROUP[h] === GROUP[r] && GROUP[h] === 'aggr') { out.grade = 'ok'; out.note = 'Richtige Richtung (aggressiv), andere Größe.'; }
    else if ((h === 'check' && r === 'limp') || (h === 'limp' && r === 'check')) out.grade = 'gut';
    else if (rec.mixed && GROUP[rec.mixed] === GROUP[h]) { out.grade = 'ok'; out.note = 'Gemischte Strategie – deine Aktion kommt im Gleichgewicht auch vor.'; }
    else if (rec.borderline) { out.grade = 'ok'; out.note = 'Knappe Entscheidung.'; }
    else if (out.evLoss !== null && out.evLoss < 0.15) { out.grade = 'ok'; out.note = 'Praktisch gleicher EV.'; }
    else if (rec.source === 'model' && rec.evs && out.evLoss !== null && out.evLoss < 1 && (rec.evs[h === 'limp' ? 'call' : h] || 0) > 0) {
      out.grade = 'ok'; out.note = `Das Modell bevorzugt ${ACTION_DE[r]}, deine Aktion ist aber auch profitabel.`;
    }
    return out;
  }

  function analyze(text) {
    const parsed = SC.parser.parse(text);
    if (parsed.errors.length) return { ok: false, parsed, errors: parsed.errors, warnings: parsed.warnings };
    const game = SC.game.replay(parsed);
    const decisions = [];
    for (const s of game.spots) {
      if (!s.spot.heroCards) continue;
      const rec = recommend(s.spot);
      const g = grade(rec, s.heroAction, s.spot);
      decisions.push({ spot: s.spot, heroAction: s.heroAction, inferred: !!s.inferred, rec, grade: g, kind: spotKind(s.spot, rec) });
    }
    let open = null;
    if (game.open && game.open.heroCards) open = { spot: game.open, rec: recommend(game.open), kind: spotKind(game.open) };
    return {
      ok: true, parsed, game, decisions, open,
      warnings: parsed.warnings.concat(game.warnings),
    };
  }

  /* Kategorie eines Spots für die Leak-Statistik. */
  function spotKind(spot, rec) {
    if (spot.street !== 'preflop') {
      const facing = spot.toCall > 0 ? 'gegen Bet' : 'erste Aktion';
      return `${spot.street[0].toUpperCase() + spot.street.slice(1)} ${facing}`;
    }
    if (rec && rec.node) return SC.preflop.NODE_DE[rec.node];
    const pos = SC.game.POS_DE[spot.hero];
    if (spot.toCall > 0 && spot.history.some((a) => a.type === 'allin')) return `${pos} gegen All-in`;
    if (spot.history.some((a) => a.street === 'preflop' && a.type === 'raise' && a.pos !== spot.hero)) return `${pos} gegen Raise`;
    if (spot.history.some((a) => a.street === 'preflop' && a.type === 'call' && a.pos !== spot.hero)) return `${pos} gegen Limp`;
    return `${pos} first in`;
  }

  SC.coach = { analyze, recommend, grade, actionLabel, ACTION_DE, spotKind, fmtBB };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
