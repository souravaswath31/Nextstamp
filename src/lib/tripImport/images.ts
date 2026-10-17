import type { ImageType } from "./extract";

/** Type from the file's own bytes; the browser-reported type is not trusted. */
export function detectImageType(buf: Uint8Array): ImageType | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (
    buf.length > 12 &&
    String.fromCharCode(...Array.from(buf.slice(0, 4))) === "RIFF" &&
    String.fromCharCode(...Array.from(buf.slice(8, 12))) === "WEBP"
  ) return "image/webp";
  return null;
}
