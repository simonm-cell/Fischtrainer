import {
  abgleichen, anzahlJeFach, bewerten, gruppeAnwenden, gruppeSetzen, kurzname, lokalerTag, migrieren,
  mindestmassText, neuerZustand, offeneKarten, symbole, tagSicherstellen, vergleichBewerten, vergleichStarten, zustandPruefen,
} from './logik.js';
import {
  bildIdsLaden, bildLaden, bilderSpeichern, dauerhaftAnfordern, istDauerhaft, vergleichLaden, vergleichSpeichern,
  zustandLaden, zustandSpeichern,
} from './speicher.js';
import { zipLesen } from './zip.js';

const VERSION = '1.2.0';
const $ = (id) => document.getElementById(id);

let fische = [];
let fischNachId = new Map();
let ids = [];
let zustand;
let bildIds = new Set();
let bildUrl = null;
let aufgedeckt = false;
let beschaeftigt = false;
let paare = [];
let paarAktuell = null;
let vergleichUrls = [];

const heute = () => lokalerTag(new Date());

function fischePruefen(liste) {
  if (!Array.isArray(liste) || liste.length === 0) throw new Error('fische.json enthält keine Fische.');
  const gesehen = new Set();
  for (const f of liste) {
    if (typeof f?.id !== 'string' || !f.id || typeof f.name !== 'string' || !f.name) {
      throw new Error('In fische.json fehlt bei einem Fisch die id oder der Name.');
    }
    if (gesehen.has(f.id)) throw new Error(`Die id „${f.id}“ steht doppelt in fische.json.`);
    gesehen.add(f.id);
    if (f.mindestmass_cm !== null && typeof f.mindestmass_cm !== 'number') {
      throw new Error(`Das Mindestmaß von „${f.name}“ muss eine Zahl oder null sein.`);
    }
    if (f.schonzeit !== null && typeof f.schonzeit !== 'string') {
      throw new Error(`Die Schonzeit von „${f.name}“ muss ein Text oder null sein.`);
    }
    if (f.ordnung !== undefined && f.ordnung !== null && typeof f.ordnung !== 'string') {
      throw new Error(`Die Ordnung von „${f.name}“ muss ein Text oder null sein.`);
    }
    if (f.lebensraum !== undefined && f.lebensraum !== null && typeof f.lebensraum !== 'string') {
      throw new Error(`Der Lebensraum von „${f.name}“ muss ein Text oder null sein.`);
    }
    if (f.herkunft !== undefined && f.herkunft !== null && typeof f.herkunft !== 'string') {
      throw new Error(`Die Herkunft von „${f.name}“ muss ein Text oder null sein.`);
    }
    if (f.invasiv !== undefined && typeof f.invasiv !== 'boolean') {
      throw new Error(`Das Feld invasiv von „${f.name}“ muss true oder false sein.`);
    }
  }
  return liste;
}

async function jsonLaden(pfad) {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(`${pfad} konnte nicht geladen werden.`);
  return antwort.json();
}

const speichern = () => zustandSpeichern(zustand);

// Prüft bei jedem Schritt, ob inzwischen Mitternacht vorbei ist.
async function tagPruefen() {
  const vorher = zustand.tag;
  zustand = tagSicherstellen(zustand, ids, heute(), Math.random);
  if (zustand.tag === vorher) return false;
  await speichern();
  return vorher !== null;
}

function ansichtZeigen(name) {
  for (const a of document.querySelectorAll('[data-ansicht]')) a.hidden = a.dataset.ansicht !== name;
  window.scrollTo(0, 0);
}

function meldung(element, text, art = '') {
  element.textContent = text;
  element.className = `meldung ${art}`.trim();
  element.hidden = !text;
}

/* Startseite */

function startZeigen() {
  const offen = offeneKarten(zustand);
  const je = anzahlJeFach(zustand, ids);
  $('faellig-zahl').textContent = offen;
  $('faellig-text').textContent = offen === 1 ? 'Karte heute fällig' : 'Karten heute fällig';

  const fertig = offen === 0;
  $('tag-fertig').hidden = !fertig;
  $('tag-fertig').textContent = je[5] === ids.length
    ? 'Alle Karten liegen in Fach 5 und gelten als gelernt.'
    : 'Für heute ist alles erledigt.';

  for (let fach = 1; fach <= 5; fach++) $(`fach-${fach}`).textContent = je[fach];

  const keineBilder = bildIds.size === 0;
  $('bilder-hinweis').hidden = !keineBilder;
  $('lernen').disabled = fertig || keineBilder;
  $('verwechslungen').disabled = paare.length === 0;
  $('vergleich-hinweis').hidden = paare.length > 0 || keineBilder;
  ansichtZeigen('start');
}

