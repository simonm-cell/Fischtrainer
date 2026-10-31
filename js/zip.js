// Liest ZIP-Dateien direkt im Browser. Es wird nichts hochgeladen und keine
// fremde Bibliothek gebraucht, weil der Browser Deflate selbst entpacken kann.

const MAX_DATEI = 30 * 1024 * 1024;
const MAX_ZIP = 500 * 1024 * 1024;

async function entpacken(daten) {
  const strom = new Blob([daten]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const leser = strom.getReader();
  const teile = [];
  let summe = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    summe += value.length;
    if (summe > MAX_DATEI) {
      await leser.cancel();
      throw new Error('Eine Datei in der ZIP-Datei ist zu groß.');
    }
    teile.push(value);
  }
  return new Blob(teile);
}

export async function zipLesen(datei) {
  if (datei.size > MAX_ZIP) throw new Error('Die ZIP-Datei ist zu groß.');
  const puffer = await datei.arrayBuffer();
  const sicht = new DataView(puffer);
  const bytes = new Uint8Array(puffer);

  let ende = -1;
  for (let i = puffer.byteLength - 22; i >= 0 && i >= puffer.byteLength - 65557; i--) {
    if (sicht.getUint32(i, true) === 0x06054b50) {
      ende = i;
      break;
    }
  }
  if (ende < 0) throw new Error('Das ist keine gültige ZIP-Datei.');

  const anzahl = sicht.getUint16(ende + 10, true);
  let pos = sicht.getUint32(ende + 16, true);
  if (anzahl === 0xffff || pos === 0xffffffff) throw new Error('Dieses ZIP-Format wird nicht unterstützt.');

  const dekoder = new TextDecoder();
  const eintraege = [];
  for (let i = 0; i < anzahl; i++) {
    if (pos + 46 > puffer.byteLength || sicht.getUint32(pos, true) !== 0x02014b50) {
      throw new Error('Die ZIP-Datei ist beschädigt.');
    }
    const flags = sicht.getUint16(pos + 8, true);
    const methode = sicht.getUint16(pos + 10, true);
    const komprimiert = sicht.getUint32(pos + 20, true);
    const namenLaenge = sicht.getUint16(pos + 28, true);
    const extraLaenge = sicht.getUint16(pos + 30, true);
    const kommentarLaenge = sicht.getUint16(pos + 32, true);
    const kopf = sicht.getUint32(pos + 42, true);
    const name = dekoder.decode(bytes.subarray(pos + 46, pos + 46 + namenLaenge));
    pos += 46 + namenLaenge + extraLaenge + kommentarLaenge;

    if (name.endsWith('/') || name.includes('__MACOSX')) continue;
    if (flags & 1) throw new Error('Passwortgeschützte ZIP-Dateien werden nicht unterstützt.');
    if (methode !== 0 && methode !== 8) throw new Error('Dieses ZIP-Format wird nicht unterstützt.');
    if (komprimiert > MAX_DATEI) throw new Error('Eine Datei in der ZIP-Datei ist zu groß.');
    if (kopf + 30 > puffer.byteLength || sicht.getUint32(kopf, true) !== 0x04034b50) {
      throw new Error('Die ZIP-Datei ist beschädigt.');
    }
    const start = kopf + 30 + sicht.getUint16(kopf + 26, true) + sicht.getUint16(kopf + 28, true);
    if (start + komprimiert > puffer.byteLength) throw new Error('Die ZIP-Datei ist beschädigt.');

    const roh = bytes.subarray(start, start + komprimiert);
    const blob = methode === 0 ? new Blob([roh]) : await entpacken(roh);
    eintraege.push({ name: name.split('/').pop(), blob });
  }
  return eintraege;
}
