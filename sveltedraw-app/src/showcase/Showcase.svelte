<script lang="ts">
  import { Popover, DropdownMenu as BitsDropdownMenu, Tabs } from 'bits-ui';
  import {
    Spinner,
    ButtonSeparator,
    LoadingMessage,
    InlineIcon,
    Island,
    StackRow,
    StackCol,
    Card,
    Paragraph,
    Ellipsify,
    Button,
    Tooltip,
    Switch,
    Range,
    TextField,
    Modal,
    Toast,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuGroup,
  } from '@sveltedraw/excalidraw';

  let switchValue = $state(false);
  let rangeValue = $state(50);
  let textValue = $state('');
  let redactedValue = $state('secret');

  // Phase 3 batch 4 demo state
  let modalOpen = $state(false);
  let toastMessage: string | null = $state(null);
  let dropdownOpen = $state(false);
</script>

<div class="showcase excalidraw">
  <h1>Sveltedraw Component Showcase</h1>
  <p>Svelte 5 port of Excalidraw UI components</p>

  <!-- ─── Phase 3 Batch 1: simple leaf components ─────────────────────── -->
  <section>
    <h2>Spinner</h2>
    <Spinner />
    <Spinner />
    <Spinner />
  </section>

  <section>
    <h2>LoadingMessage</h2>
    <LoadingMessage />
    <LoadingMessage delay={500} />
  </section>

  <section>
    <h2>InlineIcon</h2>
    <p>
      Text with
      <InlineIcon>
        {#snippet icon()}
          <svg viewBox="0 0 16 16" width="1em" height="1em"><circle cx="8" cy="8" r="7" fill="currentColor"/></svg>
        {/snippet}
      </InlineIcon>
      inline icon.
    </p>
  </section>

  <section>
    <h2>ButtonSeparator</h2>
    <div style="display:flex;align-items:center;gap:4px">
      <span>A</span>
      <ButtonSeparator />
      <span>B</span>
    </div>
  </section>

  <!-- ─── Phase 3 Batch 2: layout components ───────────────────────────── -->
  <section>
    <h2>Island / Stack</h2>
    <Island>
      <StackRow gap={1}>
        <span>Row item 1</span>
        <span>Row item 2</span>
        <span>Row item 3</span>
      </StackRow>
      <StackCol gap={1}>
        <span>Col item 1</span>
        <span>Col item 2</span>
      </StackCol>
    </Island>
  </section>

  <section>
    <h2>Card</h2>
    <Card color="primary">
      {#snippet children()}
        <p style="padding:.5rem">Card content</p>
      {/snippet}
    </Card>
  </section>

  <section>
    <h2>Paragraph + Ellipsify</h2>
    <Paragraph>This is a paragraph component.</Paragraph>
    <div style="width:120px;border:1px solid #ccc;padding:4px">
      <Ellipsify>Very long text that should be truncated with ellipsis</Ellipsify>
    </div>
  </section>

  <!-- ─── Phase 3 Batch 3: interactive components ──────────────────────── -->
  <section>
    <h2>Button</h2>
    <Button onSelect={() => alert('clicked!')}>
      {#snippet children()}Click me{/snippet}
    </Button>
    <Button onSelect={() => {}} style="margin-left:8px">
      {#snippet children()}Another button{/snippet}
    </Button>
  </section>

  <section>
    <h2>Tooltip</h2>
    <Tooltip label="This is a tooltip">
      {#snippet children()}
        <span style="text-decoration:underline;cursor:default">Hover me</span>
      {/snippet}
    </Tooltip>
  </section>

  <section>
    <h2>Switch</h2>
    <Switch
      name="showcase-switch"
      checked={switchValue}
      onChange={(v) => { switchValue = v; }}
    />
    <span style="margin-left:8px">Value: {switchValue}</span>
  </section>

  <section>
    <h2>Range</h2>
    <Range
      label="Opacity"
      value={rangeValue}
      onChange={(v) => { rangeValue = v; }}
      min={0}
      max={100}
    />
    <span style="margin-left:8px">Value: {rangeValue}</span>
  </section>

  <section>
    <h2>TextField</h2>
    <TextField
      value={textValue}
      onChange={(v) => { textValue = v; }}
      placeholder="Type here..."
    />
    <p style="margin-top:4px;font-size:.85em">Value: {textValue}</p>

    <TextField
      value={redactedValue}
      onChange={(v) => { redactedValue = v; }}
      isRedacted={true}
      label="Password"
    />
  </section>

  <!-- ─── bits-ui primitives ───────────────────────────────────────────── -->
  <section>
    <h2>bits-ui: Popover</h2>
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
    <h2>bits-ui: DropdownMenu</h2>
    <BitsDropdownMenu.Root>
      <BitsDropdownMenu.Trigger>
        {#snippet child({ props })}
          <button {...props}>Open Menu</button>
        {/snippet}
      </BitsDropdownMenu.Trigger>
      <BitsDropdownMenu.Content>
        {#snippet child({ props })}
          <div {...props} class="menu-content">
            <BitsDropdownMenu.Item>
              {#snippet child({ props })}
                <div {...props}>Item 1</div>
              {/snippet}
            </BitsDropdownMenu.Item>
            <BitsDropdownMenu.Item>
              {#snippet child({ props })}
                <div {...props}>Item 2</div>
              {/snippet}
            </BitsDropdownMenu.Item>
          </div>
        {/snippet}
      </BitsDropdownMenu.Content>
    </BitsDropdownMenu.Root>
  </section>

  <section>
    <h2>bits-ui: Tabs</h2>
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

  <!-- ─── Phase 3 Batch 4: Modal / Toast / DropdownMenu ───────────────── -->
  <section>
    <h2>Modal (Phase 3 batch 4)</h2>
    <Button onSelect={() => (modalOpen = true)}>
      {#snippet children()}Open Modal{/snippet}
    </Button>
    {#if modalOpen}
      <Modal
        onCloseRequest={() => (modalOpen = false)}
        labelledBy="demo-modal-title"
        maxWidth={500}
      >
        <div style="padding: 1.5rem; background: white; border-radius: 8px;">
          <h3 id="demo-modal-title">Hello from Svelte Modal</h3>
          <p>Body click outside or press ESC to close.</p>
          <Button onSelect={() => (modalOpen = false)}>
            {#snippet children()}Close{/snippet}
          </Button>
        </div>
      </Modal>
    {/if}
  </section>

  <section>
    <h2>Toast (Phase 3 batch 4)</h2>
    <Button onSelect={() => (toastMessage = `Saved at ${new Date().toLocaleTimeString()}`)}>
      {#snippet children()}Show Toast (3s){/snippet}
    </Button>
    {#if toastMessage}
      <div style="position: relative; margin-top: 1rem;">
        <Toast
          message={toastMessage}
          onClose={() => (toastMessage = null)}
          duration={3000}
          closable
        />
      </div>
    {/if}
  </section>

  <section>
    <h2>DropdownMenu (Phase 3 batch 4)</h2>
    <DropdownMenu open={dropdownOpen}>
      <DropdownMenuTrigger
        onToggle={() => (dropdownOpen = !dropdownOpen)}
        title="Open menu"
      >
        {#snippet children()}File ▾{/snippet}
      </DropdownMenuTrigger>
      <DropdownMenuContent onClickOutside={() => (dropdownOpen = false)}>
        <DropdownMenuGroup title="Recent">
          {#snippet children()}
            <DropdownMenuItem
              onSelect={() => console.log('open project')}
              shortcut="⌘O"
            >
              {#snippet children()}Open project{/snippet}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => console.log('save')}
              shortcut="⌘S"
              selected
            >
              {#snippet children()}Save{/snippet}
            </DropdownMenuItem>
          {/snippet}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => (dropdownOpen = false)}>
          {#snippet children()}Close menu{/snippet}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </section>
</div>

<style>
  .showcase { padding: 2rem; max-width: 800px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  section { margin: 2rem 0; padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  h2 { margin: 0 0 1rem; font-size: 1rem; color: #555; text-transform: uppercase; letter-spacing: .05em; }
  .popover-content, .menu-content {
    background: white; border: 1px solid #ccc; border-radius: 4px;
    padding: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,.15); z-index: 50;
  }
  .tabs-list { display: flex; gap: .5rem; border-bottom: 1px solid #ccc; margin-bottom: 1rem; }
</style>
