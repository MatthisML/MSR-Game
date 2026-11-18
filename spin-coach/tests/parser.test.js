const test = require('node:test');
const assert = require('node:assert');
const SC = require('../tools/load-all.js')();
const C = SC.cards;
const P = SC.parser.parse;
const L = (cs) => cs.map(C.cardCode).join(' ');
const acts = (r) => r.actions.map((a) => `${a.street[0]}:${a.pos} ${a.type}${a.amount !== undefined ? ' ' + a.amount : ''}${a.pct ? ' ' + a.pct + '%' : ''}`);

test('Gesprochenes Format mit Karten, Board und Beträgen', () => {
  const r = P('Stack 18. Position Button. Hand Herz Ass Pik König. Button raise 2. Small Blind fold. Big Blind call. Flop Herz Dame, Pik Sieben, Karo Zwei. Big Blind check. Button bet 50 Prozent. Big Blind call');
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.stackAll, 18);
  assert.strictEqual(r.hero, 'BTN');
  assert.strictEqual(L(r.heroCards), 'Ah Ks');
  assert.strictEqual(L(r.board), 'Qh 7s 2d');
  assert.deepStrictEqual(acts(r), ['p:BTN raise 2', 'p:SB fold', 'p:BB call', 'f:BB check', 'f:BTN bet 50%', 'f:BB call']);
});

test('Zahlwörter, Komma-Beträge und Stacks je Position', () => {
  assert.strictEqual(SC.parser.wordNumber('fuenfundzwanzig'), 25);
  assert.strictEqual(SC.parser.wordNumber('zweieinhalb'), 2.5);
  const r = P('Stack Button 20 Small Blind 15 Big Blind fünfundzwanzig. Ich bin Small Blind. Hand Dame Dame. Button fold. Small Blind raise auf 2,5. Big Blind all in');
  assert.deepStrictEqual(r.stacks, { BTN: 20, SB: 15, BB: 25 });
  assert.strictEqual(r.hero, 'SB');
  assert.strictEqual(C.CLASS_NAMES[r.heroClass], 'QQ');
  assert.deepStrictEqual(acts(r), ['p:BTN fold', 'p:SB raise 2.5', 'p:BB allin']);
});

test('Hand ohne Farben, suited/offsuit, Kurzcodes', () => {
  assert.strictEqual(C.CLASS_NAMES[P('Position Button Hand Ass König suited').heroClass], 'AKs');
  assert.strictEqual(C.CLASS_NAMES[P('Position Button Hand sieben zwei offsuit').heroClass], '72o');
  assert.strictEqual(C.CLASS_NAMES[P('Position Button Hand T9s').heroClass], 'T9s');
  assert.strictEqual(L(P('Position Button Hand AhKd').heroCards), 'Ah Kd');
  const w = P('Position Button Hand Ass König');
  assert.ok(w.warnings.some((x) => x.includes('offsuit')));
});

test('Heads-up: Button wird Small Blind; "Ich" ist der Held', () => {
  const r = P('Heads up. Stack 12. Ich bin Button. Hand Ah Kd. Button limpt. Big Blind raise 4. Ich call');
  assert.strictEqual(r.players, 2);
  assert.strictEqual(r.hero, 'SB');
  assert.deepStrictEqual(acts(r), ['p:SB call', 'p:BB raise 4', 'p:SB call']);
});

test('Fehlermeldungen bei fehlenden Angaben und doppelten Karten', () => {
  assert.ok(P('Stack 10 Hand Ah Kd').errors.some((e) => e.includes('Position')));
  assert.ok(P('Position Button').errors.some((e) => e.includes('Hand')));
  assert.ok(P('Position Button Hand Ah Kd Flop Ah 7c 2d').errors.some((e) => e.includes('doppelt')));
});
