/* MSR Werkjahr – Spielablauf, Aufgaben, Fehleranalyse, Werkstatt */
(function (M) {
  const T = M.T, KEY = 'msr-werkjahr-v1';
  const main = document.getElementById('main'), drawer = document.getElementById('drawer');
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ---------- Zustand ----------
  let S = { name: '', xp: 0, done: {}, cur: null, queue: [], log: [], weakF: {}, maxDay: 1 };
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };

  // ---------- Inhalte indizieren ----------
  const tasks = {}, topicRefs = {};
  M.days.sort((a, b) => a.n - b.n).forEach(d => d.steps.forEach((st, i) => {
    if (st.t !== 'task') return; st.id = 'd' + d.n + '-' + i; st.day = d.n; tasks[st.id] = st;
    if (st.topic && !st.gen && st.type !== 'sim' && st.type !== 'num') (topicRefs[st.topic] = topicRefs[st.topic] || []).push(st.id);
  }));
  const ACTS = [{ k: 'messen', t: 'Akt 1 · Messen', s: 'Im Messlabor: Was die Anlage tut, muss erst einmal erfasst werden.' }, { k: 'steuern', t: 'Akt 2 · Steuern', s: 'Im Schaltschrank: Vorgaben machen, ohne das Ergebnis zurückzumelden.' }, { k: 'regeln', t: 'Akt 3 · Regeln', s: 'In der Leitwarte: Messen, vergleichen, nachstellen – der Kreis schließt sich.' }];
  const RANKS = [[20, 'Ingenieur:in'], [19, 'Regelungstechniker:in'], [13, 'Steuerungstechniker:in'], [8, 'Messtechniker:in'], [1, 'Werkstudent:in'], [0, 'Neu im Werk']];
  const nDone = () => Object.keys(S.done).length;
  const rank = () => RANKS.find(r => nDone() >= r[0])[1];
  const nextDay = () => { for (const d of M.days) if (!S.done[d.n]) return d.n; return null; };
  const REASONS = {
    begriff: 'Ich kannte einen Begriff oder das Konzept nicht', verwechselt: 'Ich habe zwei Dinge verwechselt', formel: 'Ich wusste nicht, welche Formel ich brauche',
    umstellen: 'Formel klar, aber Einsetzen oder Umstellen hat nicht geklappt', einheit: 'Einheiten oder Vorsätze (µ, m, k …) durcheinander', rechnen: 'Rechen- oder Tippfehler',
    verstehen: 'Ich habe die Aufgabenstellung nicht verstanden', fluechtig: 'Zu schnell gelesen oder geraten'
  };

  // ---------- Navigation ----------
  let view = 'hub', run = null, timerIv = null;
  function nav(v, arg) {
    view = v; drawer.hidden = true; clearInterval(timerIv);
    $$('#top-nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === v));
    $('#top-stat').innerHTML = S.name ? `<span>${M.esc(rank())}</span><span><b>${S.xp}</b> XP</span>` : '';
    ({ hub: vHub, formeln: vFormeln, labor: vLabor, protokoll: vProtokoll, day: vDay, werkstatt: vWerkstatt }[v] || vHub)(arg);
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-nav]'); if (b) nav(S.name ? b.dataset.nav : 'hub'); });

  // ---------- Start / Anlagenplan ----------
  function vHub() {
    if (!S.name) {
      main.innerHTML = `<section class="stage"><div class="sheet"><span class="eyebrow">Werkjahr bei der Nordwerk Getränketechnik</span><h1>Erst messen, dann steuern, dann regeln.</h1>
      <p>Du fängst als angehende Ingenieurin oder angehender Ingenieur in einem Abfüllwerk an. In 20 Arbeitstagen zu je etwa 20 Minuten bringst du den Tank T-101 vom ersten Messwert bis zum sauber eingestellten Regelkreis. Jeder Tag mischt kurze Erklär-Animationen, Simulatoren zum Ausprobieren und Aufgaben. Die Formelsammlung füllt sich mit.</p>
      <p>Wenn eine Aufgabe nicht klappt, fragt das Spiel nach dem Grund und legt dir passende neue Übungen in die Werkstatt.</p>
      <div class="row"><label for="in-name">Wie heißt du?</label><input type="text" id="in-name" maxlength="24" placeholder="Vorname"><button class="btn sig" id="go-start">Werkjahr beginnen</button></div></div></section>`;
      const start = () => { const n = $('#in-name').value.trim(); if (!n) { $('#in-name').classList.add('bad'); return; } S.name = n; save(); nav('hub'); };
      $('#go-start').onclick = start; $('#in-name').onkeydown = e => { if (e.key === 'Enter') start(); };
      return;
    }
    const nd = nextDay(), d = M.days.find(x => x.n === nd), resume = S.cur && S.cur.day === nd && S.cur.idx > 0;
    let h = `<section class="hero"><div class="col"><span class="eyebrow">Anlagenplan · Nordwerk Getränketechnik</span><h1>${nd ? 'Guten Arbeitstag, ' + M.esc(S.name) + '.' : 'Werkjahr bestanden, ' + M.esc(S.name) + '.'}</h1><p class="mute">${nd ? 'Ein Tag dauert etwa 20 Minuten. Der nächste Tag öffnet sich, sobald der vorige abgeschlossen ist.' : 'Alle 20 Tage sind abgeschlossen. Du kannst jeden Tag wiederholen, im Labor weiter experimentieren und die Werkstatt leeren.'}</p></div>
      <div class="gauges"><div class="gauge"><span class="eyebrow">Tage</span><b>${nDone()}/20</b></div><div class="gauge"><span class="eyebrow">Erfahrung</span><b>${S.xp}</b></div><div class="gauge"><span class="eyebrow">Werkstatt</span><b>${S.queue.length}</b></div></div></section>`;
    if (d) h += `<section class="today"><div class="col grow"><span class="eyebrow">Heute · Tag ${d.n} von 20</span><h2>${d.title}</h2><p class="mute">${d.goal}</p></div><button class="btn sig" data-day="${d.n}">${resume ? 'Weitermachen' : 'Tag starten'}</button>${S.queue.length ? `<button class="btn ghost" id="go-ws">Werkstatt (${S.queue.length} offen)</button>` : ''}</section>`;
    else if (S.queue.length) h += `<section class="today"><div class="col grow"><h2>Werkstatt</h2><p class="mute">${S.queue.length} Übungen aus deiner Fehleranalyse sind noch offen.</p></div><button class="btn sig" id="go-ws">Werkstatt öffnen</button></section>`;
    ACTS.forEach(a => {
      h += `<section class="act"><div class="act-head"><h2>${a.t}</h2><span class="mute">${a.s}</span></div><div class="days">` + M.days.filter(x => x.act === a.k).map(x => {
        const dn = S.done[x.n], open = dn || x.n === nd;
        return `<button class="day ${dn ? 'done' : ''} ${x.n === nd ? 'next' : ''}" data-day="${x.n}" ${open ? '' : 'disabled'}><span class="n"><span>TAG ${String(x.n).padStart(2, '0')}</span><span>${dn ? '✓ ' + dn.ok + '/' + dn.total : x.n === nd ? 'offen' : 'gesperrt'}</span></span><span class="t">${x.title}</span></button>`;
      }).join('') + `</div></section>`;
    });
    main.innerHTML = h;
    $$('[data-day]').forEach(b => b.onclick = () => nav('day', +b.dataset.day));
    const ws = $('#go-ws'); if (ws) ws.onclick = () => nav('werkstatt');
  }

  // ---------- Tagesablauf ----------
  function vDay(n) {
    const day = M.days.find(d => d.n === n); S.maxDay = Math.max(S.maxDay, n);
    const resume = S.cur && S.cur.day === n ? S.cur : null;
    let steps = day.steps.slice();
    if (!resume && S.queue.length && n > 1) steps = [{ t: 'story', text: ['Bevor wir loslegen: In deiner Werkstatt liegen noch Übungen aus den letzten Tagen. Wir machen zuerst ' + Math.min(3, S.queue.length) + ' davon, dann geht es mit dem neuen Stoff weiter.'] }].concat(S.queue.slice(0, 3).map(it => ({ t: 'rem', item: it })), steps);
    run = { day, steps, idx: resume ? Math.min(resume.idx, steps.length - 1) : 0, ok: resume ? resume.ok : 0, total: resume ? resume.total : 0, t0: Date.now() - (resume ? resume.el || 0 : 0), pre: steps.length - day.steps.length, added: [] };
    renderStep();
  }
  function persist() { const i = run.idx - run.pre; S.cur = { day: run.day.n, idx: Math.max(0, i), ok: run.ok, total: run.total, el: Date.now() - run.t0 }; save(); }
  function shell(inner, foot) {
    const p = Math.round(100 * run.idx / run.steps.length);
    main.innerHTML = `<section class="stage"><div class="prog"><span>TAG ${run.day.n} · ${M.esc(run.day.title)}</span><div class="bar"><i style="width:${p}%"></i></div><span id="clock"></span><button class="btn ghost sm" id="open-f">Formeln</button></div><div class="sheet" id="sheet">${inner}<div class="sheet-foot" id="foot">${foot || ''}</div></div></section>`;
    const tick = () => { const c = $('#clock'); if (!c) return clearInterval(timerIv); const s = Math.floor((Date.now() - run.t0) / 1000); c.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' / 20 min'; };
    clearInterval(timerIv); timerIv = setInterval(tick, 1000); tick();
    $('#open-f').onclick = () => openDrawer();
  }
  const navBtns = (back) => `<button class="btn ghost" id="st-back" ${back && run.idx > 0 ? '' : 'hidden'}>Zurück</button><button class="btn" id="st-next">Weiter</button>`;
  function next() { run.idx++; if (run.idx >= run.steps.length) return finishDay(); persist(); renderStep(); window.scrollTo(0, 0); }
  function bindNav() { const b = $('#st-back'), n = $('#st-next'); if (b) b.onclick = () => { run.idx--; renderStep(); }; if (n) n.onclick = next; }

  function renderStep() {
    const st = run.steps[run.idx];
    if (st.t === 'story') {
      const tx = [].concat(st.text).map(p => `<p>${T(p)}</p>`).join('');
      shell(`<div class="story"><div class="ava"><svg viewBox="0 0 40 40" width="40" height="40"><path d="M8 22a12 12 0 0124 0z" fill="currentColor"/><rect x="5" y="22" width="30" height="4" rx="2" fill="currentColor"/><path d="M12 28c0 6 4 9 8 9s8-3 8-9" fill="none" stroke="currentColor" stroke-width="2.5"/></svg></div><div class="col"><span class="eyebrow">${st.who || 'Ina Petersen · Betriebsingenieurin, deine Mentorin'}</span><div class="say">${tx}</div></div></div>`, navBtns(true));
      bindNav();
    } else if (st.t === 'explain') {
      shell(`<span class="tag">Erklärung</span><h2>${st.title}</h2>${[].concat(st.html || []).map(p => /^</.test(p) ? T(p) : `<p>${T(p)}</p>`).join('')}<div id="fig"></div>${st.after ? `<p>${T(st.after)}</p>` : ''}`, navBtns(true));
      mountFig($('#fig'), st); bindNav();
    } else if (st.t === 'task') {
      shell(`<div id="task"></div>`, '');
      renderTask($('#task'), prep(st, st.seed), r => { run.total++; if (r.ok) run.ok++; S.xp += r.ok ? (r.tries === 1 ? 10 : 6) : 2; if (r.added) run.added = run.added.concat(r.added); persist(); }, { exam: run.day.exam });
    } else if (st.t === 'rem') {
      shell(`<span class="tag sig">Werkstatt</span><div id="task"></div>`, '');
      renderRem($('#task'), st.item, next);
    }
  }
  function finishDay() {
    const d = run.day, min = Math.round((Date.now() - run.t0) / 60000);
    S.done[d.n] = { ok: run.ok, total: run.total, ts: Date.now() }; S.cur = null; S.xp += 20; S.maxDay = Math.max(S.maxDay, Math.min(20, d.n + 1)); save();
    const fs = M.formulas.filter(f => f.day === d.n);
    main.innerHTML = `<section class="stage"><div class="sheet"><span class="eyebrow">Feierabend · Tag ${d.n}</span><h1>${d.n === 20 ? 'Werkjahr bestanden.' : 'Tag abgeschlossen.'}</h1>
      <div class="gauges" style="justify-content:flex-start"><div class="gauge"><span class="eyebrow">Aufgaben</span><b>${run.ok}/${run.total}</b></div><div class="gauge"><span class="eyebrow">Dauer</span><b>${min} min</b></div><div class="gauge"><span class="eyebrow">Rang</span><b>${M.esc(rank())}</b></div></div>
      ${d.recap ? `<div class="fb info"><b class="h">Das nimmst du mit</b><ul>${d.recap.map(r => `<li>${T(r)}</li>`).join('')}</ul></div>` : ''}
      ${fs.length ? `<div class="col"><h3>Neu in der Formelsammlung</h3><div class="fgrid">${fs.map(fcard).join('')}</div></div>` : ''}
      ${run.added.length ? `<div class="fb hint"><b class="h">Neu in der Werkstatt</b><p>Aus deinen Rückmeldungen sind ${run.added.length} neue Übungen entstanden. Sie kommen morgen als Erstes dran.</p></div>` : ''}
      <div class="sheet-foot"><span></span><button class="btn sig" data-nav="hub">Zum Anlagenplan</button></div></div></section>`;
    $('#top-stat').innerHTML = `<span>${M.esc(rank())}</span><span><b>${S.xp}</b> XP</span>`;
  }

  // ---------- Abbildungen mit Erklärschritten ----------
  function mountFig(host, st) {
    if (st.sim) return M.mountSim(host, st.sim, Object.assign({ uid: 'e' }, st.preset));
    if (!st.fig) return;
    const html = typeof st.fig === 'function' ? st.fig() : M.figs[st.fig]();
    const caps = st.caps || [];
    host.innerHTML = `<div class="figwrap">${html}${caps.length ? `<div class="player"><button class="btn ghost sm" id="pl-prev" aria-label="Schritt zurück">◀</button><button class="btn sm" id="pl-play">▶ Abspielen</button><button class="btn ghost sm" id="pl-next" aria-label="Schritt vor">▶</button><div class="dots">${caps.map(() => '<i></i>').join('')}</div><div class="cap" id="pl-cap"></div></div>` : ''}</div>`;
    if (!caps.length) return;
    let k = 0, iv = null; const svg = $('svg', host);
    const show = () => { $$('[data-f]', svg).forEach(el => el.classList.toggle('off', +el.dataset.f > k)); $('#pl-cap', host).innerHTML = T(caps[k]); $$('.dots i', host).forEach((d, i) => d.classList.toggle('on', i <= k)); };
    const stop = () => { clearInterval(iv); iv = null; $('#pl-play', host).textContent = '▶ Abspielen'; };
    const play = () => { if (k >= caps.length - 1) k = 0; show(); $('#pl-play', host).textContent = '❚❚ Pause'; iv = setInterval(() => { if (!host.isConnected) return clearInterval(iv); if (k >= caps.length - 1) return stop(); k++; show(); }, 3800); };
    $('#pl-play', host).onclick = () => iv ? stop() : play();
    $('#pl-next', host).onclick = () => { stop(); k = Math.min(caps.length - 1, k + 1); show(); };
    $('#pl-prev', host).onclick = () => { stop(); k = Math.max(0, k - 1); show(); };
    show(); if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) play();
  }

  // ---------- Aufgaben ----------
  function prep(t, seed, guided) {
    if (!t.gen) return t;
    const g = M.gens[t.gen](seed ? M.rng(seed) : null);
    return Object.assign({ type: 'num' }, t, g, { guided: guided || t.guided, _seeded: !!seed });
  }
  const parts = t => t.parts || [{ l: t.label || '', a: t.a, tol: t.tol, abs: t.abs, u: t.unit }];
  const figHtml = t => t.fig ? `<div class="figwrap">${(typeof t.fig === 'function' ? t.fig() : M.figs[t.fig]()).replace(/ data-f="\d+"/g, '')}</div>` : '';

  function renderTask(host, t, report, o) {
    o = o || {}; let tries = 0, sel = null, multi = new Set(), seq = [], cells = {}, simH = null, done = false;
    const uid = t.id || 'rem';
    let body = '';
    const order = t.opts ? M.shuffle(t.opts.map((_, i) => i)) : [];
    if (t.type === 'mc' || t.type === 'multi') body = `<div class="opts">${order.map(i => `<button class="opt ${t.type}" data-i="${i}"><span class="mk"></span><span>${T(t.opts[i])}</span></button>`).join('')}</div>` + (t.type === 'multi' ? '<p class="mute">Mehrere Antworten können richtig sein.</p>' : '');
    else if (t.type === 'num') body = parts(t).map((p, i) => `<div class="numrow">${p.l ? `<label for="${uid}-n${i}">${T(p.l)}</label>` : ''}<input class="num" type="text" inputmode="decimal" id="${uid}-n${i}" autocomplete="off" placeholder="Zahl, z. B. 0,25"><span>${T(p.u || '')}</span></div>`).join('') + '<p class="mute">Komma oder Punkt sind erlaubt, Zehnerpotenzen als 2,3e-9.</p>';
    else if (t.type === 'order') body = `<p class="mute">Klicke die Bausteine in der richtigen Reihenfolge an. Ein Klick auf einen einsortierten Baustein nimmt ihn wieder heraus.</p><div class="seq" id="seq"></div><div class="chips" id="pool"></div>`;
    else if (t.type === 'match') { const rights = M.shuffle(t.pairs.map(p => p[1])); body = `<div class="match">${t.pairs.map((p, i) => `<label for="${uid}-m${i}">${T(p[0])}</label><select id="${uid}-m${i}" data-i="${i}"><option value="">– wählen –</option>${rights.map(r => `<option>${M.esc(r)}</option>`).join('')}</select>`).join('')}</div>`; }
    else if (t.type === 'tt') { const n = t.vars.length; let rows = ''; for (let r = 0; r < (1 << n); r++) { const bits = t.vars.map((_, i) => (r >> (n - 1 - i)) & 1); rows += `<tr>${bits.map(b => `<td>${b}</td>`).join('')}<td class="cell" data-r="${r}" tabindex="0">?</td></tr>`; } body = `<p class="mute">Klicke in die rechte Spalte, um zwischen 0 und 1 zu wechseln.</p><div class="scroll"><table class="tt"><tr>${t.vars.map(v => `<th>${v}</th>`).join('')}<th>${t.out || 'y'}</th></tr>${rows}</table></div>`; }
    else if (t.type === 'sim') body = `<div id="tsim"></div>`;
    const guidedBox = t.guided && t.given ? `<dl class="given"><dt>Gegeben</dt><dd>${t.given.map(T).join(' · ')}</dd><dt>Gesucht</dt><dd>${T(t.want || '')}</dd>${t.formula ? `<dt>Formel</dt><dd>${M.fm(fById(t.formula).f)}</dd>` : ''}${t.steps ? `<dt>Vorgehen</dt><dd>${T(t.steps)}</dd>` : ''}</dl>` : '';
    host.innerHTML = `<div class="col" style="gap:16px"><div class="row">${t.src ? `<span class="tag sig">${t.src}</span>` : ''}${o.exam ? '<span class="tag warn">Probeklausur · ein Versuch</span>' : ''}${t._seeded ? '<span class="tag">neue Zahlen</span>' : ''}</div><div class="q">${T(t.q)}</div>${figHtml(t)}${guidedBox}${body}<div id="fb"></div><div class="sheet-foot"><button class="btn ghost" id="t-stuck">Ich komme nicht weiter</button><button class="btn sig" id="t-check">Prüfen</button></div></div>`;
    const fb = $('#fb', host);
    if (t.type === 'sim') simH = M.mountSim($('#tsim', host), t.sim, Object.assign({ uid: 't' }, t.preset));
    $$('.opt', host).forEach(b => b.onclick = () => { if (done) return; const i = +b.dataset.i; if (t.type === 'mc') { sel = i; $$('.opt', host).forEach(x => x.classList.toggle('sel', x === b)); } else { multi.has(i) ? multi.delete(i) : multi.add(i); b.classList.toggle('sel'); } });
    if (t.type === 'order') { const pool = M.shuffle(t.items.map((_, i) => i)); const draw = () => { $('#seq', host).innerHTML = seq.map(i => `<button class="chip" data-i="${i}">${T(t.items[i])}</button>`).join(''); $('#pool', host).innerHTML = pool.filter(i => !seq.includes(i)).map(i => `<button class="chip" data-i="${i}">${T(t.items[i])}</button>`).join(''); $$('#pool .chip', host).forEach(c => c.onclick = () => { if (!done) { seq.push(+c.dataset.i); draw(); } }); $$('#seq .chip', host).forEach(c => c.onclick = () => { if (!done) { seq = seq.filter(x => x !== +c.dataset.i); draw(); } }); }; draw(); }
    $$('td.cell', host).forEach(c => { const tog = () => { if (done) return; const r = c.dataset.r; cells[r] = cells[r] === 1 ? 0 : 1; c.textContent = cells[r]; c.classList.remove('wrong', 'right'); }; c.onclick = tog; c.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tog(); } }; });
    $$('input.num', host).forEach(inp => inp.onkeydown = e => { if (e.key === 'Enter') $('#t-check', host).click(); });

    function check() {
      if (t.type === 'mc') { if (sel == null) return null; return sel === t.a; }
      if (t.type === 'multi') { if (!multi.size) return null; return multi.size === t.a.length && t.a.every(i => multi.has(i)); }
      if (t.type === 'num') { let all = true, any = false; parts(t).forEach((p, i) => { const inp = $('#' + uid + '-n' + i, host); if (inp.value.trim()) any = true; const ok = M.numOk(M.parseNum(inp.value), p.a, p.tol, p.abs); inp.classList.toggle('bad', !ok); inp.classList.toggle('good', ok); if (!ok) all = false; }); return any ? all : null; }
      if (t.type === 'order') { if (seq.length < t.items.length) return null; return seq.every((v, i) => v === i); }
      if (t.type === 'match') { let all = true, any = false; $$('select', host).forEach(s => { if (s.value) any = true; const ok = s.value === t.pairs[+s.dataset.i][1]; s.classList.toggle('bad', !ok); s.classList.toggle('good', ok); if (!ok) all = false; }); return any ? all : null; }
      if (t.type === 'tt') { const n = t.vars.length; let all = true; if (Object.keys(cells).length < (1 << n)) return null; $$('td.cell', host).forEach(c => { const r = +c.dataset.r; const bits = t.vars.map((_, i) => (r >> (n - 1 - i)) & 1); const ok = cells[r] === (t.fn(...bits) ? 1 : 0); c.classList.toggle('wrong', !ok); c.classList.toggle('right', ok); if (!ok) all = false; }); return all; }
      if (t.type === 'sim') return !!t.check(simH.st);
    }
    const solution = () => { let s = ''; if (t.type === 'mc') s = `<p>Richtig ist: <b>${T(t.opts[t.a])}</b></p>`; if (t.type === 'multi') s = `<p>Richtig sind: ${t.a.map(i => '<b>' + T(t.opts[i]) + '</b>').join(' · ')}</p>`; if (t.type === 'num') s = `<p>Ergebnis: ${parts(t).map(p => (p.l ? T(p.l) + ' ' : '') + '<b class="mono">' + M.fmt(p.a) + '</b> ' + T(p.u || '')).join(' · ')}</p>`; if (t.type === 'order') s = `<ol>${t.items.map(i => `<li>${T(i)}</li>`).join('')}</ol>`; if (t.type === 'match') s = `<ul>${t.pairs.map(p => `<li>${T(p[0])} → <b>${T(p[1])}</b></li>`).join('')}</ul>`; if (t.type === 'tt') { $$('td.cell', host).forEach(c => { const r = +c.dataset.r, n = t.vars.length; c.textContent = t.fn(...t.vars.map((_, i) => (r >> (n - 1 - i)) & 1)) ? 1 : 0; c.classList.remove('wrong'); c.classList.add('right'); }); s = '<p>Die Tabelle zeigt jetzt die richtige Lösung.</p>'; } return s + (t.sol ? [].concat(t.sol).map(p => `<p>${T(p)}</p>`).join('') : ''); };
    const lock = () => { done = true; $$('.opt', host).forEach(b => { const i = +b.dataset.i; const right = t.type === 'mc' ? i === t.a : t.a.includes(i); if (right) b.classList.add('right'); else if (b.classList.contains('sel')) b.classList.add('wrong'); }); $$('input,select', host).forEach(x => { if (!x.closest('.sim-ctl')) x.disabled = true; }); $('#t-check', host).hidden = true; $('#t-stuck', host).hidden = true; };
    const cont = () => { fb.insertAdjacentHTML('beforeend', `<div class="row" style="justify-content:flex-end"><button class="btn" id="t-next">Weiter</button></div>`); $('#t-next', host).onclick = o.onNext || next; $('#t-next', host).focus(); };

    $('#t-check', host).onclick = () => {
      const r = check(); if (r === null) { fb.innerHTML = `<div class="fb hint">Gib zuerst eine vollständige Antwort ein.</div>`; return; }
      tries++;
      if (r) { lock(); fb.innerHTML = `<div class="fb ok"><b class="h">Richtig${tries === 1 ? '' : ' im zweiten Anlauf'}.</b>${t.sol ? [].concat(t.sol).map(p => `<p>${T(p)}</p>`).join('') : ''}</div>`; report({ ok: true, tries }); cont(); }
      else if (tries === 1 && !o.exam && !o.rem) fb.innerHTML = `<div class="fb hint"><b class="h">Noch nicht.</b><p>${T(t.hint || 'Lies die Aufgabe noch einmal genau und versuche es erneut. Die Formelsammlung oben rechts hilft.')}</p></div>`;
      else fail();
    };
    $('#t-stuck', host).onclick = fail;

    function fail() {
      lock();
      if (o.rem) { fb.innerHTML = `<div class="fb bad"><b class="h">Lösung</b>${solution()}</div>`; report({ ok: false }); return cont(); }
      const isNum = t.type === 'num' || t.type === 'sim'; const keys = isNum ? ['formel', 'umstellen', 'einheit', 'rechnen', 'begriff', 'verstehen'] : ['begriff', 'verwechselt', 'verstehen', 'fluechtig'];
      let reason = null;
      fb.innerHTML = `<div class="fb hint"><b class="h">Woran lag es?</b><p>Deine Antwort entscheidet, welche Übungen du als Nächstes bekommst.</p><div class="chips">${keys.map(k => `<button class="chip" data-r="${k}">${REASONS[k]}</button>`).join('')}</div><label for="why-${uid}" class="mute">Was genau war unklar? (freiwillig)</label><textarea id="why-${uid}" placeholder="z. B. Ich wusste nicht, was mit Arbeitspunkt gemeint ist."></textarea><div class="row" style="justify-content:flex-end"><button class="btn" id="t-sol" disabled>Lösung zeigen</button></div></div>`;
      $$('.chip[data-r]', fb).forEach(c => c.onclick = () => { reason = c.dataset.r; $$('.chip[data-r]', fb).forEach(x => x.classList.toggle('sel', x === c)); $('#t-sol', fb).disabled = false; });
      $('#t-sol', fb).onclick = () => {
        const note = $('#why-' + uid, fb).value.trim(); const items = remedial(t, reason);
        items.forEach(it => S.queue.push(it));
        S.log.push({ ts: Date.now(), day: t.day || (run && run.day.n), id: t.id, topic: t.topic, q: String(t.q).replace(/<[^>]+>/g, '').slice(0, 140), reason, note, n: items.length });
        const fid = t.formula; if (fid && (reason === 'formel' || reason === 'umstellen')) S.weakF[fid] = (S.weakF[fid] || 0) + 1;
        fb.innerHTML = `<div class="fb bad"><b class="h">Lösung</b>${solution()}</div><div class="fb info"><b class="h">Daraus entstehen neue Lernaufgaben</b><ul>${items.map(it => `<li>${describe(it)}</li>`).join('')}</ul><p class="mute">Sie liegen in deiner Werkstatt und kommen beim nächsten Tagesstart dran.</p></div>`;
        report({ ok: false, tries, added: items }); save(); cont();
      };
    }
  }

  // ---------- Fehleranalyse → neue Aufgaben ----------
  const seed = () => 1 + Math.floor(Math.random() * 1e9);
  function remedial(t, reason) {
    const tp = t.topic, info = M.topics[tp] || {}; const refs = M.shuffle((topicRefs[tp] || []).filter(id => id !== t.id));
    const genName = t.gen || (info.gens || [])[0]; const fid = t.formula || (info.formulas || [])[0];
    const card = info.card ? [{ k: 'card', topic: tp }] : [], self = t.id ? [{ k: 'ref', id: t.id }] : [];
    const gen = guided => genName ? [{ k: 'gen', gen: genName, topic: tp, seed: seed(), guided }] : self;
    const ref = n => refs.slice(0, n).map(id => ({ k: 'ref', id }));
    const fq = fid ? [{ k: 'formel', fid }] : [];
    const unit = () => ({ k: 'gen', gen: 'einheit', topic: 'einheiten', seed: seed() });
    const plan = {
      begriff: () => t.type === 'num' ? card.concat(ref(1), gen(true)) : card.concat(ref(2), refs.length ? [] : self),
      verwechselt: () => card.concat(self, ref(1)), verstehen: () => t.type === 'num' ? card.concat(gen(true)) : card.concat(self),
      fluechtig: () => self.length ? self : gen(false), formel: () => fq.concat(gen(true)), umstellen: () => gen(true).concat(gen(false)),
      einheit: () => [unit(), unit()].concat(gen(false)), rechnen: () => gen(false).concat(gen(false))
    }[reason]();
    const key = it => it.k + '|' + (it.id || it.fid || (it.k === 'card' ? it.topic : it.gen + (it.guided ? 'g' : '')));
    const have = new Set(S.queue.map(key)); const seen = new Set();
    const uniq = plan.filter(it => { const k = key(it); if (it.k !== 'gen' && have.has(k)) return false; if (it.k === 'gen' && S.queue.filter(q => key(q) === k).length >= 2) return false; if (seen.has(k) && it.k !== 'gen') return false; seen.add(k); return true; });
    const stamp = Date.now(); return (uniq.length ? uniq : plan.slice(0, 1)).map((it, i) => Object.assign(it, { from: t.id, reason, qid: stamp + '-' + i }));
  }
  const fById = id => M.formulas.find(f => f.id === id) || { name: id, f: '' };
  function describe(it) {
    const tt = (M.topics[it.topic] || {}).title;
    if (it.k === 'card') return 'Kurzerklärung: ' + (tt || it.topic);
    if (it.k === 'formel') return 'Formel-Check: ' + fById(it.fid).name;
    if (it.k === 'gen') return it.gen === 'einheit' ? 'Einheiten-Training: Vorsätze umrechnen' : (it.guided ? 'Geführte Rechenaufgabe mit neuen Zahlen' : 'Rechenaufgabe mit neuen Zahlen') + (tt ? ': ' + tt : '');
    const rt = tasks[it.id]; return 'Wiederholung: ' + (rt ? String(rt.q).replace(/<[^>]+>/g, '').replace(/\$/g, '').slice(0, 70) + '…' : 'Aufgabe');
  }
  function renderRem(host, it, onNext) {
    const drop = () => { S.queue = S.queue.filter(q => q.qid !== it.qid); S.xp += 8; save(); };
    if (it.k === 'card') {
      const info = M.topics[it.topic] || {};
      host.innerHTML = `<div class="col" style="gap:16px"><span class="tag">Kurzerklärung</span><h2>${info.title || ''}</h2>${[].concat(info.card || []).map(p => `<p>${T(p)}</p>`).join('')}${info.fig ? `<div class="figwrap">${M.figs[info.fig]().replace(/ data-f="\d+"/g, '')}</div>` : ''}${(info.formulas || []).length ? `<div class="fgrid">${info.formulas.map(id => fcard(fById(id))).join('')}</div>` : ''}<div class="sheet-foot"><span></span><button class="btn" id="c-ok">Verstanden, weiter</button></div></div>`;
      $('#c-ok', host).onclick = () => { drop(); onNext(); }; return;
    }
    let t;
    if (it.k === 'ref') t = tasks[it.id];
    else if (it.k === 'gen') t = prep({ gen: it.gen, topic: it.topic }, it.seed, it.guided);
    else if (it.k === 'formel') { const f = fById(it.fid); const others = M.shuffle(M.formulas.filter(x => x.ch === f.ch && x.id !== f.id)).slice(0, 3); t = { type: 'mc', q: 'Welche Formel gehört zu: <b>' + f.name + '</b>?', opts: [f].concat(others).map(x => '$' + x.f + '$'), a: 0, sol: f.sym ? 'Dabei gilt: ' + M.esc(f.sym) : '' }; }
    if (!t) { drop(); return onNext(); }
    renderTask(host, Object.assign({}, t, { id: 'r' + it.qid }), r => { if (r.ok) drop(); else { if (it.k === 'gen') it.seed = seed(); save(); } }, { rem: true, onNext });
  }
  function vWerkstatt() {
    if (!S.queue.length) { main.innerHTML = `<section class="stage"><div class="sheet"><h2>Werkstatt</h2><p>Hier landen Übungen, die aus deiner Fehleranalyse entstehen. Im Moment ist nichts offen.</p><div class="sheet-foot"><span></span><button class="btn" data-nav="hub">Zum Anlagenplan</button></div></div></section>`; return; }
    const list = S.queue.slice(0, 6); let i = 0;
    const step = () => { if (i >= list.length) return nav('werkstatt'); main.innerHTML = `<section class="stage"><div class="prog"><span>WERKSTATT · Übung ${i + 1} von ${list.length}</span><div class="bar"><i style="width:${100 * i / list.length}%"></i></div><span>${S.queue.length} offen</span></div><div class="sheet"><span class="tag sig">${REASONS[list[i].reason] || 'Übung'}</span><div id="task"></div></div></section>`; renderRem($('#task'), list[i], () => { i++; step(); window.scrollTo(0, 0); }); };
    step();
  }

  // ---------- Formelsammlung ----------
  function fcard(f) { const locked = f.day > S.maxDay; return `<div class="fcard ${locked ? 'locked' : ''} ${S.weakF[f.id] ? 'weak' : ''}"><div class="row" style="justify-content:space-between"><b>${f.name}</b>${S.weakF[f.id] ? '<span class="tag sig">Übungsbedarf</span>' : ''}</div>${locked ? `<span class="mute">Wird an Tag ${f.day} freigeschaltet.</span>` : `<div class="fbox">${M.fm(f.f)}</div><span class="mute">${M.esc(f.sym || '')}${f.ref ? (f.sym ? ' · ' : '') + 'Skript ' + (/^Abb/.test(f.ref) ? f.ref : 'Gl. ' + f.ref) : ''}</span>`}</div>`; }
  function fList(filter, onlyOpen) { return ['Messen', 'Steuern', 'Regeln'].map(ch => { const fs = M.formulas.filter(f => f.ch === ch && (!onlyOpen || f.day <= S.maxDay) && (!filter || (f.name + ' ' + f.sym).toLowerCase().includes(filter))); return fs.length ? `<div class="col"><h3>${ch}</h3><div class="fgrid">${fs.map(fcard).join('')}</div></div>` : ''; }).join(''); }
  function vFormeln() {
    main.innerHTML = `<section class="col"><span class="eyebrow">${M.formulas.filter(f => f.day <= S.maxDay).length} von ${M.formulas.length} freigeschaltet</span><h1>Formelsammlung</h1><div class="row"><label for="f-search">Suchen</label><input type="text" id="f-search" placeholder="z. B. Brücke"></div></section><section class="col" id="f-list" style="gap:24px">${fList()}</section>
      <section class="col"><h3>t-Tabelle (Vertrauensbereich)</h3><div class="scroll"><table class="dt mono"><tr><th>n</th><th>P = 90 %</th><th>95 %</th><th>99 %</th></tr>${Object.keys(M.tTable).map(n => `<tr><td>${n}</td>${M.tTable[n].map(v => `<td>${M.fmt(v)}</td>`).join('')}</tr>`).join('')}</table></div></section>`;
    $('#f-search').oninput = e => { $('#f-list').innerHTML = fList(e.target.value.trim().toLowerCase()); };
  }
  function openDrawer() { drawer.hidden = false; drawer.innerHTML = `<div class="row" style="justify-content:space-between"><h2>Formelsammlung</h2><button class="btn ghost sm" id="dr-x">Schließen</button></div>${fList('', true)}<div class="scroll"><table class="dt mono"><tr><th>n</th><th>90 %</th><th>95 %</th><th>99 %</th></tr>${Object.keys(M.tTable).map(n => `<tr><td>${n}</td>${M.tTable[n].map(v => `<td>${M.fmt(v)}</td>`).join('')}</tr>`).join('')}</table></div>`; $('#dr-x').onclick = () => drawer.hidden = true; }

  // ---------- Labor ----------
  function vLabor(name) {
    const keys = Object.keys(M.sims); name = name || keys[0];
    main.innerHTML = `<section class="col"><span class="eyebrow">Frei experimentieren</span><h1>Labor</h1><div class="chips">${keys.map(k => `<button class="chip ${k === name ? 'sel' : ''}" data-s="${k}">${M.sims[k].title}</button>`).join('')}</div></section><section class="sheet"><h2>${M.sims[name].title}</h2><div id="lab"></div></section>`;
    M.mountSim($('#lab'), name, { uid: 'lab' }); $$('[data-s]').forEach(b => b.onclick = () => vLabor(b.dataset.s));
  }

  // ---------- Lernprotokoll ----------
  function vProtokoll() {
    const byR = {}; S.log.forEach(l => byR[l.reason] = (byR[l.reason] || 0) + 1); const byT = {}; S.log.forEach(l => byT[l.topic] = (byT[l.topic] || 0) + 1);
    const txt = 'MSR Werkjahr – Lernprotokoll\nStand: Tag ' + nDone() + '/20, ' + S.xp + ' XP\n\n' + (S.log.length ? S.log.map(l => `Tag ${l.day} | Thema: ${(M.topics[l.topic] || {}).title || l.topic} | Grund: ${REASONS[l.reason]}${l.note ? ' | Notiz: ' + l.note : ''}\n  Aufgabe: ${l.q}`).join('\n') : 'Noch keine offenen Punkte.');
    main.innerHTML = `<section class="col"><span class="eyebrow">Fehleranalyse</span><h1>Lernprotokoll</h1><p class="mute" style="max-width:68ch">Jede Aufgabe, die nicht geklappt hat, steht hier mit deinem Grund. Daraus entstehen die Übungen in der Werkstatt.</p></section>
      ${S.log.length ? `<section class="row" style="gap:24px;align-items:flex-start"><div class="col"><h3>Häufigste Gründe</h3>${Object.keys(byR).sort((a, b) => byR[b] - byR[a]).map(k => `<span><b class="mono">${byR[k]}×</b> ${REASONS[k]}</span>`).join('')}</div><div class="col"><h3>Themen mit Übungsbedarf</h3>${Object.keys(byT).sort((a, b) => byT[b] - byT[a]).slice(0, 6).map(k => `<span><b class="mono">${byT[k]}×</b> ${(M.topics[k] || {}).title || k}</span>`).join('')}</div></section>` : ''}
      <section class="col">${S.log.length ? S.log.slice().reverse().map(l => `<div class="logrow"><div class="row"><span class="tag">Tag ${l.day}</span><span class="tag warn">${REASONS[l.reason]}</span><span class="mute">${new Date(l.ts).toLocaleDateString('de-DE')}</span></div><span>${M.esc(l.q)}</span>${l.note ? `<span class="mute">Deine Notiz: ${M.esc(l.note)}</span>` : ''}</div>`).join('') : '<div class="logrow">Noch keine Einträge. Sobald eine Aufgabe nicht klappt, fragt das Spiel nach dem Grund.</div>'}</section>
      <section class="col"><h3>Protokoll weitergeben</h3><p class="mute" style="max-width:68ch">Diesen Text kannst du kopieren, zum Beispiel um dir daraus gezielt weitere Aufgaben bauen zu lassen.</p><textarea id="exp" readonly rows="6">${M.esc(txt)}</textarea><div class="row"><button class="btn ghost" id="exp-copy">Text kopieren</button><span id="exp-msg" class="mute"></span></div></section>
      <section class="col"><h3>Spielstand</h3><div class="row"><button class="btn ghost" id="reset">Spielstand löschen</button><span id="reset-msg" class="mute">Der Spielstand liegt nur in diesem Browser.</span></div></section>`;
    $('#exp-copy').onclick = () => { const ta = $('#exp'); const done = () => $('#exp-msg').textContent = 'Kopiert.'; if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done).catch(() => { ta.select(); $('#exp-msg').textContent = 'Text ist markiert, bitte mit Strg+C kopieren.'; }); else { ta.select(); $('#exp-msg').textContent = 'Text ist markiert, bitte mit Strg+C kopieren.'; } };
    let armed = false; $('#reset').onclick = () => { if (!armed) { armed = true; $('#reset').textContent = 'Wirklich alles löschen'; $('#reset').classList.add('sig'); $('#reset-msg').textContent = 'Das entfernt alle Tage, XP und das Protokoll.'; return; } try { localStorage.removeItem(KEY); } catch (e) { } location.reload(); };
  }

  M._debug = { tasks, prep, S: () => S, nav, remedial };
  nav('hub');
})(window.MSR);
