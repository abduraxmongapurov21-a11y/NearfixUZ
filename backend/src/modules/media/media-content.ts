// Verify recognizable file/container headers before storage. This intentionally
// does not promise full image decoding or a playable video codec.
const mp4Brands = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "M4VH", "M4VP", "MSNV", "dash", "cmfc", "cmfs"]);
const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);
const heifBrands = new Set(["mif1", "msf1", ...heicBrands]);

function matchesFileTypeBox(bytes: Buffer, allowedBrands: Set<string>) {
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    if (size < 8 || size > bytes.length - offset) return false;
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    if (type === "ftyp") {
      if (size < 16 || size % 4) return false;
      if (allowedBrands.has(bytes.toString("latin1", offset + 8, offset + 12))) return true;
      for (let at = offset + 16; at < offset + size; at += 4) {
        if (allowedBrands.has(bytes.toString("latin1", at, at + 4))) return true;
      }
      return false;
    }
    if (!["free", "skip", "wide"].includes(type)) return false;
    offset += size;
  }
  return false;
}

function readEbmlInteger(bytes: Buffer, offset: number, stripMarker: boolean) {
  const first = bytes[offset];
  if (!first) return null;
  let length = 1;
  let marker = 0x80;
  while (!(first & marker) && length <= 8) { marker >>= 1; length++; }
  if (length > (stripMarker ? 8 : 4) || offset + length > bytes.length) return null;
  let value = stripMarker ? first & (marker - 1) : first;
  for (let at = offset + 1; at < offset + length; at++) value = value * 256 + bytes[at]!;
  return Number.isSafeInteger(value) ? { length, value } : null;
}

function matchesWebm(bytes: Buffer) {
  if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x1a45dfa3) return false;
  const headerSize = readEbmlInteger(bytes, 4, true);
  if (!headerSize) return false;
  let offset = 4 + headerSize.length;
  const end = offset + headerSize.value;
  if (end > bytes.length || end > 4096) return false;
  while (offset < end) {
    const id = readEbmlInteger(bytes, offset, false);
    if (!id) return false;
    offset += id.length;
    const size = readEbmlInteger(bytes, offset, true);
    if (!size) return false;
    offset += size.length;
    if (size.value > end - offset) return false;
    if (id.value === 0x4282) return size.value === 4 && bytes.toString("latin1", offset, offset + 4) === "webm";
    offset += size.value;
  }
  return false;
}

function matchesLegacyQuickTime(bytes: Buffer) {
  // Older QuickTime files can have a movie atom without an ftyp atom.
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    if (size < 8 || size > bytes.length - offset) return false;
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    if (type === "moov") {
      const end = offset + size;
      let child = offset + 8;
      while (child + 8 <= end) {
        const childSize = bytes.readUInt32BE(child);
        if (childSize < 8 || childSize > end - child) return false;
        if (bytes.toString("latin1", child + 4, child + 8) === "mvhd") return childSize >= 108;
        child += childSize;
      }
      return false;
    }
    if (!["wide", "free", "skip", "mdat"].includes(type)) return false;
    offset += size;
  }
  return false;
}

export function matchesMediaContent(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) && bytes.readUInt32BE(8) === 13 && bytes.toString("latin1", 12, 16) === "IHDR";
  if (mimeType === "image/webp") return bytes.length >= 20 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("latin1", 12, 16));
  if (mimeType === "image/heic") return matchesFileTypeBox(bytes, heicBrands);
  if (mimeType === "image/heif") return matchesFileTypeBox(bytes, heifBrands);
  if (mimeType === "video/mp4") return matchesFileTypeBox(bytes, mp4Brands);
  if (mimeType === "video/quicktime") return matchesFileTypeBox(bytes, new Set(["qt  "])) || matchesLegacyQuickTime(bytes);
  if (mimeType === "video/webm") return matchesWebm(bytes);
  return false;
}
