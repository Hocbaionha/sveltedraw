// Trigger a browser download for a Blob or pre-built URL.
//
// Anchor.click() with a blob URL is the standard SPA pattern. The URL is
// revoked after a tick so Chrome finishes consuming it before GC.

export const triggerDownload = (blobOrUrl: Blob | string, filename: string): void => {
  const url =
    typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof blobOrUrl !== "string") {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
