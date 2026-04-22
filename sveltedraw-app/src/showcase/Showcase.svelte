<script lang="ts">
  import { Popover, DropdownMenu as BitsDropdownMenu, Tabs } from "bits-ui";
  import {
    // Primitives
    Spinner,
    ButtonSeparator,
    LoadingMessage,
    InlineIcon,
    // Layout
    Island,
    StackRow,
    StackCol,
    Card,
    Paragraph,
    Ellipsify,
    Section,
    FixedSideContainer,
    ScrollableList,
    // Buttons
    Button,
    ButtonIcon,
    FilledButton,
    ToolButton,
    LinkButton,
    HelpButton,
    DialogActionButton,
    DarkModeToggle,
    // Toggles / inputs
    Switch,
    Range,
    TextField,
    CheckboxItem,
    RadioGroup,
    RadioSelection,
    QuickSearch,
    // Toolbar buttons
    PenModeButton,
    LockButton,
    HandButton,
    LaserPointerButton,
    // Overlays
    Modal,
    Toast,
    Tooltip,
    Popover as PopoverComp,
    // Dropdown menu
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuGroup,
    // Dialogs
    Dialog,
    ConfirmDialog,
    ErrorDialog,
    // Misc
    Avatar,
    ExcalidrawLogo,
    FollowMode,
    Collapsible,
    // Icons
    Icon,
  } from "@sveltedraw/excalidraw";

  // State
  let switchValue = $state(false);
  let rangeValue = $state(50);
  let textValue = $state("");
  let redactedValue = $state("secret");
  let checkboxValue = $state(true);
  let radioValue = $state<"a" | "b" | "c">("b");
  let radioSelectionValue = $state<"a" | "b">("a");
  let penMode = $state(false);
  let lockActive = $state(false);
  let handActive = $state(false);
  let laserActive = $state(false);
  let modalOpen = $state(false);
  let dialogOpen = $state(false);
  let confirmOpen = $state(false);
  let errorOpen = $state(false);
  let toastMessage: string | null = $state(null);
  let dropdownOpen = $state(false);
  let collapsibleOpen = $state(true);
  let theme = $state<"light" | "dark">("light");
  let searchTerm = $state("");

  // Active section (hash-routed)
  let section = $state<string>("primitives");
  $effect(() => {
    const fromHash = window.location.hash.replace(/^#showcase\//, "");
    if (fromHash && fromHash !== "showcase") section = fromHash;
    const onHash = () => {
      const h = window.location.hash.replace(/^#showcase\//, "");
      if (h && h !== "showcase") section = h;
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  });

  const CATEGORIES = [
    { id: "primitives", label: "Primitives" },
    { id: "layout", label: "Layout" },
    { id: "buttons", label: "Buttons" },
    { id: "inputs", label: "Inputs" },
    { id: "toolbar", label: "Toolbar" },
    { id: "overlays", label: "Overlays" },
    { id: "dropdown", label: "Dropdown menu" },
    { id: "dialogs", label: "Dialogs" },
    { id: "misc", label: "Misc" },
    { id: "icons", label: "Icons" },
    { id: "bitsui", label: "bits-ui" },
  ];

  // A handful of commonly used icon names to demo the sprite wrapper.
  const ICON_SAMPLES = [
    "PlusIcon",
    "CloseIcon",
    "LibraryIcon",
    "TrashIcon",
    "MoonIcon",
    "SunIcon",
    "LockedIcon",
    "UnlockedIcon",
    "HelpIcon",
    "RectangleIcon",
    "EllipseIcon",
    "ArrowIcon",
    "LineIcon",
    "TextIcon",
    "EraserIcon",
    "ImageIcon",
    "DuplicateIcon",
    "ExportIcon",
    "ZoomInIcon",
    "ZoomOutIcon",
    "UndoIcon",
    "RedoIcon",
    "handIcon",
    "PinIcon",
    "GithubIcon",
    "DiscordIcon",
    "XBrandIcon",
    "LinkIcon",
    "copyIcon",
    "cutIcon",
  ];

  function go(id: string) {
    window.location.hash = `#showcase/${id}`;
    section = id;
  }
</script>

<div class="showcase excalidraw" class:theme--dark={theme === "dark"}>
  <aside class="showcase__sidebar">
    <header>
      <strong>Sveltedraw</strong>
      <span class="showcase__tag">Svelte 5 port</span>
    </header>
    <nav>
      {#each CATEGORIES as cat (cat.id)}
        <button
          type="button"
          class="showcase__nav-item"
          class:active={section === cat.id}
          onclick={() => go(cat.id)}
        >
          {cat.label}
        </button>
      {/each}
    </nav>
    <footer>
      <label class="showcase__theme">
        <input
          type="checkbox"
          checked={theme === "dark"}
          onchange={(e) =>
            (theme = (e.currentTarget as HTMLInputElement).checked
              ? "dark"
              : "light")}
        />
        <span>Dark theme</span>
      </label>
    </footer>
  </aside>

  <main class="showcase__main">
    {#if section === "primitives"}
      <h1>Primitives</h1>

      <div class="demo">
        <h2>Spinner</h2>
        <div class="row"><Spinner /><Spinner /><Spinner /></div>
      </div>

      <div class="demo">
        <h2>LoadingMessage</h2>
        <div class="frame"><LoadingMessage /></div>
        <div class="frame"><LoadingMessage delay={500} /></div>
      </div>

      <div class="demo">
        <h2>InlineIcon</h2>
        <p>
          Text with
          {#snippet dot()}
            <svg viewBox="0 0 16 16" width="1em" height="1em">
              <circle cx="8" cy="8" r="7" fill="currentColor" />
            </svg>
          {/snippet}
          <InlineIcon icon={dot} />
          inline icon.
        </p>
      </div>

      <div class="demo">
        <h2>ButtonSeparator</h2>
        <div class="row">
          <span>A</span><ButtonSeparator /><span>B</span
          ><ButtonSeparator /><span>C</span>
        </div>
      </div>

      <div class="demo">
        <h2>ExcalidrawLogo</h2>
        <ExcalidrawLogo withText size="normal" />
      </div>

      <div class="demo">
        <h2>Ellipsify &amp; Paragraph</h2>
        <Paragraph>
          {#snippet children()}
            This is a paragraph component demonstrating normal prose.
          {/snippet}
        </Paragraph>
        <div style="width: 200px; border: 1px solid var(--default-border-color); padding: 4px;">
          <Ellipsify>
            {#snippet children()}
              Very long text that should be truncated with ellipsis
            {/snippet}
          </Ellipsify>
        </div>
      </div>
    {:else if section === "layout"}
      <h1>Layout</h1>

      <div class="demo">
        <h2>Island</h2>
        <Island padding={2}>
          {#snippet children()}<p>Island contents with padding=2.</p>{/snippet}
        </Island>
      </div>

      <div class="demo">
        <h2>Stack (Row + Col)</h2>
        <Island padding={2}>
          {#snippet children()}
            <StackRow gap={1}>
              {#snippet children()}
                <span>Row 1</span><span>Row 2</span><span>Row 3</span>
              {/snippet}
            </StackRow>
            <StackCol gap={1}>
              {#snippet children()}
                <span>Col 1</span><span>Col 2</span>
              {/snippet}
            </StackCol>
          {/snippet}
        </Island>
      </div>

      <div class="demo">
        <h2>Card</h2>
        <Card color="primary">
          {#snippet children()}
            <p style="padding: .5rem;">Card content</p>
          {/snippet}
        </Card>
      </div>

      <div class="demo">
        <h2>Section + ScrollableList</h2>
        <Section heading="canvasActions" headingText="Demo section">
          {#snippet children()}
            <ScrollableList placeholder="empty" isEmpty={false}>
              {#snippet children()}
                <div>Item A</div>
                <div>Item B</div>
                <div>Item C</div>
              {/snippet}
            </ScrollableList>
          {/snippet}
        </Section>
      </div>

      <div class="demo">
        <h2>FixedSideContainer</h2>
        <div class="frame" style="position: relative; height: 80px; border: 1px dashed #ccc;">
          <FixedSideContainer side="top">
            {#snippet children()}<span>pinned to top</span>{/snippet}
          </FixedSideContainer>
        </div>
      </div>
    {:else if section === "buttons"}
      <h1>Buttons</h1>

      <div class="demo">
        <h2>Button</h2>
        <div class="row">
          <Button onSelect={() => alert("clicked!")}>
            {#snippet children()}Click me{/snippet}
          </Button>
          <Button onSelect={() => {}} selected>
            {#snippet children()}Selected{/snippet}
          </Button>
        </div>
      </div>

      <div class="demo">
        <h2>FilledButton</h2>
        <div class="row">
          <FilledButton label="Primary" onclick={() => {}} />
          <FilledButton label="Danger" color="danger" onclick={() => {}} />
          <FilledButton
            label="Outlined"
            variant="outlined"
            color="muted"
            onclick={() => {}}
          />
          <FilledButton label="With icon" iconName="PlusIcon" onclick={() => {}} />
        </div>
      </div>

      <div class="demo">
        <h2>ButtonIcon</h2>
        <div class="row">
          {#snippet btnIcon()}<Icon name="PlusIcon" />{/snippet}
          <ButtonIcon
            icon={btnIcon}
            title="Plus"
            standalone
            onclick={() => {}}
          />
        </div>
      </div>

      <div class="demo">
        <h2>ToolButton (icon)</h2>
        <div class="row">
          <ToolButton
            type="button"
            aria-label="Plus"
            title="Plus"
            onclick={() => {}}
          >
            {#snippet icon()}<Icon name="PlusIcon" />{/snippet}
          </ToolButton>
          <ToolButton
            type="icon"
            aria-label="Duplicate"
            title="Duplicate"
            selected
            onclick={() => {}}
          >
            {#snippet icon()}<Icon name="DuplicateIcon" />{/snippet}
          </ToolButton>
        </div>
      </div>

      <div class="demo">
        <h2>LinkButton &amp; HelpButton</h2>
        <div class="row">
          <LinkButton href="https://excalidraw.com">
            {#snippet children()}Open excalidraw.com{/snippet}
          </LinkButton>
          <HelpButton onclick={() => alert("help")} />
        </div>
      </div>

      <div class="demo">
        <h2>DialogActionButton</h2>
        <div class="row">
          <DialogActionButton label="Primary" onclick={() => {}} />
          <DialogActionButton
            label="Danger"
            actionType="danger"
            onclick={() => {}}
          />
          <DialogActionButton label="Loading" isLoading onclick={() => {}} />
        </div>
      </div>

      <div class="demo">
        <h2>DarkModeToggle</h2>
        <DarkModeToggle
          value={theme}
          onChange={(v) => (theme = v)}
        />
      </div>
    {:else if section === "inputs"}
      <h1>Inputs</h1>

      <div class="demo">
        <h2>Switch</h2>
        <Switch
          name="showcase-switch"
          checked={switchValue}
          onChange={(v) => (switchValue = v)}
        />
        <code>value: {switchValue}</code>
      </div>

      <div class="demo">
        <h2>Range</h2>
        <Range
          label="Opacity"
          value={rangeValue}
          onChange={(v) => (rangeValue = v)}
          min={0}
          max={100}
        />
        <code>value: {rangeValue}</code>
      </div>

      <div class="demo">
        <h2>TextField</h2>
        <TextField
          value={textValue}
          onChange={(v) => (textValue = v)}
          placeholder="Type here..."
        />
        <code>value: {textValue}</code>
        <br /><br />
        <TextField
          value={redactedValue}
          onChange={(v) => (redactedValue = v)}
          isRedacted
          label="Password"
        />
      </div>

      <div class="demo">
        <h2>CheckboxItem</h2>
        <CheckboxItem
          checked={checkboxValue}
          onChange={(c) => (checkboxValue = c)}
        >
          {#snippet children()}Enable thing{/snippet}
        </CheckboxItem>
      </div>

      <div class="demo">
        <h2>RadioGroup</h2>
        <RadioGroup
          name="rg-demo"
          value={radioValue}
          onChange={(v) => (radioValue = v as "a" | "b" | "c")}
          choices={[
            { value: "a", label: "Option A" },
            { value: "b", label: "Option B" },
            { value: "c", label: "Option C" },
          ]}
        />
      </div>

      <div class="demo">
        <h2>RadioSelection</h2>
        {#snippet iconA()}<Icon name="RectangleIcon" />{/snippet}
        {#snippet iconB()}<Icon name="EllipseIcon" />{/snippet}
        <RadioSelection
          type="radio"
          group="rs-demo"
          value={radioSelectionValue}
          onChange={(v) => (radioSelectionValue = v)}
          options={[
            { value: "a" as const, text: "Rectangle", icon: iconA },
            { value: "b" as const, text: "Ellipse", icon: iconB },
          ]}
        />
      </div>

      <div class="demo">
        <h2>QuickSearch</h2>
        <QuickSearch
          placeholder="Search..."
          onChange={(v) => (searchTerm = v)}
        />
        <code>term: "{searchTerm}"</code>
      </div>
    {:else if section === "toolbar"}
      <h1>Toolbar buttons</h1>

      <div class="demo">
        <h2>PenModeButton</h2>
        <PenModeButton
          checked={penMode}
          onChange={() => (penMode = !penMode)}
          title="Pen mode"
          penDetected
        />
      </div>

      <div class="demo">
        <h2>LockButton</h2>
        <LockButton
          checked={lockActive}
          onChange={() => (lockActive = !lockActive)}
          title="Lock"
        />
      </div>

      <div class="demo">
        <h2>HandButton</h2>
        <HandButton
          checked={handActive}
          onChange={() => (handActive = !handActive)}
          title="Hand"
        />
      </div>

      <div class="demo">
        <h2>LaserPointerButton</h2>
        <LaserPointerButton
          checked={laserActive}
          onChange={() => (laserActive = !laserActive)}
          title="Laser pointer"
        />
      </div>
    {:else if section === "overlays"}
      <h1>Overlays</h1>

      <div class="demo">
        <h2>Tooltip</h2>
        <Tooltip label="This is a tooltip">
          {#snippet children()}
            <span style="text-decoration: underline; cursor: default;"
              >Hover me</span
            >
          {/snippet}
        </Tooltip>
      </div>

      <div class="demo">
        <h2>Modal</h2>
        <Button onSelect={() => (modalOpen = true)}>
          {#snippet children()}Open Modal{/snippet}
        </Button>
        {#if modalOpen}
          <Modal
            onCloseRequest={() => (modalOpen = false)}
            labelledBy="demo-modal-title"
            maxWidth={500}
          >
            <div
              style="padding: 1.5rem; background: white; border-radius: 8px;"
            >
              <h3 id="demo-modal-title">Hello from Svelte Modal</h3>
              <p>Click the background or press ESC to close.</p>
              <Button onSelect={() => (modalOpen = false)}>
                {#snippet children()}Close{/snippet}
              </Button>
            </div>
          </Modal>
        {/if}
      </div>

      <div class="demo">
        <h2>Toast</h2>
        <Button
          onSelect={() =>
            (toastMessage = `Saved at ${new Date().toLocaleTimeString()}`)}
        >
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
      </div>
    {:else if section === "dropdown"}
      <h1>Dropdown menu</h1>

      <div class="demo">
        <h2>DropdownMenu (click to open)</h2>
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
                  onSelect={() => console.log("open project")}
                  shortcut="⌘O"
                >
                  {#snippet children()}Open project{/snippet}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => console.log("save")}
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
      </div>
    {:else if section === "dialogs"}
      <h1>Dialogs</h1>

      <div class="demo">
        <h2>Dialog</h2>
        <Button onSelect={() => (dialogOpen = true)}>
          {#snippet children()}Open Dialog{/snippet}
        </Button>
        {#if dialogOpen}
          <Dialog
            onCloseRequest={() => (dialogOpen = false)}
            title="Demo dialog"
            size="small"
          >
            <p>Dialog content goes here.</p>
            <DialogActionButton
              label="OK"
              onclick={() => (dialogOpen = false)}
            />
          </Dialog>
        {/if}
      </div>

      <div class="demo">
        <h2>ConfirmDialog</h2>
        <Button onSelect={() => (confirmOpen = true)}>
          {#snippet children()}Open ConfirmDialog{/snippet}
        </Button>
        {#if confirmOpen}
          <ConfirmDialog
            title="Are you sure?"
            onConfirm={() => (confirmOpen = false)}
            onCancel={() => (confirmOpen = false)}
          >
            {#snippet children()}
              <p>This action cannot be undone.</p>
            {/snippet}
          </ConfirmDialog>
        {/if}
      </div>

      <div class="demo">
        <h2>ErrorDialog</h2>
        <Button onSelect={() => (errorOpen = true)}>
          {#snippet children()}Trigger ErrorDialog{/snippet}
        </Button>
        {#if errorOpen}
          <ErrorDialog onClose={() => (errorOpen = false)}>
            {#snippet children()}
              Something went wrong.
            {/snippet}
          </ErrorDialog>
        {/if}
      </div>
    {:else if section === "misc"}
      <h1>Misc</h1>

      <div class="demo">
        <h2>Avatar</h2>
        <div class="row">
          <Avatar color="#5f8ec7" name="Alice" onclick={() => {}} />
          <Avatar color="#e03131" name="Bob" onclick={() => {}} />
          <Avatar color="#2b8a3e" name="Carol" onclick={() => {}} />
        </div>
      </div>

      <div class="demo">
        <h2>Collapsible</h2>
        <Island padding={2}>
          {#snippet children()}
            <Collapsible
              label="Toggle me"
              open={collapsibleOpen}
              openTrigger={() => (collapsibleOpen = !collapsibleOpen)}
            >
              {#snippet children()}
                <p>Body content revealed when open.</p>
              {/snippet}
            </Collapsible>
          {/snippet}
        </Island>
      </div>

      <div class="demo">
        <h2>FollowMode</h2>
        <div class="frame" style="position: relative; height: 80px;">
          <FollowMode
            username="alice"
            width={280}
            height={80}
            onDisconnect={() => {}}
          />
        </div>
      </div>
    {:else if section === "icons"}
      <h1>Icons (179 static + 18 dynamic)</h1>
      <p class="muted">
        Use <code>&lt;Icon name="X" /&gt;</code> to render any codegen'd icon.
        Samples below — there are hundreds more.
      </p>
      <div class="icon-grid">
        {#each ICON_SAMPLES as name (name)}
          <div class="icon-cell" title={name}>
            <div class="icon-cell__icon">
              <Icon {name} />
            </div>
            <div class="icon-cell__label">{name}</div>
          </div>
        {/each}
      </div>
    {:else if section === "bitsui"}
      <h1>bits-ui primitives</h1>

      <div class="demo">
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
      </div>

      <div class="demo">
        <h2>DropdownMenu</h2>
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
      </div>

      <div class="demo">
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
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body) {
    background: #fafafa;
  }

  .showcase {
    display: grid;
    grid-template-columns: 220px 1fr;
    min-height: 100vh;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #222;
  }

  .showcase.theme--dark :global(*) {
    --accent: #a5d8ff;
  }
  .showcase.theme--dark {
    background: #121212;
    color: #ced4da;
  }

  .showcase__sidebar {
    background: #fff;
    border-right: 1px solid #e9ecef;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  .showcase.theme--dark .showcase__sidebar {
    background: #1e1e1e;
    border-right-color: #343a40;
  }

  .showcase__sidebar header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 0.5rem 1rem;
    border-bottom: 1px solid #e9ecef;
    margin-bottom: 0.75rem;
  }
  .showcase.theme--dark .showcase__sidebar header {
    border-bottom-color: #343a40;
  }

  .showcase__tag {
    font-size: 0.7rem;
    color: #868e96;
  }

  .showcase__sidebar nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .showcase__nav-item {
    text-align: left;
    background: transparent;
    border: 0;
    padding: 0.45rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    color: inherit;
    font-family: inherit;
  }
  .showcase__nav-item:hover {
    background: #f1f3f5;
  }
  .showcase.theme--dark .showcase__nav-item:hover {
    background: #2a2a2a;
  }
  .showcase__nav-item.active {
    background: #e7f5ff;
    color: #1971c2;
    font-weight: 500;
  }
  .showcase.theme--dark .showcase__nav-item.active {
    background: #1c3a5e;
    color: #a5d8ff;
  }

  .showcase__sidebar footer {
    margin-top: auto;
    padding-top: 0.75rem;
    border-top: 1px solid #e9ecef;
    font-size: 0.8rem;
  }
  .showcase.theme--dark .showcase__sidebar footer {
    border-top-color: #343a40;
  }
  .showcase__theme {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
  }

  .showcase__main {
    padding: 2rem 3rem;
    max-width: 1000px;
  }

  .showcase__main h1 {
    margin: 0 0 1.5rem;
    font-size: 1.5rem;
    border-bottom: 1px solid #e9ecef;
    padding-bottom: 0.75rem;
  }
  .showcase.theme--dark .showcase__main h1 {
    border-bottom-color: #343a40;
  }

  .showcase__main h2 {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #495057;
  }
  .showcase.theme--dark .showcase__main h2 {
    color: #adb5bd;
  }

  .demo {
    background: #fff;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 1.25rem;
    margin-bottom: 1.25rem;
  }
  .showcase.theme--dark .demo {
    background: #1e1e1e;
    border-color: #343a40;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .frame {
    margin-top: 0.5rem;
    background: #f8f9fa;
    border-radius: 6px;
    padding: 0.5rem;
  }
  .showcase.theme--dark .frame {
    background: #2a2a2a;
  }

  .muted {
    color: #868e96;
    font-size: 0.875rem;
  }

  code {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    background: #f1f3f5;
    font-size: 0.8rem;
  }
  .showcase.theme--dark code {
    background: #2a2a2a;
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 0.5rem;
  }
  .icon-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 0.25rem;
    background: #fff;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    font-size: 0.7rem;
    color: #495057;
    overflow: hidden;
  }
  .showcase.theme--dark .icon-cell {
    background: #1e1e1e;
    border-color: #343a40;
    color: #adb5bd;
  }
  .icon-cell__icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-cell__icon :global(svg) {
    width: 100%;
    height: 100%;
  }
  .icon-cell__label {
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    width: 100%;
    text-align: center;
  }

  .popover-content,
  .menu-content {
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 50;
  }
  .tabs-list {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid #ccc;
    margin-bottom: 1rem;
  }
</style>
