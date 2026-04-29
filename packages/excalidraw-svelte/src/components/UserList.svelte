<script lang="ts" module>
  // Port of packages/excalidraw/components/UserList.tsx
  // SCSS sidecar (UserList.scss) loaded globally by host app.
  //
  // The original calls actionManager.renderAction("goToCollaborator", ...) to
  // render each avatar. Since ActionManager is Phase 6 territory, this port
  // accepts a `renderAvatar` snippet prop that callers supply. Phase 6 will
  // wire it to the actual ActionManager-backed renderer.

  export type UserListUserObject = {
    avatarUrl?: string;
    id?: string;
    socketId: string;
    username?: string | null;
    isInCall?: boolean;
    isSpeaking?: boolean;
    isMuted?: boolean;
  };

  export type RenderAvatarArg = {
    socketId: string;
    collaborator: UserListUserObject;
    withName: boolean;
    isBeingFollowed: boolean;
  };
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import clsx from "clsx";
  // @ts-ignore upstream package
  import { supportsResizeObserver } from "@sveltedraw/common";
  import { Popover as BitsPopover } from "bits-ui";
  import Island from "./Island.svelte";
  import QuickSearch from "./QuickSearch.svelte";
  import ScrollableList from "./ScrollableList.svelte";
  import Tooltip from "./Tooltip.svelte";

  const DEFAULT_MAX_AVATARS = 4;
  const SHOW_COLLABORATORS_FILTER_AT = 8;

  let {
    class: className = "",
    mobile = false,
    collaborators,
    userToFollow,
    renderAvatar,
    quickSearchPlaceholder = "Search…",
    emptyPlaceholder = "No users",
    hintText,
  }: {
    class?: string;
    mobile?: boolean;
    collaborators: Map<string, UserListUserObject>;
    userToFollow: string | null;
    renderAvatar: Snippet<[RenderAvatarArg]>;
    quickSearchPlaceholder?: string;
    emptyPlaceholder?: string;
    hintText?: string;
  } = $props();

  const uniqueCollaborators = $derived.by(() => {
    const map = new Map<string, UserListUserObject>();
    collaborators.forEach((collaborator, socketId) => {
      const userId = collaborator.id || socketId;
      map.set(userId, { ...collaborator, socketId });
    });
    return Array.from(map.values()).filter((c) => c.username?.trim());
  });

  let searchTerm = $state("");
  const filteredCollaborators = $derived(
    uniqueCollaborators.filter((c) =>
      c.username?.toLowerCase().includes(searchTerm),
    ),
  );

  let userListWrapper: HTMLDivElement | null = $state(null);
  let maxAvatars = $state(DEFAULT_MAX_AVATARS);

  $effect(() => {
    if (!userListWrapper) return;
    const update = (width: number) => {
      maxAvatars = Math.max(1, Math.min(8, Math.floor(width / 38)));
    };
    update(userListWrapper.clientWidth);
    if (!supportsResizeObserver) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) update(entry.contentRect.width);
    });
    obs.observe(userListWrapper);
    return () => obs.disconnect();
  });

  const firstNCollaborators = $derived(
    uniqueCollaborators.slice(0, maxAvatars - 1),
  );
</script>

{#snippet collaboratorAvatar(c: UserListUserObject, withName: boolean)}
  {#if c.username}
    <Tooltip label={c.username}>
      {@render renderAvatar({
        socketId: c.socketId,
        collaborator: c,
        withName,
        isBeingFollowed: c.socketId === userToFollow,
      })}
    </Tooltip>
  {:else}
    {@render renderAvatar({
      socketId: c.socketId,
      collaborator: c,
      withName,
      isBeingFollowed: c.socketId === userToFollow,
    })}
  {/if}
{/snippet}

{#if mobile}
  <div class={clsx("UserList UserList_mobile", className)}>
    {#each uniqueCollaborators as c (c.socketId)}
      {@render collaboratorAvatar(c, false)}
    {/each}
  </div>
{:else}
  <div class="UserList__wrapper" bind:this={userListWrapper}>
    <div
      class={clsx("UserList", className)}
      style:--max-avatars={maxAvatars}
    >
      {#each firstNCollaborators as c (c.socketId)}
        {@render collaboratorAvatar(c, false)}
      {/each}

      {#if uniqueCollaborators.length > maxAvatars - 1}
        <BitsPopover.Root>
          <BitsPopover.Trigger>
            {#snippet child({ props })}
              <button {...props} class="UserList__more">
                +{uniqueCollaborators.length - maxAvatars + 1}
              </button>
            {/snippet}
          </BitsPopover.Trigger>
          <BitsPopover.Content align="end" sideOffset={10}>
            {#snippet child({ props })}
              <div
                {...props}
                style="z-index: 2; width: 15rem; text-align: left;"
              >
                <Island padding={2}>
                  {#if uniqueCollaborators.length >= SHOW_COLLABORATORS_FILTER_AT}
                    <QuickSearch
                      placeholder={quickSearchPlaceholder}
                      onChange={(v) => (searchTerm = v)}
                    />
                  {/if}
                  <ScrollableList
                    class="dropdown-menu UserList__collaborators"
                    placeholder={emptyPlaceholder}
                    isEmpty={filteredCollaborators.length === 0}
                  >
                    {#if hintText}
                      <div class="hint">{hintText}</div>
                    {/if}
                    {#each filteredCollaborators as c (c.socketId)}
                      {@render collaboratorAvatar(c, true)}
                    {/each}
                  </ScrollableList>
                </Island>
              </div>
            {/snippet}
          </BitsPopover.Content>
        </BitsPopover.Root>
      {/if}
    </div>
  </div>
{/if}
