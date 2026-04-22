<script lang="ts">
  // Renders the "external links" header row of HelpDialog. Default English
  // labels point at the upstream excalidraw URLs; override `links` to swap.

  import type { Snippet } from "svelte";
  import Icon from "../../icons/Icon.svelte";

  type LinkEntry = {
    label: string;
    href: string;
    /** Icon name from the static icons map (e.g., "ExternalLinkIcon"). */
    iconName?: string;
    /** Or a custom icon snippet. */
    icon?: Snippet;
  };

  const DEFAULT_LINKS: LinkEntry[] = [
    {
      label: "Documentation",
      href: "https://docs.excalidraw.com",
      iconName: "ExternalLinkIcon",
    },
    {
      label: "Blog",
      href: "https://plus.excalidraw.com/blog",
      iconName: "ExternalLinkIcon",
    },
    {
      label: "GitHub",
      href: "https://github.com/excalidraw/excalidraw/issues",
      iconName: "GithubIcon",
    },
    {
      label: "YouTube",
      href: "https://youtube.com/@excalidraw",
      iconName: "youtubeIcon",
    },
  ];

  let { links = DEFAULT_LINKS }: { links?: LinkEntry[] } = $props();
</script>

<div class="HelpDialog__header">
  {#each links as link (link.href)}
    <a
      class="HelpDialog__btn"
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div class="HelpDialog__link-icon">
        {#if link.icon}{@render link.icon()}{:else if link.iconName}<Icon
            name={link.iconName}
          />{/if}
      </div>
      {link.label}
    </a>
  {/each}
</div>
