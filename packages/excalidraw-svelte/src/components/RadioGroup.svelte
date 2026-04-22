<script lang="ts" module>
  // Port of packages/excalidraw/components/RadioGroup.tsx
  // SCSS sidecar (RadioGroup.scss) loaded globally by host app.
  export type RadioGroupChoice<T> = {
    value: T;
    label: string;
    ariaLabel?: string;
  };
</script>

<script lang="ts" generics="T">
  import clsx from "clsx";

  let {
    choices,
    value,
    onChange,
    name,
  }: {
    choices: RadioGroupChoice<T>[];
    value: T;
    onChange: (value: T) => void;
    name: string;
  } = $props();
</script>

<div class="RadioGroup">
  {#each choices as choice (String(choice.value))}
    <div
      class={clsx("RadioGroup__choice", { active: choice.value === value })}
      title={choice.ariaLabel}
    >
      <input
        {name}
        type="radio"
        checked={choice.value === value}
        onchange={() => onChange(choice.value)}
        aria-label={choice.ariaLabel}
      />
      {choice.label}
    </div>
  {/each}
</div>
