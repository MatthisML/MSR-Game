/* Kleine UI-Helfer: HTML-Escaping, Karten, Badges, Toast. */
(function (SC) {
  'use strict';
  const C = SC.cards;

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('de-DE');
  const SUIT_CLASS = ['c', 'd', 'h', 's'];

  function cardHTML(c, size) {
    if (c === null || c === undefined) return `<span class="pc empty ${size || ''}"></span>`;
    const r = C.RANKS[C.rankOf(c)].replace('T', '10');
    const s = C.suitOf(c);
    return `<span class="pc ${SUIT_CLASS[s]} ${size || ''}" aria-label="${esc(C.RANK_NAME_DE[C.rankOf(c)] + ' ' + C.SUIT_NAME_DE[s])}"><span>${r}</span><span class="s">${C.SUIT_SYMBOL[s]}</span></span>`;
  }
  const cardsHTML = (cs, size) => `<span class="cards">${cs.map((c) => cardHTML(c, size)).join('')}</span>`;

  const ICON = {
    gut: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>',
    ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg>',
    fehler: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  };
  const GRADE_DE = { gut: 'Richtig', ok: 'Vertretbar', fehler: 'Fehler' };
  const badge = (g) => `<span class="badge ${g}">${ICON[g] || ''}${GRADE_DE[g] || esc(g)}</span>`;

  let toastTimer = null;
  function toast(text) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  const POS_DE = { BTN: 'Button', SB: 'Small Blind', BB: 'Big Blind' };
  const REC_DE = { fold: 'Fold', check: 'Check', call: 'Call', limp: 'Limp (Complete)', bet: 'Bet', raise: 'Raise', allin: 'All-in' };
  function recLabel(rec) {
    let s = REC_DE[rec.action] || rec.action;
    if (rec.size && (rec.action === 'raise' || rec.action === 'bet')) s += (rec.action === 'raise' ? ' auf ' : ' ') + fmt(rec.size) + ' BB';
    if (rec.sizePct && rec.action === 'bet') s += ` (${Math.round(rec.sizePct * 100)} % Pot)`;
    return s;
  }
  function heroLabel(a) {
    if (!a) return '–';
    let s = REC_DE[a.type] || a.type;
    if (a.type === 'raise') s += ' auf ' + fmt(a.to) + ' BB';
    else if (a.type === 'bet') s += ' ' + fmt(a.to) + ' BB';
    else if (a.type === 'call' && a.amount) s += ' ' + fmt(a.amount) + ' BB';
    else if (a.type === 'allin' && a.to) s += ' (' + fmt(a.to) + ' BB)';
    return s;
  }
  function when(ts) {
    const d = new Date(ts);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (d >= today) return 'heute ' + time;
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (d >= y) return 'gestern ' + time;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + time;
  }

  SC.ui = { esc, fmt, cardHTML, cardsHTML, badge, toast, POS_DE, REC_DE, recLabel, heroLabel, when, GRADE_DE };
})(window.SC = window.SC || {});
