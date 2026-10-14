import assert from "node:assert/strict";
import { matchesMediaContent } from "../src/modules/media/media-content.js";

let checks = 0;
function check(bytes: Buffer, mime: string, expected: boolean) {
  assert.equal(matchesMediaContent(bytes, mime), expected, mime); checks++;
}
function box(type: string, body: Buffer) {
  const result = Buffer.alloc(8 + body.length);
  result.writeUInt32BE(result.length);
  result.write(type, 4, 4, "latin1");
  body.copy(result, 8);
  return result;
}
function ftyp(major: string, compatible = "") {
  return box("ftyp", Buffer.concat([Buffer.from(major, "latin1"), Buffer.alloc(4), Buffer.from(compatible, "latin1")]));
}
// Synthetic container/header fixtures exercise type discrimination; these
// checks do not claim complete decoding, playable codecs or native playback.
check(ftyp("isom"), "video/mp4", true);
check(Buffer.concat([box("free", Buffer.alloc(4)), ftyp("abcd", "mp42")]), "video/mp4", true);
check(ftyp("qt  "), "video/quicktime", true);
check(box("moov", box("mvhd", Buffer.alloc(100))), "video/quicktime", true);
check(ftyp("heic"), "image/heic", true);
check(ftyp("mif1", "heic"), "image/heic", true);
check(ftyp("mif1"), "image/heif", true);
check(ftyp("isom"), "image/heic", false);
check(ftyp("heic"), "video/mp4", false);
check(ftyp("qt  "), "video/mp4", false);
check(ftyp("mif1"), "image/heic", false);
check(ftyp("abcd"), "video/mp4", false);
check(Buffer.from("0000000866747970", "hex"), "video/mp4", false);
const truncated = ftyp("isom"); truncated.writeUInt32BE(200);
check(truncated, "video/mp4", false);
check(box("moov", Buffer.alloc(4)), "video/quicktime", false);
const webm = Buffer.concat([Buffer.from("1a45dfa387428284", "hex"), Buffer.from("webm")]);
check(webm, "video/webm", true);
check(Buffer.concat([Buffer.from("1a45dfa38b428288", "hex"), Buffer.from("matroska")]), "video/webm", false);
check(webm.subarray(0, 7), "video/webm", false);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=", "base64");
check(png, "image/png", true);
check(png.subarray(0, 8), "image/png", false);
check(png, "image/jpeg", false);
check(Buffer.from("ffd8ffdb00112233ffd9", "hex"), "image/jpeg", true);
check(Buffer.from("ffd8ff", "hex"), "image/jpeg", false);
for (const chunk of ["VP8 ", "VP8L", "VP8X"]) {
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from("14000000", "hex"), Buffer.from(`WEBP${chunk}`), Buffer.alloc(8)]);
  check(webp, "image/webp", true);
}
for (const mime of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "video/mp4", "video/quicktime", "video/webm"]) {
  check(Buffer.from("fictional nonmedia content"), mime, false);
  check(Buffer.alloc(0), mime, false);
}
console.log(`Media content tests: ${checks} checks passed`);
