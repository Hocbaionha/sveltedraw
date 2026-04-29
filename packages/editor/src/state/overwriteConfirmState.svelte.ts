//
// Reactive state + a promise-returning `openConfirmModal()` factory backing
// the OverwriteConfirmDialog. A single module-level instance is sufficient
// because the modal is per-page.

import type { Snippet } from "svelte";

export type OverwriteConfirmActiveState = {
  active: true;
  title: string;
  description: string | Snippet;
  actionLabel: string;
  color: "danger" | "warning";
  onClose: () => void;
  onConfirm: () => void;
  onReject: () => void;
};

export type OverwriteConfirmInactiveState = { active: false };

export type OverwriteConfirmStateValue =
  | OverwriteConfirmActiveState
  | OverwriteConfirmInactiveState;

export class OverwriteConfirmStore {
  state = $state<OverwriteConfirmStateValue>({ active: false });

  set(next: OverwriteConfirmStateValue) {
    this.state = next;
  }

  reset() {
    this.state = { active: false };
  }

  /**
   * Opens the modal and resolves the returned Promise once the user confirms,
   * rejects, or closes (close + reject both resolve to false).
   */
  openConfirmModal(opts: {
    title: string;
    description: string | Snippet;
    actionLabel: string;
    color: "danger" | "warning";
  }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state = {
        active: true,
        title: opts.title,
        description: opts.description,
        actionLabel: opts.actionLabel,
        color: opts.color,
        onConfirm: () => resolve(true),
        onClose: () => resolve(false),
        onReject: () => resolve(false),
      };
    });
  }
}

/** Singleton store — modal is per-page. */
export const overwriteConfirmStore = new OverwriteConfirmStore();
