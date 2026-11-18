/* Parser für das feste Eingabeformat (gesprochen oder getippt), z. B.:
     Stack 18. Position Button. Hand Ass König suited.
     Button raise 2. Small Blind fold. Big Blind call.
     Flop Herz Ass, Pik Sieben, Karo Zwei. Big Blind check. Button bet 50 Prozent. Big Blind call.
   Ergebnis: { players, stacks, hero, heroCards, heroClass, actions, board, showdown, errors, warnings } */
(function (SC) {
  'use strict';
  const C = SC.cards;

  const PHRASES = [
    [/\b(small|smol|smal|kleine[rn]?)[\s-]*blinds?\b/g, ' sb '],
    [/\b(big|bick|grosse[rn]?)[\s-]*(blinds?|line|lind)\b/g, ' bb '],
    [/\bsmallblind\b/g, ' sb '], [/\bbigblind\b/g, ' bb '],
    [/\b(all|ol|oll|al)[\s-]*(in|inn)\b/g, ' allin '],
    [/\bheads?[\s-]*up\b/g, ' headsup '],
    [/\bzwei spieler\b/g, ' spieler 2 '], [/\bdrei spieler\b/g, ' spieler 3 '],
    [/\bgeht mit\b/g, ' call '], [/\bgehe mit\b/g, ' call '],
    [/\bmin[\s-]*raise[sd]?\b/g, ' minraise '], [/\bmin[\s-]*bet\b/g, ' bet 1 '],
    [/\bhalbe[nr]? pot\b/g, ' 50 prozent '],
    [/\bdrei ?viertel ?pot\b/g, ' 75 prozent '],
    [/\bzwei ?drittel ?pot\b/g, ' 66 prozent '],
    [/\b(ein )?drittel ?pot\b/g, ' 33 prozent '],
    [/\bviertel ?pot\b/g, ' 25 prozent '],
    [/\bich bin\b/g, ' position '],
    [/\bich habe\b/g, ' hand '], [/\bmeine hand\b/g, ' hand '],
    [/(\d+)\s*(komma|punkt)\s*(\d+)/g, '$1.$3'],
    [/(\d),(\d)/g, '$1.$2'],
    [/%/g, ' prozent '],
    [/(\d)(x)\b/g, '$1 x'],
    [/(\d)(bb)\b/g, '$1 bb'],
  ];

  const WORDS = {
    pos: {
      btn: 'BTN', button: 'BTN', dealer: 'BTN', bu: 'BTN', bt: 'BTN', baton: 'BTN', batten: 'BTN', botton: 'BTN',
      sb: 'SB', bb: 'BB', ich: 'HERO', hero: 'HERO', held: 'HERO',
    },
    street: { flop: 'flop', flopp: 'flop', flob: 'flop', turn: 'turn', torn: 'turn', tern: 'turn', river: 'river', riva: 'river', rivers: 'river', riwer: 'river' },
    key: {
      stack: 'stack', stacks: 'stack', stapel: 'stack', chips: 'stack',
      position: 'position', platz: 'position',
      hand: 'hand', karten: 'hand', haende: 'hand',
      spieler: 'players', headsup: 'headsup',
      showdown: 'showdown', zeigt: 'showdown', zeigen: 'showdown', aufgedeckt: 'showdown',
      board: 'board', brett: 'board',
    },
    action: {
      fold: 'fold', folds: 'fold', foldet: 'fold', folde: 'fold', folded: 'fold', faltet: 'fold', passt: 'fold', passe: 'fold', weg: 'fold', foult: 'fold', fault: 'fold', fould: 'fold',
      check: 'check', checks: 'check', checkt: 'check', checke: 'check', schegg: 'check', scheck: 'check', check_: 'check', klopft: 'check', tscheck: 'check',
      call: 'call', calls: 'call', callt: 'call', calle: 'call', called: 'call', cold: 'call', col: 'call', coll: 'call', kohl: 'call', zahlt: 'call', mit: 'call', limp: 'call', limpt: 'call', limps: 'call', limpe: 'call', komplettiert: 'call', complete: 'call',
      bet: 'bet', bets: 'bet', bettet: 'bet', bette: 'bet', bett: 'bet', setzt: 'bet', setze: 'bet', wettet: 'bet', wette: 'bet', bed: 'bet', bat: 'bet',
      raise: 'raise', raises: 'raise', raist: 'raise', raised: 'raise', reist: 'raise', reise: 'raise', race: 'raise', erhoeht: 'raise', erhoehe: 'raise', reraise: 'raise', '3bet': 'raise', dreibet: 'raise', minraise: 'minraise',
      allin: 'allin', shove: 'allin', shoved: 'allin', shovt: 'allin', schovt: 'allin', schiebt: 'allin', push: 'allin', pusht: 'allin', pushed: 'allin', jam: 'allin', jammt: 'allin',
    },
    suit: {
      herz: 2, hertz: 2, herze: 2, herzen: 2, heart: 2, hearts: 2, harz: 2,
      karo: 1, caro: 1, karos: 1, carro: 1, diamonds: 1, diamond: 1, karow: 1,
      pik: 3, pick: 3, piek: 3, peak: 3, pique: 3, spades: 3, spade: 3, pieck: 3, pic: 3, piks: 3,
      kreuz: 0, kreuze: 0, kreuzt: 0, clubs: 0, club: 0, treff: 0, kreutz: 0,
    },
    rank: {
      ass: 12, asse: 12, ace: 12, assen: 12,
      koenig: 11, konig: 11, koenige: 11, king: 11,
      dame: 10, damen: 10, queen: 10,
      bube: 9, buben: 9, bauer: 9, jack: 9, junge: 9,
      zehn: 8, zehner: 8, ten: 8, '10': 8,
      neun: 7, neuner: 7, nine: 7, '9': 7,
      acht: 6, achter: 6, eight: 6, '8': 6,
      sieben: 5, siebener: 5, seven: 5, '7': 5,
      sechs: 4, sechser: 4, six: 4, '6': 4,
      fuenf: 3, funf: 3, fuenfer: 3, five: 3, '5': 3,
      vier: 2, vierer: 2, four: 2, '4': 2,
      drei: 1, dreier: 1, three: 1, '3': 1,
      zwei: 0, zwo: 0, zweier: 0, two: 0, '2': 0,
    },
    letterRank: { a: 12, k: 11, q: 10, j: 9, t: 8 },
    suited: { suited: 's', suitet: 's', sooted: 's', suted: 's', suit: 's', gleichfarbig: 's', farbig: 's', s: 's',
      offsuit: 'o', offsuited: 'o', off: 'o', of: 'o', o: 'o', verschiedenfarbig: 'o', ungleich: 'o', unsuited: 'o' },
    unit: { prozent: 'pct', percent: 'pct', pot: 'pot', pott: 'pot', x: 'x', mal: 'x', fach: 'x', bb: 'bb', blinds: 'bb' },
    filler: new Set(['und', 'der', 'die', 'das', 'dann', 'auf', 'zu', 'er', 'sie', 'es', 'ist', 'hat', 'den', 'dem', 'mit_', 'von', 'nach', 'jetzt', 'also', 'ok', 'okay', 'so', 'noch', 'ein', 'eine', 'einen', 'wird', 'kommt', 'kam', 'auch', 'am', 'im', 'in', 'beim']),
  };

  const NUM_UNITS = { eins: 1, ein: 1, eine: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9 };
  const NUM_TEENS = { zehn: 10, elf: 11, zwoelf: 12, dreizehn: 13, vierzehn: 14, fuenfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19 };
  const NUM_TENS = { zwanzig: 20, dreissig: 30, vierzig: 40, fuenfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90, hundert: 100 };

  function wordNumber(w) {
    if (/^\d+(\.\d+)?$/.test(w)) return parseFloat(w);
    let half = 0;
    if (w === 'halb' || w === 'einhalb') return 0.5;
    if (w === 'anderthalb' || w === 'eineinhalb') return 1.5;
    if (w.endsWith('einhalb')) { half = 0.5; w = w.slice(0, -7); }
    let v = null;
    if (w in NUM_UNITS) v = NUM_UNITS[w];
    else if (w in NUM_TEENS) v = NUM_TEENS[w];
    else if (w in NUM_TENS) v = NUM_TENS[w];
    else {
      const m = w.match(/^(ein|zwei|drei|vier|fuenf|sechs|sieben|acht|neun)und(zwanzig|dreissig|vierzig|fuenfzig|sechzig|siebzig|achtzig|neunzig)$/);
      if (m) v = NUM_UNITS[m[1]] + NUM_TENS[m[2]];
    }
    return v === null ? null : v + half;
  }

  function normalize(text) {
    let t = ' ' + String(text).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss') + ' ';
    for (const [re, rep] of PHRASES) t = t.replace(re, rep);
    // Satzzeichen trennen Wörter; Dezimalpunkt in Zahlen bleibt erhalten
    t = t.replace(/(\d)\.(\d)/g, '$1§$2').replace(/[.,;:!?()"'/\n\r\t-]+/g, ' ').replace(/§/g, '.');
    return t.split(/\s+/).filter(Boolean);
  }

  const CARD_CODE = /^(10|[2-9tjqka])([cdhs])$/;
  const DOUBLE_CODE = /^(10|[2-9tjqka])([cdhs])(10|[2-9tjqka])([cdhs])$/;
  const CLASS_CODE = /^([2-9tjqka])([2-9tjqka])([so])?$/;
  const rankFromChar = (ch) => (ch === '10' ? 8 : C.RANKS.indexOf(ch.toUpperCase()));

  /* Ein Wort klassifizieren; ctx = 'cards' erlaubt Einzelbuchstaben als Ränge. */
  function classify(w, next, ctx) {
    if (w in WORDS.pos) return { t: 'pos', v: WORDS.pos[w] };
    if (w in WORDS.street) return { t: 'street', v: WORDS.street[w] };
    if (w in WORDS.key) return { t: 'key', v: WORDS.key[w] };
    if (w in WORDS.action) return { t: 'action', v: WORDS.action[w] };
    if (w in WORDS.suit) return { t: 'suit', v: WORDS.suit[w] };
    if (w === 'as' && next && (next in WORDS.suit || next in WORDS.rank || next in WORDS.suited)) return { t: 'rank', v: 12 };
    let m = w.match(DOUBLE_CODE);
    if (m) return { t: 'cards', v: [C.card(rankFromChar(m[1]), C.SUITS.indexOf(m[2])), C.card(rankFromChar(m[3]), C.SUITS.indexOf(m[4]))] };
    m = w.match(CARD_CODE);
    if (m) return { t: 'cards', v: [C.card(rankFromChar(m[1]), C.SUITS.indexOf(m[2]))] };
    if (ctx === 'cards') {
      if (w in WORDS.rank) return { t: 'rank', v: WORDS.rank[w] };
      if (w in WORDS.letterRank) return { t: 'rank', v: WORDS.letterRank[w] };
      if (w in WORDS.suited) return { t: 'suited', v: WORDS.suited[w] };
      m = w.match(CLASS_CODE);
      if (m) return { t: 'class', v: { r1: rankFromChar(m[1]), r2: rankFromChar(m[2]), s: m[3] || null } };
    }
    if (w in WORDS.unit) return { t: 'unit', v: WORDS.unit[w] };
    const n = wordNumber(w);
    if (n !== null) return { t: 'num', v: n };
    if (w in WORDS.rank) return { t: 'rank', v: WORDS.rank[w] };
    if (w in WORDS.suited) return { t: 'suited', v: WORDS.suited[w] };
    if (WORDS.filler.has(w)) return { t: 'filler' };
    return { t: 'unknown', v: w };
  }

  function parse(text) {
    const words = normalize(text);
    const res = {
      players: 3, stacks: {}, stackAll: null, hero: null, heroCards: null, heroClass: -1, heroSuitsKnown: false,
      actions: [], board: [], boardByStreet: { flop: [], turn: [], river: [] }, showdown: {}, errors: [], warnings: [],
    };
    let i = 0;
    let street = 'preflop';
    const peek = (ctx) => (i < words.length ? classify(words[i], words[i + 1], ctx) : null);
    const isBoundary = (tok) => tok && (tok.t === 'pos' || tok.t === 'street' || tok.t === 'key' || tok.t === 'action');

    function readCards(max) {
      const cards = [], bare = [];
      let rank = null, suit = null, suitedFlag = null, classTok = null;
      while (i < words.length) {
        const tok = classify(words[i], words[i + 1], 'cards');
        if (tok.t === 'rank' || (tok.t === 'num' && Number.isInteger(tok.v) && tok.v >= 2 && tok.v <= 10)) {
          const r = tok.t === 'rank' ? tok.v : (tok.v === 10 ? 8 : tok.v - 2);
          if (rank !== null && suit === null) bare.push(rank);
          rank = r;
        } else if (tok.t === 'suit') {
          if (suit !== null && rank === null) { /* zweite Farbe ohne Rang: ersetzen */ }
          suit = tok.v;
        } else if (tok.t === 'cards') {
          cards.push(...tok.v);
        } else if (tok.t === 'class') {
          classTok = tok.v;
        } else if (tok.t === 'suited') {
          suitedFlag = tok.v;
        } else if (tok.t === 'filler') {
          // überspringen
        } else break;
        i++;
        if (rank !== null && suit !== null) { cards.push(C.card(rank, suit)); rank = null; suit = null; }
        if (max && cards.length >= max && rank === null) break;
      }
      if (rank !== null) bare.push(rank);
      return { cards, bare, suitedFlag, classTok, danglingSuit: suit !== null };
    }

    function readAmount() {
      let amount = null, unit = null;
      let tok = peek();
      while (tok && tok.t === 'filler') { i++; tok = peek(); }
      if (tok && tok.t === 'num') {
        amount = tok.v; i++;
        tok = peek();
        if (tok && tok.t === 'num' && tok.v === 0.5 && words[i] !== '0.5') { amount += 0.5; i++; tok = peek(); }
        if (tok && tok.t === 'unit') { unit = tok.v; i++; }
        else if (tok && tok.t === 'pos' && tok.v === 'BB') {
          // "raise 2 bb" – "bb" ist hier die Einheit, wenn danach keine Aktion folgt
          const after = i + 1 < words.length ? classify(words[i + 1], words[i + 2]) : null;
          if (!after || after.t !== 'action') { unit = 'bb'; i++; }
        }
      } else if (tok && tok.t === 'unit' && tok.v === 'pot') {
        amount = 100; unit = 'pct'; i++;
      }
      if (unit === 'pot') unit = amount !== null && amount <= 2 ? 'potx' : 'pct';
      return { amount, unit };
    }

    function addAction(pos, type) {
      const a = { street, pos, type };
      if (type === 'bet' || type === 'raise' || type === 'minraise') {
        const { amount, unit } = readAmount();
        if (type === 'minraise') { a.type = 'raise'; a.min = true; }
        else if (amount === null) res.warnings.push(`Betrag fehlt bei "${type}" (${street}) – nehme ${type === 'raise' ? 'Min-Raise' : 'halben Pot'} an.`);
        if (amount !== null) {
          if (unit === 'pct') a.pct = amount;
          else if (unit === 'potx') a.pct = amount * 100;
          else if (unit === 'x') a.mult = amount;
          else a.amount = amount;
        } else if (type === 'raise') a.min = true;
        else a.pct = 50;
      } else if (type === 'call' || type === 'check' || type === 'fold' || type === 'allin') {
        // optionaler Betrag ("call 2") wird ignoriert
        const tok = peek();
        if (tok && tok.t === 'num') { i++; const u = peek(); if (u && (u.t === 'unit' || (u.t === 'pos' && u.v === 'BB' && !nextIsAction(i + 1)))) i++; }
      }
      res.actions.push(a);
    }
    const nextIsAction = (j) => j < words.length && classify(words[j], words[j + 1]).t === 'action';

    function setHand(rc) {
      if (rc.cards.length >= 2) {
        res.heroCards = rc.cards.slice(0, 2);
        res.heroClass = C.classOf(res.heroCards[0], res.heroCards[1]);
        res.heroSuitsKnown = true;
        if (rc.cards[0] === rc.cards[1]) res.errors.push('Beide Hole Cards sind gleich.');
        return;
      }
      let r1, r2, s = rc.suitedFlag;
      if (rc.classTok) { r1 = rc.classTok.r1; r2 = rc.classTok.r2; s = rc.classTok.s || s; }
      else {
        const ranks = rc.cards.map(C.rankOf).concat(rc.bare);
        if (ranks.length < 2) { res.errors.push('Hand nicht erkannt. Beispiel: "Hand Herz Ass Pik König" oder "Hand Ass König suited".'); return; }
        [r1, r2] = ranks;
        if (rc.cards.length === 1) res.warnings.push('Nur eine Farbe erkannt – Hand wird ohne Farben ausgewertet.');
      }
      const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
      const name = C.RANKS[hi] + C.RANKS[lo] + (hi === lo ? '' : (s === 's' ? 's' : 'o'));
      res.heroClass = C.classFromName(name);
      if (hi !== lo && !s) res.warnings.push(`"suited" oder "offsuit" fehlt bei ${name.slice(0, 2)} – nehme offsuit an.`);
      res.heroSuitsKnown = false;
    }

    function setBoard(st, rc) {
      const want = st === 'flop' ? 3 : 1;
      if (rc.cards.length !== want) {
        res.errors.push(`${st[0].toUpperCase() + st.slice(1)}: ${want} Karte${want > 1 ? 'n' : ''} mit Farbe erwartet, ${rc.cards.length} erkannt.`);
      }
      if (rc.bare.length || rc.danglingSuit) res.warnings.push(`${st}: Karte ohne Farbe oder Farbe ohne Rang – bitte "Herz Ass" sagen.`);
      res.boardByStreet[st] = rc.cards.slice(0, want);
    }

    let pendingPos = null;
    while (i < words.length) {
      const tok = peek();
      i++;
      if (tok.t === 'key') {
        pendingPos = null;
        if (tok.v === 'stack') {
          const nums = [];
          let pos = null;
          while (i < words.length) {
            const t2 = peek();
            if (t2.t === 'pos' && nextIsPosNum(i)) { pos = t2.v; i++; }
            else if (t2.t === 'num') { nums.push({ pos, v: t2.v }); pos = null; i++; }
            else if (t2.t === 'unit' || t2.t === 'filler') i++;
            else break;
          }
          applyStacks(nums);
        } else if (tok.v === 'position') {
          const t2 = peek();
          if (t2 && t2.t === 'pos' && t2.v !== 'HERO') { res.hero = t2.v; i++; }
          else res.errors.push('Position nicht erkannt. Beispiel: "Position Button".');
        } else if (tok.v === 'players') {
          const t2 = peek();
          if (t2 && t2.t === 'num' && (t2.v === 2 || t2.v === 3)) { res.players = t2.v; i++; }
        } else if (tok.v === 'headsup') {
          res.players = 2;
        } else if (tok.v === 'hand') {
          setHand(readCards(2));
        } else if (tok.v === 'showdown') {
          const t2 = peek();
          if (t2 && t2.t === 'pos') { i++; const rc = readCards(2); if (rc.cards.length === 2) res.showdown[t2.v] = rc.cards; }
        } else if (tok.v === 'board') {
          const rc = readCards(5);
          const cs = rc.cards;
          if (cs.length >= 3) { res.boardByStreet.flop = cs.slice(0, 3); }
          if (cs.length >= 4) res.boardByStreet.turn = [cs[3]];
          if (cs.length >= 5) res.boardByStreet.river = [cs[4]];
        }
      } else if (tok.t === 'street') {
        pendingPos = null;
        street = tok.v;
        setBoard(street, readCards(street === 'flop' ? 3 : 1));
      } else if (tok.t === 'pos') {
        // "Button 20" direkt nach Stack-Angaben oder "Button Stack 20"
        const t2 = peek();
        if (t2 && t2.t === 'key' && t2.v === 'stack') {
          i++;
          const t3 = peek();
          if (t3 && t3.t === 'num') { applyStacks([{ pos: tok.v, v: t3.v }]); i++; }
        } else pendingPos = tok.v;
      } else if (tok.t === 'action') {
        addAction(pendingPos, tok.v);
        pendingPos = null;
      } else if (tok.t === 'unknown') {
        res.warnings.push(`Nicht verstanden: "${tok.v}"`);
      }
    }

    function nextIsPosNum(j) { return j + 1 < words.length && classify(words[j + 1], words[j + 2]).t === 'num'; }

    function applyStacks(nums) {
      if (!nums.length) { res.errors.push('Stack-Größe fehlt. Beispiel: "Stack 18".'); return; }
      if (nums.length === 1 && !nums[0].pos) { res.stackAll = nums[0].v; return; }
      const order = res.players === 2 ? ['SB', 'BB'] : ['BTN', 'SB', 'BB'];
      let k = 0;
      for (const n of nums) {
        const p = n.pos || order[k];
        if (p) res.stacks[p === 'HERO' ? 'HERO' : p] = n.v;
        k++;
      }
    }

    // Board zusammensetzen
    res.board = res.boardByStreet.flop.concat(res.boardByStreet.turn, res.boardByStreet.river);
    if (res.players === 2) {
      // Heads-up: Button = Small Blind
      const fix = (p) => (p === 'BTN' ? 'SB' : p);
      res.hero = fix(res.hero);
      for (const a of res.actions) a.pos = fix(a.pos);
      if (res.stacks.BTN !== undefined) { res.stacks.SB = res.stacks.BTN; delete res.stacks.BTN; }
      for (const k of Object.keys(res.showdown)) if (k === 'BTN') { res.showdown.SB = res.showdown.BTN; delete res.showdown.BTN; }
    }
    if (res.stacks.HERO !== undefined) {
      if (res.hero) res.stacks[res.hero] = res.stacks.HERO;
      delete res.stacks.HERO;
    }
    for (const a of res.actions) if (a.pos === 'HERO') a.pos = res.hero;
    if (!res.hero) res.errors.push('Deine Position fehlt. Beispiel: "Position Button".');
    if (res.heroClass < 0 && !res.errors.some((e) => e.startsWith('Hand'))) res.errors.push('Deine Hand fehlt. Beispiel: "Hand Herz Ass Pik König".');
    // doppelte Karten
    const seen = new Set();
    for (const c of (res.heroCards || []).concat(res.board)) {
      if (seen.has(c)) res.errors.push(`Karte ${C.cardLabel(c)} ist doppelt.`);
      seen.add(c);
    }
    return res;
  }

  SC.parser = { parse, normalize, wordNumber };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