/* Lernkarte */

function symboleZeigen(fisch) {
  const { namen, bedeutung } = symbole(fisch);
  const leiste = $('karte-symbole');
  const ns = 'http://www.w3.org/2000/svg';
  leiste.replaceChildren(...namen.map((name) => {
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', `#symbol-${name}`);
    svg.append(use);
    return svg;
  }));
  leiste.dataset.symbole = namen.join(' ');
  leiste.setAttribute('aria-label', bedeutung);
  leiste.title = bedeutung;
}

function bildFreigeben() {
  if (bildUrl) URL.revokeObjectURL(bildUrl);
  bildUrl = null;
}

async function bildZeigen(id) {
  bildFreigeben();
  const blob = bildIds.has(id) ? await bildLaden(id) : null;
  const bild = $('karte-bild');
  $('karte-platzhalter').hidden = Boolean(blob);
  bild.hidden = !blob;
  bild.removeAttribute('src');
  if (blob) {
    bildUrl = URL.createObjectURL(blob);
    bild.src = bildUrl;
  }
}

async function karteZeigen() {
  if (await tagPruefen()) {
    location.hash = '';
    return;
  }
  const id = zustand.warteschlange[0];
  if (!id) {
    bildFreigeben();
    ansichtZeigen('fertig');
    return;
  }
  aufgedeckt = false;
  // Die Lösung kommt erst beim Aufdecken in die Seite.
  $('karte-loesung').hidden = true;
  $('karte-name').textContent = '';
  $('karte-symbole').replaceChildren();
  $('karte-ordnung').textContent = '';
  $('karte-lebensraum').textContent = '';
  $('karte-herkunft').textContent = '';
  $('karte-herkunft-zeile').hidden = true;
  $('karte-mass').textContent = '';
  $('karte-schonzeit').textContent = '';
  $('karte-hinweis').textContent = '';
  $('karte-hinweis-zeile').hidden = true;
  $('bewerten').hidden = true;
  $('aufdecken').hidden = false;
  $('karte-bild').alt = 'Bild des gesuchten Tieres';
  document.querySelector('.karte').classList.remove('ist-aufgedeckt');
  await bildZeigen(id);
  ansichtZeigen('karte');
}

function aufdecken() {
  if (aufgedeckt) return;
  const fisch = fischNachId.get(zustand.warteschlange[0]);
  if (!fisch) return;
  aufgedeckt = true;
  $('karte-name').textContent = fisch.name;
  symboleZeigen(fisch);
  $('karte-ordnung').textContent = fisch.ordnung || 'nicht angegeben';
  $('karte-lebensraum').textContent = fisch.lebensraum || 'nicht angegeben';
  $('karte-herkunft').textContent = fisch.herkunft || '';
  $('karte-herkunft-zeile').hidden = !fisch.herkunft;
  $('karte-mass').textContent = mindestmassText(fisch);
  $('karte-schonzeit').textContent = fisch.schonzeit ?? 'keine Schonzeit';
  $('karte-hinweis').textContent = fisch.hinweis || '';
  $('karte-hinweis-zeile').hidden = !fisch.hinweis;
  $('karte-bild').alt = `Bild: ${fisch.name}`;
  $('karte-loesung').hidden = false;
  $('aufdecken').hidden = true;
  $('bewerten').hidden = false;
  document.querySelector('.karte').classList.add('ist-aufgedeckt');
  $('karte-loesung').scrollTop = 0;
}

async function bewertungAbgeben(gewusst) {
  if (!aufgedeckt || beschaeftigt) return;
  beschaeftigt = true;
  try {
    if (await tagPruefen()) {
      location.hash = '';
      return;
    }
    zustand = bewerten(zustand, zustand.warteschlange[0], gewusst, zustand.tag);
    await speichern();
    await karteZeigen();
  } finally {
    beschaeftigt = false;
  }
}

/* Verwechslungen üben */

