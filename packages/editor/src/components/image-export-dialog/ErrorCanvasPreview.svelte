<script lang="ts">
  let {
    title = "Cannot show preview",
    message = "Canvas is too big",
    tip = "Try a smaller export scale or fewer elements.",
  }: {
    title?: string;
    message?: string;
    tip?: string;
  } = $props();
</script>

<div>
  <h3>{title}</h3>
  <p><span>{message}</span></p>
  <em>({tip})</em>
</div>
