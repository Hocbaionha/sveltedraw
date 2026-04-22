// Port of packages/excalidraw/hooks/useCopiedIndicator.ts
// Returns a small reactive object exposing copyStatus + onCopy + reset.
// Used by ShareableLinkDialog and others that show "Copied!" feedback.

const TIMEOUT = 2000;

export class CopyStatus {
  status = $state<"success" | null>(null);
  private timeoutId = 0;

  onCopy = () => {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.status = "success";
    this.timeoutId = window.setTimeout(() => {
      this.status = null;
    }, TIMEOUT);
  };

  reset = () => {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.status = null;
  };
}

export function createCopyStatus(): CopyStatus {
  return new CopyStatus();
}
