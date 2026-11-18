/* Spracheingabe über die Web Speech API (Chrome, Edge, Safari). Jede erkannte Äußerung wird als Zeile geliefert.
   Sprachbefehle: "auswerten", "zurück" (letzte Zeile löschen), "neue Hand" (alles löschen), "stopp". */
(function (SC) {
  'use strict';
  const Rec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  function create(handlers) {
    if (!Rec) return null;
    const rec = new Rec();
    rec.lang = (SC.store && SC.store.settings().voiceLang) || 'de-DE';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let active = false;
    let wantRestart = false;

    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r[0].transcript.trim();
        if (r.isFinal) {
          const cmd = command(text);
          if (cmd) handlers.onCommand && handlers.onCommand(cmd);
          else if (text) handlers.onLine && handlers.onLine(text);
        } else interim += text + ' ';
      }
      handlers.onInterim && handlers.onInterim(interim.trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      wantRestart = false;
      handlers.onError && handlers.onError(ev.error === 'not-allowed'
        ? 'Mikrofon nicht erlaubt. Bitte in den Browser-Einstellungen freigeben.'
        : 'Spracheingabe-Fehler: ' + ev.error);
    };
    rec.onend = () => {
      // Chrome beendet die Erkennung nach Pausen – solange gewünscht neu starten
      if (wantRestart) { try { rec.start(); return; } catch (e) { /* weiter unten */ } }
      active = false;
      handlers.onState && handlers.onState(false);
    };

    return {
      start() { if (active) return; wantRestart = true; active = true; try { rec.start(); } catch (e) { /* läuft schon */ } handlers.onState && handlers.onState(true); },
      stop() { wantRestart = false; try { rec.stop(); } catch (e) { /* egal */ } },
      get active() { return active; },
    };
  }

  function command(text) {
    const t = text.toLowerCase().replace(/[.!?]/g, '').trim();
    if (/^(auswerten|analysieren|analyse|fertig|bewerten)$/.test(t)) return 'analyze';
    if (/^(zurück|zurueck|rückgängig|letzte zeile löschen|korrektur)$/.test(t)) return 'undo';
    if (/^(neue hand|alles löschen|von vorne)$/.test(t)) return 'clear';
    if (/^(stopp|stop|mikro aus|aufhören)$/.test(t)) return 'stop';
    return null;
  }

  SC.voice = { supported: !!Rec, create, command };
})(typeof window !== 'undefined' ? (window.SC = window.SC || {}) : (globalThis.SC = globalThis.SC || {}));
