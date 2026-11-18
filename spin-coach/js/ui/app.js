/* Start und Navigation (Hash-Router). */
(function (SC) {
  'use strict';
  const VIEWS = { review: SC.review, trainer: SC.trainer, ranges: SC.ranges, stats: SC.stats };

  function route() {
    const name = (location.hash || '#review').slice(1);
    const key = VIEWS[name] ? name : 'review';
    for (const k of Object.keys(VIEWS)) document.getElementById('view-' + k).hidden = k !== key;
    document.querySelectorAll('#tabs a').forEach((a) => {
      const on = a.dataset.tab === key;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const v = VIEWS[key];
    if (v.onShow) v.onShow();
    window.scrollTo(0, 0);
  }

  function start() {
    for (const v of Object.values(VIEWS)) v.render();
    window.addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  start();
})(window.SC = window.SC || {});
