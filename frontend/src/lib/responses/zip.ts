// Minimal, dependency-free ZIP writer using the STORE method (no compression).
// Respondent uploads are JPEG/PNG/WebP/PDF — already compressed — so STORE keeps
// this small and fast without pulling in a zip library. UTF-8 file names are
// flagged via bit 11 of the general-purpose flags.

export type ZipEntry = {
  /** Path inside the archive, e.g. "files/row-3/f_2-photo.jpg". */
  name: string;
  data: Uint8Array;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a ZIP archive Blob from the given entries. */
export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: BlobPart[] = [];

  // Encode the current time once for all entries (MS-DOS date/time format).
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    (Math.floor(now.getSeconds() / 2) & 0x1f);
  const dosDate =
    (Math.max(0, now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  let offset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header signature
    local.setUint16(4, 20, true); // version needed to extract
    local.setUint16(6, 0x0800, true); // flags — UTF-8 file name
    local.setUint16(8, 0, true); // compression method — 0 = STORE
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true); // compressed size
    local.setUint32(22, size, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra field length

    // entry.data is a Uint8Array — a valid BlobPart; cast past the generic
    // ArrayBufferLike vs ArrayBuffer mismatch in the DOM lib types.
    parts.push(local.buffer, nameBytes, entry.data as BlobPart);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); // central directory header signature
    cd.setUint16(4, 20, true); // version made by
    cd.setUint16(6, 20, true); // version needed to extract
    cd.setUint16(8, 0x0800, true); // flags — UTF-8
    cd.setUint16(10, 0, true); // compression method
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint16(30, 0, true); // extra field length
    cd.setUint16(32, 0, true); // file comment length
    cd.setUint16(34, 0, true); // disk number start
    cd.setUint16(36, 0, true); // internal file attributes
    cd.setUint32(38, 0, true); // external file attributes
    cd.setUint32(42, offset, true); // relative offset of local header

    central.push(cd.buffer, nameBytes);
    centralSize += 46 + nameBytes.length;
    offset += 30 + nameBytes.length + size;
  }

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); // end of central directory signature
  eocd.setUint16(4, 0, true); // number of this disk
  eocd.setUint16(6, 0, true); // disk with central directory start
  eocd.setUint16(8, entries.length, true); // entries on this disk
  eocd.setUint16(10, entries.length, true); // total entries
  eocd.setUint32(12, centralSize, true); // central directory size
  eocd.setUint32(16, offset, true); // central directory offset
  eocd.setUint16(20, 0, true); // comment length

  return new Blob([...parts, ...central, eocd.buffer], {
    type: "application/zip",
  });
}
