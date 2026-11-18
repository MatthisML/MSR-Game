/* Lokale Speicherung (localStorage): Hände, Trainer-Ergebnisse, Einstellungen. Export/Import als JSON. */
(function (SC) {
  'use strict';
  const KEY = 'spinCoach.v1';
  const empty = () => ({ version: 1, hands: [], drills: [], settings: { voiceLang: 'de-DE', autoAnalyze: true } });
  let mem = null;

  function load() {
    if (mem) return mem;
    try {
      const raw = localStorage.getItem(KEY);
      mem = raw ? Object.assign(empty(), JSON.parse(raw)) : empty();
    } catch (e) { mem = empty(); }
    return mem;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); return true; } catch (e) { return false; }
  }

  function addHand(entry) {
    const db = load();
    entry.id = entry.id || 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    entry.ts = entry.ts || Date.now();
    db.hands.unshift(entry);
    save();
    return entry;
  }
  function updateHand(id, patch) {
    const db = load();
    const h = db.hands.find((x) => x.id === id);
    if (h) { Object.assign(h, patch); save(); }
    return h;
  }
  function deleteHand(id) {
    const db = load();
    db.hands = db.hands.filter((x) => x.id !== id);
    save();
  }
  function addDrill(d) {
    const db = load();
    d.ts = d.ts || Date.now();
    db.drills.push(d);
    if (db.drills.length > 20000) db.drills.splice(0, db.drills.length - 20000);
    save();
  }
  function exportJSON() { return JSON.stringify(load(), null, 1); }
  function importJSON(text, merge) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.hands) || !Array.isArray(data.drills)) throw new Error('Keine Spin-Coach-Datei.');
    const db = load();
    if (merge) {
      const ids = new Set(db.hands.map((h) => h.id));
      for (const h of data.hands) if (!ids.has(h.id)) db.hands.push(h);
      const keys = new Set(db.drills.map((d) => d.ts + d.kind));
      for (const d of data.drills) if (!keys.has(d.ts + d.kind)) db.drills.push(d);
      db.hands.sort((a, b) => b.ts - a.ts);
      db.drills.sort((a, b) => a.ts - b.ts);
    } else {
      mem = Object.assign(empty(), data);
    }
    save();
  }
  function reset() { mem = empty(); save(); }
  const settings = () => load().settings;
  function setSetting(k, v) { load().settings[k] = v; save(); }

  SC.store = { load, save, addHand, updateHand, deleteHand, addDrill, exportJSON, importJSON, reset, settings, setSetting };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