function vergleichFreigeben() {
  for (const url of vergleichUrls) URL.revokeObjectURL(url);
  vergleichUrls = [];
}

async function vergleichBild(schluessel, alt) {
  const blob = bildIds.has(schluessel) ? await bildLaden(schluessel) : null;
  if (!blob) {
    const platzhalter = document.createElement('div');
    platzhalter.className = 'platzhalter';
    platzhalter.textContent = 'Kein Bild vorhanden';
    return platzhalter;
  }
  const bild = document.createElement('img');
  const url = URL.createObjectURL(blob);
  vergleichUrls.push(url);
  bild.src = url;
  bild.alt = alt;
  return bild;
}

async function vergleichZeigen() {
  const paar = paare.find((p) => p.id === zustand.vergleich[0]);
  vergleichFreigeben();
  aufgedeckt = false;
  paarAktuell = null;
  if (!paar) {
    ansichtZeigen('vergleich-fertig');
    return;
  }
  // Die Reihenfolge wechselt, damit nicht die Position die Lösung verrät.
  paarAktuell = { id: paar.id, gemeinsam: paar.gemeinsam, fische: Math.random() < 0.5 ? paar.fische : [...paar.fische].reverse() };
  const bilder = await Promise.all(paarAktuell.fische.map((f, i) => vergleichBild(f.vorn, `${i + 1}. Fisch`)));
  $('vergleich-inhalt').replaceChildren(...bilder.map((bild) => {
    const rahmen = document.createElement('div');
    rahmen.className = 'vergleich-vorn';
    rahmen.append(bild);
    return rahmen;
  }));
  $('vergleich-inhalt').classList.remove('ist-aufgedeckt');
  $('vergleich-aufdecken').hidden = false;
  $('vergleich-bewerten').hidden = true;
  ansichtZeigen('vergleich');
}

async function vergleichAufdecken() {
  if (aufgedeckt || !paarAktuell) return;
  aufgedeckt = true;
  const teile = [];
  for (const fisch of paarAktuell.fische) {
    const block = document.createElement('section');
    const name = document.createElement('h2');
    // Fische aus fische.json tragen in beiden Lernmodi dieselben Namen.
    name.textContent = fischNachId.get(fisch.vorn)?.name ?? fisch.name;
    block.append(name, await vergleichBild(fisch.hinten, `Unterscheidungsmerkmale: ${name.textContent}`));
    if (fisch.text) {
      const text = document.createElement('p');
      text.textContent = fisch.text;
      block.append(text);
    }
    teile.push(block);
  }
  if (paarAktuell.gemeinsam) {
    const text = document.createElement('p');
    text.className = 'vergleich-gemeinsam';
    text.textContent = paarAktuell.gemeinsam;
    teile.push(text);
  }
  $('vergleich-inhalt').replaceChildren(...teile);
  $('vergleich-inhalt').classList.add('ist-aufgedeckt');
  $('vergleich-inhalt').scrollTop = 0;
  $('vergleich-aufdecken').hidden = true;
  $('vergleich-bewerten').hidden = false;
}

async function vergleichBewertungAbgeben(gewusst) {
  if (!aufgedeckt || beschaeftigt || !paarAktuell) return;
  beschaeftigt = true;
  try {
    zustand = vergleichBewerten(zustand, paarAktuell.id, gewusst);
    await speichern();
    await vergleichZeigen();
  } finally {
    beschaeftigt = false;
  }
}

async function vergleichBeginnen() {
  if (zustand.vergleich.length === 0) {
    zustand = vergleichStarten(zustand, paare.map((p) => p.id), Math.random);
    await speichern();
  }
  if (location.hash === '#vergleich') await vergleichZeigen();
  else location.hash = 'vergleich';
}

function paarePruefen(liste) {
  const ok = Array.isArray(liste) && liste.every((p) => typeof p?.id === 'string'
    && Array.isArray(p.fische) && p.fische.length === 2
    && p.fische.every((f) => ['name', 'vorn', 'hinten', 'text'].every((k) => typeof f?.[k] === 'string')));
  if (!ok) throw new Error('Die Vergleichsdaten in der ZIP-Datei sind ungültig.');
  return liste;
}

/* Bilder importieren */

