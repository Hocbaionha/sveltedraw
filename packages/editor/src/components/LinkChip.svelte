<script lang="ts">
  // A1: one chip per linked-selected element. Pure presentational —
  // parent computes the reactive `linked` list (a $derived reading
  // sceneNonce so mutateElement bumps retrigger) and passes zoom +
  // scroll so we map scene coords to container-relative pixels.
  type Elem = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    link?: string | null;
  };

  let {
    linked,
    zoom,
    scrollX,
    scrollY,
  }: {
    linked: ReadonlyArray<Elem>;
    zoom: number;
    scrollX: number;
    scrollY: number;
  } = $props();
</script>

{#each linked as el (el.id)}
  {@const cx = (el.x + el.width + scrollX) * zoom}
  {@const cy = (el.y + scrollY) * zoom}
  <a
    class="sveltedraw-link-chip"
    style="left: {Math.max(cx - 180, 8)}px; top: {Math.max(cy - 28, 8)}px;"
    href={el.link ?? "#"}
    target="_blank"
    rel="noopener noreferrer"
    title={el.link ?? ""}
  >
    🔗 {el.link}
  </a>
{/each}

<style>
  .sveltedraw-link-chip {
    position: absolute;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: #1e1e1e;
    color: #fff;
    border-radius: 14px;
    font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    text-decoration: none;
    white-space: nowrap;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    z-index: 60;
    cursor: pointer;
  }
  .sveltedraw-link-chip:hover { background: #2b2b2b; }
  .sveltedraw-link-chip:focus-visible { outline: 2px solid #6965db; }
</style>
