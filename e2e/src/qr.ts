import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import jsQR from "jsqr";

function numberValue(value: unknown): number {
  if (value && typeof value === "object" && "asNumber" in value) {
    return Number((value as { asNumber: () => number }).asNumber());
  }
  return Number(value);
}

function toRgba(data: Uint8Array, width: number, height: number): Uint8ClampedArray | null {
  const pixels = width * height;
  if (pixels <= 0 || data.length < pixels) return null;
  const channels = Math.floor(data.length / pixels);
  if (channels < 1 || channels > 4) return null;
  const rgba = new Uint8ClampedArray(pixels * 4);
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * channels;
    const red = data[offset] ?? 0;
    const green = channels > 1 ? (data[offset + 1] ?? 0) : red;
    const blue = channels > 2 ? (data[offset + 2] ?? 0) : red;
    rgba[index * 4] = red;
    rgba[index * 4 + 1] = green;
    rgba[index * 4 + 2] = blue;
    rgba[index * 4 + 3] = 255;
  }
  return rgba;
}

/** Read session links printed as QR images on a generated sheet. */
export async function sessionLinksFromPdf(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  const found: string[] = [];
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    const subtype = object.dict.lookup(PDFName.of("Subtype"));
    if (!subtype || subtype.toString() !== "/Image") continue;
    const width = numberValue(object.dict.lookup(PDFName.of("Width")));
    const height = numberValue(object.dict.lookup(PDFName.of("Height")));
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
    let raw: Uint8Array;
    try {
      raw = decodePDFRawStream(object).decode();
    } catch {
      raw = object.contents;
    }
    const rgba = toRgba(raw, width, height);
    if (!rgba) continue;
    const code = jsQR(rgba, width, height);
    if (code?.data?.includes("/session/")) found.push(code.data);
  }
  return [...new Set(found)];
}
