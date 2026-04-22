<script lang="ts">
  // Port of packages/excalidraw/components/FollowMode/FollowMode.tsx
  // SCSS sidecar (FollowMode.scss) loaded globally by host app.

  import Icon from "../icons/Icon.svelte";

  let {
    width,
    height,
    username,
    onDisconnect,
    followingLabel = "Following",
  }: {
    width: number;
    height: number;
    username: string;
    onDisconnect: () => void;
    followingLabel?: string;
  } = $props();
</script>

<div class="follow-mode" style="width: {width}px; height: {height}px;">
  <div class="follow-mode__badge">
    <div class="follow-mode__badge__label">
      {followingLabel}
      <span class="follow-mode__badge__username" title={username}>
        {username}
      </span>
    </div>
    <button
      type="button"
      onclick={onDisconnect}
      class="follow-mode__disconnect-btn"
    >
      <Icon name="CloseIcon" />
    </button>
  </div>
</div>
