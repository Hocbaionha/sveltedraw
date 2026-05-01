// Built-in plugin: Templates.
//
// Owns:
//   - Toolbar button (utility group, "New from template" + Ctrl+N hint)
//   - Side panel mounting TemplateSelector
//   - Main menu item with Ctrl+N shortcut
//   - selectTemplate logic — builds drawing elements from the picked
//     template and replaces the scene through ctx.api.updateScene.

// @ts-ignore — resolved via Vite alias to packages/element/src
import { newElement } from "@sveltedraw/element";

import type { SveltedrawPlugin, SveltedrawPluginContext } from "../../types.js";
import { createState } from "./state.svelte.js";
import PanelHost, { bindPanelHost } from "./PanelHost.svelte";
import TemplatesIcon from "./Icon.svelte";

export const TEMPLATES_STORE_KEY: unique symbol = Symbol("templatesStore");

export type TemplatesStore = {
  open(): void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Template = any;

export const templatesPlugin: SveltedrawPlugin = {
  id: "builtin/templates",
  install(ctx: SveltedrawPluginContext): () => void {
    const state = createState();

    /**
     * Apply a template by replacing the scene. The shape conversion
     * here mirrors the inline `selectTemplate` that previously lived
     * in App.svelte: it tolerates `text`-typed entries by spreading
     * a `text` field through `as any` because newElement's typed
     * shapes don't include text. A future cleanup should route text
     * elements through newTextElement; preserving the prior permissive
     * behaviour for now.
     */
    const onSelect = (template: Template): void => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newElements = (template.elements as any[]).map((te) => {
        return newElement({
          type: te.type || "rectangle",
          x: te.x ?? 0,
          y: te.y ?? 0,
          width: te.width ?? 100,
          height: te.height ?? 100,
          strokeColor: te.strokeColor ?? "#000000",
          backgroundColor: te.backgroundColor ?? "#ffffff",
          fillStyle: te.fillStyle ?? "solid",
          strokeWidth: te.strokeWidth ?? 1,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ text: te.text ?? "" } as any),
        });
      });

      ctx.api.updateScene({
        elements: newElements,
        appState: { selectedElementIds: {} },
      });
    };

    bindPanelHost({ state, onSelect });

    const store: TemplatesStore = {
      open: () => (state.open = true),
    };
    const releaseStore = ctx.provideStore(TEMPLATES_STORE_KEY, store);

    const removeToolbarItem = ctx.addToolbarItem({
      id: "open",
      icon: TemplatesIcon,
      title: "New from template (Ctrl+N)",
      group: "utility",
      isActive: () => state.open,
      onActivate: () => (state.open = !state.open),
    });

    const removeSidePanel = ctx.addSidePanel({
      id: "panel",
      title: "Templates",
      triggerIcon: TemplatesIcon,
      component: PanelHost,
    });

    const removeMenuItem = ctx.addMainMenuItem({
      id: "open",
      label: "New from template",
      shortcut: "Ctrl+N",
      onSelect: () => (state.open = true),
    });

    const removeAction = ctx.addAction({
      id: "open",
      label: "New from template",
      category: "plugin",
      hotkey: "CmdOrCtrl+N",
      perform: () => {
        state.open = true;
        return { consumed: true };
      },
    });

    return () => {
      releaseStore();
      removeToolbarItem();
      removeSidePanel();
      removeMenuItem();
      removeAction();
    };
  },
};
