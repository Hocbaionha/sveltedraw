<script lang="ts">
  // Tiny inline SVG used as the example plugin's toolbar/menu icon.
  // Exposed as a Svelte component so the ToolbarItemDef.icon contract
  // (Component | Snippet) is satisfied without modifying the editor's
  // built-in icon map.
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width="18"
  height="18"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
  <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
  <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
  <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125 0-.926.746-1.687 1.688-1.687h1.997c3.104 0 5.642-2.538 5.642-5.643C22 6.391 17.524 2 12 2z" />
</svg>
