// Aufruf: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const SC = require('../tools/load-all.js')();
const C = SC.cards;
const cards = (s) => s.split(' ').map(C.cardFromCode);
const ev = (s) => SC.evaluator.evaluate(cards(s));
const cat = (s) => ev(s) >> 20;

test('Handbewertung: Kategorien', () => {
  assert.strictEqual(cat('Ah Kh Qh Jh Th 2c 3d'), 8);
  assert.strictEqual(cat('As Ad Ac Ah 2c 3d 4s'), 7);
  assert.strictEqual(cat('Ks Kd Kc 2h 2c 3d 4s'), 6);
  assert.strictEqual(cat('2h 5h 9h Jh Kh Ac Ad'), 5);
  assert.strictEqual(cat('5c 4d 3h 2s Ac Kd Qd'), 4); // Wheel
  assert.strictEqual(cat('Qc Qd Qh 6s 2c 3d 9s'), 3);
  assert.strictEqual(cat('9c 9d 8h 8s 2c 2d As'), 2);
  assert.strictEqual(cat('Qc Qd 7h 6s 2c 3d 4h'), 1);
  assert.strictEqual(cat('Ac Kd 9h 7s 2c 3d 5s'), 0);
});

test('Handbewertung: Kicker und Vergleiche', () => {
  assert.ok(ev('Ac Ad Kh 7s 2c 3d 4s') > ev('Ac Ad Qh 7s 2c 3d 4s'));
  assert.ok(ev('6c 5d 4h 3s 2c Kd Qs') > ev('5c 4d 3h 2s Ac Kd Qd')); // 6-high > Wheel
  assert.strictEqual(ev('Ac Kd Qh Js 9c 2d 3s'), ev('Ad Kc Qs Jh 9d 2c 3h'));
  assert.ok(ev('Kc Kd Kh 2s 2c 7d 8s') > ev('Qc Qd Qh As Ac 7d 8s'));
  assert.ok(ev('9c 9d 8h 8s 7c 7d As') > ev('9c 9d 8h 8s 7c 7d Ks')); // bester Kicker bei drei Paaren
});

test('Hand-Klassen und Kombos', () => {
  assert.strictEqual(C.CLASS_NAMES[C.classFromName('AKs')], 'AKs');
  assert.strictEqual(C.CLASS_NCOMBOS[C.classFromName('AKs')], 4);
  assert.strictEqual(C.CLASS_NCOMBOS[C.classFromName('AKo')], 12);
  assert.strictEqual(C.CLASS_NCOMBOS[C.classFromName('77')], 6);
  assert.strictEqual(C.classOf(C.cardFromCode('Ah'), C.cardFromCode('Kh')), C.classFromName('AKs'));
  assert.strictEqual(C.classOf(C.cardFromCode('2c'), C.cardFromCode('7d')), C.classFromName('72o'));
  let total = 0; for (let a = 0; a < 169; a++) total += C.CLASS_NCOMBOS[a];
  assert.strictEqual(total, 1326);
});

test('Preflop-Equity-Tabelle', () => {
  const e = (a, b) => SC.equity.eq2(C.classFromName(a), C.classFromName(b));
  assert.ok(Math.abs(e('AA', 'KK') - 0.82) < 0.015);
  assert.ok(Math.abs(e('AKo', '22') - 0.47) < 0.02);
  assert.ok(Math.abs(e('KK', 'AA') + e('AA', 'KK') - 1) < 1e-6);
  const r = SC.equity.percentRange(20);
  assert.ok(Math.abs(SC.equity.rangePercent(r) - 20) < 0.01);
  assert.strictEqual(SC.equity.rangePercent(SC.equity.parseRange('22+')), 78 / 1326 * 100);
});