function bildTyp(kopf) {
  if (kopf[0] === 0xff && kopf[1] === 0xd8 && kopf[2] === 0xff) return 'image/jpeg';
  if (kopf[0] === 0x89 && kopf[1] === 0x50 && kopf[2] === 0x4e && kopf[3] === 0x47) return 'image/png';
  if (kopf[0] === 0x52 && kopf[1] === 0x49 && kopf[2] === 0x46 && kopf[3] === 0x46
    && kopf[8] === 0x57 && kopf[9] === 0x45 && kopf[10] === 0x42 && kopf[11] === 0x50) return 'image/webp';
  return null;
}

async function bilderImportieren(datei, ausgabe) {
  meldung(ausgabe, 'Bilder werden importiert …');
  try {
    const eintraege = await zipLesen(datei);
    const neu = [];
    let ignoriert = 0;
    let neuePaare = null;
    for (const { name, blob } of eintraege) {
      if (name === 'vergleich.json') {
        neuePaare = paarePruefen(JSON.parse(await blob.text()));
        continue;
      }
      const id = name.match(/^(.+)\.(jpe?g|png|webp)$/i)?.[1];
      if (!id || !(fischNachId.has(id) || /^(v|extra)_/.test(id))) {
        ignoriert++;
        continue;
      }
      const typ = bildTyp(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
      if (!typ) {
        ignoriert++;
        continue;
      }
      neu.push({ id, blob: new Blob([blob], { type: typ }) });
    }
    if (neu.length === 0) throw new Error('In der ZIP-Datei wurde kein passendes Bild gefunden.');
    await bilderSpeichern(neu);
    if (neuePaare) {
      await vergleichSpeichern(neuePaare);
      paare = neuePaare;
      zustand = { ...zustand, vergleich: zustand.vergleich.filter((id) => paare.some((p) => p.id === id)) };
      await speichern();
    }
    bildIds = new Set(await bildIdsLaden());
    await dauerhaftAnfordern();
    const fehlen = ids.filter((id) => !bildIds.has(id)).length;
    const fischbilder = neu.filter((b) => fischNachId.has(b.id)).length;
    const teile = [`${fischbilder} Fischbilder importiert.`];
    if (neuePaare) teile.push(`${neuePaare.length} Vergleichspaare importiert.`);
    if (ignoriert) teile.push(`${ignoriert} Dateien ignoriert.`);
    if (fehlen) teile.push(`${fehlen} Bilder fehlen noch.`);
    meldung(ausgabe, teile.join(' '), 'erfolg');
  } catch (e) {
    meldung(ausgabe, e.message, 'fehler');
  }
}

/* Einstellungen */

async function einstellungenZeigen() {
  const fehlend = fische.filter((f) => !bildIds.has(f.id));
  $('bilder-anzahl').textContent = `${ids.length - fehlend.length} vorhanden, ${fehlend.length} fehlen, ${paare.length} Vergleichspaare`;
  $('gruppe').max = ids.length;
  $('gruppe').value = zustand.gruppe;
  $('bilder-fehlend').textContent = fehlend.length && fehlend.length < ids.length
    ? `Es fehlen: ${fehlend.map((f) => kurzname(f.name)).join(', ')}`
    : '';
  $('speicher-status').textContent = (await istDauerhaft())
    ? 'Der Browser hat dauerhaften Speicher zugesagt.'
    : 'Der Browser hat keinen dauerhaften Speicher zugesagt. Bewahre deshalb fischbilder.zip und einen Fortschritts-Export auf.';
  ansichtZeigen('einstellungen');
}

function link(url, text) {
  const a = document.createElement('a');
  a.textContent = text;
  if (/^https:\/\//.test(url)) {
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return a;
}

function quellenFuellen() {
  const quellen = new Map();
  for (const f of fische) {
    if (f.quelle) quellen.set(`${f.quelle}|${f.stand}`, f);
  }
  const liste = $('quellen-liste');
  liste.replaceChildren();
  for (const f of quellen.values()) {
    const li = document.createElement('li');
    li.append(link(f.quelle, f.quelle), document.createElement('br'), `Stand: ${f.stand || 'unbekannt'}`);
    liste.append(li);
  }
  const ungeprueft = fische.filter((f) => /ungeprüft/i.test(f.hinweis || ''));
  $('ungeprueft').textContent = ungeprueft.length
    ? `Hinweise mit dem Vermerk „ungeprüft“: ${ungeprueft.map((f) => kurzname(f.name)).join(', ')}.`
    : '';
  $('version').textContent = `Version ${VERSION}`;
}

async function nachweiseFuellen() {
  const nachweise = await jsonLaden('bildnachweise.json');
  const liste = $('nachweise-liste');
  liste.replaceChildren();
  for (const n of nachweise) {
    const li = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = kurzname(fischNachId.get(n.id)?.name ?? n.id);
    li.append(name, document.createElement('br'), `Urheber: ${n.urheber}`, document.createElement('br'), 'Lizenz: ');
    li.append(n.lizenz_url ? link(n.lizenz_url.replace(/^http:/, 'https:'), n.lizenz) : n.lizenz);
    li.append(document.createElement('br'), link(n.quelle, 'Bild auf Wikimedia Commons'));
    liste.append(li);
  }
}

function fortschrittExportieren() {
  const inhalt = JSON.stringify({
    app: 'fischtrainer',
    format: 1,
    exportiert: new Date().toISOString(),
    zustand,
  }, null, 2);
  const url = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `fischtrainer-fortschritt-${heute()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  meldung($('fortschritt-meldung'), 'Der Fortschritt wurde als Datei gespeichert.', 'erfolg');
}

let wartenderImport = null;

async function fortschrittPruefen(datei) {
  const ausgabe = $('fortschritt-meldung');
  try {
    if (datei.size > 5 * 1024 * 1024) throw new Error('Die Datei ist zu groß.');
    let inhalt;
    try {
      inhalt = JSON.parse(await datei.text());
    } catch {
      throw new Error('Die Datei ist keine gültige JSON-Datei.');
    }
    if (inhalt?.app !== 'fischtrainer') throw new Error('Das ist keine Fortschrittsdatei des Fischtrainers.');
    wartenderImport = zustandPruefen(inhalt.zustand);
    $('import-dialog').showModal();
  } catch (e) {
    meldung(ausgabe, e.message, 'fehler');
  }
}

async function fortschrittUebernehmen() {
  zustand = tagSicherstellen(gruppeAnwenden(abgleichen(wartenderImport, ids)), ids, heute(), Math.random);
  zustand = { ...zustand, vergleich: zustand.vergleich.filter((id) => paare.some((p) => p.id === id)) };
  wartenderImport = null;
  await speichern();
  meldung($('fortschritt-meldung'), 'Der Fortschritt wurde importiert.', 'erfolg');
}

async function fortschrittZuruecksetzen() {
  zustand = tagSicherstellen(neuerZustand(ids, zustand.gruppe), ids, heute(), Math.random);
  await speichern();
  meldung($('fortschritt-meldung'), 'Der Fortschritt wurde zurückgesetzt. Die Bilder bleiben erhalten.', 'erfolg');
}

async function gruppeAendern() {
  const ausgabe = $('gruppe-meldung');
  const wert = Number($('gruppe').value);
  if (!Number.isInteger(wert) || wert < 1 || wert > ids.length) {
    meldung(ausgabe, `Bitte eine ganze Zahl von 1 bis ${ids.length} eingeben.`, 'fehler');
    $('gruppe').value = zustand.gruppe;
    return;
  }
  zustand = gruppeSetzen(zustand, wert);
  await speichern();
  meldung(ausgabe, `Aus Fach 1 werden jetzt höchstens ${wert} Karten gleichzeitig abgefragt.`, 'erfolg');
}

/* Navigation und Bedienung */

async function route() {
  await tagPruefen();
  const ziel = location.hash.slice(1);
  if (ziel !== 'vergleich') vergleichFreigeben();
  if (ziel === 'lernen') await karteZeigen();
  else if (ziel === 'vergleich') await vergleichZeigen();
  else if (ziel === 'einstellungen') await einstellungenZeigen();
  else {
    bildFreigeben();
    startZeigen();
  }
}

function tastatur(e) {
  if (document.querySelector('dialog[open]') || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
  const karte = !$('ansicht-karte').hidden;
  if (!karte && $('ansicht-vergleich').hidden) return;
  const deckeAuf = karte ? aufdecken : vergleichAufdecken;
  const bewerte = karte ? bewertungAbgeben : vergleichBewertungAbgeben;
  if (e.code === 'Space' && !aufgedeckt) {
    e.preventDefault();
    deckeAuf();
  } else if (e.code === 'Space') {
    e.preventDefault();
  } else if (aufgedeckt && (e.key === '1' || e.code === 'Numpad1')) {
    e.preventDefault();
    bewerte(true);
  } else if (aufgedeckt && (e.key === '2' || e.code === 'Numpad2')) {
    e.preventDefault();
    bewerte(false);
  }
}

function dateiWahl(eingabe, aktion) {
  eingabe.addEventListener('change', async () => {
    const datei = eingabe.files[0];
    eingabe.value = '';
    if (datei) await aktion(datei);
  });
}

function bedienungEinrichten() {
  $('lernen').addEventListener('click', () => {
    meldung($('bilder-meldung-start'), '');
    location.hash = 'lernen';
  });
  $('verwechslungen').addEventListener('click', vergleichBeginnen);
  $('vergleich-nochmal').addEventListener('click', vergleichBeginnen);
  $('vergleich-zur-start').addEventListener('click', () => { location.hash = ''; });
  $('vergleich-aufdecken').addEventListener('click', vergleichAufdecken);
  $('vergleich-gewusst').addEventListener('click', () => vergleichBewertungAbgeben(true));
  $('vergleich-nicht-gewusst').addEventListener('click', () => vergleichBewertungAbgeben(false));
  $('gruppe').addEventListener('change', gruppeAendern);
  $('oeffne-einstellungen').addEventListener('click', () => { location.hash = 'einstellungen'; });
  $('zur-start').addEventListener('click', () => { location.hash = ''; });
  $('zur-start-fertig').addEventListener('click', () => { location.hash = ''; });
  $('aufdecken').addEventListener('click', aufdecken);
  $('gewusst').addEventListener('click', () => bewertungAbgeben(true));
  $('nicht-gewusst').addEventListener('click', () => bewertungAbgeben(false));
  $('bilder-start').addEventListener('click', () => $('bilder-datei-start').click());
  $('bilder-einstellungen').addEventListener('click', () => $('bilder-datei').click());
  dateiWahl($('bilder-datei-start'), async (d) => {
    await bilderImportieren(d, $('bilder-meldung-start'));
    startZeigen();
  });
  dateiWahl($('bilder-datei'), async (d) => {
    await bilderImportieren(d, $('bilder-meldung'));
    await einstellungenZeigen();
  });
  $('export').addEventListener('click', fortschrittExportieren);
  $('import').addEventListener('click', () => $('import-datei').click());
  dateiWahl($('import-datei'), fortschrittPruefen);
  $('import-dialog').addEventListener('close', async () => {
    if ($('import-dialog').returnValue === 'ja') await fortschrittUebernehmen();
    else wartenderImport = null;
    $('import-dialog').returnValue = '';
  });
  $('reset').addEventListener('click', () => $('reset-dialog').showModal());
  $('reset-dialog').addEventListener('close', async () => {
    if ($('reset-dialog').returnValue === 'ja') await fortschrittZuruecksetzen();
    $('reset-dialog').returnValue = '';
  });
  document.addEventListener('keydown', tastatur);
  window.addEventListener('hashchange', route);
  // Nach einem App-Wechsel bleibt die Karte, wie sie war, außer es ist ein neuer Tag.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && await tagPruefen()) {
      if (location.hash) location.hash = '';
      else startZeigen();
    }
  });
}

async function start() {
  try {
    fische = fischePruefen(await jsonLaden('fische.json'));
    fischNachId = new Map(fische.map((f) => [f.id, f]));
    ids = fische.map((f) => f.id);
    const gespeichert = await zustandLaden();
    paare = (await vergleichLaden()) ?? [];
    zustand = gruppeAnwenden(abgleichen(migrieren(gespeichert ?? neuerZustand(ids)), ids));
    zustand = { ...zustand, vergleich: zustand.vergleich.filter((id) => paare.some((p) => p.id === id)) };
    bildIds = new Set(await bildIdsLaden());
    await speichern();
    bedienungEinrichten();
    quellenFuellen();
    await nachweiseFuellen();
    await route();
    dauerhaftAnfordern();
  } catch (e) {
    $('start-fehler').textContent = `Die App konnte nicht starten: ${e.message}`;
    ansichtZeigen('fehler');
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
  }
}

start();
