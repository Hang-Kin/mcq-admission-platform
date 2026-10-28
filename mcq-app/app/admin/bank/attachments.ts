import {
  MAX_QUESTION_IMAGE_BYTES,
  QUESTION_IMAGE_BUCKET,
  publicQuestionImagePath,
} from "../questions/questionImages";

export { MAX_QUESTION_IMAGE_BYTES, QUESTION_IMAGE_BUCKET, publicQuestionImagePath };

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export function attachmentExtension(mimeType: string): string | null {
  return EXTENSION_BY_TYPE[mimeType] ?? null;
}

export function attachmentError(file: { type: string; size: number }): string | null {
  if (!attachmentExtension(file.type)) {
    return "Use a PNG, JPEG, WEBP, GIF, or PDF file.";
  }
  if (file.size <= 0) return "Choose a file.";
  if (file.size > MAX_QUESTION_IMAGE_BYTES) return "File must be 5 MB or smaller.";
  return null;
}

export function isPdfAttachment(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = publicQuestionImagePath(url);
  return Boolean(path?.toLowerCase().endsWith(".pdf"));
}

export function uploadFailureMessage(fileType: string, storageMessage: string): string {
  const lower = storageMessage.toLowerCase();
  if (
    fileType === "application/pdf" ||
    lower.includes("mime") ||
    lower.includes("pdf")
  ) {
    return "PDF files are not accepted by the file store yet. Use an image instead.";
  }
  return "Could not upload the file. Use a PNG, JPEG, WEBP, or GIF image.";
}
