/* Skizzen. Jede Figur liefert SVG; Elemente mit data-f="k" erscheinen ab Erklärschritt k. */
(function (M) {
  const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" class="fig" role="img"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="fi"/></marker><marker id="ahs" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="fs"/></marker></defs>${body}</svg>`;
  const lines = (x, y, t, cls, anchor) => { const p = String(t).split('|'); return p.map((l, k) => `<text class="${cls || ''}" x="${x}" y="${y + (k - (p.length - 1) / 2) * 16 + 5}" text-anchor="${anchor || 'middle'}">${l}</text>`).join(''); };
  const box = (x, y, w, h, t, f, c) => `<g data-f="${f || 0}" class="bx ${c || ''}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/>${lines(x + w / 2, y + h / 2, t)}</g>`;
  const arr = (x1, y1, x2, y2, t, f, c, dy) => `<g data-f="${f || 0}"><line class="ln ${c || ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#${c === 'hi' ? 'ahs' : 'ah'})"/>${t ? lines((x1 + x2) / 2, (y1 + y2) / 2 - (dy == null ? 14 : dy), t, 's') : ''}</g>`;
  const ln = (pts, f, c) => `<polyline data-f="${f || 0}" class="ln ${c || ''}" points="${pts}"/>`;
  const txt = (x, y, t, f, c, a) => `<g data-f="${f || 0}">${lines(x, y, t, c, a)}</g>`;
  const sum = (x, y, f, minus) => `<g data-f="${f || 0}" class="bx"><circle cx="${x}" cy="${y}" r="11"/></g>` + (minus ? `<text data-f="${f || 0}" x="${x - 20}" y="${y + 26}" class="ts">−</text>` : '');
  const dot = (x, y, f) => `<circle data-f="${f || 0}" cx="${x}" cy="${y}" r="4" class="fi"/>`;
  M.svgkit = { svg, box, arr, ln, txt, sum, dot, lines };
  const F = M.figs;

  F.messkette = () => svg(760, 250,
    box(10, 80, 120, 60, 'Messobjekt|Prozess', 0) + arr(130, 110, 180, 110, 'Messgröße', 0) +
    box(180, 70, 150, 80, 'Messgrößen-|aufnahme|(Sensor)', 1, 'hi') + arr(330, 110, 390, 110, 'Messsignal', 1) +
    box(390, 70, 150, 80, 'Messsignal-|verarbeitung|(Verstärker)', 2, 'pe') + arr(540, 110, 600, 110, 'Messwert', 2) +
    box(600, 70, 150, 80, 'Messwert-|ausgabe|(Anzeige)', 3) +
    box(390, 195, 150, 44, 'Hilfsenergie', 4) + arr(465, 195, 465, 152, '', 4) + ln('255,172 255,180 675,180 675,172', 4) + arr(255, 180, 255, 152, '', 4) + arr(675, 180, 675, 152, '', 4) +
    box(310, 5, 310, 30, 'Umgebung: Einfluss- und Störgrößen', 5) + arr(255, 35, 255, 68, '', 5) + arr(465, 35, 465, 68, '', 5) + arr(675, 35, 675, 68, '', 5) + ln('255,35 310,20', 5) + ln('620,20 675,35', 5));

  F.kette3 = () => svg(700, 150,
    arr(10, 70, 80, 70, 'Weg s', 0) + box(80, 40, 120, 60, 'Wegsensor|s → U', 0, 'hi') + arr(200, 70, 290, 70, 'Spannung U', 0) + box(290, 40, 120, 60, 'Verstärker|U → I', 0, 'pe') + arr(410, 70, 500, 70, 'Strom I', 0) + box(500, 40, 120, 60, 'Anzeige|I → Sk', 0) + arr(620, 70, 690, 70, 'Skale', 0) +
    txt(140, 125, 'c₁ = 0,1 µm/µV', 0, 'mono s') + txt(350, 125, 'c₂ = 100 µV/mA', 0, 'mono s') + txt(560, 125, 'c₃ = 0,01 mA/Sk', 0, 'mono s'));

  F.kennlinie = () => svg(520, 300,
    arr(60, 260, 500, 260, '', 0) + arr(60, 260, 60, 20, '', 0) + txt(480, 282, 'Eingangsgröße x', 0, 's', 'end') + txt(70, 22, 'Ausgangsgröße y', 0, 's', 'start') +
    `<path data-f="0" class="ln pe" d="M60 260 C140 170 220 170 300 140 S440 90 480 30"/>` +
    `<circle data-f="1" cx="300" cy="140" r="5" class="fs"/>` + txt(250, 122, 'Arbeitspunkt', 1, 'ts') +
    ln('230,166 370,114', 2, 'hi') + ln('250,159 350,159 350,121', 2, 'dash') + txt(300, 176, 'dx', 2, 's') + txt(364, 142, 'dy', 2, 's') +
    txt(420, 200, 'ε = dy/dx|Steigung = Empfindlichkeit', 3, 'tp'));

  F.abweichung = () => svg(560, 300,
    arr(60, 260, 540, 260, '', 0) + arr(60, 260, 60, 20, '', 0) + txt(530, 282, 'Eingangsgröße x', 0, 's', 'end') + txt(70, 22, 'y', 0, 's', 'start') +
    ln('100,220 480,70', 0, 'pe') + txt(420, 130, 'Sollkennlinie yₛ', 0, 'tp') +
    `<path data-f="1" class="ln hi" d="M100 200 C200 110 380 60 480 50"/>` + txt(250, 82, 'Istkennlinie yᵢ', 1, 'ts') +
    ln('300,141 300,99', 2, '') + txt(308, 124, 'F_abs = yᵢ − yₛ', 2, '', 'start') +
    ln('92,200 92,220', 3, '') + txt(86, 240, 'F₀ Nullpunkt-|abweichung', 3, 's', 'middle'));

  F.linear = () => svg(680, 260,
    txt(170, 18, 'Festpunktmethode', 0) + txt(510, 18, 'Toleranzbandmethode', 1) +
    arr(30, 230, 310, 230, '', 0) + arr(30, 230, 30, 30, '', 0) + ln('60,200 290,60', 0, 'pe') + `<path data-f="0" class="ln hi" d="M60 200 C120 100 220 70 290 60"/>` + ln('160,139 160,98', 0) + txt(210, 150, 'max. Linearitäts-|abweichung', 0, 's') + txt(170, 250, 'Soll- und Istkennlinie decken sich an Anfang A und Ende E', 0, 's') +
    arr(370, 230, 650, 230, '', 1) + arr(370, 230, 370, 30, '', 1) + ln('400,180 630,50', 1, 'pe') + `<path data-f="1" class="ln hi" d="M400 205 C460 95 560 70 630 62"/>` + txt(510, 250, 'Sollkennlinie so gelegt, dass die Abweichung minimal wird', 1, 's'));

  F.messschaltung = () => svg(720, 250,
    txt(180, 18, 'a) stromrichtig', 0) + txt(540, 18, 'b) spannungsrichtig', 1) +
    // a
    ln('40,60 110,60', 0) + `<g data-f="0" class="bx hi"><circle cx="130" cy="60" r="20"/></g>` + txt(130, 60, 'A', 0) + ln('150,60 300,60 300,100', 0) + box(280, 100, 40, 80, 'Rₓ', 0) + ln('300,180 300,220 40,220', 0) +
    ln('70,60 70,120', 0) + `<g data-f="0" class="bx pe"><circle cx="70" cy="140" r="20"/></g>` + txt(70, 140, 'V', 0) + ln('70,160 70,220', 0) + txt(190, 130, 'A misst I durch Rₓ richtig,|V misst U über A + Rₓ', 0, 's') + txt(180, 245, 'Rₓ = U/I − R_A', 0, 'tp') +
    // b
    ln('400,60 430,60', 1) + `<g data-f="1" class="bx hi"><circle cx="450" cy="60" r="20"/></g>` + txt(450, 60, 'A', 1) + ln('470,60 660,60 660,100', 1) + box(640, 100, 40, 80, 'Rₓ', 1) + ln('660,180 660,220 400,220', 1) +
    ln('560,60 560,120', 1) + `<g data-f="1" class="bx pe"><circle cx="560" cy="140" r="20"/></g>` + txt(560, 140, 'V', 1) + ln('560,160 560,220', 1) + txt(470, 150, 'V misst U an Rₓ|richtig, A misst|I durch Rₓ und V', 1, 's') + txt(540, 245, 'Rₓ = U / (I − U/R_V)', 1, 'tp'));

  F.wheatstone = () => svg(520, 300,
    ln('60,150 200,50 340,150 200,250 60,150', 0) +
    box(105, 80, 50, 30, 'R₁', 0) + box(245, 80, 50, 30, 'R₂', 0) + box(105, 190, 50, 30, 'R₃', 0) + box(245, 190, 50, 30, 'R₄', 0, 'hi') +
    ln('60,150 20,150 20,285 380,285 380,150 340,150', 1) + txt(200, 278, 'Speisung U₀', 1, 's') +
    ln('200,50 200,120', 2, 'pe') + ln('200,180 200,250', 2, 'pe') + `<g data-f="2" class="bx pe"><circle cx="200" cy="150" r="24"/></g>` + txt(200, 150, 'U', 2) +
    txt(440, 110, 'Zwei Spannungs-|teiler: R₁/R₂|und R₃/R₄', 1, 's') + txt(440, 190, 'Abgeglichen:|U = 0 V  ⇔|R₁·R₄ = R₂·R₃', 3, 'tp'));

  F.steuerung = () => svg(720, 170,
    arr(10, 80, 90, 80, 'Führungs-|größe w', 0, '', 24) + box(90, 50, 170, 60, 'Steuereinrichtung', 0, 'pe') + arr(260, 80, 370, 80, 'Stellgröße y', 1) + box(370, 50, 170, 60, 'Steuerstrecke', 1, 'hi') + arr(540, 80, 700, 80, 'Steuergröße x', 2) +
    arr(455, 10, 455, 48, '', 3) + txt(520, 20, 'Störgröße z', 3, 's') + txt(360, 150, 'Offener Wirkungsweg: Die Steuerung erfährt nicht, was am Ende herauskommt.', 4, 'ts'));
  F.stoeraufschaltung = () => svg(720, 190,
    arr(10, 100, 90, 100, 'w', 0) + box(90, 70, 170, 60, 'Steuereinrichtung', 0, 'pe') + arr(260, 100, 370, 100, 'y', 0) + box(370, 70, 170, 60, 'Steuerstrecke', 0, 'hi') + arr(540, 100, 700, 100, 'x', 0) +
    arr(455, 20, 455, 68, '', 0) + txt(500, 34, 'z', 0, 's') + ln('455,20 175,20', 1, 'hi') + arr(175, 20, 175, 68, '', 1, 'hi') + txt(310, 40, 'Störgröße wird gemessen und aufgeschaltet', 1, 'ts') + txt(360, 170, 'Immer noch keine Rückführung von x: es bleibt eine Steuerung.', 2, 's'));
  F.regelkreis = () => svg(760, 230,
    arr(10, 80, 100, 80, 'Führungs-|größe w', 0, '', 24) + sum(112, 80, 0, true) + arr(123, 80, 190, 80, 'e', 1) + box(190, 50, 130, 60, 'Regler', 1, 'pe') + arr(320, 80, 400, 80, 'Stellgröße u', 2) + sum(412, 80, 2) + arr(423, 80, 470, 80, '', 2) + box(470, 50, 130, 60, 'Strecke', 2, 'hi') + arr(600, 80, 750, 80, 'Regelgröße y', 3) +
    arr(412, 20, 412, 68, '', 4) + txt(470, 28, 'Störgröße d', 4, 's') +
    dot(660, 80, 5) + ln('660,80 660,180 112,180', 5, 'hi') + arr(112, 180, 112, 92, '', 5, 'hi') + txt(390, 200, 'Rückführung: y wird fortlaufend gemessen und mit w verglichen (e = w − y)', 5, 'ts'));

  // IEC-Gattersymbole
  const gate = (x, y, sym, name, n) => `<g class="bx"><rect x="${x}" y="${y}" width="56" height="56" rx="3"/><text x="${x + 28}" y="${y + 33}" text-anchor="middle">${sym}</text></g><line class="ln" x1="${x - 18}" y1="${y + 16}" x2="${x}" y2="${y + 16}"/>` + (n.one ? '' : `<line class="ln" x1="${x - 18}" y1="${y + 40}" x2="${x}" y2="${y + 40}"/>`) + (n.neg ? `<circle cx="${x + 61}" cy="${y + 28}" r="5" class="fl" stroke="currentColor" stroke-width="1.5"/><line class="ln" x1="${x + 66}" y1="${y + 28}" x2="${x + 80}" y2="${y + 28}"/>` : `<line class="ln" x1="${x + 56}" y1="${y + 28}" x2="${x + 80}" y2="${y + 28}"/>`) + `<text x="${x + 28}" y="${y + 78}" text-anchor="middle" class="s">${name}</text>`;
  F.gatter = () => svg(720, 110, gate(30, 8, '&amp;', 'UND  a ∧ b', {}) + gate(150, 8, '≥1', 'ODER  a ∨ b', {}) + gate(270, 8, '1', 'NICHT  ¬a', { one: 1, neg: 1 }) + gate(390, 8, '&amp;', 'NAND', { neg: 1 }) + gate(510, 8, '≥1', 'NOR', { neg: 1 }) + gate(630, 8, '=1', 'XOR', {}));

  const sw = (x, y, t, f, open) => `<g data-f="${f}"><line class="ln" x1="${x}" y1="${y}" x2="${x + 14}" y2="${y}"/><line class="ln hi" x1="${x + 14}" y1="${y}" x2="${x + 44}" y2="${y - (open ? 0 : 14)}"/>${open ? `<line class="ln" x1="${x + 44}" y1="${y - 8}" x2="${x + 44}" y2="${y + 4}"/>` : ''}<line class="ln" x1="${x + 46}" y1="${y}" x2="${x + 60}" y2="${y}"/><text x="${x + 30}" y="${y - 20}" text-anchor="middle" class="s">${t}</text></g>`;
  const lamp = (x, y, f) => `<g data-f="${f}" class="bx"><circle cx="${x}" cy="${y}" r="14"/><path d="M${x - 10} ${y - 10}L${x + 10} ${y + 10}M${x + 10} ${y - 10}L${x - 10} ${y + 10}"/></g>`;
  F.vps = () => svg(720, 200,
    txt(120, 16, 'UND = Reihenschaltung', 0) + ln('10,70 30,70', 0) + sw(30, 70, 'S1', 0) + sw(90, 70, 'S2', 0) + ln('150,70 180,70', 0) + lamp(194, 70, 0) + ln('208,70 230,70', 0) +
    txt(380, 16, 'ODER = Parallelschaltung', 1) + ln('270,90 290,90 290,60 300,60', 1) + sw(300, 60, 'S1', 1) + ln('290,90 290,120 300,120', 1) + sw(300, 120, 'S2', 1) + ln('360,60 370,60 370,120 360,120', 1) + ln('370,90 420,90', 1) + lamp(434, 90, 1) + ln('448,90 470,90', 1) +
    txt(610, 16, 'NICHT = Öffner', 2) + ln('520,70 540,70', 2) + sw(540, 70, 'S1 (Öffner)', 2, true) + ln('600,70 640,70', 2) + lamp(654, 70, 2) + ln('668,70 700,70', 2) +
    txt(360, 180, 'Schließer: unbetätigt offen, schließt beim Drücken. Öffner: unbetätigt geschlossen, öffnet beim Drücken.', 2, 's'));

  F.flipflop = () => svg(640, 220,
    txt(40, 54, 'S', 0) + txt(40, 104, 'Q (alt)', 0, 's') + ln('60,50 150,50', 0) + ln('80,100 150,100', 0) + box(150, 35, 60, 80, '≥1', 0) + ln('210,75 330,75 330,110 360,110', 0) +
    txt(40, 164, 'R', 1) + ln('60,160 250,160', 1) + `<circle data-f="1" cx="257" cy="160" r="6" class="fl" stroke="currentColor" stroke-width="1.5"/>` + ln('263,160 330,160 330,150 360,150', 1) + box(360, 95, 60, 70, '&amp;', 1, 'pe') + arr(420, 130, 560, 130, 'A = Q (neu)', 1) +
    dot(500, 130, 2) + ln('500,130 500,200 80,200 80,100', 2, 'hi') + txt(300, 215, 'Rückführung = Speicher', 2, 'ts') + txt(520, 60, 'A = ¬R ∧ (S ∨ Q)|Rücksetzen dominiert', 3, 'tp'));

  const step = (x, y, n, f, init, act) => `<g data-f="${f}" class="bx ${act ? 'hi' : ''}"><rect x="${x}" y="${y}" width="50" height="44"/>${init ? `<rect x="${x + 5}" y="${y + 5}" width="40" height="34"/>` : ''}<text x="${x + 25}" y="${y + 27}" text-anchor="middle">${n}</text></g>`;
  const trans = (x, y, t, f) => `<g data-f="${f}"><line class="ln hi" x1="${x - 16}" y1="${y}" x2="${x + 16}" y2="${y}"/><text x="${x + 26}" y="${y + 4}" class="s">${t}</text></g>`;
  F.grafcetStep = step; F.grafcetTrans = trans;
  F.grafcet = () => svg(620, 300,
    step(120, 20, '1', 0, true) + txt(250, 42, 'Initialschritt (Doppelrahmen)', 0, 's', 'start') +
    ln('145,64 145,130', 1) + trans(145, 97, 'S1 ∨ S2   (Transition mit Übergangsbedingung)', 1) +
    step(120, 130, '2', 2) + ln('170,152 200,152', 3) + box(200, 132, 150, 40, 'Lampe H1 := 1', 3, 'pe') + txt(365, 156, 'Aktion', 3, 's', 'start') +
    ln('145,174 145,250', 4) + trans(145, 212, '30 s / X2   (Zeit läuft, seit Schritt 2 aktiv ist)', 4) +
    ln('145,250 145,280 60,280 60,8 145,8 145,20', 5, 'dash') + txt(64, 296, 'Wirkverbindung zurück zu Schritt 1', 5, 's', 'start'));

  F.spszyklus = () => svg(640, 260,
    box(230, 10, 180, 44, '1  Eingänge einlesen', 0, 'hi') + box(430, 108, 190, 44, '2  Programm abarbeiten', 1, 'pe') + box(230, 206, 180, 44, '3  Ausgänge ausgeben', 2, 'hi') + box(20, 108, 190, 44, 'Zyklus beginnt neu', 3) +
    `<path data-f="1" class="ln" d="M410 32 Q525 32 525 106" marker-end="url(#ah)"/><path data-f="2" class="ln" d="M525 152 Q525 228 412 228" marker-end="url(#ah)"/><path data-f="3" class="ln" d="M230 228 Q115 228 115 154" marker-end="url(#ah)"/><path data-f="3" class="ln" d="M115 108 Q115 32 228 32" marker-end="url(#ah)"/>` +
    txt(320, 122, 'Zykluszeit', 4, 'ts') + txt(320, 142, 'typisch 20 ms', 4, 's'));

  F.spsstruktur = () => svg(720, 190,
    box(10, 70, 110, 50, 'Sensoren|Taster', 0) + arr(120, 95, 170, 95, '', 0) + box(170, 40, 110, 110, 'Eingabe-|baugruppe|(A/D)', 0, 'hi') + arr(280, 95, 320, 95, '', 1) + box(320, 20, 150, 150, 'CPU|Programm|+ Speicher', 1, 'pe') + arr(470, 95, 510, 95, '', 2) + box(510, 40, 110, 110, 'Ausgabe-|baugruppe|(D/A)', 2, 'hi') + arr(620, 95, 660, 95, '', 2) + box(660, 70, 55, 50, 'Akto-|ren', 2));

  F.strukturen = () => svg(720, 250,
    txt(60, 20, 'a) Reihe', 0, '', 'start') + arr(20, 60, 60, 60, '', 0) + box(60, 40, 70, 40, 'G₁', 0) + arr(130, 60, 170, 60, '', 0) + box(170, 40, 70, 40, 'G₂', 0) + arr(240, 60, 280, 60, '', 0) + txt(150, 105, 'G = G₁ · G₂', 0, 'tp') +
    txt(330, 20, 'b) Parallel', 1, '', 'start') + ln('310,60 340,60', 1) + dot(340, 60, 1) + ln('340,60 340,40 370,40', 1) + ln('340,60 340,90 370,90', 1) + box(370, 22, 70, 36, 'G₁', 1) + box(370, 72, 70, 36, 'G₂', 1) + ln('440,40 480,40', 1) + ln('440,90 480,90', 1) + arr(480, 40, 480, 52, '', 1) + arr(480, 90, 480, 78, '', 1) + sum(480, 65, 1) + arr(491, 65, 530, 65, '', 1) + txt(410, 130, 'G = G₁ + G₂', 1, 'tp') +
    txt(60, 160, 'c) Kreis (Rückführung)', 2, '', 'start') + arr(20, 195, 60, 195, '', 2) + sum(72, 195, 2, true) + arr(83, 195, 130, 195, '', 2) + box(130, 175, 80, 40, 'G₁', 2) + arr(210, 195, 300, 195, '', 2) + dot(250, 195, 2) + ln('250,195 250,240 205,240', 2) + box(135, 222, 70, 26, 'G₂', 2) + ln('135,235 72,235', 2) + arr(72, 235, 72, 207, '', 2) + txt(480, 200, 'G = G₁ / (1 + G₁ · G₂)', 2, 'tp') + txt(480, 222, '(Gegenkopplung, Minus an der Additionsstelle)', 2, 's'));

  F.wirkungsplan = () => svg(700, 110,
    arr(20, 40, 110, 40, '', 0) + txt(65, 80, 'Wirkungslinie', 0, 's') + box(170, 18, 90, 44, 'Block', 0) + txt(215, 80, 'Übertragungsglied', 0, 's') +
    arr(330, 40, 368, 40, '', 0) + sum(380, 40, 0, true) + arr(391, 40, 430, 40, '', 0) + arr(380, 82, 380, 52, '', 0) + txt(440, 80, 'Additionsstelle', 0, 's') +
    ln('520,40 600,40', 0) + dot(560, 40, 0) + arr(600, 40, 660, 40, '', 0) + arr(560, 40, 560, 85, '', 0) + txt(620, 80, 'Verzweigung', 0, 's'));

  F.testsignale = () => svg(700, 150,
    arr(20, 110, 210, 110, '', 0) + arr(40, 130, 40, 20, '', 0) + ln('40,110 80,110 80,45 200,45', 0, 'hi') + txt(120, 140, 'Sprung σ(t)', 0, 's') +
    arr(250, 110, 440, 110, '', 1) + arr(270, 130, 270, 20, '', 1) + ln('270,110 310,110 310,25 316,25 316,110 430,110', 1, 'hi') + txt(350, 140, 'Impuls δ(t)', 1, 's') +
    arr(480, 110, 670, 110, '', 2) + arr(500, 130, 500, 20, '', 2) + ln('500,110 540,110 650,35', 2, 'hi') + txt(580, 140, 'Rampe', 2, 's'));

  F.rc = () => svg(520, 190,
    ln('40,50 120,50', 0) + box(120, 34, 80, 32, 'R', 0) + ln('200,50 330,50 330,84', 0) + ln('305,84 355,84', 0, 'hi') + ln('305,96 355,96', 0, 'hi') + ln('330,96 330,150 40,150', 0) + txt(372, 92, 'C', 0, '', 'start') +
    `<g data-f="0" class="bx"><circle cx="40" cy="100" r="18"/></g>` + txt(40, 100, 'U₀', 0) + ln('40,50 40,82', 0) + ln('40,118 40,150', 0) +
    arr(420, 60, 420, 140, '', 1, 'hi') + txt(470, 100, 'u_C(t)', 1, 'ts') + txt(240, 178, 'T = R · C     G(s) = 1 / (1 + T·s)   →   PT1-Glied', 1, 'tp'));

  F.znablauf = () => svg(700, 120,
    box(5, 35, 120, 50, 'Regler als|P-Regler', 0) + arr(125, 60, 145, 60, '', 1) + box(145, 35, 130, 50, 'K_P erhöhen bis|Dauerschwingung', 1, 'hi') + arr(275, 60, 295, 60, '', 2) + box(295, 35, 120, 50, 'K_krit und|T_krit ablesen', 2, 'pe') + arr(415, 60, 435, 60, '', 3) + box(435, 35, 120, 50, 'Kennwerte|nach Tabelle', 3) + arr(555, 60, 575, 60, '', 4) + box(575, 35, 120, 50, 'ggf.|verbessern', 4));

  F.vollbruecke = () => svg(560, 220,
    box(60, 80, 300, 50, 'Zugstab', 0) + arr(360, 105, 440, 105, 'F', 0, 'hi') + arr(60, 105, 10, 105, 'F', 0, 'hi') +
    `<g data-f="1" class="bx hi"><rect x="120" y="92" width="60" height="12"/><rect x="240" y="106" width="60" height="12"/></g>` + txt(210, 68, '2 DMS längs: +ε (gedehnt)', 1, 'ts') +
    `<g data-f="2" class="bx pe"><rect x="200" y="86" width="12" height="38"/><rect x="320" y="86" width="12" height="38"/></g>` + txt(270, 150, '2 DMS quer: −µ·ε (gestaucht)', 2, 'tp') +
    txt(280, 195, 'U/U₀ = (k/4)·(ε₁ − ε₂ + ε₃ − ε₄) = k·ε·(1 + µ)/2', 3));

  // Sprungantwort aus Übungsblatt A11 (rekonstruiert aus dem Diagramm)
  F.a11 = () => M.plot({ x: [0, 6000], y: [0, 90], xl: 'Zeit t in s', yl: 'Temperaturänderung in K', series: [{ d: M.range(0, 6000, 120).map(t => [t, 83.3 * (1 - Math.exp(-t / 2000))]), c: 'pe' }], title: 'Gemessene Sprungantwort' });
})(window.MSR);
