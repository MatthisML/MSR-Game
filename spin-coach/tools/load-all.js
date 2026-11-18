// Lädt alle Module der App (ohne UI) in Node.
module.exports = () => require('./load')('core/cards.js', 'core/eval.js', 'data/eq2.js', 'data/pushfold.js', 'core/equity.js',
  'input/parser.js', 'core/game.js', 'strategy/preflop.js', 'strategy/postflop.js', 'strategy/coach.js');
