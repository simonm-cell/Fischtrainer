import {
  tagesmenge, istFaellig, differenzTage, lokalerTag, neuerZustand, abgleichen, tagesplan,
  tagSicherstellen, bewerten, anzahlJeFach, mischen, zustandPruefen, migrieren, gruppeAnwenden,
  gruppeSetzen, offeneKarten, vergleichStarten, vergleichBewerten, kurzname, mindestmassText, symbole, systematik,
} from '../js/logik.js';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function gleich(ist, soll, text = '') {
  const a = JSON.stringify(ist);
  const b = JSON.stringify(soll);
  if (a !== b) throw new Error(`${text} erwartet ${b}, erhalten ${a}`);
}
function wirft(fn, text) {
  try { fn(); } catch { return; }
  throw new Error(`Fehler erwartet: ${text}`);
}

// Reproduzierbarer Zufall für die Tests
function zufall(start = 1) {
  let s = start;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const ids = (n) => Array.from({ length: n }, (_, i) => `k${i + 1}`);
function mitFach(n, fach, zuletzt) {
  const z = neuerZustand(ids(n));
  for (const id of ids(n)) z.karten[id] = { fach, zuletzt };
  return z;
}
const neustart = (z) => JSON.parse(JSON.stringify(z));

// Aufrunden und Anteile
test('Tagesmenge Fach 1: alle Karten', () => {
  gleich(tagesmenge(67, 1), 67);
  gleich(tagesmenge(0, 1), 0);
});
test('Tagesmenge Fach 2: die Hälfte, aufgerundet', () => {
  gleich(tagesmenge(4, 2), 2);
  gleich(tagesmenge(5, 2), 3);
  gleich(tagesmenge(1, 2), 1);
});
test('Tagesmenge Fach 3: ein Drittel, aufgerundet', () => {
  gleich(tagesmenge(6, 3), 2);
  gleich(tagesmenge(7, 3), 3);
});
test('Tagesmenge Fach 4: ein Fünftel, aufgerundet', () => {
  gleich(tagesmenge(10, 4), 2);
  gleich(tagesmenge(11, 4), 3);
  gleich(tagesmenge(1, 4), 1);
});
test('Plan begrenzt jedes Fach auf seine Tagesmenge', () => {
  const liste = ids(30);
  const z = neuerZustand(liste);
  liste.forEach((id, i) => {
    z.karten[id] = { fach: (i % 3) + 2, zuletzt: '2026-01-01' };
  });
  const plan = tagesplan(z, liste, '2026-02-01', zufall());
  const zaehler = { 2: 0, 3: 0, 4: 0 };
  plan.forEach((id) => zaehler[z.karten[id].fach]++);
  gleich(zaehler, { 2: 5, 3: 4, 4: 2 });
});
test('Fach 5 wird nie abgefragt', () => {
  const z = mitFach(4, 5, '2020-01-01');
  gleich(tagesplan(z, ids(4), '2026-01-01', zufall()), []);
});

// Mindestabstand
test('Mindestabstand Fach 1: ab dem nächsten Tag', () => {
  const k = { fach: 1, zuletzt: '2026-03-10' };
  gleich(istFaellig(k, '2026-03-10'), false);
  gleich(istFaellig(k, '2026-03-11'), true);
});
test('Mindestabstand Fach 2: 2 Tage', () => {
  const k = { fach: 2, zuletzt: '2026-03-10' };
  gleich(istFaellig(k, '2026-03-11'), false);
  gleich(istFaellig(k, '2026-03-12'), true);
});
test('Mindestabstand Fach 3: 3 Tage', () => {
  const k = { fach: 3, zuletzt: '2026-03-10' };
  gleich(istFaellig(k, '2026-03-12'), false);
  gleich(istFaellig(k, '2026-03-13'), true);
});
test('Mindestabstand Fach 4: 5 Tage', () => {
  const k = { fach: 4, zuletzt: '2026-03-10' };
  gleich(istFaellig(k, '2026-03-14'), false);
  gleich(istFaellig(k, '2026-03-15'), true);
});
test('Noch nie abgefragte Karten sind fällig', () => {
  gleich(istFaellig({ fach: 2, zuletzt: null }, '2026-03-10'), true);
});
test('Am längsten nicht abgefragte Karten kommen zuerst', () => {
  const liste = ids(4);
  const z = neuerZustand(liste);
  z.karten.k1 = { fach: 2, zuletzt: '2026-03-08' };
  z.karten.k2 = { fach: 2, zuletzt: '2026-03-01' };
  z.karten.k3 = { fach: 2, zuletzt: '2026-03-05' };
  z.karten.k4 = { fach: 2, zuletzt: '2026-03-09' };
  gleich(tagesplan(z, liste, '2026-03-20', zufall()).sort(), ['k2', 'k3']);
});
test('Karten im Mindestabstand fehlen, auch wenn die Tagesmenge nicht voll wird', () => {
  const liste = ids(4);
  const z = neuerZustand(liste);
  z.karten.k1 = { fach: 2, zuletzt: '2026-03-10' };
  z.karten.k2 = { fach: 2, zuletzt: '2026-03-11' };
  z.karten.k3 = { fach: 2, zuletzt: '2026-03-11' };
  z.karten.k4 = { fach: 2, zuletzt: '2026-03-11' };
  gleich(tagesplan(z, liste, '2026-03-12', zufall()), ['k1']);
});

// Plan bleibt am selben Tag stabil
test('Plan bleibt am selben Tag unverändert', () => {
  const z = tagSicherstellen(neuerZustand(ids(10)), ids(10), '2026-04-01', zufall(1));
  const nochmal = tagSicherstellen(z, ids(10), '2026-04-01', zufall(99));
  gleich(nochmal.warteschlange, z.warteschlange);
});
test('Gewusste Karten bringen am selben Tag keine neuen Karten', () => {
  let z = tagSicherstellen(mitFach(4, 2, null), ids(4), '2026-04-01', zufall());
  gleich(z.warteschlange.length, 2);
  z = bewerten(z, z.warteschlange[0], true, '2026-04-01');
  z = tagSicherstellen(z, ids(4), '2026-04-01', zufall(5));
  gleich(z.warteschlange.length, 1);
});
test('Der Lerntag ist erledigt, wenn die Warteschlange leer ist', () => {
  let z = tagSicherstellen(neuerZustand(ids(2)), ids(2), '2026-04-01', zufall());
  z = bewerten(z, z.warteschlange[0], true, '2026-04-01');
  z = bewerten(z, z.warteschlange[0], true, '2026-04-01');
  gleich(z.warteschlange, []);
  gleich(tagSicherstellen(z, ids(2), '2026-04-01', zufall()).warteschlange, []);
});
test('Die Reihenfolge wird beim Planen zufällig gemischt', () => {
  const start = neuerZustand(ids(20), 20);
  const a = tagSicherstellen(start, ids(20), '2026-04-01', zufall(3)).warteschlange;
  const b = tagSicherstellen(start, ids(20), '2026-04-01', zufall(4)).warteschlange;
  if (JSON.stringify(a) === JSON.stringify(b)) throw new Error('Gleiche Reihenfolge');
  gleich([...a].sort(), [...ids(20)].sort());
});

// Lerngruppe in Fach 1
test('Höchstens 7 Karten aus Fach 1 sind gleichzeitig aktiv', () => {
  const z = tagSicherstellen(neuerZustand(ids(20)), ids(20), '2026-04-01', zufall());
  gleich(z.warteschlange.length, 7);
  gleich(z.reserve.length, 13);
  gleich(offeneKarten(z), 20);
  gleich(z.planGroesse, 20);
});
test('Ohne gewusste Karte bleiben es immer dieselben 7 Karten', () => {
  let z = tagSicherstellen(neuerZustand(ids(20)), ids(20), '2026-04-01', zufall());
  const gruppe = [...z.warteschlange].sort();
  const reserve = [...z.reserve];
  for (let i = 0; i < 30; i++) {
    z = bewerten(z, z.warteschlange[0], false, '2026-04-01');
    gleich([...z.warteschlange].sort(), gruppe);
    gleich(z.reserve, reserve);
  }
});
test('Sobald eine Karte gewusst wurde, rückt die nächste am Ende nach', () => {
  let z = tagSicherstellen(neuerZustand(ids(20)), ids(20), '2026-04-01', zufall());
  const neu = z.reserve[0];
  const id = z.warteschlange[0];
  z = bewerten(z, id, true, '2026-04-01');
  gleich(z.warteschlange.length, 7);
  gleich(z.warteschlange[6], neu);
  gleich(z.warteschlange.includes(id), false);
  gleich(z.reserve.length, 12);
  gleich(offeneKarten(z), 19);
});
test('Der Lerntag endet erst, wenn auch die Reserve leer ist', () => {
  let z = tagSicherstellen(neuerZustand(ids(10)), ids(10), '2026-04-01', zufall());
  for (let i = 0; i < 9; i++) {
    z = bewerten(z, z.warteschlange[0], true, '2026-04-01');
    gleich(offeneKarten(z) > 0, true);
  }
  z = bewerten(z, z.warteschlange[0], true, '2026-04-01');
  gleich(offeneKarten(z), 0);
});
test('Die Gruppengröße begrenzt nur Fach 1, nicht Fach 2 bis 4', () => {
  const liste = ids(12);
  const z = neuerZustand(liste, 2);
  liste.slice(0, 4).forEach((id) => { z.karten[id] = { fach: 1, zuletzt: null }; });
  liste.slice(4).forEach((id) => { z.karten[id] = { fach: 2, zuletzt: '2026-01-01' }; });
  const p = tagSicherstellen(z, liste, '2026-04-01', zufall());
  const fach1 = p.warteschlange.filter((id) => p.karten[id].fach === 1);
  const fach2 = p.warteschlange.filter((id) => p.karten[id].fach === 2);
  gleich(fach1.length, 2);
  gleich(fach2.length, 4);
  gleich(p.reserve.length, 2);
});
test('Rückfall aus Fach 2 belegt heute keinen Platz in der Gruppe', () => {
  let z = neuerZustand(['a', 'b', 'c'], 1);
  z.karten.a = { fach: 2, zuletzt: '2026-01-01' };
  z = { ...z, tag: '2026-04-01', warteschlange: ['a', 'b'], reserve: ['c'] };
  z = bewerten(z, 'a', false, '2026-04-01');
  gleich(z.warteschlange, ['b']);
  gleich(z.reserve, ['c']);
});
test('Am nächsten Tag bleibt die begonnene Gruppe vor neuen Karten', () => {
  let z = tagSicherstellen(neuerZustand(ids(20)), ids(20), '2026-04-01', zufall());
  const gruppe = [...z.warteschlange].sort();
  for (let i = 0; i < 7; i++) z = bewerten(z, z.warteschlange[0], false, '2026-04-01');
  const morgen = tagSicherstellen(z, ids(20), '2026-04-02', zufall(9));
  gleich([...morgen.warteschlange].sort(), gruppe);
});
test('Lerngruppe und Reserve überstehen einen Neustart', () => {
  let z = tagSicherstellen(neuerZustand(ids(20)), ids(20), '2026-04-01', zufall());
  z = bewerten(z, z.warteschlange[0], true, '2026-04-01');
  const danach = tagSicherstellen(neustart(z), ids(20), '2026-04-01', zufall(5));
  gleich(danach.warteschlange, z.warteschlange);
  gleich(danach.reserve, z.reserve);
});
test('Größere Gruppe holt am selben Tag wartende Karten nach', () => {
  let z = tagSicherstellen(neuerZustand(ids(20)), ids(20), '2026-04-01', zufall());
  const vorher = offeneKarten(z);
  z = gruppeSetzen(z, 10);
  gleich(z.warteschlange.length, 10);
  gleich(offeneKarten(z), vorher);
});
test('Kleinere Gruppe schickt überzählige Karten zurück, die erste Karte bleibt', () => {
  let z = tagSicherstellen(neuerZustand(ids(20)), ids(20), '2026-04-01', zufall());
  const erste = z.warteschlange[0];
  z = gruppeSetzen(z, 3);
  gleich(z.warteschlange.length, 3);
  gleich(z.warteschlange[0], erste);
  gleich(offeneKarten(z), 20);
});
test('Ungültige Gruppengröße wird abgelehnt', () => {
  const z = neuerZustand(ids(3));
  wirft(() => gruppeSetzen(z, 0), 'null');
  wirft(() => gruppeSetzen(z, 2.5), 'Kommazahl');
});
test('Alter Speicherstand ohne Gruppe wird ohne Verlust übernommen', () => {
  const alt = neuerZustand(ids(20));
  alt.karten.k1 = { fach: 3, zuletzt: '2026-03-01' };
  delete alt.reserve;
  delete alt.gruppe;
  delete alt.vergleich;
  alt.tag = '2026-04-01';
  alt.warteschlange = ids(20);
  const z = gruppeAnwenden(abgleichen(migrieren(alt), ids(20)));
  gleich(z.gruppe, 7);
  gleich(z.karten.k1, { fach: 3, zuletzt: '2026-03-01' });
  gleich(offeneKarten(z), 20);
  gleich(z.warteschlange.filter((id) => z.karten[id].fach === 1).length, 7);
  gleich(z.warteschlange.includes('k1'), true);
});

// Anzeige auf der Karte
test('Ganzjährig geschützte Art zeigt beim Mindestmaß einen Strich', () => {
  gleich(mindestmassText({ mindestmass_cm: null, schonzeit: 'ganzjährig' }), '-');
});
test('Art ohne Schutz und ohne Maß zeigt „kein Mindestmaß“', () => {
  gleich(mindestmassText({ mindestmass_cm: null, schonzeit: null }), 'kein Mindestmaß');
});
test('Teilweise ganzjährig geschonte Art behält ihr Mindestmaß', () => {
  gleich(mindestmassText({ mindestmass_cm: 40, schonzeit: 'in der Elbe 1. Januar bis 15. Juni, sonst ganzjährig' }), '40 cm');
});
test('Der Kurzname ist der erste von mehreren Namen', () => {
  gleich(kurzname('Quappe | Rutte | Trüsche | Aalrutte'), 'Quappe');
  gleich(kurzname('Barbe'), 'Barbe');
});

// Ordnung und Gattung
test('Ordnung und Gattung stehen in einer Zeile, die Erläuterung darunter', () => {
  gleich(systematik({ ordnung: 'Cypriniformes (karpfenartige Fische)', gattung: 'Barbus' }), { zeile: 'Cypriniformes | Barbus', gruppe: 'karpfenartige Fische' });
});
test('Ordnung ohne Klammer und ohne Gattung bleibt lesbar', () => {
  gleich(systematik({ ordnung: 'Salmoniformes', gattung: null }), { zeile: 'Salmoniformes', gruppe: '' });
  gleich(systematik({ ordnung: null, gattung: null }), { zeile: 'nicht angegeben', gruppe: '' });
});

// Symbole unter dem Namen
const namenVon = (mindestmass_cm, schonzeit, invasiv = false) => symbole({ mindestmass_cm, schonzeit, invasiv }).namen;
test('Symbole: invasive Art', () => {
  gleich(namenVon(null, null, true), ['angel', 'nicht-zuruecksetzen']);
});
test('Symbole: nicht geschützt', () => {
  gleich(namenVon(null, null), ['angel']);
});
test('Symbole: nur Mindestmaß', () => {
  gleich(namenVon(25, null), ['angel', 'mass']);
});
test('Symbole: nur Schonzeit', () => {
  gleich(namenVon(null, '1. Februar bis 31. Mai'), ['angel', 'kalender']);
});
test('Symbole: Mindestmaß und Schonzeit', () => {
  gleich(namenVon(50, '1. Februar bis 31. Mai'), ['angel', 'mass', 'kalender']);
});
test('Symbole: ganzjährig geschont', () => {
  gleich(namenVon(null, 'ganzjährig'), ['angel-gesperrt']);
});
test('Symbole: teilweise ganzjährig geschonte Art zählt nach Maß und Schonzeit', () => {
  gleich(namenVon(40, 'in der Elbe 1. Januar bis 15. Juni, sonst ganzjährig'), ['angel', 'mass', 'kalender']);
});

// Modus für Verwechslungen
test('Verwechslungen: Gewusst entfernt, Nicht gewusst kommt ans Ende', () => {
  let z = { ...neuerZustand(['a']), vergleich: ['p1', 'p2', 'p3'] };
  z = vergleichBewerten(z, 'p1', false);
  gleich(z.vergleich, ['p2', 'p3', 'p1']);
  z = vergleichBewerten(z, 'p2', true);
  gleich(z.vergleich, ['p3', 'p1']);
  wirft(() => vergleichBewerten(z, 'p1', true), 'falsche Reihenfolge');
});
test('Verwechslungen ändern weder Fächer noch Tagesplan', () => {
  let z = tagSicherstellen(neuerZustand(ids(3)), ids(3), '2026-04-01', zufall());
  const vorher = JSON.stringify([z.karten, z.warteschlange, z.reserve]);
  z = vergleichStarten(z, ['p1', 'p2'], zufall());
  z = vergleichBewerten(z, z.vergleich[0], true);
  gleich(JSON.stringify([z.karten, z.warteschlange, z.reserve]), vorher);
});

// Wiederholung in Fach 1
test('Fach 1, Gewusst: Karte rückt in Fach 2 und ist erledigt', () => {
  let z = tagSicherstellen(neuerZustand(['a', 'b']), ['a', 'b'], '2026-05-01', zufall());
  const id = z.warteschlange[0];
  z = bewerten(z, id, true, '2026-05-01');
  gleich(z.karten[id], { fach: 2, zuletzt: '2026-05-01' });
  gleich(z.warteschlange.includes(id), false);
});
test('Fach 1, Nicht gewusst: Karte kommt ans Ende', () => {
  let z = { ...neuerZustand(['a', 'b', 'c']), tag: '2026-05-01', warteschlange: ['a', 'b', 'c'] };
  z = bewerten(z, 'a', false, '2026-05-01');
  gleich(z.warteschlange, ['b', 'c', 'a']);
  gleich(z.karten.a.fach, 1);
});
test('Fach 1: Wiederholung auch nach mehrfachem Nicht gewusst, bis gewusst', () => {
  let z = { ...neuerZustand(['a', 'b']), tag: '2026-05-01', warteschlange: ['a', 'b'] };
  z = bewerten(z, 'a', false, '2026-05-01');
  gleich(z.warteschlange, ['b', 'a']);
  z = bewerten(z, 'b', true, '2026-05-01');
  gleich(z.warteschlange, ['a']);
  for (let i = 0; i < 5; i++) {
    z = bewerten(z, 'a', false, '2026-05-01');
    gleich(z.warteschlange, ['a'], 'Letzte Karte erscheint sofort wieder:');
    gleich(z.karten.a.fach, 1);
  }
  z = bewerten(z, 'a', true, '2026-05-01');
  gleich(z.warteschlange, []);
  gleich(z.karten.a.fach, 2);
});

// Rückfall aus Fach 2 bis 4
for (const fach of [2, 3, 4]) {
  test(`Fach ${fach}, Nicht gewusst: zurück in Fach 1, heute keine Wiederholung`, () => {
    let z = neuerZustand(['a', 'b']);
    z.karten.a = { fach, zuletzt: '2026-01-01' };
    z = { ...z, tag: '2026-05-01', warteschlange: ['a', 'b'] };
    z = bewerten(z, 'a', false, '2026-05-01');
    gleich(z.karten.a, { fach: 1, zuletzt: '2026-05-01' });
    gleich(z.warteschlange, ['b']);
  });
  test(`Fach ${fach}, Gewusst: rückt ein Fach weiter`, () => {
    let z = neuerZustand(['a']);
    z.karten.a = { fach, zuletzt: '2026-01-01' };
    z = { ...z, tag: '2026-05-01', warteschlange: ['a'] };
    z = bewerten(z, 'a', true, '2026-05-01');
    gleich(z.karten.a, { fach: fach + 1, zuletzt: '2026-05-01' });
    gleich(z.warteschlange, []);
  });
}
test('Zurückgefallene Karte kommt ab dem nächsten Tag wieder', () => {
  let z = neuerZustand(['a']);
  z.karten.a = { fach: 3, zuletzt: '2026-01-01' };
  z = tagSicherstellen(z, ['a'], '2026-05-01', zufall());
  z = bewerten(z, 'a', false, '2026-05-01');
  gleich(tagSicherstellen(z, ['a'], '2026-05-01', zufall()).warteschlange, []);
  gleich(tagSicherstellen(z, ['a'], '2026-05-02', zufall()).warteschlange, ['a']);
});

// Fortsetzen nach einem Neustart
test('Warteschlange übersteht einen Neustart an derselben Stelle', () => {
  let z = tagSicherstellen(neuerZustand(ids(5)), ids(5), '2026-06-01', zufall());
  z = bewerten(z, z.warteschlange[0], true, '2026-06-01');
  z = bewerten(z, z.warteschlange[0], false, '2026-06-01');
  const vorher = z.warteschlange;
  const danach = tagSicherstellen(neustart(z), ids(5), '2026-06-01', zufall(77));
  gleich(danach.warteschlange, vorher);
});
test('Wiederholung läuft nach einem Neustart weiter', () => {
  let z = { ...neuerZustand(['a', 'b']), tag: '2026-06-01', warteschlange: ['a', 'b'] };
  z = bewerten(z, 'a', false, '2026-06-01');
  z = neustart(z);
  z = bewerten(z, 'b', true, '2026-06-01');
  gleich(neustart(z).warteschlange, ['a']);
});

// Tageswechsel und verpasste Tage
test('Tageswechsel berechnet einen neuen Plan', () => {
  let z = tagSicherstellen(neuerZustand(['a']), ['a'], '2026-07-01', zufall());
  z = bewerten(z, 'a', false, '2026-07-01');
  z = bewerten(z, 'a', true, '2026-07-01');
  gleich(z.karten.a.fach, 2);
  gleich(tagSicherstellen(z, ['a'], '2026-07-02', zufall()).warteschlange, []);
  gleich(tagSicherstellen(z, ['a'], '2026-07-03', zufall()).warteschlange, ['a']);
});
test('Bewerten nach Mitternacht wird abgelehnt', () => {
  const z = tagSicherstellen(neuerZustand(['a']), ['a'], '2026-07-01', zufall());
  wirft(() => bewerten(z, 'a', true, '2026-07-02'), 'alter Lerntag');
});
test('Verpasste Tage stauen sich nicht auf', () => {
  const liste = ids(10);
  const z = mitFach(10, 2, '2026-01-01');
  z.tag = '2026-01-02';
  z.warteschlange = liste.slice(0, 5);
  const danach = tagSicherstellen(z, liste, '2026-03-01', zufall());
  gleich(danach.warteschlange.length, 5);
  gleich(danach.planGroesse, 5);
});
test('Unerledigte Karten rücken nach verpassten Tagen nach vorn', () => {
  const liste = ids(4);
  const z = neuerZustand(liste);
  z.karten.k1 = { fach: 2, zuletzt: '2026-03-10' };
  z.karten.k2 = { fach: 2, zuletzt: '2026-03-10' };
  z.karten.k3 = { fach: 2, zuletzt: '2026-03-01' };
  z.karten.k4 = { fach: 2, zuletzt: '2026-03-01' };
  z.tag = '2026-03-11';
  z.warteschlange = ['k3', 'k4'];
  gleich(tagSicherstellen(z, liste, '2026-03-20', zufall()).warteschlange.sort(), ['k3', 'k4']);
});
test('Sommerzeit-Umstellung verfälscht den Abstand nicht', () => {
  gleich(differenzTage('2026-03-30', '2026-03-28'), 2);
  gleich(differenzTage('2026-10-26', '2026-10-24'), 2);
});
test('Der Tag wechselt um Mitternacht nach lokaler Zeit', () => {
  gleich(lokalerTag(new Date(2026, 11, 31, 23, 59, 59)), '2026-12-31');
  gleich(lokalerTag(new Date(2027, 0, 1, 0, 0, 0)), '2027-01-01');
});

// Übergang in Fach 5
test('Karte durchläuft alle Fächer bis Fach 5', () => {
  let z = neuerZustand(['a']);
  const tage = ['2026-08-01', '2026-08-03', '2026-08-06', '2026-08-11'];
  const erwartet = [2, 3, 4, 5];
  tage.forEach((tag, i) => {
    z = tagSicherstellen(z, ['a'], tag, zufall());
    gleich(z.warteschlange, ['a'], `Tag ${tag}:`);
    z = bewerten(z, 'a', true, tag);
    gleich(z.karten.a.fach, erwartet[i]);
  });
});
test('Karte in Fach 5 gilt als gelernt und kommt nicht wieder', () => {
  let z = neuerZustand(['a']);
  z.karten.a = { fach: 5, zuletzt: '2026-08-11' };
  z = tagSicherstellen(z, ['a'], '2030-01-01', zufall());
  gleich(z.warteschlange, []);
  gleich(anzahlJeFach(z, ['a']), { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 });
});

// Updates und Import
test('Neue Fische starten in Fach 1 und ändern den heutigen Plan nicht', () => {
  let z = tagSicherstellen(neuerZustand(['a']), ['a'], '2026-09-01', zufall());
  z = bewerten(z, 'a', true, '2026-09-01');
  z = abgleichen(z, ['a', 'neu']);
  gleich(z.karten.a.fach, 2);
  gleich(z.karten.neu, { fach: 1, zuletzt: null });
  gleich(tagSicherstellen(z, ['a', 'neu'], '2026-09-01', zufall()).warteschlange, []);
  gleich(tagSicherstellen(z, ['a', 'neu'], '2026-09-02', zufall()).warteschlange, ['neu']);
});
test('Entfernte Fische verlassen die Warteschlange, ihr Fortschritt bleibt', () => {
  let z = { ...neuerZustand(['a', 'b']), tag: '2026-09-01', warteschlange: ['a', 'b'] };
  z.karten.a = { fach: 3, zuletzt: '2026-08-01' };
  z = abgleichen(z, ['b']);
  gleich(z.warteschlange, ['b']);
  gleich(z.karten.a.fach, 3);
});
test('Mischen verliert keine Karte', () => {
  gleich(mischen(ids(9), zufall()).sort(), ids(9).sort());
});
test('Ungültiger Import wird abgelehnt', () => {
  wirft(() => zustandPruefen(null), 'leer');
  wirft(() => zustandPruefen({ karten: { a: { fach: 9, zuletzt: null } }, tag: null, warteschlange: [] }), 'Fach');
  wirft(() => zustandPruefen({ karten: { a: { fach: 1, zuletzt: 'gestern' } }, tag: null, warteschlange: [] }), 'Datum');
  wirft(() => zustandPruefen({ karten: {}, tag: null, warteschlange: ['x'] }), 'Warteschlange');
});
test('Gültiger Import wird übernommen', () => {
  const z = { karten: { a: { fach: 2, zuletzt: '2026-01-01' } }, tag: '2026-01-01', warteschlange: ['a'], reserve: [], planGroesse: 1, gruppe: 5, vergleich: ['p1'] };
  gleich(zustandPruefen(z), z);
});
test('Alte Fortschrittsdatei ohne Gruppe bleibt importierbar', () => {
  const z = zustandPruefen({ karten: { a: { fach: 2, zuletzt: null } }, tag: null, warteschlange: [] });
  gleich(z.gruppe, 7);
  gleich(z.reserve, []);
  gleich(z.vergleich, []);
});
test('Import mit ungültiger Gruppe oder Reserve wird abgelehnt', () => {
  const basis = { karten: { a: { fach: 1, zuletzt: null } }, tag: null, warteschlange: [] };
  wirft(() => zustandPruefen({ ...basis, gruppe: 0 }), 'Gruppe');
  wirft(() => zustandPruefen({ ...basis, reserve: ['x'] }), 'Reserve');
});

const ergebnisse = tests.map(([name, fn]) => {
  try {
    fn();
    return { name, ok: true };
  } catch (e) {
    return { name, ok: false, fehler: e.message };
  }
});
const fehler = ergebnisse.filter((e) => !e.ok);
const liste = document.getElementById('liste');
for (const e of ergebnisse) {
  const li = document.createElement('li');
  li.textContent = `${e.ok ? 'OK' : 'FEHLER'}: ${e.name}${e.fehler ? ` – ${e.fehler}` : ''}`;
  li.className = e.ok ? 'ok' : 'fehler';
  liste.append(li);
}
const summe = document.getElementById('summe');
summe.textContent = `${ergebnisse.length - fehler.length} von ${ergebnisse.length} Tests bestanden`;
summe.dataset.fehler = String(fehler.length);
window.testErgebnis = { gesamt: ergebnisse.length, fehler };
