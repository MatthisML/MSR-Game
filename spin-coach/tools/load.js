// Lädt die Browser-Skripte (IIFE mit globalem SC) in Node.
const path = require('path');
module.exports = function load(...files) {
  for (const f of files) require(path.join(__dirname, '..', 'js', f));
  return globalThis.SC;
};
