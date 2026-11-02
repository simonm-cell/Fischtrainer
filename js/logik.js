// Lernlogik des Karteikastens. Alle Funktionen sind rein: Sie lesen weder Uhr
// noch Speicher, und Datum und Zufall kommen als Parameter herein.

export const NENNER = { 1: 1, 2: 2, 3: 3, 4: 5 };
export const ABSTAND_TAGE = { 1: 1, 2: 2, 3: 3, 4: 5 };
export const STANDARD_GRUPPE = 7;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

function tagesZahl(datum) {
  const [j, m, t] = datum.split('-').map(Number);
  return Date.UTC(j, m - 1, t) / 86400000;
}

export function differenzTage(heute, frueher) {
  return tagesZahl(heute) - tagesZahl(frueher);
}

// Der Lerntag aus der lokalen Zeit des Geräts.
export function lokalerTag(datum) {
  const j = String(datum.getFullYear()).padStart(4, '0');
  const m = String(datum.getMonth() + 1).padStart(2, '0');
  const t = String(datum.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

export function tagesmenge(anzahlImFach, fach) {
  return Math.ceil(anzahlImFach / NENNER[fach]);
}

export function istFaellig(karte, heute) {
  if (karte.fach >= 5) return false;
  if (karte.zuletzt === null) return true;
  return differenzTage(heute, karte.zuletzt) >= ABSTAND_TAGE[karte.fach];
}

export function mischen(liste, zufall) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function neuerZustand(ids, gruppe = STANDARD_GRUPPE) {
  const karten = {};
  for (const id of ids) karten[id] = { fach: 1, zuletzt: null };
  return { karten, tag: null, warteschlange: [], reserve: [], planGroesse: 0, gruppe, vergleich: [], merkgruppen: [] };
}

const gueltigeGruppe = (n) => Number.isInteger(n) && n >= 1;

// Ergänzt Felder, die ältere gespeicherte Stände noch nicht kennen.
export function migrieren(zustand) {
  return {
    ...zustand,
    reserve: zustand.reserve ?? [],
    gruppe: gueltigeGruppe(zustand.gruppe) ? zustand.gruppe : STANDARD_GRUPPE,
    vergleich: zustand.vergleich ?? [],
    merkgruppen: zustand.merkgruppen ?? [],
  };
}

// Neue Fische starten in Fach 1. Der Fortschritt entfernter Fische bleibt
// erhalten, ihre Karten verschwinden aber aus der heutigen Warteschlange.
export function abgleichen(zustand, ids) {
  const karten = { ...zustand.karten };
  for (const id of ids) {
    if (!karten[id]) karten[id] = { fach: 1, zuletzt: null };
  }
  const aktiv = new Set(ids);
  return {
    ...zustand,
    karten,
    warteschlange: zustand.warteschlange.filter((id) => aktiv.has(id)),
    reserve: zustand.reserve.filter((id) => aktiv.has(id)),
    merkgruppen: zustand.merkgruppen.map((g) => ({ ...g, runde: g.runde.filter((id) => aktiv.has(id)) })),
  };
}

const aktiveFach1 = (zustand) => zustand.warteschlange.filter((id) => zustand.karten[id].fach === 1);

// Holt wartende Fach-1-Karten nach, bis die Lerngruppe wieder voll ist.
function auffuellen(zustand) {
  const frei = zustand.gruppe - aktiveFach1(zustand).length;
  if (frei <= 0 || zustand.reserve.length === 0) return zustand;
  return {
    ...zustand,
    warteschlange: [...zustand.warteschlange, ...zustand.reserve.slice(0, frei)],
    reserve: zustand.reserve.slice(frei),
  };
}

// Setzt die Gruppengröße durch. Überzählige Karten warten wieder vorne in der Reserve.
export function gruppeAnwenden(zustand) {
  const zuViele = aktiveFach1(zustand).slice(zustand.gruppe);
  const ueberzaehlig = new Set(zuViele);
  return auffuellen({
    ...zustand,
    warteschlange: zustand.warteschlange.filter((id) => !ueberzaehlig.has(id)),
    reserve: [...zuViele, ...zustand.reserve],
  });
}

export function gruppeSetzen(zustand, gruppe) {
  if (!gueltigeGruppe(gruppe)) throw new Error('Die Gruppengröße muss eine ganze Zahl ab 1 sein.');
  return gruppeAnwenden({ ...zustand, gruppe });
}

export const offeneKarten = (zustand) => zustand.warteschlange.length + zustand.reserve.length;

export function tagesplan(zustand, ids, heute, zufall) {
  const plan = [];
  for (const fach of [1, 2, 3, 4]) {
    const imFach = ids.filter((id) => zustand.karten[id].fach === fach);
    const faellig = mischen(imFach.filter((id) => istFaellig(zustand.karten[id], heute)), zufall);
    // Nie abgefragte Karten zählen als am längsten nicht abgefragt.
    faellig.sort((a, b) => {
      const za = zustand.karten[a].zuletzt ?? '';
      const zb = zustand.karten[b].zuletzt ?? '';
      return za < zb ? -1 : za > zb ? 1 : 0;
    });
    plan.push(...faellig.slice(0, tagesmenge(imFach.length, fach)));
  }
  return mischen(plan, zufall);
}

// Bereits begonnene Fach-1-Karten bleiben vor neuen dran, damit die Lerngruppe
// am nächsten Tag dieselbe bleibt. Die ältesten kommen zuerst.
function fach1Reihenfolge(ids, karten) {
  const zuletzt = (id) => karten[id].zuletzt;
  return [...ids].sort((a, b) => {
    if (zuletzt(a) === zuletzt(b)) return 0;
    if (zuletzt(a) === null) return 1;
    if (zuletzt(b) === null) return -1;
    return zuletzt(a) < zuletzt(b) ? -1 : 1;
  });
}

// Rechnet den Plan nur beim ersten Öffnen eines Tages; danach bleibt er stabil.
export function tagSicherstellen(zustand, ids, heute, zufall) {
  if (zustand.tag === heute) return zustand;
  const plan = tagesplan(zustand, ids, heute, zufall);
  const fach1 = fach1Reihenfolge(plan.filter((id) => zustand.karten[id].fach === 1), zustand.karten);
  const andere = plan.filter((id) => zustand.karten[id].fach !== 1);
  return {
    ...zustand,
    tag: heute,
    warteschlange: mischen([...andere, ...fach1.slice(0, zustand.gruppe)], zufall),
    reserve: fach1.slice(zustand.gruppe),
    planGroesse: plan.length,
  };
}

export function bewerten(zustand, id, gewusst, heute) {
  if (zustand.tag !== heute) throw new Error('Der Lerntag ist abgelaufen.');
  if (zustand.warteschlange[0] !== id) throw new Error('Diese Karte ist nicht an der Reihe.');
  const alt = zustand.karten[id];
  const rest = zustand.warteschlange.slice(1);
  let fach;
  let warteschlange = rest;
  if (gewusst) {
    fach = alt.fach + 1;
  } else if (alt.fach === 1) {
    fach = 1;
    warteschlange = [...rest, id];
  } else {
    fach = 1;
  }
  return auffuellen({
    ...zustand,
    karten: { ...zustand.karten, [id]: { fach, zuletzt: heute } },
    warteschlange,
  });
}

// Merkgruppen liegen neben dem Karteikasten und ändern weder Fächer noch Tagesplan.
const MAX_MERKNAME = 40;

function merkgruppeAendern(zustand, gruppeId, aendern) {
  if (!zustand.merkgruppen.some((g) => g.id === gruppeId)) throw new Error('Diese Merkgruppe gibt es nicht mehr.');
  return {
    ...zustand,
    merkgruppen: zustand.merkgruppen.map((g) => (g.id === gruppeId ? aendern(g) : g)),
  };
}

export function merkgruppeAnlegen(zustand, gruppeId, name, kartenId) {
  const sauber = name.trim();
  if (!sauber) throw new Error('Bitte gib der Merkgruppe einen Namen.');
  if (sauber.length > MAX_MERKNAME) throw new Error(`Der Name darf höchstens ${MAX_MERKNAME} Zeichen lang sein.`);
  if (zustand.merkgruppen.some((g) => g.name.toLowerCase() === sauber.toLowerCase())) {
    throw new Error('Eine Merkgruppe mit diesem Namen gibt es schon.');
  }
  return {
    ...zustand,
    merkgruppen: [...zustand.merkgruppen, { id: gruppeId, name: sauber, karten: [kartenId], runde: [] }],
  };
}

// Läuft gerade eine Runde, kommt die neue Karte ans Ende und wird noch mit abgefragt.
export const merkKarteHinzufuegen = (zustand, gruppeId, kartenId) => merkgruppeAendern(zustand, gruppeId, (g) => (
  g.karten.includes(kartenId) ? g : {
    ...g,
    karten: [...g.karten, kartenId],
    runde: g.runde.length ? [...g.runde, kartenId] : g.runde,
  }
));

export const merkKarteEntfernen = (zustand, gruppeId, kartenId) => merkgruppeAendern(zustand, gruppeId, (g) => ({
  ...g,
  karten: g.karten.filter((id) => id !== kartenId),
  runde: g.runde.filter((id) => id !== kartenId),
}));

export const merkgruppeLoeschen = (zustand, gruppeId) => ({
  ...zustand,
  merkgruppen: zustand.merkgruppen.filter((g) => g.id !== gruppeId),
});

export const merkRundeStarten = (zustand, gruppeId, ids, zufall) => merkgruppeAendern(zustand, gruppeId, (g) => ({
  ...g,
  runde: mischen(g.karten.filter((id) => ids.includes(id)), zufall),
}));

export const merkBewerten = (zustand, gruppeId, kartenId, gewusst) => merkgruppeAendern(zustand, gruppeId, (g) => {
  if (g.runde[0] !== kartenId) throw new Error('Diese Karte ist nicht an der Reihe.');
  const rest = g.runde.slice(1);
  return { ...g, runde: gewusst ? rest : [...rest, kartenId] };
});

// Blättern dreht nur die offenen Karten weiter. Die sichtbare Karte steht immer vorn.
export const merkBlaettern = (zustand, gruppeId, richtung) => merkgruppeAendern(zustand, gruppeId, (g) => {
  if (g.runde.length < 2) return g;
  return {
    ...g,
    runde: richtung > 0 ? [...g.runde.slice(1), g.runde[0]] : [g.runde.at(-1), ...g.runde.slice(0, -1)],
  };
});

// Mehrere Namen eines Fisches stehen mit " | " getrennt im Feld name.
export const kurzname = (name) => name.split(' | ')[0];

// Beide Schreibweisen zählen: „Äsche“ findet man über „aesche“ und über „asche“.
const UMSCHRIFT = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
const OHNE_PUNKTE = { ä: 'a', ö: 'o', ü: 'u', ß: 'ss' };

function schreibweisen(text) {
  const klein = text.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
  return [UMSCHRIFT, OHNE_PUNKTE].map((tabelle) => klein.replace(/[äöüß]/g, (z) => tabelle[z]));
}

// Sucht in allen Namen einer Karte. Treffer am Wortanfang stehen vorn, sonst
// geht es nach dem Alphabet. Ohne Suchtext erscheinen alle Karten.
export function fischeSuchen(fische, text) {
  const gesucht = schreibweisen(text);
  const sortiert = [...fische].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  if (!gesucht[0]) return sortiert;
  const wortanfang = [];
  const mittendrin = [];
  for (const fisch of sortiert) {
    const namen = schreibweisen(fisch.name);
    if (gesucht.some((g, i) => namen[i].startsWith(g) || namen[i].includes(` ${g}`))) wortanfang.push(fisch);
    else if (gesucht.some((g, i) => namen[i].includes(g))) mittendrin.push(fisch);
  }
  return [...wortanfang, ...mittendrin];
}

// Ganzjährig geschützte Arten haben kein Maß, das beim Fang eine Rolle spielt.
export function mindestmassText(fisch) {
  if (fisch.mindestmass_cm !== null) return `${fisch.mindestmass_cm} cm`;
  return fisch.schonzeit === 'ganzjährig' ? '-' : 'kein Mindestmaß';
}

// Trennt „Cypriniformes (karpfenartige Fische)“ in die Zeile „Ordnung | Gattung“
// und die Erläuterung darunter.
export function systematik(fisch) {
  const [, ordnung = '', gruppe = ''] = (fisch.ordnung ?? '').match(/^(.*?)(?: \((.*)\))?$/) ?? [];
  return {
    zeile: [ordnung, fisch.gattung].filter(Boolean).join(' | ') || 'nicht angegeben',
    gruppe,
  };
}

// Welche Symbole unter dem Namen stehen und was sie zusammen bedeuten.
export function symbole(fisch) {
  const mass = fisch.mindestmass_cm !== null;
  const schonzeit = fisch.schonzeit !== null;
  if (fisch.invasiv) return { namen: ['angel', 'nicht-zuruecksetzen'], bedeutung: 'Invasive Art, nicht zurücksetzen' };
  if (!mass && fisch.schonzeit === 'ganzjährig') return { namen: ['angel-gesperrt'], bedeutung: 'Ganzjährig geschont' };
  if (mass && schonzeit) return { namen: ['angel', 'mass', 'kalender'], bedeutung: 'Mindestmaß und Schonzeit' };
  if (mass) return { namen: ['angel', 'mass'], bedeutung: 'Mindestmaß' };
  if (schonzeit) return { namen: ['angel', 'kalender'], bedeutung: 'Schonzeit' };
  return { namen: ['angel'], bedeutung: 'Nicht geschützt' };
}

// Der Modus für Verwechslungen ist vom Karteikasten unabhängig und ändert keine Fächer.
export const vergleichStarten = (zustand, paarIds, zufall) => ({
  ...zustand,
  vergleich: mischen(paarIds, zufall),
});

export function vergleichBewerten(zustand, id, gewusst) {
  if (zustand.vergleich[0] !== id) throw new Error('Dieses Paar ist nicht an der Reihe.');
  const rest = zustand.vergleich.slice(1);
  return { ...zustand, vergleich: gewusst ? rest : [...rest, id] };
}

export function anzahlJeFach(zustand, ids) {
  const zaehler = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const id of ids) zaehler[zustand.karten[id].fach]++;
  return zaehler;
}

// Prüft einen importierten Fortschritt, bevor er den aktuellen ersetzt.
export function zustandPruefen(z) {
  if (!z || typeof z !== 'object' || !z.karten || typeof z.karten !== 'object') {
    throw new Error('Die Datei enthält keinen Fortschritt.');
  }
  if (z.tag !== null && !(typeof z.tag === 'string' && DATUM.test(z.tag))) {
    throw new Error('Das Datum in der Datei ist ungültig.');
  }
  if (!Array.isArray(z.warteschlange) || z.warteschlange.some((id) => !z.karten[id])) {
    throw new Error('Die Warteschlange in der Datei ist ungültig.');
  }
  if (z.reserve !== undefined && (!Array.isArray(z.reserve) || z.reserve.some((id) => !z.karten[id]))) {
    throw new Error('Die wartenden Karten in der Datei sind ungültig.');
  }
  if (z.gruppe !== undefined && !gueltigeGruppe(z.gruppe)) {
    throw new Error('Die Gruppengröße in der Datei ist ungültig.');
  }
  if (z.vergleich !== undefined && (!Array.isArray(z.vergleich) || z.vergleich.some((id) => typeof id !== 'string'))) {
    throw new Error('Die Verwechslungen in der Datei sind ungültig.');
  }
  const textListe = (l) => Array.isArray(l) && l.every((id) => typeof id === 'string');
  if (z.merkgruppen !== undefined && !(Array.isArray(z.merkgruppen) && z.merkgruppen.every((g) => (
    typeof g?.id === 'string' && typeof g.name === 'string' && textListe(g.karten) && textListe(g.runde)
  )))) {
    throw new Error('Die Merkgruppen in der Datei sind ungültig.');
  }
  for (const karte of Object.values(z.karten)) {
    const fachOk = Number.isInteger(karte?.fach) && karte.fach >= 1 && karte.fach <= 5;
    const zuletztOk = karte?.zuletzt === null || (typeof karte?.zuletzt === 'string' && DATUM.test(karte.zuletzt));
    if (!fachOk || !zuletztOk) throw new Error('Eine Karte in der Datei ist ungültig.');
  }
  return migrieren({
    karten: z.karten,
    tag: z.tag,
    warteschlange: z.warteschlange,
    reserve: z.reserve,
    planGroesse: Number.isInteger(z.planGroesse) ? z.planGroesse : z.warteschlange.length,
    gruppe: z.gruppe,
    vergleich: z.vergleich,
    merkgruppen: z.merkgruppen,
  });
}
