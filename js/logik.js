// Lernlogik des Karteikastens. Alle Funktionen sind rein: Sie lesen weder Uhr
// noch Speicher, und Datum und Zufall kommen als Parameter herein.

export const NENNER = { 1: 1, 2: 2, 3: 3, 4: 5 };
export const ABSTAND_TAGE = { 1: 1, 2: 2, 3: 3, 4: 5 };

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

export function neuerZustand(ids) {
  const karten = {};
  for (const id of ids) karten[id] = { fach: 1, zuletzt: null };
  return { karten, tag: null, warteschlange: [], planGroesse: 0 };
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
  };
}

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

// Rechnet den Plan nur beim ersten Öffnen eines Tages; danach bleibt er stabil.
export function tagSicherstellen(zustand, ids, heute, zufall) {
  if (zustand.tag === heute) return zustand;
  const warteschlange = tagesplan(zustand, ids, heute, zufall);
  return { ...zustand, tag: heute, warteschlange, planGroesse: warteschlange.length };
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
  return {
    ...zustand,
    karten: { ...zustand.karten, [id]: { fach, zuletzt: heute } },
    warteschlange,
  };
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
  for (const karte of Object.values(z.karten)) {
    const fachOk = Number.isInteger(karte?.fach) && karte.fach >= 1 && karte.fach <= 5;
    const zuletztOk = karte?.zuletzt === null || (typeof karte?.zuletzt === 'string' && DATUM.test(karte.zuletzt));
    if (!fachOk || !zuletztOk) throw new Error('Eine Karte in der Datei ist ungültig.');
  }
  return {
    karten: z.karten,
    tag: z.tag,
    warteschlange: z.warteschlange,
    planGroesse: Number.isInteger(z.planGroesse) ? z.planGroesse : z.warteschlange.length,
  };
}
