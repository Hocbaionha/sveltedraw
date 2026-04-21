<script lang="ts">
  import { Popover, DropdownMenu, Tabs } from 'bits-ui';
</script>

<div class="showcase">
  <h1>bits-ui Showcase</h1>
  <p>Validation: radix-ui → bits-ui mapping (Svelte 5)</p>

  <section>
    <h2>Popover</h2>
    <Popover.Root>
      <Popover.Trigger>
        {#snippet child({ props })}
          <button {...props}>Open Popover</button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content>
        {#snippet child({ props })}
          <div {...props} class="popover-content">Popover content ✓</div>
        {/snippet}
      </Popover.Content>
    </Popover.Root>
  </section>

  <section>
    <h2>DropdownMenu</h2>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <button {...props}>Open Menu</button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {#snippet child({ props })}
          <div {...props} class="menu-content">
            <DropdownMenu.Item>
              {#snippet child({ props })}
                <div {...props}>Item 1</div>
              {/snippet}
            </DropdownMenu.Item>
            <DropdownMenu.Item>
              {#snippet child({ props })}
                <div {...props}>Item 2</div>
              {/snippet}
            </DropdownMenu.Item>
          </div>
        {/snippet}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </section>

  <section>
    <h2>Tabs</h2>
    <Tabs.Root value="tab1">
      <Tabs.List>
        {#snippet child({ props })}
          <div {...props} class="tabs-list">
            <Tabs.Trigger value="tab1">
              {#snippet child({ props })}
                <button {...props}>Tab 1</button>
              {/snippet}
            </Tabs.Trigger>
            <Tabs.Trigger value="tab2">
              {#snippet child({ props })}
                <button {...props}>Tab 2</button>
              {/snippet}
            </Tabs.Trigger>
          </div>
        {/snippet}
      </Tabs.List>
      <Tabs.Content value="tab1">
        {#snippet child({ props })}
          <div {...props}><p>Tab 1 content ✓</p></div>
        {/snippet}
      </Tabs.Content>
      <Tabs.Content value="tab2">
        {#snippet child({ props })}
          <div {...props}><p>Tab 2 content ✓</p></div>
        {/snippet}
      </Tabs.Content>
    </Tabs.Root>
  </section>
</div>

<style>
  .showcase { padding: 2rem; max-width: 800px; margin: 0 auto; }
  section { margin: 2rem 0; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  .popover-content, .menu-content {
    background: white; border: 1px solid #ccc; border-radius: 4px;
    padding: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,.15); z-index: 50;
  }
  .tabs-list { display: flex; gap: .5rem; border-bottom: 1px solid #ccc; margin-bottom: 1rem; }
</style>
