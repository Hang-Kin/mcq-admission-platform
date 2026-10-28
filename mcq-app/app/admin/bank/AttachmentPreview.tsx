import { isPdfAttachment, publicQuestionImagePath } from "./attachments";

export function AttachmentPreview({ url }: { url: string | null }) {
  if (!url || !publicQuestionImagePath(url)) return null;

  if (isPdfAttachment(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-base hover:underline">
        Open PDF
      </a>
    );
  }

  return (
    // Public bucket URL. Loaded directly so it does not need a Next image host.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="max-h-64 w-full rounded-md border border-border object-contain"
    />
  );
}
