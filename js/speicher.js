// Fortschritt und Bilder liegen in IndexedDB, also nur auf diesem Gerät.

const DB_NAME = 'fischtrainer';
const ZUSTAND = 'zustand';
const VERGLEICH = 'vergleich';
let verbindung;

function oeffnen() {
  verbindung ??= new Promise((ok, fehler) => {
    const anfrage = indexedDB.open(DB_NAME, 1);
    anfrage.onupgradeneeded = () => {
      anfrage.result.createObjectStore('daten');
      anfrage.result.createObjectStore('bilder');
    };
    anfrage.onsuccess = () => ok(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });
  return verbindung;
}

async function lesen(store, aktion) {
  const db = await oeffnen();
  return new Promise((ok, fehler) => {
    const anfrage = aktion(db.transaction(store).objectStore(store));
    anfrage.onsuccess = () => ok(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error);
  });
}

async function schreiben(store, aktion) {
  const db = await oeffnen();
  return new Promise((ok, fehler) => {
    const tx = db.transaction(store, 'readwrite');
    aktion(tx.objectStore(store));
    tx.oncomplete = () => ok();
    tx.onerror = () => fehler(tx.error);
    tx.onabort = () => fehler(tx.error);
  });
}

export const zustandLaden = () => lesen('daten', (s) => s.get(ZUSTAND));
export const zustandSpeichern = (zustand) => schreiben('daten', (s) => s.put(zustand, ZUSTAND));
export const vergleichLaden = () => lesen('daten', (s) => s.get(VERGLEICH));
export const vergleichSpeichern = (paare) => schreiben('daten', (s) => s.put(paare, VERGLEICH));
export const bildLaden = (id) => lesen('bilder', (s) => s.get(id));
export const bildIdsLaden = () => lesen('bilder', (s) => s.getAllKeys());
export const bilderSpeichern = (bilder) => schreiben('bilder', (s) => {
  for (const { id, blob } of bilder) s.put(blob, id);
});

export async function dauerhaftAnfordern() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function istDauerhaft() {
  if (!navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
