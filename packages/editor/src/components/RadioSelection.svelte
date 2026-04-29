<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import clsx from "clsx";
  import ButtonIcon from "./ButtonIcon.svelte";

  type Option = {
    value: T;
    text: string;
    icon: Snippet;
    testId?: string;
    /** if not supplied, defaults to value identity check */
    active?: boolean;
  };

  type RadioProps = {
    type?: "radio";
    group: string;
    onChange: (value: T) => void;
  };
  type ButtonProps = {
    type: "button";
    onClick: (value: T, event: MouseEvent) => void;
  };

  let props: {
    options: Option[];
    value: T | null;
  } & (RadioProps | ButtonProps) = $props();
</script>

{#each props.options as option (option.text)}
  {#if props.type === "button"}
    <ButtonIcon
      icon={option.icon}
      title={option.text}
      testId={option.testId}
      active={option.active ?? props.value === option.value}
      onclick={(event) => props.onClick(option.value, event)}
    />
  {:else}
    <label
      class={clsx({ active: props.value === option.value })}
      title={option.text}
    >
      <input
        type="radio"
        name={props.group}
        onchange={() => props.onChange(option.value)}
        checked={props.value === option.value}
        data-testid={option.testId}
      />
      {@render option.icon()}
    </label>
  {/if}
{/each}
