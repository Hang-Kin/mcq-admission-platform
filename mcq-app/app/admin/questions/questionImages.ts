export const QUESTION_IMAGE_BUCKET = "question-images";
export const MAX_QUESTION_IMAGE_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const PUBLIC_PATH_MARKER = "/storage/v1/object/public/question-images/";

export function questionImageExtension(mimeType: string): string | null {
  return EXTENSION_BY_TYPE[mimeType] ?? null;
}

export function questionImageError(file: { type: string; size: number }): string | null {
  if (!questionImageExtension(file.type)) {
    return "Image must be PNG, JPEG, WEBP, or GIF.";
  }
  if (file.size > MAX_QUESTION_IMAGE_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  if (file.size <= 0) {
    return "Choose an image file.";
  }
  return null;
}

export function publicQuestionImagePath(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const index = parsed.pathname.indexOf(PUBLIC_PATH_MARKER);
    if (index === -1) return null;
    const path = decodeURIComponent(parsed.pathname.slice(index + PUBLIC_PATH_MARKER.length));
    if (!path || path.includes("..")) return null;
    return path;
  } catch {
    return null;
  }
}
