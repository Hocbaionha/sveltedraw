<script lang="ts">
  // Sveltedraw wordmark. Replaces the the engine vector
  // wordmark (which spelled out "Sveltedraw" in path data). Rendered
  // as <text> rather than path data so the wordmark always reads as
  // "Sveltedraw" without us having to ship a bespoke vector for the
  // letterforms. The font stack matches the canonical Sveltedraw look
  // for visual continuity with the icon.
</script>

<svg
  viewBox="0 0 280 55"
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  class="SveltedrawLogo-text"
>
  <text
    x="0"
    y="40"
    fill="currentColor"
    font-family="Cascadia, 'Cascadia Code', 'Virgil', 'Comic Sans MS', sans-serif"
    font-size="44"
    font-weight="600"
    letter-spacing="-1"
  >Sveltedraw</text>
</svg>
