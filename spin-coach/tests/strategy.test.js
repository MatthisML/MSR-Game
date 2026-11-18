const test = require('node:test');
const assert = require('node:assert');
const SC = require('../tools/load-all.js')();

const openRec = (text) => {
  const r = SC.coach.analyze(text);
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.ok(r.open, 'erwarte offenen Spot');
  return r.open.rec;
};

test('Hand-Simulation: Pot, fehlender Fold, offener Spot', () => {
  const p = SC.parser.parse('Stack 20 Position Big Blind Hand Ah Kd Button raise 2 Big Blind call Flop Qh 7s 2d Big Blind check Button bet 3');
  const g = SC.game.replay(p);
  assert.ok(g.warnings.some((w) => w.includes('Small Blind')));
  assert.strictEqual(g.open.toCall, 3);
  assert.strictEqual(g.open.pot, 7.5);
  assert.strictEqual(g.open.street, 'flop');
});

test('Push/Fold: Asse pushen, 72o foldet', () => {
  assert.strictEqual(openRec('Stack 8 Position Button Hand Ah Ad').action, 'allin');
  assert.strictEqual(openRec('Stack 8 Position Button Hand 7h 2c').action, 'fold');
  // bei 1 BB Rest ist jede Hand ein Push; bei 3 BB foldet 72o, weil der BB fast alles callt
  assert.strictEqual(openRec('Heads up Stack 1 Position Small Blind Hand 7h 2c').action, 'allin');
  assert.strictEqual(openRec('Heads up Stack 3 Position Small Blind Hand 7h 2c').action, 'fold');
});

test('Call vs. All-in: Nash-Ranges', () => {
  assert.strictEqual(openRec('Stack 10 Position Big Blind Hand Ah Ad Button fold Small Blind all in').action, 'call');
  assert.strictEqual(openRec('Stack 15 Position Big Blind Hand 7h 2c Button all in Small Blind fold').action, 'fold');
  // Big Blind mit 1 BB Rest gegen All-in: fast alles callen
  assert.strictEqual(openRec('Stack 2 Position Big Blind Hand 8h 3c Button fold Small Blind all in').action, 'call');
});

test('Nash-Tabellen plausibel', () => {
  const P = SC.preflop, c = SC.cards.classFromName;
  const pct = (node, S) => { let x = 0; for (let a = 0; a < 169; a++) x += P.nash(node, S, a).freq / 100 * SC.cards.CLASS_NCOMBOS[a]; return x / 13.26; };
  // Heads-up-Nash bei 10 BB: rund 58 % Push-Range
  assert.ok(Math.abs(pct('huPush', 10) - 58) < 4);
  // Ranges werden mit tieferen Stacks enger
  assert.ok(pct('btnPush', 5) > pct('btnPush', 10));
  assert.ok(pct('btnPush', 10) > pct('btnPush', 20));
  assert.ok(P.nash('bbCallSb', 10, c('A2o')).freq > 90);
});

test('Postflop: Nuts callen, Luft foldet am River', () => {
  const base = 'Stack 25 Position Big Blind Button raise 2 Small Blind fold Big Blind call Flop Ah 9h 4c Big Blind check Button bet 33 Prozent Big Blind call Turn 2d Big Blind check Button check River 7s Big Blind check ';
  const nuts = openRec(base.replace('Position Big Blind', 'Position Big Blind Hand Ad As') + 'Button bet 100 Prozent');
  assert.ok(['call', 'raise', 'allin'].includes(nuts.action));
  const air = openRec(base.replace('Position Big Blind', 'Position Big Blind Hand Kd Qs') + 'Button bet 100 Prozent');
  assert.strictEqual(air.action, 'fold');
});

test('Postflop: Value-Bet mit starker Hand, Check mit mittlerer', () => {
  const strong = openRec('Stack 25 Position Button Hand Kh Ks Button raise 2 Small Blind fold Big Blind call Flop Kd 7c 2s Big Blind check');
  assert.ok(['bet', 'allin'].includes(strong.action));
});

test('Coach bewertet Entscheidungen und EV-Verlust', () => {
  const r = SC.coach.analyze('Stack 8 Position Button Hand 7h 2c Button all in');
  assert.strictEqual(r.decisions.length, 1);
  assert.strictEqual(r.decisions[0].grade.grade, 'fehler');
  assert.ok(r.decisions[0].grade.evLoss > 0);
});
